const fs = require('fs');
const path = require('path');

// Category mapping helper
function detectCategory(name, existingGroup) {
    const n = (name || '').toLowerCase();
    const g = (existingGroup || '').toLowerCase();

    // Devotional
    if (['bhakti', 'satsang', 'divya', 'peace', 'darshan', 'aastha', 'sanskar', 'shubh', 'bhakthi', 'lord', 'god', 'sai', 'jesus', 'madha', 'islam', 'quran'].some(d => n.includes(d) || g.includes(d))) return 'Devotional';
    
    // Tamil
    if (n.includes('tamil') || n.includes('thirai') || n.includes('sun tv') || n.includes('sun news') || n.includes('sun life') || n.includes('sun music') || n.includes('vijay') ||
        n.includes('kalaignar') || n.includes('ktv') || n.includes('adithya') || n.includes('chutti') || n.includes('isai aruvi') || n.includes('murasu') || n.includes('siripoli') ||
        n.includes('jaya') || n.includes('polimer') || n.includes('puthuyugam') || n.includes('news18 tamil') || n.includes('makkal') || n.includes('vasanth') || n.includes('mega tv') ||
        n.includes('raj tv') || n.includes('zee tamil') || n.includes('captain tv') || n.includes('captain news') || g.includes('tamil')) return 'Tamil';
    
    // Sports
    if (n.includes('sports') || n.includes('cricket') || n.includes('espn') || n.includes('eurosport') ||
        n.includes('ten 1') || n.includes('ten 2') || n.includes('ten 3') || n.includes('ten 4') || n.includes('ten 5') ||
        n.includes('ten1') || n.includes('ten2') || n.includes('ten3') || n.includes('ten4') || n.includes('ten5') ||
        n.includes('willow') || n.includes('fancode') || n.includes('dd sports') || g.includes('sports')) return 'Sports';
    
    // News
    if (n.includes('news') || n.includes('ndtv') || n.includes('republic') || n.includes('wion') ||
        n.includes('cnbc') || n.includes('times now') || n.includes('india today') || n.includes('aaj tak') || g.includes('news')) return 'News';

    // Kids
    if (n.includes('kids') || n.includes('cartoon') || n.includes('disney') || n.includes('pogo') ||
        n.includes('nick') || n.includes('yay') || n.includes('sonic') || n.includes('cbeebies') ||
        n.includes('baby tv') || n.includes('hungama') || n.includes('discovery kids') || g.includes('kids')) return 'Kids';

    // Movies
    if (n.includes('cinema') || n.includes('movies') || n.includes('movie') || n.includes('pix') ||
        n.includes('classic') || n.includes('bollywood') || n.includes('masti') || n.includes('utsav') ||
        n.includes('talkies') || n.includes('zest') || n.includes('xplor') || n.includes('galaxy') || g.includes('movies')) return 'Movies';

    // Music
    if (n.includes('music') || n.includes('beats') || n.includes('mtv') || n.includes('vh1') || n.includes('9xm') || g.includes('music')) return 'Music';

    // Telugu
    if (n.includes('telugu') || n.includes('cinemalu') || n.includes('vanitha') || n.includes('maa tv') ||
        n.includes('gemini') || n.includes('zee power') || n.includes('star maa') || n.includes('aha') || g.includes('telugu')) return 'Telugu';

    // Malayalam
    if (n.includes('malayalam') || n.includes('keralam') || n.includes('mazhavil') || n.includes('asianet') ||
        n.includes('surya tv') || n.includes('flowers') || n.includes('amrita') || n.includes('reporter') || g.includes('malayalam')) return 'Malayalam';

    // Kannada
    if (n.includes('kannada') || n.includes('udaya') || n.includes('colors super') || n.includes('star suvarna') || g.includes('kannada')) return 'Kannada';

    // Hindi
    if (n.includes('hindi') || n.includes('zee tv') || n.includes('star plus') || n.includes('sony sab') ||
        n.includes('colors tv') || n.includes('and tv') || n.includes('sab tv') || n.includes('star bharat') ||
        n.includes('sahara') || n.includes('sony pal') || n.includes('zee anmol') || n.includes('sony wah') ||
        n.includes('zee café') || n.includes('set hd') || n.includes('sony set') || n.includes('sony max') ||
        n.includes('sony entertainment') || g.includes('hindi')) return 'Hindi';

    return existingGroup || 'Entertainment';
}

