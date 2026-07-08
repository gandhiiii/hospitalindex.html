const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'server-data.json');
const HTML_FILE = path.join(__dirname, 'hospital-inventory.html');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Load persisted data
let serverData = {};
if (fs.existsSync(DATA_FILE)) {
  try { serverData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e) {}
}

function persistData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(serverData, null, 2));
}

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Serve the HTML for any top-level path for SPA-like access
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html' || req.url === '/hospital-inventory.html')) {
    if (fs.existsSync(HTML_FILE)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(HTML_FILE, 'utf8'));
    } else {
      res.writeHead(404); res.end('HTML file not found');
    }
    return;
  }

  // GET /api/data - retrieve current server data
  if (req.method === 'GET' && req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(serverData));
    return;
  }

  // POST /api/data - sync data from client
  if (req.method === 'POST' && req.url === '/api/data') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const newData = JSON.parse(body);
        Object.assign(serverData, newData);
        persistData();
        const msg = JSON.stringify({ type: 'sync', data: serverData });
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) client.send(msg);
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // GET /api/health - health check
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: wss.clients.size }));
    return;
  }

  // Serve static files from the same directory (for CSS/JS assets if any)
  const staticPath = path.join(__dirname, req.url.slice(1));
  if (req.method === 'GET' && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    const ext = path.extname(staticPath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(staticPath));
    return;
  }

  res.writeHead(404); res.end('Not found');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const addr = req.socket.remoteAddress;
  console.log(`Client connected from ${addr} (${wss.clients.size} connected)`);
  ws.send(JSON.stringify({ type: 'sync', data: serverData }));

  ws.on('message', message => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'sync' && msg.data) {
        Object.assign(serverData, msg.data);
        persistData();
        const broadcast = JSON.stringify({ type: 'sync', data: serverData });
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) client.send(broadcast);
        });
      }
    } catch(e) {}
  });

  ws.on('close', () => console.log(`Client disconnected (${wss.clients.size} remaining)`));
});

server.listen(PORT, () => {
  const ip = getLocalIP();
  console.log('\n============================================');
  console.log('  HIMS - Live Server Running');
  console.log('============================================');
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Network:  http://${ip}:${PORT}`);
  console.log(`  WS:       ws://${ip}:${PORT}`);
  console.log('--------------------------------------------');
  console.log(`  Data:     ${DATA_FILE}`);
  console.log(`  Clients:  0 connected`);
  console.log('============================================\n');
});
