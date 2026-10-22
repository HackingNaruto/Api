const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 8080;
const ROOT = __dirname;

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

    // Proxy endpoint
    if (reqUrl.pathname === '/api/proxy') {
        let targetUrl = reqUrl.searchParams.get('url');
        if (!targetUrl) {
            res.writeHead(400);
            return res.end('Missing target url');
        }

        if (targetUrl.startsWith('https:/') && !targetUrl.startsWith('https://')) {
            targetUrl = targetUrl.replace('https:/', 'https://');
        } else if (targetUrl.startsWith('http:/') && !targetUrl.startsWith('http://')) {
            targetUrl = targetUrl.replace('http:/', 'http://');
        }

        try {
            const targetUrlObj = new URL(targetUrl);
            const hostname = targetUrlObj.hostname.toLowerCase();
            const pathname = targetUrlObj.pathname.toLowerCase();

            const isSegment =
                /\.(ts|mp4|m4s|m4v|aac|mp3|fmp4|cmfs|key|dash|m4f)$/i.test(pathname) ||
                pathname.includes('.dash') ||
                /segment|seg|frag|part|pipe=/i.test(targetUrl);

            // Redirect segments directly for Jio/Akamai
            if (isSegment && (hostname.includes('jio.com') || hostname.includes('jiocinema') || pathname.includes('bpk-tv'))) {
                let redirectUrl = targetUrl;
                let cookieVal = reqUrl.searchParams.get('cookie');
                if (!cookieVal) {
                    const m = targetUrl.match(/_{0,2}hdnea_{0,2}=([^&]+)/);
                    if (m) cookieVal = m[1];
                }
                if (cookieVal && !redirectUrl.includes('__hdnea')) {
                    redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + (cookieVal.includes('__hdnea__=') ? cookieVal : ('__hdnea__=' + cookieVal));
                }
                res.writeHead(302, {
                    'Location': redirectUrl,
                    'Access-Control-Allow-Origin': '*'
                });
                return res.end();
            }

            const fetchHeaders = {};
            if (req.headers['range']) fetchHeaders['Range'] = req.headers['range'];

            if (hostname.includes('astro.com.my') || hostname.includes('linearjitp-playback')) {
                fetchHeaders['Origin'] = 'https://astrogo.astro.com.my';
                fetchHeaders['Referer'] = 'https://astrogo.astro.com.my/';
                fetchHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
            } else if (hostname.includes('jio.com') || hostname.includes('jiocinema') || targetUrl.includes('bpk-tv')) {
                fetchHeaders['Origin'] = 'https://www.jiotv.com';
                fetchHeaders['Referer'] = 'https://www.jiotv.com/';
                fetchHeaders['User-Agent'] = 'plaYtv/7.1.5 (Linux; Android 13) ExoPlayerLib/2.11.6';
            } else {
                fetchHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
            }

            const proxyRes = await fetch(targetUrl, {
                method: req.method,
                headers: fetchHeaders,
                redirect: 'follow'
            });

            const resHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
            };

            if (proxyRes.headers.get('content-type')) resHeaders['Content-Type'] = proxyRes.headers.get('content-type');
            if (proxyRes.headers.get('content-range')) resHeaders['Content-Range'] = proxyRes.headers.get('content-range');
            if (proxyRes.headers.get('accept-ranges')) resHeaders['Accept-Ranges'] = proxyRes.headers.get('accept-ranges');

            const contentType = (proxyRes.headers.get('content-type') || '').toLowerCase();
            const isM3U8 = contentType.includes('mpegurl') || targetUrl.includes('.m3u8');
            const isMPD = contentType.includes('dash+xml') || targetUrl.includes('.mpd');

            if (isM3U8) {
                let text = await proxyRes.text();
                const urlWithoutQuery = targetUrl.split('?')[0];
                const baseUrl = urlWithoutQuery.substring(0, urlWithoutQuery.lastIndexOf('/') + 1);
                
                const lines = text.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line && !line.startsWith('#') && !line.startsWith('http')) {
                        lines[i] = line.startsWith('/') ? (targetUrlObj.origin + line) : (baseUrl + line);
                    }
                }
                const modifiedText = lines.join('\n');
                resHeaders['Content-Type'] = 'application/vnd.apple.mpegurl';
                resHeaders['Content-Length'] = Buffer.byteLength(modifiedText, 'utf8');
                res.writeHead(proxyRes.status, resHeaders);
                return res.end(modifiedText);
            }

            if (isMPD) {
                let text = await proxyRes.text();
                const cleanUrl = targetUrl.split('?')[0].replace(/([^:])\/{2,}/g, '$1/');
                const baseUrl = cleanUrl.substring(0, cleanUrl.lastIndexOf('/') + 1);
                
                // Inject absolute BaseURL tag so relative segments resolve to the real server, not localhost:8080!
                if (!text.includes('<BaseURL>http')) {
                    text = text.replace(/<MPD([^>]*)>/i, `<MPD$1>\n  <BaseURL>${baseUrl}</BaseURL>`);
                }
                resHeaders['Content-Type'] = 'application/dash+xml';
                resHeaders['Content-Length'] = Buffer.byteLength(text, 'utf8');
                res.writeHead(proxyRes.status, resHeaders);
                return res.end(text);
            }

            const buffer = Buffer.from(await proxyRes.arrayBuffer());
            resHeaders['Content-Length'] = buffer.length;
            res.writeHead(proxyRes.status, resHeaders);
            return res.end(buffer);

        } catch (e) {
            res.writeHead(500);
            return res.end('Proxy error: ' + e.message);
        }
    }

    // Static files
    let filePath = path.join(ROOT, reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.css': 'text/css',
            '.svg': 'image/svg+xml',
            '.m3u': 'application/x-mpegurl',
            '.m3u8': 'application/vnd.apple.mpegurl',
            '.mpd': 'application/dash+xml',
            '.mp4': 'video/mp4',
            '.m4s': 'video/iso.segment',
            '.ts': 'video/mp2t'
        };
        res.writeHead(200, {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*'
        });
        return fs.createReadStream(filePath).pipe(res);
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 Live TV API Local Tester Server is RUNNING!`);
    console.log(`👉 Open: http://localhost:${PORT}`);
    console.log(`=================================================\n`);
});
