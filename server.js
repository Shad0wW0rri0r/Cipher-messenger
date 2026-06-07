const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const os   = require('os');

const PORT = process.env.PORT || 3000;

// ── ICE / TURN config ────────────────────────────────────────────────────────
// By default uses free STUN only.
// For reliable cross-network calls, set these env vars:
//   TURN_URLS       comma-separated turn: URIs
//   TURN_USERNAME   credential username
//   TURN_CREDENTIAL credential password
function buildIceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302'  },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ];

  if (process.env.TURN_URLS) {
    servers.push({
      urls:       process.env.TURN_URLS.split(',').map(s => s.trim()),
      username:   process.env.TURN_USERNAME   || '',
      credential: process.env.TURN_CREDENTIAL || '',
    });
    console.log('[TURN] Using configured TURN server(s).');
  } else {
    console.log('[TURN] No TURN_URLS set — STUN only. Cross-NAT calls may fail for some users.');
    console.log('[TURN] See README.md for free TURN setup.');
  }

  return servers;
}

const ICE_SERVERS = buildIceServers();

// ── HTTP server ──────────────────────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  // CORS preflight (for local dev)
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/api/ice') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ICE_SERVERS));
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, online: users.size }));
    return;
  }

  // Serve index.html for everything else
  if (req.method === 'GET') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (_) {
      res.writeHead(500);
      res.end('index.html not found next to server.js');
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

// ── WebSocket server ─────────────────────────────────────────────────────────
const wss  = new WebSocketServer({ server: httpServer });
const users = new Map(); // username → ws

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  let me = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }

    // ── Register ──────────────────────────────────────────────────────────
    if (msg.type === 'register') {
      const name = (msg.username || '').trim();

      if (!name || name.length < 2 || name.length > 28) {
        ws.send(js({ type: 'error', code: 'BAD_NAME',
          text: 'Name must be 2–28 characters.' }));
        return;
      }

      if (users.has(name)) {
        ws.send(js({ type: 'error', code: 'NAME_TAKEN',
          text: `"${name}" is already online. Choose a different name.` }));
        return;
      }

      me = name;
      users.set(me, ws);

      // Send the new user the current roster
      ws.send(js({
        type:  'online-users',
        users: [...users.keys()].filter(u => u !== me),
      }));

      // Tell everyone else
      broadcast({ type: 'presence', from: me, status: 'online' }, me);
      log(`+ ${me}  [${ip}]  (${users.size} online)`);
      return;
    }

    if (!me) return;

    // ── Point-to-point relay ───────────────────────────────────────────────
    if (msg.to) relay(msg.to, { ...msg, from: me });
  });

  ws.on('close', () => {
    if (me) {
      users.delete(me);
      broadcast({ type: 'presence', from: me, status: 'offline' });
      log(`- ${me}  (${users.size} online)`);
      me = null;
    }
  });

  ws.on('error', () => {
    if (me) users.delete(me);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function relay(to, msg) {
  const t = users.get(to);
  if (t && t.readyState === 1) t.send(js(msg));
}

function broadcast(msg, exclude) {
  const data = js(msg);
  for (const [name, client] of users) {
    if (name !== exclude && client.readyState === 1) client.send(data);
  }
}

function js(o)  { return JSON.stringify(o); }
function log(s) { console.log(`[${new Date().toLocaleTimeString()}] ${s}`); }

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown() {
  console.log('\nShutting down…');
  broadcast({ type: 'server-shutdown', text: 'Server is restarting. Please refresh.' });
  httpServer.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

// ── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  const lines = [
    '',
    '  🔐  Cipher Messenger  v2',
    `  ${'─'.repeat(42)}`,
    `  Local :   http://localhost:${PORT}`,
  ];

  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        lines.push(`  Network:  http://${addr.address}:${PORT}`);
      }
    }
  }

  lines.push(`  ${'─'.repeat(42)}`);
  lines.push('  Deploy this server publicly to chat across any network.');
  lines.push('  See README.md for one-click deploy instructions.\n');
  console.log(lines.join('\n'));
});
