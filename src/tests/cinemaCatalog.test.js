import handler from '../../api/cinema-catalog';

function createResponse() {
  return {
    statusCode: 0,
    body: undefined,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };
}

describe('cinema catalog API', () => {
  const originalCatalog = process.env.CINEMA_CATALOG_JSON;
  const originalHosts = process.env.CINEMA_MEDIA_HOSTS;

  beforeEach(() => {
    delete process.env.CINEMA_CATALOG_JSON;
    delete process.env.CINEMA_MEDIA_HOSTS;
  });

  afterEach(() => {
    if(originalCatalog === undefined) delete process.env.CINEMA_CATALOG_JSON;
    else process.env.CINEMA_CATALOG_JSON = originalCatalog;
    if(originalHosts === undefined) delete process.env.CINEMA_MEDIA_HOSTS;
    else process.env.CINEMA_MEDIA_HOSTS = originalHosts;
  });

  it('reports an unconfigured catalog instead of returning fabricated titles', () => {
    const response = createResponse();
    handler({method: 'GET'}, response);

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({error: 'Licensed cinema catalog is not configured.'});
  });

  it('orders configured episodes by series, season and episode', () => {
    process.env.CINEMA_MEDIA_HOSTS = 'media.example.com';
    process.env.CINEMA_CATALOG_JSON = JSON.stringify([
      {id: 'seeker-1', title: 'Seeker episode 1', series: 'Legend of the Seeker', season: 1, episode: 1, src: 'https://media.example.com/seeker.m3u8', type: 'application/vnd.apple.mpegurl'},
      {id: 'merlin-2', title: 'Merlin episode 2', series: 'Merlin', season: 1, episode: 2, src: 'https://media.example.com/merlin-2.m3u8', type: 'application/vnd.apple.mpegurl'},
      {id: 'merlin-1', title: 'Merlin episode 1', series: 'Merlin', season: 1, episode: 1, src: 'https://media.example.com/merlin-1.m3u8', type: 'application/vnd.apple.mpegurl'}
    ]);
    const response = createResponse();
    handler({method: 'GET'}, response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      items: [
        {id: 'merlin-1'},
        {id: 'merlin-2'},
        {id: 'seeker-1'}
      ]
    });
  });

  it('rejects streams hosted outside the configured allowlist', () => {
    process.env.CINEMA_MEDIA_HOSTS = 'media.example.com';
    process.env.CINEMA_CATALOG_JSON = JSON.stringify([
      {id: 'merlin-1', title: 'Episode 1', series: 'Merlin', season: 1, episode: 1, src: 'https://unapproved.example/episode.m3u8', type: 'application/vnd.apple.mpegurl'}
    ]);
    const response = createResponse();
    handler({method: 'GET'}, response);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({error: 'Cinema catalog configuration is invalid.'});
  });

  it('rejects methods other than GET', () => {
    const response = createResponse();
    handler({method: 'POST'}, response);

    expect(response.statusCode).toBe(405);
    expect(response.headers.Allow).toBe('GET');
  });
});