function parseM3U(text, sourceKey, defaultCat) {
    const lines = text.replace(/^\uFEFF/, '').trim().split('\n');
    const channels = [];
    let cur = null;
    let pendingKeyId = '';
    let pendingKey = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#EXTM3U')) continue;
        
        if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
            const match = line.split('=')[1];
            if (match && match.includes(':')) {
                pendingKeyId = match.split(':')[0].trim().replace(/[-:\s]/g, '').toLowerCase();
                pendingKey = match.split(':')[1].trim().replace(/[-:\s]/g, '').toLowerCase();
            }
            continue;
        }
        
        if (line.startsWith('#EXTINF:')) {
            const logoM = line.match(/tvg-logo="([^"]*)"/);
            const groupM = line.match(/group-title="([^"]*)"/);
            const idM = line.match(/tvg-id="([^"]*)"/);
            let name = '';
            const lastComma = line.lastIndexOf(',');
            if (lastComma !== -1) name = line.slice(lastComma + 1).trim();
            const group = groupM ? groupM[1] : '';
            const cat = defaultCat || detectCategory(name, group);
            
            cur = {
                id: (sourceKey + '_' + (idM ? idM[1] : i)).replace(/[^a-zA-Z0-9_-]/g, '_'),
                name: name || 'Unknown',
                logo: logoM ? logoM[1] : '',
                category: cat,
                group: group || cat,
                source: sourceKey,
                keyId: pendingKeyId,
                key: pendingKey
            };
            pendingKeyId = '';
            pendingKey = '';
        } else if (line.startsWith('http')) {
            if (cur) {
                cur.url = line;
                channels.push({ ...cur });
                cur = null;
            }
        }
    }
    return channels;
}

