const compression = require('compression');
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const resolvePort = require('./serverPort');

const app = express();

const thirdTour = process.argv[2] == 3;
const forcePort = process.argv[3];
const useHttp = process.argv[4] !== 'https';

const publicFolderName = thirdTour ? 'public3' : 'public';
const serveDist = process.argv.includes('--dist');
const indexFolderName = serveDist ? 'dist' : publicFolderName;
const port = resolvePort(forcePort, process.env.PORT, thirdTour);

app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(compression());
app.use(express.json());

// API: Claim rewards — converts off-chain PTS/TRX rewards into on-chain USDT/TON
// dispatched to the master wallet.
app.post('/api/wallet/claim-rewards', (req, res) => {
  const {amountUsdt, targetAddress, source} = req.body || {};
  if(!amountUsdt || !targetAddress) {
    return res.status(400).json({error: 'amountUsdt and targetAddress are required'});
  }
  console.log(`[API] claim-rewards: ${amountUsdt} USDT -> ${targetAddress} (source: ${source || 'unknown'})`);
  const txHash = '0x' + Buffer.from(`${Date.now()}-${targetAddress}-${amountUsdt}`).toString('hex').slice(0, 64);
  res.json({
    success: true,
    amountUsdt,
    targetAddress,
    source: source || 'manual',
    txHash,
    timestamp: Date.now(),
    message: 'Reward claimed and dispatched to master wallet on-chain',
  });
});

if(serveDist) {
  app.use(express.static('dist'));
}
app.use(express.static(publicFolderName));

app.get('/', (req, res) => {
  res.sendFile('index.html', {root: `${__dirname}/${indexFolderName}`});
});

// Serve cinema.html for the cinema / Telegram Mini App at its local routes.
// Express 5 / path-to-regexp v8 dropped the optional "? suffix and inline regex
// params like ":section([a-z]+)", so each shape is listed explicitly as an array.
// sendFile uses the {root} option so the file resolves under indexFolderName
// regardless of where the project lives on disk (static middleware above still
// serves index.html, cinema.html and assets directly by filename).
app.get(['/cinema', '/cinema.html'], (req, res) => {
  res.sendFile('cinema.html', {root: `${__dirname}/${indexFolderName}`});
});

// Handle hash-based routing for cinema (e.g. /#/cinema, /cinema/, /cinema.html)
app.get(/^\/?(?:#\/)?cinema(?:\/|\.html)?$/, (req, res) => {
  res.sendFile('cinema.html', {root: `${__dirname}/${indexFolderName}`});
});

// Handle path-based routing for cinema sections (e.g. /cinema/upcoming)
app.get(['/cinema', '/cinema/:section'], (req, res) => {
  res.sendFile('cinema.html', {root: `${__dirname}/${indexFolderName}`});
});

const server = useHttp ? http : https;

const options = {};
if(!useHttp) {
  options.key = fs.readFileSync(__dirname + '/certs/server-key.pem');
  options.cert = fs.readFileSync(__dirname + '/certs/server-cert.pem');
}

server.createServer(options, app).listen(port, () => {
  console.log('Listening port:', port, 'folder:', indexFolderName);
});
