# 📺 StreamX Universal Live TV API

Universal All-in-One Live TV API containing **1299+ live channels** across **32 categories** (Tamil, Sports, Hindi, Telugu, Malayalam, Kannada, Sony LIV, Astro, Zee, News, Kids, Movies, etc.).

All streams include direct playable URLs (`.m3u8` / `.mpd`), ClearKey DRM keys, logos, and categories ready to plug directly into any custom website or player.

---

## 🌐 Live API Endpoints

### 1. Direct Raw GitHub JSON:
```text
https://raw.githubusercontent.com/HackingNaruto/Api/main/livetvapi/channels.json
```

### 2. High-Speed CDN Endpoint (Fast Caching & No Rate Limit):
```text
https://cdn.jsdelivr.net/gh/HackingNaruto/Api@main/livetvapi/channels.json
```

---

## 📦 JSON Response Structure

```json
{
  "api_name": "StreamX Live TV API",
  "version": "1.0.0",
  "total_channels": 1299,
  "categories": [
    "Tamil", "Sports", "Sony LIV", "Hindi", "Telugu", 
    "Malayalam", "Kannada", "News", "Movies", "Kids", ...
  ],
  "channels": [
    {
      "id": "extra_vijaytakkar_apac",
      "name": "Vijay Takkar APAC",
      "url": "https://linearjitp-playback.astro.com.my/dash-wv/linear/2312/default_ott.mpd",
      "logo": "https://dtil.tmsimg.com/assets/s144078_ld_h15_aa.png?lock=720x540",
      "category": "Tamil",
      "group": "Astro",
      "stream_type": "dash",
      "drm": {
        "type": "clearkey",
        "clearKeys": {
          "c1d97f26c5df5ebfb603ca9bcfd25d19": "ad8e2e28399581907cb3e0ec0483ea4e"
        },
        "keyId": "c1d97f26c5df5ebfb603ca9bcfd25d19",
        "key": "ad8e2e28399581907cb3e0ec0483ea4e"
      },
      "source": "astro"
    }
  ]
}
```

---

## 🚀 Easy 10-Line Integration (Create Live TV Site Instantly)

Just paste this JavaScript snippet in any HTML page to fetch and play with Shaka Player:

```html
<video id="videoPlayer" controls autoplay style="width:100%;max-width:800px;"></video>
<script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js"></script>

<script>
async function startLiveTV() {
    const res = await fetch('https://cdn.jsdelivr.net/gh/HackingNaruto/Api@main/livetvapi/channels.json');
    const data = await res.json();
    console.log(`Loaded ${data.total_channels} channels!`);

    const video = document.getElementById('videoPlayer');
    const player = new shaka.Player(video);

    // Play function for any channel object
    window.playChannel = async function(channel) {
        const config = { drm: {} };
        if (channel.drm && channel.drm.clearKeys) {
            config.drm.clearKeys = channel.drm.clearKeys;
        }
        player.configure(config);
        await player.load(channel.url);
    };

    // Play first channel as demo
    playChannel(data.channels[0]);
}
startLiveTV();
</script>
```
