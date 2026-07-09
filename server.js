const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = 5000;

if (!fs.existsSync('./repos')) { fs.mkdirSync('./repos'); }

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

    // ROUTE 1: Ingest URL and Clone
    if (req.method === 'POST' && parsedUrl.pathname === '/api/analyze') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { url: repoUrl } = JSON.parse(body);
                if (!repoUrl || !repoUrl.startsWith('https://')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Invalid URL' }));
                }

                const uniqueId = crypto.createHash('md5').update(repoUrl).digest('hex').substring(0, 8);
                const targetPath = `./repos/${uniqueId}`;

                if (fs.existsSync(targetPath)) {
                    console.log(`[SYSTEM] Repo already exists locally at ${targetPath}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ status: 'success', repo_id: uniqueId }));
                }

                console.log(`[EXEC] Cloning: ${repoUrl}`);
                exec(`git clone --depth 100 ${repoUrl} ${targetPath}`, (err, stdout, stderr) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Clone failed', details: stderr }));
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success', repo_id: uniqueId }));
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Malformed JSON' }));
            }
        });
    } 
    
    // ROUTE 2: Extract Telemetry & Calculate Friction Matrix
    else if (req.method === 'GET' && parsedUrl.pathname === '/api/metrics') {
        const repoId = parsedUrl.searchParams.get('id');
        const targetPath = `./repos/${repoId}`;

        if (!repoId || !fs.existsSync(targetPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Repository not found. Run /api/analyze first.' }));
        }

        console.log(`[EXEC] Gathering Git telemetry for repo: ${repoId}`);

        // Command returns: [lines added] [lines deleted] [filepath] for every commit
        const gitCmd = `git -C ${targetPath} log --numstat --pretty=format:""`;

        exec(gitCmd, (err, stdout) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Failed to extract git logs' }));
            }

            const fileMetrics = {};
            const lines = stdout.split('\n');

            // Parse raw text logs line-by-line
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length === 3) {
                    const added = parseInt(parts[0], 10) || 0;
                    const deleted = parseInt(parts[1], 10) || 0;
                    const filePath = parts[2];

                    // Exclude hidden git/config assets or lockfiles
                    if (filePath.includes('.git/') || filePath.endsWith('lock.json')) return;

                    if (!fileMetrics[filePath]) {
                        fileMetrics[filePath] = { churn: 0, volume: 0 };
                    }
                    fileMetrics[filePath].churn += (added + deleted);
                }
            });

            // Calculate Volume (LOC) by physically looking at files left inside directory
            const nodes = [];
            Object.keys(fileMetrics).forEach(filePath => {
                const absolutePath = path.join(targetPath, filePath);
                
                try {
                    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
                        const content = fs.readFileSync(absolutePath, 'utf8');
                        const loc = content.split('\n').length;

                        fileMetrics[filePath].volume = loc;
                        
                        // Operational Formula: Friction Index = Churn * Volume
                        const frictionIndex = fileMetrics[filePath].churn * loc;

                        nodes.push({
                            id: filePath,
                            churn: fileMetrics[filePath].churn,
                            volume: loc,
                            friction_score: frictionIndex
                        });
                    }
                } catch (e) {
                    // File existed in logs but was completely deleted over time, safe to ignore
                }
            });

            // Sort nodes descending so the frontend immediately knows the worst technical debt hotspots
            nodes.sort((a, b) => b.friction_score - a.friction_score);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', repo_id: repoId, nodes: nodes }));
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Route not found' }));
    }
});

server.listen(PORT, () => console.log(`[SYSTEM] Orchestration Engine running on port ${PORT}...`));
