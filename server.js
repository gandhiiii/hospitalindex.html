const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'server-data.json');

// Load persisted data
let serverData = {};
if (fs.existsSync(DATA_FILE)) {
  try { serverData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e) {}
}

// Save data to disk
function persistData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(serverData, null, 2));
}

// HTTP server to serve the HTML and handle REST sync
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Serve the HTML file
  if (req.method === 'GET' && req.url === '/') {
    const htmlPath = path.join(__dirname, 'hospital-inventory.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath, 'utf8'));
    } else {
      res.writeHead(404); res.end('HTML file not found');
    }
    return;
  }

  // GET /api/data - retrieve current data
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
        // Broadcast to all connected WebSocket clients
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

  // Fallback: 404
  res.writeHead(404); res.end('Not found');
});

// WebSocket server for real-time sync
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('Client connected from', req.socket.remoteAddress);

  // Send current data on connect
  ws.send(JSON.stringify({ type: 'sync', data: serverData }));

  ws.on('message', message => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'sync' && msg.data) {
        Object.assign(serverData, msg.data);
        persistData();
        // Broadcast to all OTHER clients
        const broadcast = JSON.stringify({ type: 'sync', data: serverData });
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) client.send(broadcast);
        });
      }
    } catch(e) {}
  });

  ws.on('close', () => console.log('Client disconnected'));
});

server.listen(PORT, () => {
  console.log(`HIMS Live Server running on http://localhost:${PORT}`);
  console.log(`WebSocket ready at ws://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/hospital-inventory.html in your browser`);
});
