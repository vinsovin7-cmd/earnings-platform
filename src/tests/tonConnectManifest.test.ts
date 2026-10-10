import tonConnectManifest from '../../scripts/tonConnectManifest';

describe('TON Connect preview manifest', () => {
  const createResponse = () => {
    const headers: Record<string, string> = {};
    return {
      headers,
      statusCode: 0,
      body: '',
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      end(body: string) {
        this.body = body;
      }
    };
  };

  it('returns a manifest scoped to the HTTPS preview origin', () => {
    const response = createResponse();
    const next = vi.fn();
    tonConnectManifest(
      {url: '/api/tonconnect-manifest?origin=https%3A%2F%2Fpreview.example'},
      response,
      next
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(JSON.parse(response.body)).toEqual({
      url: 'https://preview.example',
      name: 'Urban Cinema',
      iconUrl: 'https://preview.example/assets/img/logo.svg'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects non-HTTPS preview origins', () => {
    const response = createResponse();
    tonConnectManifest({url: '/api/tonconnect-manifest?origin=http%3A%2F%2Flocalhost'}, response, vi.fn());

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('HTTPS');
  });

  it('passes unrelated requests through', () => {
    const response = createResponse();
    const next = vi.fn();
    tonConnectManifest({url: '/cinema.html'}, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(0);
  });
});
