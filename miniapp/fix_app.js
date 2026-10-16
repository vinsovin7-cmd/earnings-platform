const fs = require('fs');
let code = fs.readFileSync('miniapp/app.js', 'utf8');
// Add pilot entry after sintel in catalog (using actual unicode chars)
code = code.replace(
  "priceUSD: 2.99, src: channels.merlin.playlist[1].src }",
  "priceUSD: 2.99, src: channels.merlin.playlist[1].src },\n  { id: 'pilot', title: 'Pilot - Legend of Seeker', icon: '🗿', priceUSD: 0, src: channels.legend.playlist[0].src }"
);
fs.writeFileSync('miniapp/app.js', code);
console.log('Catalog updated, length: ' + code.length);
"