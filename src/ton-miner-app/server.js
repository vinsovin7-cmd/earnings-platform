const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/api/payouts', (req, res) => {
  // Mock payout data
  res.json([
    { address: 'UQ...', amount: '0.0123', ts: Date.now() },
    // Add more mock entries if needed
  ]);
});

wss.on('connection', ws => {
  // Broadcast a mock payout every 5 seconds
  const interval = setInterval(() => {
    const mock = {
      address: 'UQ' + Math.random().toString(16).substring(2, 10),
      amount: (Math.random() * 0.1).toFixed(6),
      ts: Date.now(),
    };
    ws.send(JSON.stringify(mock));
  }, 5000);

  ws.on('close', () => clearInterval(interval));
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});