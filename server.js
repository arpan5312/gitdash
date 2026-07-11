require('dotenv').config();
const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require("@google/genai");

const PORT = 5000;
const REPOS_DIR = path.resolve('./repos');

// Initialize Gemini SDK via environment variables
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

if (!fs.existsSync(REPOS_DIR)) { fs.mkdirSync(REPOS_DIR); }

function runCommand(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { cwd, shell: false });
        let stdout = '';
        let stderr = '';
        let finished = false;

        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            child.kill();
            reject(new Error('Process execution timed out'));
        }, 45000);

        child.stdout.on('data', chunk => { if (!finished) stdout += chunk.toString(); });
        child.stderr.on('data', chunk => { if (!finished) stderr += chunk.toString(); });

        child.on('close', code => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (code !== 0) reject(new Error(stderr.trim() || `Exited with code ${code}`));
            else resolve(stdout);
        });

        child.on('error', err => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            reject(err);
        });
    });
}

function processCommitCoupling(files, metrics) {
    if (files.length < 2) return;
    files.forEach(a => {
        if (!metrics[a]) return;
        files.forEach(b => {
            if (a !== b) {
                metrics[a].co_changes[b] = (metrics[a].co_changes[b] || 0) + 1;
            }
        });
    });
}

function getSafeRepoPath(repoId) {
    if (!/^[a-f0-9]{12}$/.test(repoId)) throw new Error('Malformed repository ID');
    return path.join(REPOS_DIR, repoId);
}

function median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mad(values, med) {
    return median(values.map(v => Math.abs(v - med)));
}

function robustZ(value, med, madValue) {
    return (value - med) / (1.4826 * madValue + 1e-6);
}

function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

const DOC_EXTENSIONS = ['.md', '.txt', '.rst', '.adoc', 'LICENSE', 'NOTICE'];
const INFRA_FILES = ['Dockerfile', 'Makefile', 'Jenkinsfile', 'docker-compose.yml', 'package.json', 'go.mod', 'Cargo.toml'];

function isDocumentation(filePath) {
    const fileName = path.basename(filePath);
    return DOC_EXTENSIONS.some(ext => filePath.endsWith(ext) || fileName === ext);
}

function classifyComponent(filePath) {
    const fileName = path.basename(filePath);
    if (isDocumentation(filePath)) return 'documentation';
    if (INFRA_FILES.includes(fileName)) return 'infrastructure';
    if (filePath.startsWith('.github/')) return 'pipeline';
    if (filePath.includes('test') || filePath.startsWith('tests/')) return 'testing';
    return 'source_code';
}

const RISK_STEEPNESS = 1.15;
const RISK_OFFSET = 0.55;

