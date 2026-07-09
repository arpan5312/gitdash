const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

const PORT = 5000;

// Ensure a directory exists to hold the cloned repositories
if (!fs.existsSync('./repos')) {
    fs.mkdirSync('./repos');
}

const server = http.createServer((req, res) => {
    // Set CORS headers so your frontend browser client won't be blocked later
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle browser pre-flight verification requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Route: POST /api/analyze
    if (req.method === 'POST' && req.url === '/api/analyze') {
        let body = '';

        // Accumulate incoming data stream chunks
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const repoUrl = data.url;

                // Basic validation: Check if it's a structural git string link
                if (!repoUrl || !repoUrl.startsWith('https://')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid or missing repository URL' }));
                    return;
                }

                // Generate a deterministic, unique directory name based on a hash of the URL
                const uniqueId = crypto.createHash('md5').update(repoUrl).digest('hex').substring(0, 8);
                const targetPath = `./repos/${uniqueId}`;

                console.log(`[EXEC] Starting git clone for: ${repoUrl} into ${targetPath}`);

                // Spawn the OS shell process asynchronously
                exec(`git clone --depth 100 ${repoUrl} ${targetPath}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[ERROR] Clone failed: ${error.message}`);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to clone repository', details: stderr }));
                        return;
                    }

                    console.log(`[SUCCESS] Cloned successfully into ${targetPath}`);
                    
                    // Return response payload contract back to client
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        status: 'success', 
                        repo_id: uniqueId 
                    }));
                });

            } catch (parseError) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Route not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`[SYSTEM] Backend engine listening on port ${PORT}...`);
});
