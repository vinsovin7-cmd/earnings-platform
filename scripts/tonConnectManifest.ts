import {createTonConnectManifest} from '../src/tonConnectManifest';

export default function tonConnectManifest(req: any, res: any, next: () => void) {
  const [path, search] = (req.url || '').split('?');
  if(path !== '/tonconnect-manifest.json' && path !== '/api/tonconnect-manifest' && path !== '/.well-known/tonconnect-manifest.json') return next();

  // TON Connect standard well-known path: derive origin from request host
  // when no origin query param is provided.
  let requestedOrigin = new URLSearchParams(search || '').get('origin');
  if(!requestedOrigin && path === '/.well-known/tonconnect-manifest.json') {
    const host = req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
    const protocol = Array.isArray(proto) ? proto[0] : proto;
    if(typeof protocol === 'string' && typeof host === 'string') {
      requestedOrigin = `${protocol.trim()}://${host}`;
    }
  }

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