function scoreRepository(rawNodes) {
    const docNodes = rawNodes.filter(n => isDocumentation(n.id));
    const scorable = rawNodes.filter(n => !isDocumentation(n.id));

    const derived = scorable.map(node => {
        const couplingDensity = node.historical_coupling_score / Math.max(node.commit_frequency, 1);
        return {
            node,
            churn: Math.log1p(node.commit_frequency),
            authors: Math.log1p(node.author_count),
            density: Math.log1p(couplingDensity)
        };
    });

    const churnVals = derived.map(d => d.churn);
    const authorVals = derived.map(d => d.authors);
    const densityVals = derived.map(d => d.density);

    const churnMed = median(churnVals), churnMad = mad(churnVals, churnMed);
    const authorMed = median(authorVals), authorMad = mad(authorVals, authorMed);
    const densityMed = median(densityVals), densityMad = mad(densityVals, densityMed);

    const finalizedNodes = derived.map(({ node, churn, authors, density }) => {
        const zChurn = robustZ(churn, churnMed, churnMad);
        const zAuthors = robustZ(authors, authorMed, authorMad);
        const zDensity = robustZ(density, densityMed, densityMad);

        const entanglement = Math.max(0, zChurn) * Math.max(0, zDensity);
        const stabilityReward = (1 - node.stability_ratio) * sigmoid(zChurn);

        const rawScore =
              0.35 * zChurn
            + 0.25 * zDensity
            + 0.15 * zAuthors
            + 0.15 * node.knowledge_concentration
            + 0.10 * entanglement
            - 0.20 * stabilityReward;

        const structuralRisk = sigmoid(RISK_STEEPNESS * (rawScore - RISK_OFFSET));
        const componentType = classifyComponent(node.id);

        let tag = 'stable_component';
        if (componentType === 'infrastructure' || componentType === 'pipeline') {
            tag = structuralRisk > 0.7 ? 'volatile_config_bottleneck' : 'stable_environment';
        } else if (componentType === 'testing') {
            tag = structuralRisk > 0.7 ? 'high_test_churn' : 'stable_test_suite';
        } else {
            if (structuralRisk > 0.8) tag = 'refactor_decay_hotspot';
            else if (node.historical_coupling_score > 10 && node.author_count > 4) tag = 'shared_bottleneck';
            else if (node.stability_ratio < 0.15 && node.commit_frequency > 5) tag = 'active_feature_growth';
        }

        return {
            id: node.id,
            component_type: componentType,
            lines_of_code: node.lines_of_code,
            commit_frequency: node.commit_frequency,
            author_count: node.author_count,
            historical_coupling_score: node.historical_coupling_score,
            knowledge_owner: node.knowledge_owner,
            bus_factor: node.bus_factor,
            knowledge_concentration: node.knowledge_concentration,
            behavioral_tag: tag,
            structural_risk_index: parseFloat(structuralRisk.toFixed(2))
        };
    });

    docNodes.forEach(node => {
        const flatRisk = Math.min(0.3, Math.log1p(node.commit_frequency) / 20);
        finalizedNodes.push({
            id: node.id,
            component_type: 'documentation',
            lines_of_code: node.lines_of_code,
            commit_frequency: node.commit_frequency,
            author_count: node.author_count,
            historical_coupling_score: node.historical_coupling_score,
            knowledge_owner: node.knowledge_owner,
            bus_factor: node.bus_factor,
            knowledge_concentration: node.knowledge_concentration,
            behavioral_tag: flatRisk > 0.2 ? 'documentation_hotspot' : 'stable_docs',
            structural_risk_index: parseFloat(flatRisk.toFixed(2))
        });
    });

    return finalizedNodes;
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'POST' && parsedUrl.pathname === '/api/analyze') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { url: repoUrl } = JSON.parse(body);
                if (!repoUrl || !repoUrl.startsWith('https://github.com/')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Invalid GitHub URL.' }));
                }

                const uniqueId = crypto.createHash('sha256').update(repoUrl).digest('hex').substring(0, 12);
                const targetPath = path.join(REPOS_DIR, uniqueId);

                if (fs.existsSync(targetPath)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ status: 'success', repo_id: uniqueId }));
                }

                console.log(`[EXEC] Running non-blocking clone for: ${repoUrl}`);
                await runCommand('git', ['clone', '--depth', '100', repoUrl, targetPath]);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ status: 'success', repo_id: uniqueId }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Ingestion failed', details: e.message }));
            }
        });
    }

    else if (req.method === 'GET' && parsedUrl.pathname === '/api/metrics') {
        try {
            const repoId = parsedUrl.searchParams.get('id');
            const targetPath = getSafeRepoPath(repoId);

            if (!fs.existsSync(targetPath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Repository not found.' }));
            }

            console.log(`[EXEC] Scraping commit streams for token: ${repoId}`);
            const logDump = await runCommand('git', ['-C', targetPath, 'log', '--numstat', '--pretty=format:COMMIT|%an']);

            const fileMetrics = {};
            const lines = logDump.split('\n');
            let currentAuthor = 'Unknown';
            let filesInCurrentCommit = [];

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;

                if (trimmed.startsWith('COMMIT|')) {
                    processCommitCoupling(filesInCurrentCommit, fileMetrics);
                    filesInCurrentCommit = [];
                    currentAuthor = trimmed.split('|')[1] || 'Unknown';
                    return;
                }

                const parts = trimmed.split(/\s+/);
                if (parts.length === 3) {
                    if (parts[0] === '-' || parts[1] === '-') return;

                    const added = parseInt(parts[0], 10) || 0;
                    const deleted = parseInt(parts[1], 10) || 0;
                    const filePath = parts[2];

                    if (filePath.includes('.git/') || filePath.endsWith('lock.json')) return;

                    if (!fileMetrics[filePath]) {
                        fileMetrics[filePath] = {
                            additions: 0,
                            deletions: 0,
                            commit_frequency: 0,
                            authors: {},
                            co_changes: {}
                        };
                    }

                    const metrics = fileMetrics[filePath];
                    metrics.additions += added;
                    metrics.deletions += deleted;
                    metrics.commit_frequency += 1;
                    metrics.authors[currentAuthor] = (metrics.authors[currentAuthor] || 0) + (added + deleted);
                    filesInCurrentCommit.push(filePath);
                }
            });

            processCommitCoupling(filesInCurrentCommit, fileMetrics);

            const rawNodes = [];
            const validTrackedFiles = new Set();

            Object.keys(fileMetrics).forEach(filePath => {
                const absolutePath = path.join(targetPath, filePath);

                try {
                    const stats = fs.statSync(absolutePath);
                    if (!stats.isFile() || stats.size > 1024 * 1024) return;

                    const content = fs.readFileSync(absolutePath, 'utf8');
                    const loc = content.split('\n').length;

                    const metrics = fileMetrics[filePath];
                    const totalMutations = metrics.additions + metrics.deletions;
                    const stabilityRatio = metrics.deletions / (totalMutations || 1);
                    const authorCount = Object.keys(metrics.authors).length;

                    let topAuthor = 'Unknown';
                    let maxAuthorImpact = 0;
                    Object.entries(metrics.authors).forEach(([author, linesTouched]) => {
                        if (linesTouched > maxAuthorImpact) {
                            maxAuthorImpact = linesTouched;
                            topAuthor = author;
                        }
                    });

                    const knowledgeConcentration = maxAuthorImpact / (totalMutations || 1);
                    const busFactor = (knowledgeConcentration > 0.8 && metrics.commit_frequency > 5) ? 1 : authorCount;

                    validTrackedFiles.add(filePath);
                    rawNodes.push({
                        id: filePath,
                        lines_of_code: loc,
                        commit_frequency: metrics.commit_frequency,
                        author_count: authorCount,
                        historical_coupling_score: Object.keys(metrics.co_changes).length,
                        stability_ratio: stabilityRatio,
                        knowledge_owner: topAuthor,
                        bus_factor: busFactor,
                        knowledge_concentration: parseFloat(knowledgeConcentration.toFixed(2))
                    });
                } catch (e) {
                    // Silent fail safe drop for deleted file tracks
                }
            });

            if (rawNodes.length === 0) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ status: 'success', repo_id: repoId, nodes: [], links: [] }));
            }

            const finalizedNodes = scoreRepository(rawNodes);

            const links = [];
            const seenNetworkEdges = new Set();

            for (const [file, metrics] of Object.entries(fileMetrics)) {
                if (!validTrackedFiles.has(file)) continue;

                for (const [related, count] of Object.entries(metrics.co_changes)) {
                    if (!validTrackedFiles.has(related) || file === related) continue;

                    const edgeTokenKey = [file, related].sort().join('|');

                    if (seenNetworkEdges.has(edgeTokenKey)) continue;
                    seenNetworkEdges.add(edgeTokenKey);

                    links.push({
                        source: file,
                        target: related,
                        weight: count
                    });
                }
            }

            const targetNodeCount = Math.max(1, Math.ceil(finalizedNodes.length * 0.2));
            const topCoupledNodes = [...finalizedNodes]
                .sort((a, b) => b.historical_coupling_score - a.historical_coupling_score)
                .slice(0, targetNodeCount);

            const topCoupledIds = new Set(topCoupledNodes.map(n => n.id));

            const prunedNodes = finalizedNodes.filter(node => {
                const isHighRisk = node.structural_risk_index > 0.7;
                const isTopCoupled = topCoupledIds.has(node.id);
                const isCriticalBusFactor = node.bus_factor === 1;
                const isCoreComponent = node.component_type === 'infrastructure' || node.component_type === 'pipeline';
                const hasVolatileTag = [
                    'refactor_decay_hotspot',
                    'shared_bottleneck',
                    'volatile_config_bottleneck'
                ].includes(node.behavioral_tag);

                return isHighRisk || isTopCoupled || isCriticalBusFactor || isCoreComponent || hasVolatileTag;
            });

            const survivingNodeIds = new Set(prunedNodes.map(n => n.id));

            const validLinks = links.filter(link => 
                survivingNodeIds.has(link.source) && survivingNodeIds.has(link.target)
            );

            const targetEdgeCount = Math.max(1, Math.ceil(validLinks.length * 0.15));
            const prunedLinks = [...validLinks]
                .sort((a, b) => b.weight - a.weight)
                .slice(0, targetEdgeCount);

            const connectedNodeIds = new Set();
            prunedLinks.forEach(link => {
                connectedNodeIds.add(link.source);
                connectedNodeIds.add(link.target);
            });

            const finalNodes = prunedNodes.filter(
                node => connectedNodeIds.has(node.id)
            );

            finalNodes.sort((a, b) => b.structural_risk_index - a.structural_risk_index);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                status: 'success',
                repo_id: repoId,
                nodes: finalNodes,
                links: prunedLinks
            }));
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: err.message }));
        }
    }

    else if (req.method === 'GET' && parsedUrl.pathname === '/api/repository-summary') {
        try {
            const repoId = parsedUrl.searchParams.get('id');
            const targetPath = getSafeRepoPath(repoId);

            if (!fs.existsSync(targetPath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Repository not found.' }));
            }

            console.log(`[EXEC] Scraping summary streams for token: ${repoId}`);
            const logDump = await runCommand('git', ['-C', targetPath, 'log', '--numstat', '--pretty=format:COMMIT|%an']);

            const fileMetrics = {};
            const lines = logDump.split('\n');
            let currentAuthor = 'Unknown';
            let filesInCurrentCommit = [];

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;

                if (trimmed.startsWith('COMMIT|')) {
                    processCommitCoupling(filesInCurrentCommit, fileMetrics);
                    filesInCurrentCommit = [];
                    currentAuthor = trimmed.split('|')[1] || 'Unknown';
                    return;
                }

                const parts = trimmed.split(/\s+/);
                if (parts.length === 3) {
                    if (parts[0] === '-' || parts[1] === '-') return;

                    const added = parseInt(parts[0], 10) || 0;
                    const deleted = parseInt(parts[1], 10) || 0;
                    const filePath = parts[2];

                    if (filePath.includes('.git/') || filePath.endsWith('lock.json')) return;

                    if (!fileMetrics[filePath]) {
                        fileMetrics[filePath] = {
                            additions: 0,
                            deletions: 0,
                            commit_frequency: 0,
                            authors: {},
                            co_changes: {}
                        };
                    }

                    const metrics = fileMetrics[filePath];
                    metrics.additions += added;
                    metrics.deletions += deleted;
                    metrics.commit_frequency += 1;
                    metrics.authors[currentAuthor] = (metrics.authors[currentAuthor] || 0) + (added + deleted);
                    filesInCurrentCommit.push(filePath);
                }
            });

            processCommitCoupling(filesInCurrentCommit, fileMetrics);

            const rawNodes = [];
            const validTrackedFiles = new Set();

            Object.keys(fileMetrics).forEach(filePath => {
                const absolutePath = path.join(targetPath, filePath);

                try {
                    const stats = fs.statSync(absolutePath);
                    if (!stats.isFile() || stats.size > 1024 * 1024) return;

                    const content = fs.readFileSync(absolutePath, 'utf8');
                    const loc = content.split('\n').length;

                    const metrics = fileMetrics[filePath];
                    const totalMutations = metrics.additions + metrics.deletions;
                    const stabilityRatio = metrics.deletions / (totalMutations || 1);
                    const authorCount = Object.keys(metrics.authors).length;

                    let topAuthor = 'Unknown';
                    let maxAuthorImpact = 0;
                    Object.entries(metrics.authors).forEach(([author, linesTouched]) => {
                        if (linesTouched > maxAuthorImpact) {
                            maxAuthorImpact = linesTouched;
                            topAuthor = author;
                        }
                    });

                    const knowledgeConcentration = maxAuthorImpact / (totalMutations || 1);
                    const busFactor = (knowledgeConcentration > 0.8 && metrics.commit_frequency > 5) ? 1 : authorCount;

                    validTrackedFiles.add(filePath);
                    rawNodes.push({
                        id: filePath,
                        lines_of_code: loc,
                        commit_frequency: metrics.commit_frequency,
                        author_count: authorCount,
                        historical_coupling_score: Object.keys(metrics.co_changes).length,
                        stability_ratio: stabilityRatio,
                        knowledge_owner: topAuthor,
                        bus_factor: busFactor,
                        knowledge_concentration: parseFloat(knowledgeConcentration.toFixed(2))
                    });
                } catch (e) {
                    // Silent fail safe drop for deleted file tracks
                }
            });

            if (rawNodes.length === 0) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ status: 'success', repo_id: repoId, nodes: [], links: [] }));
            }

            const finalizedNodes = scoreRepository(rawNodes);

            const links = [];
            const seenNetworkEdges = new Set();

            for (const [file, metrics] of Object.entries(fileMetrics)) {
                if (!validTrackedFiles.has(file)) continue;

                for (const [related, count] of Object.entries(metrics.co_changes)) {
                    if (!validTrackedFiles.has(related) || file === related) continue;

                    const edgeTokenKey = [file, related].sort().join('|');

                    if (seenNetworkEdges.has(edgeTokenKey)) continue;
                    seenNetworkEdges.add(edgeTokenKey);

                    links.push({
                        source: file,
                        target: related,
                        weight: count
                    });
                }
            }

            const targetNodeCount = Math.max(1, Math.ceil(finalizedNodes.length * 0.2));
            const topCoupledNodes = [...finalizedNodes]
                .sort((a, b) => b.historical_coupling_score - a.historical_coupling_score)
                .slice(0, targetNodeCount);

            const topCoupledIds = new Set(topCoupledNodes.map(n => n.id));

            const prunedNodes = finalizedNodes.filter(node => {
                const isHighRisk = node.structural_risk_index > 0.7;
                const isTopCoupled = topCoupledIds.has(node.id);
                const isCriticalBusFactor = node.bus_factor === 1;
                const isCoreComponent = node.component_type === 'infrastructure' || node.component_type === 'pipeline';
                const hasVolatileTag = [
                    'refactor_decay_hotspot',
                    'shared_bottleneck',
                    'volatile_config_bottleneck'
                ].includes(node.behavioral_tag);

                return isHighRisk || isTopCoupled || isCriticalBusFactor || isCoreComponent || hasVolatileTag;
            });

            const survivingNodeIds = new Set(prunedNodes.map(n => n.id));

            const validLinks = links.filter(link => 
                survivingNodeIds.has(link.source) && survivingNodeIds.has(link.target)
            );

            const targetEdgeCount = Math.max(1, Math.ceil(validLinks.length * 0.15));
            const prunedLinks = [...validLinks]
                .sort((a, b) => b.weight - a.weight)
                .slice(0, targetEdgeCount);

            const connectedNodeIds = new Set();
            prunedLinks.forEach(link => {
                connectedNodeIds.add(link.source);
                connectedNodeIds.add(link.target);
            });

            const finalNodes = prunedNodes.filter(
                node => connectedNodeIds.has(node.id)
            );

            const hotspots = finalNodes
                .filter(n => n.structural_risk_index > 0.8)
                .slice(0, 5)
                .map(n => ({
                    file: n.id,
                    risk: n.structural_risk_index,
                    tag: n.behavioral_tag
                }));

            const ownershipRisks = finalNodes
                .filter(n => n.bus_factor === 1)
                .slice(0, 5)
                .map(n => ({
                    file: n.id,
                    owner: n.knowledge_owner
                }));

            const bottlenecks = finalNodes
                .sort((a, b) => b.historical_coupling_score - a.historical_coupling_score)
                .slice(0, 5)
                .map(n => ({
                    file: n.id,
                    coupling: n.historical_coupling_score
                }));

            const volatileConfigs = finalNodes
                .filter(n => n.component_type === 'infrastructure' || n.component_type === 'pipeline')
                .map(n => ({
                    file: n.id
                }));

            const strongestRelationships = prunedLinks
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 5);

            const averageRisk = finalNodes.reduce((sum, node) => sum + node.structural_risk_index, 0) / Math.max(finalNodes.length, 1);
            const repositoryHealth = Math.round((1 - averageRisk) * 100);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                status: 'success',
                repo_id: repoId,
                repository_health: repositoryHealth,
                hotspots,
                ownership_risks: ownershipRisks,
                bottlenecks,
                volatile_configs: volatileConfigs,
                strongest_relationships: strongestRelationships
            }));
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: err.message }));
        }
    } 

    else if (req.method === 'GET' && parsedUrl.pathname === '/api/ai-summary') {
        try {
            const repoId = parsedUrl.searchParams.get('id');
            if (!repoId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Missing target repository ID parameter' }));
            }

            const summaryResponse = await fetch(
                `http://localhost:${PORT}/api/repository-summary?id=${repoId}`
            );
            
            if (!summaryResponse.ok) {
                const errData = await summaryResponse.json();
                throw new Error(errData.error || 'Failed to retrieve repository data mapping summary');
            }
            
            const summary = await summaryResponse.json();

            const prompt = `
You are a senior software architect.

Analyze this repository intelligence report.

Repository health score: ${summary.repository_health}

Hotspots: ${JSON.stringify(summary.hotspots, null, 2)}

Ownership risks: ${JSON.stringify(summary.ownership_risks, null, 2)}

Bottlenecks: ${JSON.stringify(summary.bottlenecks, null, 2)}

Strong relationships: ${JSON.stringify(summary.strongest_relationships, null, 2)}

Return:

1. Architecture overview.
2. Major engineering risks.
3. Technical debt hotspots.
4. Knowledge bottlenecks.
5. Refactoring recommendations.

Keep the answer concise and actionable.
`;

            const result = await genAI.models.generateContent({
                model: "gemini-3.5-flash",
                contents: prompt
            });
            const text = result.text;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                status: 'success',
                analysis: text
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'AI summary analysis generation pipeline crashed', details: err.message }));
        }
    }
    
    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Route not found' }));
    }
});

server.listen(PORT, () => console.log(`[SERVER] Graph Engine frozen on port ${PORT}...`));
