# 🔐 Cipher Messenger

Real-time messaging + audio/video calls.  
Works across **any network, anywhere in the world**.  
No accounts. No phone numbers. Messages auto-delete after 24 hours.

---

## How to deploy (pick one)

### Option A — Railway (recommended, free)

1. **Create a free account** at https://railway.app

2. **Push this folder to a GitHub repo**
   ```bash
   git init
   git add .
   git commit -m "cipher messenger"
   # create a repo on github.com, then:
   git remote add origin https://github.com/YOUR_USERNAME/cipher-messenger.git
   git push -u origin main
   ```

3. On Railway:  
   → New Project → Deploy from GitHub repo → select your repo  
   Railway auto-detects Node.js and runs `npm start`.  
   It gives you a public URL like `https://cipher-messenger-xxxx.up.railway.app`

4. **Share that URL** with anyone — they can open it from any device, any network.

---

### Option B — Render (also free)

1. Create a free account at https://render.com
2. New → Web Service → connect your GitHub repo
3. Build command: `npm install`  
   Start command: `node server.js`
4. Render gives you a public `https://` URL.

---

### Option C — Any VPS (DigitalOcean, Linode, etc.)

```bash
# On the server
git clone <your-repo> cipher
cd cipher
npm install
node server.js   # or use PM2 for production

# If using nginx as a reverse proxy, add to your nginx config:
# location / {
#     proxy_pass http://localhost:3000;
#     proxy_http_version 1.1;
#     proxy_set_header Upgrade $http_upgrade;
#     proxy_set_header Connection "upgrade";
#     proxy_set_header Host $host;
# }
```

---

## Making video/audio calls work reliably

By default, Cipher uses **STUN** servers (Google's free ones).  
STUN works for ~80% of connections. For the other 20% (strict firewalls, 
corporate networks, mobile data), you need a **TURN** server.

### Get a free TURN server from Metered.ca

1. Sign up free at https://www.metered.ca/stun-turn
2. Create an application → copy the TURN credentials
3. Set these environment variables on your deployment:

| Variable          | Value                              |
|-------------------|------------------------------------|
| `TURN_URLS`       | `turn:relay.metered.ca:80,turn:relay.metered.ca:443` |
| `TURN_USERNAME`   | (from Metered dashboard)           |
| `TURN_CREDENTIAL` | (from Metered dashboard)           |

**On Railway**: Settings → Variables → add the three vars above.  
**On Render**: Environment → add them there.

Free tier: 10 GB/month relay traffic — plenty for personal use.

---

## Features

| Feature | Details |
|---|---|
| Messaging | Real-time, Enter to send, Shift+Enter for new line |
| Message storage | Browser `localStorage`, 24-hour auto-delete |
| Save chat | Downloads conversation as `.txt` at any time |
| Online status | Live — shows Online / Xm ago / Xh ago |
| Audio call | WebRTC peer-to-peer, mute control |
| Video call | WebRTC peer-to-peer, mute + camera toggle |
| Reconnect | Auto-reconnects with exponential backoff |

---

## How it works

```
Person A (browser) ──WebSocket──▶ Server ──WebSocket──▶ Person B (browser)
                                    │
                                    └─ relays signaling only
                                       (offer / answer / ICE candidates)

After call connects:
Person A (browser) ◀──────── WebRTC (peer-to-peer) ────────▶ Person B (browser)
                         audio/video never touches server
```

The server only relays small signaling messages. Audio and video are 
**peer-to-peer** — the server never sees your call media.

Messages are stored only in **your browser** — the server never stores them.

---

## Local development

```bash
npm install
node server.js
# open http://localhost:3000 in two tabs
```
