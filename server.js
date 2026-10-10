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
if(serveDist) {
  app.use(express.static('dist'));
}
app.use(express.static(publicFolderName));

app.get('/', (req, res) => {
  res.sendFile(__dirname + `/${indexFolderName}/index.html`);
});

// Serve cinema.html directly for /cinema or /cinema.html
app.get(['/cinema', '/cinema.html'], (req, res) => {
  res.sendFile(__dirname + `/${indexFolderName}/cinema.html`);
});

// Handle hash-based routing for cinema - redirect to clean URL
app.get(/^\/?(?:#\/)?cinema(?:\/|\.html)?$/, (req, res) => {
  res.sendFile(__dirname + `/${indexFolderName}/cinema.html`);
});

// Handle path-based routing for cinema sections
app.get('/cinema/:section?', (req, res) => {
  res.sendFile(__dirname + `/${indexFolderName}/cinema.html`);
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