async function run() {
    console.log('Generating Live TV API Channels Dataset...');
    const allChannels = [];
    const seenNames = new Set();

    // 1. Sony LIV & Sports with ClearKey DRM
    try {
        const sonyData = JSON.parse(fs.readFileSync('C:/Users/ELCOT/Downloads/StreamX/data/sony_channels.json', 'utf8'));
        sonyData.forEach(c => {
            const clearKeys = {};
            if (c.keyId && c.key) {
                const kid = c.keyId.replace(/[-:\s]/g, '').toLowerCase();
                const key = c.key.replace(/[-:\s]/g, '').toLowerCase();
                clearKeys[kid] = key;
            }
            allChannels.push({
                id: c.id || ('sony_' + c.name.toLowerCase().replace(/[^a-z0-9]/g, '_')),
                name: c.name,
                url: c.url || c.stream_url,
                logo: c.logo || '',
                category: c.category || 'Sony LIV',
                group: 'Sony LIV',
                stream_type: (c.url || c.stream_url).includes('.mpd') ? 'dash' : 'hls',
                drm: Object.keys(clearKeys).length ? {
                    type: 'clearkey',
                    clearKeys: clearKeys,
                    keyId: c.keyId || Object.keys(clearKeys)[0],
                    key: c.key || clearKeys[Object.keys(clearKeys)[0]]
                } : null,
                cookie_url: c.cookie_url || 'https://raw.githubusercontent.com/sportlive18/playlist/refs/heads/main/cookie.json',
                source: 'sony_liv'
            });
            seenNames.add(c.name.toLowerCase().trim());
        });
        console.log('Added Sony channels:', sonyData.length);
    } catch(e) {
        console.error('Error adding Sony channels:', e);
    }

    // 2. Astro Live Channels (DASH + ClearKey)
    try {
        const res = await fetch('https://raw.githubusercontent.com/margabantheshwar/Streamliveplatlist.m3u/refs/heads/main/streamliveastro');
        const text = await res.text();
        const astroList = parseM3U(text, 'astro', null);
        astroList.forEach(c => {
            const clearKeys = {};
            if (c.keyId && c.key) {
                clearKeys[c.keyId] = c.key;
            }
            allChannels.push({
                id: c.id,
                name: c.name,
                url: c.url,
                logo: c.logo,
                category: c.category,
                group: 'Astro',
                stream_type: c.url.includes('.mpd') ? 'dash' : 'hls',
                drm: Object.keys(clearKeys).length ? {
                    type: 'clearkey',
                    clearKeys: clearKeys,
                    keyId: c.keyId,
                    key: c.key
                } : null,
                source: 'astro'
            });
        });
        console.log('Added Astro channels:', astroList.length);
    } catch(e) {
        console.error('Error adding Astro:', e);
    }

    // 3. Zee Network (M3U + ClearKey)
    try {
        const res = await fetch('https://gist.githubusercontent.com/Mehedi-Hasan-404/563e929f577ddf142220865f0d209a57/raw/0486b2c6888777b587a6c9920c53bbe519e32fb5/Zee.m3u');
        const text = await res.text();
        const zeeList = parseM3U(text, 'zee', null);
        zeeList.forEach(c => {
            const clearKeys = {};
            if (c.keyId && c.key) clearKeys[c.keyId] = c.key;
            allChannels.push({
                id: c.id,
                name: c.name,
                url: c.url,
                logo: c.logo,
                category: c.category,
                group: 'Zee Network',
                stream_type: c.url.includes('.mpd') ? 'dash' : 'hls',
                drm: Object.keys(clearKeys).length ? {
                    type: 'clearkey',
                    clearKeys: clearKeys,
                    keyId: c.keyId,
                    key: c.key
                } : null,
                source: 'zee_network'
            });
        });
        console.log('Added Zee Network channels:', zeeList.length);
    } catch(e) {
        console.error('Error adding Zee:', e);
    }

    // 4. Prime Sports (Willow / Prime Video Live Sports)
    try {
        const res = await fetch('https://raw.githubusercontent.com/sportlive18/Willow-Cricbuzz-Prime-Video-Sport-Live-Event-Auto-Updated-Playlist/refs/heads/main/primesport.m3u');
        const text = await res.text();
        const primeList = parseM3U(text, 'primesport', 'Sports');
        primeList.forEach(c => {
            const clearKeys = {};
            if (c.keyId && c.key) clearKeys[c.keyId] = c.key;
            allChannels.push({
                id: c.id,
                name: c.name,
                url: c.url,
                logo: c.logo,
                category: 'Sports',
                group: 'Sports',
                stream_type: c.url.includes('.mpd') ? 'dash' : 'hls',
                drm: Object.keys(clearKeys).length ? {
                    type: 'clearkey',
                    clearKeys: clearKeys,
                    keyId: c.keyId,
                    key: c.key
                } : null,
                source: 'prime_sports'
            });
        });
        console.log('Added Prime Sports:', primeList.length);
    } catch(e) {
        console.error('Error adding Prime sports:', e);
    }

    // 5. Hardcoded Premium Fixes (Zee Tamil HD, Zee Tamil APAC, Vijay Takkar APAC, Zee Tamil News)
    const premiumExtras = [
        {
            id: 'extra_zeetamil_hd',
            name: 'Zee Tamil HD',
            url: 'https://d2o8pibksxtln6.cloudfront.net/live/media/Zee_Tamil_HD/hls/Zee_Tamil_HD.m3u8',
            fallback_urls: [
                'https://da86m1sqpm3o0.cloudfront.net/28072023/smil:zeetamil1.smil/playlist.m3u8'
            ],
            logo: 'https://jiotvimages.cdn.jio.com/dare_images/images/Zee_Tamil.png',
            category: 'Tamil',
            group: 'Tamil',
            stream_type: 'hls',
            drm: null,
            source: 'premium_cdn'
        },
        {
            id: 'extra_zeetamil_apac',
            name: 'Zee Tamil HD APAC',
            url: 'https://linearjitp-playback.astro.com.my/dash-wv/linear/2311/default_ott.mpd',
            logo: 'https://jiotvimages.cdn.jio.com/dare_images/images/Zee_Tamil.png',
            category: 'Tamil',
            group: 'Astro',
            stream_type: 'dash',
            drm: {
                type: 'clearkey',
                clearKeys: { '0d4e3e7dac2d58b93bf819a72fe8d510': '667a33f4d5bb3587f2d5209886839eac' },
                keyId: '0d4e3e7dac2d58b93bf819a72fe8d510',
                key: '667a33f4d5bb3587f2d5209886839eac'
            },
            source: 'astro'
        },
        {
            id: 'extra_vijaytakkar_apac',
            name: 'Vijay Takkar APAC',
            url: 'https://linearjitp-playback.astro.com.my/dash-wv/linear/2312/default_ott.mpd',
            fallback_urls: [
                'https://tglmp01.akamaized.net/out/v1/c1071012b73f4f189b202e1529e8f802/manifest.mpd'
            ],
            logo: 'https://dtil.tmsimg.com/assets/s144078_ld_h15_aa.png?lock=720x540',
            category: 'Tamil',
            group: 'Astro',
            stream_type: 'dash',
            drm: {
                type: 'clearkey',
                clearKeys: { 'c1d97f26c5df5ebfb603ca9bcfd25d19': 'ad8e2e28399581907cb3e0ec0483ea4e' },
                keyId: 'c1d97f26c5df5ebfb603ca9bcfd25d19',
                key: 'ad8e2e28399581907cb3e0ec0483ea4e'
            },
            source: 'astro'
        },
        {
            id: 'extra_zeetamil_news',
            name: 'Zee Tamil News',
            url: 'https://raw.githubusercontent.com/amazeyourself/adaptive-streams/refs/heads/main/streams/in/ZMCL/ZeeTamilNews.m3u8',
            logo: 'https://english.cdn.zeenews.com/images/logo/zee-tamil-logo-20.svg',
            category: 'Tamil',
            group: 'News',
            stream_type: 'hls',
            drm: null,
            source: 'public_hls'
        }
    ];

    premiumExtras.forEach(p => allChannels.unshift(p));

    // 6. Major JTV Channels
    try {
        const res = await fetch('https://jtvxweb.pages.dev/jstr4web.json');
        const jtvData = await res.json();
        const jtvList = Array.isArray(jtvData) ? jtvData : (jtvData.channels || []);
        
        jtvList.forEach(c => {
            const name = (c.name || c.channel_name || '').trim();
            if (!name) return;
            const clearKeys = {};
            if (c.drmLicense) {
                String(c.drmLicense).split(',').forEach(pair => {
                    const p = pair.split(':');
                    if (p.length >= 2) {
                        const kid = p[0].trim().replace(/[-:\s]/g, '').toLowerCase();
                        const key = p.slice(1).join(':').trim().replace(/[-:\s]/g, '').toLowerCase();
                        if (kid && key) clearKeys[kid] = key;
                    }
                });
            }
            if (c.keyId && c.key) {
                const kid = c.keyId.replace(/[-:\s]/g, '').toLowerCase();
                const key = c.key.replace(/[-:\s]/g, '').toLowerCase();
                clearKeys[kid] = key;
            }

            const url = c.url || c.link || c.stream_url || '';
            if (!url) return;

            allChannels.push({
                id: 'jtv_' + (c.id || c.channel_id || name.toLowerCase().replace(/[^a-z0-9]/g, '_')),
                name: name,
                url: url,
                logo: c.logo || c.image || '',
                category: c.category || detectCategory(name, c.group),
                group: c.group || c.category || 'General',
                stream_type: url.includes('.mpd') ? 'dash' : 'hls',
                drm: Object.keys(clearKeys).length ? {
                    type: 'clearkey',
                    clearKeys: clearKeys,
                    keyId: Object.keys(clearKeys)[0],
                    key: clearKeys[Object.keys(clearKeys)[0]]
                } : null,
                cookie: c.cookie || '',
                source: 'jtv'
            });
        });
        console.log('Added JTV channels:', jtvList.length);
    } catch(e) {
        console.error('Error adding JTV:', e);
    }

    // Distinct Categories
    const categories = [...new Set(allChannels.map(c => c.category || 'General'))].sort();
    
    const output = {
        api_name: "StreamX Live TV API",
        version: "1.0.0",
        total_channels: allChannels.length,
        categories: categories,
        last_updated: new Date().toISOString(),
        player_config: {
            engine: "Shaka Player / Hls.js",
            shaka_snippet: "shakaPlayer.configure({ drm: { clearKeys: channel.drm ? channel.drm.clearKeys : undefined } }); shakaPlayer.load(channel.url);"
        },
        channels: allChannels
    };

    const outPath = 'C:/Users/ELCOT/Downloads/Api/livetvapi/channels.json';
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Successfully generated ${outPath} with ${allChannels.length} channels across ${categories.length} categories.`);
}

run();
