import handler from '../../api/tonconnect-manifest';

type MockResponse = {
  headers: Record<string, string>,
  statusCode: number,
  body: unknown,
  setHeader: (name: string, value: string) => void,
  status: (code: number) => MockResponse,
  json: (body: unknown) => void
};

describe('TON Connect production manifest endpoint', () => {
  const createResponse = () => {
    const headers: Record<string, string> = {};
    const response: MockResponse = {
      headers,
      statusCode: 0,
      body: undefined as unknown,
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
      status(code: number) {
        response.statusCode = code;
        return response;
      },
      json(body: unknown) {
        response.body = body;
      }
    };
    return response;
  };

  it('returns a manifest for the forwarded HTTPS custom domain', () => {
    const response = createResponse();
    handler({
      method: 'GET',
      headers: {'x-forwarded-proto': 'https', host: 'cinema.example'}
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Cache-Control']).toBe('no-store');
    expect(response.body).toEqual({
      url: 'https://cinema.example',
      name: 'Urban Cinema',
      iconUrl: 'https://cinema.example/assets/img/logo.svg'
    });
  });

  it('rejects a non-HTTPS forwarded protocol', () => {
    const response = createResponse();
    handler({
      method: 'GET',
      headers: {'x-forwarded-proto': 'http', host: 'cinema.example'}
    }, response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({error: 'A valid HTTPS request origin is required.'});
  });

  it('rejects missing origin headers', () => {
    const response = createResponse();
    handler({method: 'GET', headers: {}}, response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({error: 'A valid HTTPS request origin is required.'});
  });

  it('rejects non-GET requests', () => {
    const response = createResponse();
    handler({
      method: 'POST',
      headers: {'x-forwarded-proto': 'https', host: 'cinema.example'}
    }, response);

    expect(response.statusCode).toBe(405);
    expect(response.headers.Allow).toBe('GET');
  });
});
