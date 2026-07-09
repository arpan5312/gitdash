const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const REPOS_DIR = path.resolve('./repos');

if (!fs.existsSync(REPOS_DIR)) { fs.mkdirSync(REPOS_DIR); }

// Secure Helper: Run OS process as an asynchronous stream promise with resource guard
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

// Bug Fix: Hardened process coupling to prevent runtime object crashes
function processCommitCoupling(files, metrics) {
    if (files.length < 2) return;
    files.forEach(a => {
        if (!metrics[a]) return; // Reference guard boundary
        files.forEach(b => {
            if (a !== b) {
                // Optimization: Track raw edge co-change frequencies via a map dictionary
                metrics[a].co_changes[b] = (metrics[a].co_changes[b] || 0) + 1;
            }
        });
    });
}

function getSafeRepoPath(repoId) {
    if (!/^[a-f0-9]{12}$/.test(repoId)) throw new Error('Malformed repository ID');
    return path.join(REPOS_DIR, repoId);
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

    // ROUTE 1: Ingest Repo Target
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
    
    // ROUTE 2: Structural Pipeline, Percentile Matrix Evaluation & Edge Topological Generation
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
                            co_changes: {} // Optimization: Set collection updated to dictionary tracking counter
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

            const getPercentile = (arr, val, key) => {
                const lowerCount = arr.filter(item => item[key] <= val).length;
                return lowerCount / arr.length;
            };

            const DOC_EXTENSIONS = ['.md', '.txt', '.rst', '.adoc', 'LICENSE', 'NOTICE'];
            const INFRA_FILES = ['Dockerfile', 'Makefile', 'Jenkinsfile', 'docker-compose.yml', 'package.json', 'go.mod', 'Cargo.toml'];
            const PIPELINE_EXTENSIONS = ['.yml', '.yaml', '.json'];

            const finalizedNodes = rawNodes.map(node => {
                const pFreq = getPercentile(rawNodes, node.commit_frequency, 'commit_frequency');
                const pAuthors = getPercentile(rawNodes, node.author_count, 'author_count');
                const pStability = getPercentile(rawNodes, node.stability_ratio, 'stability_ratio');
                const pCoupling = getPercentile(rawNodes, node.historical_coupling_score, 'historical_coupling_score');

                const compositeRisk = (pFreq * 0.3) + (pAuthors * 0.2) + (pStability * 0.4) + (pCoupling * 0.1);

                const fileName = path.basename(node.id);
                let componentType = 'source_code';
                let tag = 'stable_component';

                if (DOC_EXTENSIONS.some(ext => node.id.endsWith(ext) || fileName === ext)) {
                    componentType = 'documentation';
                } else if (INFRA_FILES.includes(fileName)) {
                    componentType = 'infrastructure';
                } else if (node.id.startsWith('.github/')) { // Optimization: Widened match scope covering infrastructure profiles
                    componentType = 'pipeline';
                } else if (node.id.includes('test') || node.id.startsWith('tests/')) {
                    componentType = 'testing';
                }

                if (componentType === 'documentation') {
                    tag = compositeRisk > 0.75 ? 'documentation_hotspot' : 'stable_docs';
                } else if (componentType === 'infrastructure' || componentType === 'pipeline') {
                    tag = compositeRisk > 0.75 ? 'volatile_config_bottleneck' : 'stable_environment';
                } else if (componentType === 'testing') {
                    tag = compositeRisk > 0.75 ? 'high_test_churn' : 'stable_test_suite';
                } else {
                    if (compositeRisk > 0.8) {
                        tag = 'refactor_decay_hotspot';
                    } else if (node.historical_coupling_score > 10 && node.author_count > 4) {
                        tag = 'shared_bottleneck';
                    } else if (node.stability_ratio < 0.15 && node.commit_frequency > 5) {
                        tag = 'active_feature_growth';
                    }
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
                    structural_risk_index: parseFloat(compositeRisk.toFixed(2))
                };
            });

            // Weighted Topological Link Extraction & Mapping
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
                        weight: count // Optimization: Exposing precise co-change impact frequencies
                    });
                }
            }

            finalizedNodes.sort((a, b) => b.structural_risk_index - a.structural_risk_index);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                status: 'success',
                repo_id: repoId,
                nodes: finalizedNodes,
                links: links
            }));
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: err.message }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Route not found' }));
    }
});

server.listen(PORT, () => console.log(`[SERVER] Graph Engine frozen on port ${PORT}...`));
