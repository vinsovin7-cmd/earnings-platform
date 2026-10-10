import {GEMINI_ENDPOINT, GEMINI_MODEL, GeminiRequestError, buildGeminiRequest, getGeminiErrorMessage, getGeminiResponseText, shouldRetryGeminiAutomatically} from '@/geminiChat';

describe('Gemini chat request helpers', () => {
  it('builds direct generateContent requests with the key only in the header', () => {
    const request = buildGeminiRequest('  user-owned-key  ', [
      {role: 'user', text: '<script>plain text</script>'},
      {role: 'model', text: 'A plain text answer.'}
    ]);
    const body = JSON.parse(request.init.body);

    expect(GEMINI_MODEL).toBe('gemini-2.5-flash');
    expect(request.url).toBe(GEMINI_ENDPOINT);
    expect(request.url).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent$/);
    expect(request.url).not.toContain('key=');
    expect(request.init.headers['x-goog-api-key']).toBe('user-owned-key');
    expect(body.contents).toEqual([
      {role: 'user', parts: [{text: '<script>plain text</script>'}]},
      {role: 'model', parts: [{text: 'A plain text answer.'}]}
    ]);
  });

  it('extracts candidate text and rejects malformed or empty responses', () => {
    expect(getGeminiResponseText({
      candidates: [{content: {parts: [{text: 'Hello '}, {text: 'there.'}]}}]
    })).toBe('Hello there.');
    expect(() => getGeminiResponseText({candidates: []})).toThrow(GeminiRequestError);
    expect(() => getGeminiResponseText({
      candidates: [{content: {parts: [{inlineData: {data: 'not text'}}]}}]
    })).toThrow('Gemini returned an invalid response.');
  });

  it('redacts provider error bodies and categorizes key, quota, server, and timeout failures', () => {
    expect(getGeminiErrorMessage(new GeminiRequestError('http', 403))).toContain('Check the key');
    expect(getGeminiErrorMessage(new GeminiRequestError('http', 429))).toContain('quota or rate limit');
    expect(getGeminiErrorMessage(new GeminiRequestError('http', 503))).toContain('HTTP 503');
    expect(getGeminiErrorMessage(new Error('secret prompt and key'), true)).toContain('30-second limit');
    expect(getGeminiErrorMessage(new GeminiRequestError('response'))).toContain('unreadable or empty');
  });

  it('allows at most one automatic retry for network, timeout, or server failures', () => {
    expect(shouldRetryGeminiAutomatically(0, 'network')).toBe(true);
    expect(shouldRetryGeminiAutomatically(0, 'timeout')).toBe(true);
    expect(shouldRetryGeminiAutomatically(0, 'http', 503)).toBe(true);
    expect(shouldRetryGeminiAutomatically(0, 'http', 429)).toBe(false);
    expect(shouldRetryGeminiAutomatically(0, 'response')).toBe(false);
    expect(shouldRetryGeminiAutomatically(1, 'network')).toBe(false);
  });

  it('keeps abort signals on the request and does not convert cancellation into a retry', async() => {
    const controller = new AbortController();
    const request = buildGeminiRequest('key', [{role: 'user', text: 'hello'}]);
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      expect(init.signal).toBe(controller.signal);
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });

    await expect(fetcher(request.url, {...request.init, signal: controller.signal})).rejects.toMatchObject({
      name: 'AbortError'
    });
    expect(shouldRetryGeminiAutomatically(0, 'response')).toBe(false);
  });
});
