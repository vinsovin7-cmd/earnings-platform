export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type GeminiTurn = {
  role: 'user' | 'model',
  text: string
};

export class GeminiRequestError extends Error {
  constructor(
    readonly kind: 'http' | 'response',
    readonly status?: number
  ) {
    super(kind === 'http' ? 'Gemini request failed.' : 'Gemini returned an invalid response.');
  }
}

export function buildGeminiRequest(apiKey: string, turns: GeminiTurn[]) {
  return {
    url: GEMINI_ENDPOINT,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim()
      },
      body: JSON.stringify({
        contents: turns.map(({role, text}) => ({
          role,
          parts: [{text}]
        }))
      })
    }
  };
}

export function getGeminiResponseText(payload: unknown) {
  if(!payload || typeof payload !== 'object' || !('candidates' in payload) ||
    !Array.isArray(payload.candidates)) {
    throw new GeminiRequestError('response');
  }

  const candidate = payload.candidates[0];
  if(!candidate || typeof candidate !== 'object' || !('content' in candidate) ||
    !candidate.content || typeof candidate.content !== 'object' ||
    !('parts' in candidate.content) || !Array.isArray(candidate.content.parts)) {
    throw new GeminiRequestError('response');
  }

  const text = candidate.content.parts
    .filter((part: unknown): part is {text: string} =>
      Boolean(part && typeof part === 'object' && 'text' in part && typeof part.text === 'string'))
    .map((part) => part.text)
    .join('');
  if(!text.trim()) throw new GeminiRequestError('response');
  return text;
}

export function getGeminiErrorMessage(error: unknown, timedOut = false) {
  if(timedOut) return 'Gemini did not respond before the 30-second limit. You can retry.';
  if(error instanceof GeminiRequestError) {
    if(error.kind === 'response') return 'Gemini returned an unreadable or empty response. You can retry.';
    if(error.status === 401 || error.status === 403) {
      return 'Gemini rejected this key or its permissions. Check the key and API access in your Google project.';
    }
    if(error.status === 429) return 'Gemini reported a quota or rate limit. Check your Google project and try again later.';
    return error.status && error.status >= 500 ?
      `Gemini is temporarily unavailable (HTTP ${error.status}). You can retry.` :
      `Gemini request failed (HTTP ${error.status || 'unknown'}). Check the key and try again.`;
  }
  return 'Gemini could not be reached. Check your connection and retry.';
}

export function shouldRetryGeminiAutomatically(attempt: number, failure: 'network' | 'timeout' | 'http' | 'response', status?: number) {
  return attempt === 0 && (failure === 'network' || failure === 'timeout' ||
    (failure === 'http' && status !== undefined && status >= 500));
}
