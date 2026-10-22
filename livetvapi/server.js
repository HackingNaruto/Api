const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // Enable Full CORS for player
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

    // Built-in proxy to tunnel Astro, Akamai and external streams without CORS issues
    if (parsedUrl.pathname === '/api/proxy') {
        const target = parsedUrl.searchParams.get('url');
        if (!target) {
            res.writeHead(400);
            return res.end('Missing target url');
        }

        try {
            const targetUrl = new URL(target);
            const client = targetUrl.protocol === 'https:' ? https : http;

            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': '*/*'
            };

            if (targetUrl.hostname.includes('astro.com.my')) {
                headers['Origin'] = 'https://astrogo.astro.com.my';
                headers['Referer'] = 'https://astrogo.astro.com.my/';
            }

            const proxyReq = client.request(targetUrl, { method: req.method, headers }, (proxyRes) => {
                // Forward status & headers
                const respHeaders = { ...proxyRes.headers };
                respHeaders['access-control-allow-origin'] = '*';
                respHeaders['access-control-allow-headers'] = '*';
                res.writeHead(proxyRes.statusCode, respHeaders);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                console.error('Proxy Error:', err.message);
                if (!res.headersSent) {
                    res.writeHead(502);
                    res.end('Bad Gateway: ' + err.message);
                }
            });

            req.pipe(proxyReq);
            return;
        } catch (e) {
            res.writeHead(400);
            return res.end('Invalid URL');
        }
    }

    // Static Files (index.html, channels.json, etc.)
    let reqPath = parsedUrl.pathname;
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

    const filePath = path.join(ROOT, decodeURIComponent(reqPath));

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 Live TV API Local Tester Server is RUNNING!`);
    console.log(`👉 Open in Browser: http://localhost:${PORT}`);
    console.log(`=================================================\n`);
});
