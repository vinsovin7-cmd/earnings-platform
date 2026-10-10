import {For, Show, createSignal, onCleanup, onMount} from 'solid-js';
import {GeminiRequestError, GeminiTurn, buildGeminiRequest, getGeminiErrorMessage, getGeminiResponseText, shouldRetryGeminiAutomatically} from '@/geminiChat';

const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 1_200;

export default function GeminiCodingAssistant(props: {
  apiKey: string,
  keySaved: boolean,
  keyStatus: string,
  onApiKeyInput: (value: string) => void,
  onSaveKey: () => void,
  onRemoveKey: () => void
}) {
  const [expanded, setExpanded] = createSignal(true);
  const [messages, setMessages] = createSignal<GeminiTurn[]>([]);
  const [draft, setDraft] = createSignal('');
  const [pending, setPending] = createSignal(false);
  const [status, setStatus] = createSignal('Add your Google Gemini API key to start a chat.');
  const [errorMessage, setErrorMessage] = createSignal('');
  const [browserOnline, setBrowserOnline] = createSignal(true);
  let activeController: AbortController;
  let requestTimeout: number;
  let retryTimer: number;
  let expediteRetry: (() => void) | undefined;
  let cancelRetryWait: (() => void) | undefined;
  let lastRequestTurns: GeminiTurn[] | undefined;
  let disposed = false;
  let cancellationRequested = false;
  let requestGeneration = 0;

  const onOnline = () => {
    setBrowserOnline(true);
    expediteRetry?.();
  };

  const onOffline = () => setBrowserOnline(false);

  const waitForRetry = () => new Promise<boolean>((resolve) => {
    const finish = (shouldRetry: boolean) => {
      window.clearTimeout(retryTimer);
      retryTimer = undefined;
      if(expediteRetry === expedite) expediteRetry = undefined;
      if(cancelRetryWait === cancel) cancelRetryWait = undefined;
      resolve(shouldRetry);
    };
    const expedite = () => finish(true);
    const cancel = () => finish(false);
    expediteRetry = expedite;
    cancelRetryWait = cancel;
    retryTimer = window.setTimeout(expedite, RETRY_DELAY_MS);
  });

  const requestTurns = async(turns: GeminiTurn[]) => {
    if(!props.apiKey.trim() || pending()) return;
    const generation = ++requestGeneration;
    cancellationRequested = false;
    setPending(true);
    setErrorMessage('');

    try {
      for(let attempt = 0; attempt < 2; ++attempt) {
        const controller = new AbortController();
        activeController = controller;
        let timedOut = false;
        const timeout = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, REQUEST_TIMEOUT_MS);
        requestTimeout = timeout;

        try {
          const request = buildGeminiRequest(props.apiKey, turns);
          const response = await fetch(request.url, {...request.init, signal: controller.signal});
          if(!response.ok) throw new GeminiRequestError('http', response.status);
          const payload: unknown = await response.json();
          const text = getGeminiResponseText(payload);
          if(disposed || generation !== requestGeneration) return;
          setMessages((current) => [...current, {role: 'model', text}]);
          setStatus(`Gemini responded · HTTP ${response.status}.`);
          lastRequestTurns = undefined;
          return;
        } catch(error) {
          if(disposed || generation !== requestGeneration) return;
          if(controller.signal.aborted && !timedOut) {
            setStatus('Gemini request cancelled.');
            return;
          }

          const failure = timedOut ? 'timeout' :
            error instanceof GeminiRequestError ? error.kind :
              error instanceof TypeError ? 'network' : 'response';
          const retryableFailure = failure === 'http' ?
            shouldRetryGeminiAutomatically(attempt, 'http', error instanceof GeminiRequestError ? error.status : undefined) :
            shouldRetryGeminiAutomatically(attempt, failure);
          window.clearTimeout(timeout);
          requestTimeout = undefined;
          if(retryableFailure) {
            const retry = await waitForRetry();
            if(cancellationRequested) {
              setStatus('Gemini request cancelled.');
              return;
            }
            if(retry) {
              setStatus('Temporary Gemini connection issue. Retrying once…');
              continue;
            }
          }

          setErrorMessage(getGeminiErrorMessage(error, timedOut));
          setStatus('Gemini request did not complete.');
          return;
        } finally {
          window.clearTimeout(timeout);
          if(requestTimeout === timeout) requestTimeout = undefined;
          if(activeController === controller) activeController = undefined;
        }
      }
    } finally {
      if(!disposed && generation === requestGeneration) setPending(false);
    }
  };

  const submitMessage = (event: SubmitEvent) => {
    event.preventDefault();
    const text = draft().trim();
    if(!text || !props.apiKey.trim() || pending()) return;
    const turns: GeminiTurn[] = [...messages(), {role: 'user', text}];
    setMessages(turns);
    setDraft('');
    lastRequestTurns = turns;
    void requestTurns(turns);
  };

  const retryRequest = () => {
    if(lastRequestTurns) void requestTurns(lastRequestTurns);
  };

  const cancelRequest = () => {
    cancellationRequested = true;
    window.clearTimeout(requestTimeout);
    window.clearTimeout(retryTimer);
    cancelRetryWait?.();
    activeController?.abort();
  };

  const clearConversation = () => {
    ++requestGeneration;
    cancelRequest();
    setMessages([]);
    setDraft('');
    setErrorMessage('');
    lastRequestTurns = undefined;
    setPending(false);
    setStatus('Conversation cleared. Messages are only kept in memory.');
  };

  onMount(() => {
    setBrowserOnline(navigator.onLine);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  });

  onCleanup(() => {
    disposed = true;
    window.clearTimeout(requestTimeout);
    window.clearTimeout(retryTimer);
    cancelRetryWait?.();
    activeController?.abort();
    expediteRetry?.();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  });

  return (
    <section class="cinema-gemini" aria-labelledby="gemini-chat-title">
      <div class="cinema-gemini-heading">
        <div>
          <p class="cinema-eyebrow">DIRECT GOOGLE API CONNECTION</p>
          <h2 id="gemini-chat-title">
            <button
              class="cinema-gemini-toggle"
              type="button"
              aria-expanded={expanded()}
              aria-controls="gemini-chat-panel"
              onClick={() => setExpanded(!expanded())}
            >
              Gemini coding assistant
              <span aria-hidden="true">{expanded() ? '−' : '+'}</span>
            </button>
          </h2>
        </div>
        <span class="cinema-gemini-network">
          Browser reports {browserOnline() ? 'online' : 'offline'} · advisory only
        </span>
      </div>
      <div class="cinema-gemini-body" id="gemini-chat-panel" hidden={!expanded()}>
      <p class="cinema-gemini-disclosure">
        Your key is reused from this page’s localStorage setting. Browser localStorage is not a secure vault:
        this page and other same-origin scripts can read it. When you send a message, Google receives your
        prompt and conversation context. Usage consumes your Google project’s available quota and may be billable;
        check Google’s current terms and billing. Use a dedicated key with appropriate restrictions. Chat history
        stays in memory and is cleared when you leave or clear it.
      </p>
      <div class="cinema-gemini-key">
        <label for="gemini-chat-key">Google Gemini API key</label>
        <input
          id="gemini-chat-key"
          type="password"
          name="gemini-chat-key"
          autoComplete="off"
          value={props.apiKey}
          disabled={pending()}
          onInput={(event) => props.onApiKeyInput(event.currentTarget.value)}
        />
        <div class="cinema-gemini-actions">
          <button class="cinema-control" type="button" onClick={props.onSaveKey} disabled={pending()}>
            Save key on this device
          </button>
          <button class="cinema-control cinema-control-subtle" type="button" onClick={props.onRemoveKey} disabled={pending()}>
            Remove saved Gemini key
          </button>
        </div>
        <p class="cinema-gemini-key-status" role="status">
          {props.keyStatus || (props.keySaved ? 'Gemini key saved in this browser.' : 'Gemini key is not saved yet.')}
        </p>
      </div>
      <div class="cinema-gemini-transcript" aria-label="Conversation with Gemini">
        <Show when={messages().length} fallback={
          <p class="cinema-gemini-empty">Your conversation will appear here as plain text.</p>
        }>
          <ol>
            <For each={messages()}>{(message) =>
              <li class={`cinema-gemini-message is-${message.role}`}>
                <strong>{message.role === 'user' ? 'You' : 'Gemini'}</strong>
                <pre>{message.text}</pre>
              </li>
            }</For>
          </ol>
        </Show>
      </div>
      <form class="cinema-gemini-form" onSubmit={submitMessage}>
        <label for="gemini-chat-message">Message</label>
        <textarea
          id="gemini-chat-message"
          rows="3"
          value={draft()}
          disabled={pending()}
          onInput={(event) => setDraft(event.currentTarget.value)}
        />
        <div class="cinema-gemini-actions">
          <button class="cinema-control" type="submit" disabled={pending() || !props.apiKey.trim() || !draft().trim()}>
            Send to Gemini
          </button>
          <button class="cinema-control cinema-control-subtle" type="button" onClick={cancelRequest} disabled={!pending()}>
            Cancel request
          </button>
          <button class="cinema-control cinema-control-subtle" type="button" onClick={clearConversation}>
            Clear conversation
          </button>
          <Show when={errorMessage() && lastRequestTurns}>
            <button class="cinema-control cinema-control-subtle" type="button" onClick={retryRequest} disabled={pending()}>
              Retry message
            </button>
          </Show>
        </div>
      </form>
      <p class="cinema-gemini-status" role="status">{status()}</p>
      <Show when={errorMessage()}>
        <p class="cinema-gemini-error">{errorMessage()}</p>
      </Show>
      </div>
    </section>
  );
}
