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

// ---------------------------------------------------------------------
// Risk scoring model
//
// The old model ranked files by percentile within the repo. Percentile
// only encodes ORDER, not MAGNITUDE — and in any real repo, the files
// that actually matter (hot paths, shared modules) are correlated across
// every metric at once (busy files also tend to have more authors, more
// coupling, more deletions). That correlation collapses the whole
// "important" cluster into the same high percentile band regardless of
// how much busier one file is than another.
//
// This model replaces rank with magnitude: log-tamed metrics, robust
// z-scores (median/MAD, resistant to the outliers commit histories are
// full of), an explicit interaction term for "busy AND entangled," an
// explicit reward for stable/additive maintenance, and a single
// calibrated sigmoid at the end instead of averaging four percentiles.
// Documentation files are excluded from the scoring pool entirely.
// ---------------------------------------------------------------------

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
    return (value - med) / (1.4826 * madValue + 1e-6); // 1.4826 makes MAD comparable to std-dev
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

// Calibration knobs. RISK_STEEPNESS: higher = sharper separation between
// hotspots and everything else. RISK_OFFSET: shifts the sigmoid so a
// typical/median file scores low instead of landing at 0.5. Tune both
// against a repo you know well if the spread still looks off.
const RISK_STEEPNESS = 1.15;
const RISK_OFFSET = 0.55;

function scoreRepository(rawNodes) {
    const docNodes = rawNodes.filter(n => isDocumentation(n.id));
    const scorable = rawNodes.filter(n => !isDocumentation(n.id));

    // Log-tame the heavy-tailed counts once per scorable file. Git
    // activity is power-law distributed — a few files have 10-100x the
    // commits of the median file. Without this, those files alone would
    // dominate the median/MAD and flatten everyone else's contrast.
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

        // Only fires when a file is BOTH above-median busy AND
        // above-median entangled — the explicit "coupled files that
        // change together frequently" penalty, not just two averaged
        // signals that happen to both be high.
        const entanglement = Math.max(0, zChurn) * Math.max(0, zDensity);

        // Rewards files that are actively maintained (high churn) but
        // mostly through additions rather than deletions/rewrites.
        // Scaled by how "alive" the file is, so an untouched file gets
        // no spurious reward.
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

    // Documentation is excluded from the risk contest entirely — it gets
    // a flat, churn-only informational score so it's never flagged
    // "critical" purely for being frequently read/edited, but a
    // genuinely hot README still surfaces as a documentation_hotspot
    // rather than disappearing.
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

    // ROUTE 2: Structural Pipeline, Risk Scoring & Edge Topological Generation
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

            const finalizedNodes = scoreRepository(rawNodes);

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