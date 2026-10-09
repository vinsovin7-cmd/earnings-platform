const MAX_CATALOG_SIZE = 1_000_000;
const ALLOWED_MEDIA_TYPES = new Set(['application/vnd.apple.mpegurl', 'video/mp4']);
const SERIES_ORDER = new Map([['Merlin', 0], ['Legend of the Seeker', 1]]);

function parseCatalog(raw, allowedHosts) {
  const entries = JSON.parse(raw);
  if(!Array.isArray(entries) || entries.length > 5000) {
    throw new Error('Cinema catalog must be an array with at most 5000 entries.');
  }

  const seen = new Set();
  return entries.map((entry) => {
    if(!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Cinema catalog entry must be an object.');
    }

    const {id, title, series, season, episode, src, type} = entry;
    if(typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || seen.has(id)) {
      throw new Error('Cinema catalog entry has an invalid or duplicate id.');
    }
    const seriesName = typeof series === 'string' ? series.trim() : '';
    if(typeof title !== 'string' || !title.trim() || title.length > 200 ||
      !SERIES_ORDER.has(seriesName) || seriesName.length > 100) {
      throw new Error(`Cinema catalog entry ${id} has invalid display metadata.`);
    }
    if(!Number.isInteger(season) || season < 1 || season > (seriesName === 'Merlin' ? 5 : 100) ||
      !Number.isInteger(episode) || episode < 1 || episode > 1000) {
      throw new Error(`Cinema catalog entry ${id} has invalid episode metadata.`);
    }
    if(typeof src !== 'string' || src.length > 4096 || !ALLOWED_MEDIA_TYPES.has(type)) {
      throw new Error(`Cinema catalog entry ${id} has an invalid media source.`);
    }

    let url;
    try {
      url = new URL(src);
    } catch{
      throw new Error(`Cinema catalog entry ${id} has an invalid media URL.`);
    }

    if(url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase()) ||
      url.username || url.password) {
      throw new Error(`Cinema catalog entry ${id} uses an unapproved media host.`);
    }

    seen.add(id);
    return {id, title: title.trim(), series: seriesName, season, episode, src: url.href, type};
  }).sort((first, second) =>
    SERIES_ORDER.get(first.series) - SERIES_ORDER.get(second.series) ||
    first.season - second.season ||
    first.episode - second.episode
  );
}

export default function handler(req, res) {
  if(req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({error: 'Method not allowed.'});
    return;
  }

  const raw = process.env.CINEMA_CATALOG_JSON;
  const hosts = process.env.CINEMA_MEDIA_HOSTS;
  if(!raw || !hosts) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({error: 'Licensed cinema catalog is not configured.'});
    return;
  }

  if(Buffer.byteLength(raw, 'utf8') > MAX_CATALOG_SIZE) {
    console.error('Cinema catalog configuration exceeds the maximum size.');
    res.status(500).json({error: 'Cinema catalog configuration is invalid.'});
    return;
  }

  try {
    const allowedHosts = new Set(hosts.split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
    if(allowedHosts.size === 0) {
      throw new Error('At least one approved cinema media host is required.');
    }

    const catalog = parseCatalog(raw, allowedHosts);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.status(200).json({items: catalog});
  } catch(error) {
    console.error('Cinema catalog configuration is invalid.', error);
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({error: 'Cinema catalog configuration is invalid.'});
  }
}
