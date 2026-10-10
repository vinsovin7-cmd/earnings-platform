import {createTonConnectManifest} from '../src/tonConnectManifest';

type ManifestRequest = {
  method?: string,
  headers: Record<string, string | string[] | undefined>
};

type ManifestResponse = {
  setHeader: (name: string, value: string) => void,
  status: (code: number) => ManifestResponse,
  json: (body: unknown) => void
};

export default function handler(req: ManifestRequest, res: ManifestResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  if(req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({error: 'Method not allowed.'});
    return;
  }

  const forwardedProtocol = req.headers['x-forwarded-proto'];
  const host = req.headers.host;
  const protocol = Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol;
  if(typeof protocol !== 'string' || typeof host !== 'string') {
    res.status(400).json({error: 'A valid HTTPS request origin is required.'});
    return;
  }

  try {
    const origin = `${protocol.split(',')[0].trim()}://${host}`;
    res.status(200).json(createTonConnectManifest(origin));
  } catch{
    res.status(400).json({error: 'A valid HTTPS request origin is required.'});
  }
}
