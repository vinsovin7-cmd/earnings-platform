import {createTonConnectManifest} from '../src/tonConnectManifest';

export default function tonConnectManifest(req: any, res: any, next: () => void) {
  const [path, search] = (req.url || '').split('?');
  if(path !== '/tonconnect-manifest.json' && path !== '/api/tonconnect-manifest') return next();

  const requestedOrigin = new URLSearchParams(search || '').get('origin');
  try {
    const manifest = createTonConnectManifest(requestedOrigin || '');
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(manifest));
  } catch{
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({error: 'A valid HTTPS preview origin is required.'}));
  }
}
