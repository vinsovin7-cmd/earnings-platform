import {GeminiTurn, buildGeminiRequest, getGeminiResponseText, GEMINI_MODEL} from './geminiChat';

/**
 * State types for the companion conversation flow
 */
export type CompanionSessionState = 
  | 'idle'
  | 'greeting'      // Initial greeting
  | 'wellbeing'     // Asking about well-being
  | 'meals'         // Asking about meals
  | 'rest'          // Asking about rest
  | 'focus'         // Asking about focus/work
  | 'follow_up'     // Follow-up question based on previous answers
  | 'wrapping_up'   // Starting to wrap up
  | 'goodbye'       // Final goodbye
  | 'complete';     // Session complete

/**
 * Configuration for the companion's personality and behavior
 */
export interface CompanionConfig {
  name?: string;
  personality?: string;
  maxTurns?: number;
  timeoutMs?: number;
}

/**
 * Message in the companion conversation
 */
export interface CompanionMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  state?: CompanionSessionState;
}

/**
 * Result of a companion session turn
 */
export interface CompanionTurnResult {
  message: string;
  nextState: CompanionSessionState;
  isFinal: boolean;
}

/**
 * Callback for companion events
 */
export interface CompanionEventCallback {
  onMessage?: (message: CompanionMessage) => void;
  onStateChange?: (state: CompanionSessionState) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * The main companion session manager class
 * Handles multi-turn conversations with state management
 */
export class GeminiCompanionSession {
  private apiKey: string;
  private state: CompanionSessionState = 'idle';
  private messages: CompanionMessage[] = [];
  private turnCount: number = 0;
  private config: Required<CompanionConfig>;
  private callbacks: CompanionEventCallback = {};
  private activeController: AbortController | null = null;
  private disposed: boolean = false;
  private conversationTimeout: number | null = null;
  
  // System prompt for the companion
  private static readonly SYSTEM_PROMPT = `
You are a deeply caring, warm, low-key friend who checks in on well-being. 
Be gentle, empathetic, and supportive. 
Ask natural, conversational questions about:
- How they're feeling emotionally
- If they've eaten properly today
- If they're getting enough rest
- If they're staying focused or need breaks

Keep responses brief (1-3 sentences maximum). 
Be warm and personal but not intrusive. 
End naturally when the conversation feels complete.
Use simple, natural language. 
Never mention you're an AI or that this is a check-in.
Speak as a real friend would.
`;

  constructor(apiKey: string, config: CompanionConfig = {}) {
    this.apiKey = apiKey.trim();
    this.config = {
      name: config.name || 'Friend',
      personality: config.personality || 'caring, warm, low-key',
      maxTurns: config.maxTurns || 8,
      timeoutMs: config.timeoutMs || 30_000
    };
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: CompanionEventCallback): void {
    this.callbacks = callbacks;
  }

  /**
   * Get current session state
   */
  getState(): CompanionSessionState {
    return this.state;
  }

  /**
   * Get all messages in the conversation
   */
  getMessages(): CompanionMessage[] {
    return [...this.messages];
  }

  /**
   * Get current turn count
   */
  getTurnCount(): number {
    return this.turnCount;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.state !== 'idle' && this.state !== 'complete';
  }

  /**
   * Check if session has reached max turns
   */
  isAtMaxTurns(): boolean {
    return this.turnCount >= this.config.maxTurns;
  }

  /**
   * Start a new companion check-in session
   */
  async startSession(): Promise<CompanionMessage | null> {
    if(this.disposed || this.state !== 'idle') {
      return null;
    }

    this.state = 'greeting';
    this.turnCount = 0;
    this.messages = [];
    this.callbacks.onStateChange?.(this.state);

    // Cancel any existing timeout
    this.clearConversationTimeout();

    // Start with an initial greeting
    const greeting = this.generateGreeting();
    const greetingMessage: CompanionMessage = {
      role: 'model',
      text: greeting,
      timestamp: Date.now(),
      state: 'greeting'
    };

    this.messages.push(greetingMessage);
    this.turnCount++;
    this.callbacks.onMessage?.(greetingMessage);

    // Set timeout for conversation
    this.conversationTimeout = window.setTimeout(() => {
      if(this.state !== 'complete') {
        this.wrapUpSession();
      }
    }, this.config.timeoutMs);

    return greetingMessage;
  }

  /**
   * Generate the initial greeting message
   */
  private generateGreeting(): string {
    const greetings = [
      "Hey there... how are you feeling right now?",
      "Hi friend. What's going on with you today?",
      "Hello... how's your day been treating you so far?",
      "Hey... just checking in. How are you doing?",
      "Hi there. How's your heart feeling today?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Generate a follow-up question based on the conversation state
   */
  private generateFollowUpQuestion(prevUserMessage: string, currentState: CompanionSessionState): string {
    const userMessageLower = prevUserMessage.toLowerCase();
    
    // State-specific follow-ups
    switch(currentState) {
      case 'wellbeing':
        if(userMessageLower.includes('good') || userMessageLower.includes('great') || userMessageLower.includes('fine')) {
          return "That's wonderful to hear. Have you had a chance to eat something good today?";
        } else if(userMessageLower.includes('tired') || userMessageLower.includes('exhausted') || userMessageLower.includes('drained')) {
          return "I hear that. Have you been getting enough rest lately?";
        } else {
          return "Tell me more about that. How's your energy been?";
        }
      
      case 'meals':
        if(userMessageLower.includes('yes') || userMessageLower.includes('ate') || userMessageLower.includes('eat')) {
          return "What did you have? Was it good?";
        } else if(userMessageLower.includes('no') || userMessageLower.includes('not yet') || userMessageLower.includes('haven\'t')) {
          return "Oh, you should take care of yourself. Even a small snack helps. Have you been able to rest a bit today?";
        } else {
          return "Food is important. Are you remembering to take breaks too?";
        }
      
      case 'rest':
        if(userMessageLower.includes('yes') || userMessageLower.includes('slept') || userMessageLower.includes('rested')) {
          return "That's good. Rest is so important. Are you finding time to focus on what matters to you?";
        } else if(userMessageLower.includes('no') || userMessageLower.includes('not enough') || userMessageLower.includes('tired')) {
          return "You deserve rest. Try to be kind to yourself today. Are you staying hydrated at least?";
        } else {
          return "Tell me about your sleep. Have you been able to focus on your work okay?";
        }
      
      case 'focus':
        if(userMessageLower.includes('yes') || userMessageLower.includes('focused') || userMessageLower.includes('good')) {
          return "That's great to hear. I'm glad you're in a good flow. Anything else on your mind?";
        } else if(userMessageLower.includes('no') || userMessageLower.includes('distracted') || userMessageLower.includes('struggling')) {
          return "That's tough. Remember to take small breaks - they actually help you focus better. Would you like to talk about what's distracting you?";
        } else {
          return "How's your focus been today?";
        }
      
      case 'follow_up':
        // More personal follow-ups
        if(userMessageLower.includes('work') || userMessageLower.includes('job') || userMessageLower.includes('project')) {
          return "Work can be a lot. Are you taking care of yourself while you're busy?";
        } else if(userMessageLower.includes('stress') || userMessageLower.includes('anxious') || userMessageLower.includes('worried')) {
          return "I'm sorry to hear that. Remember to breathe. Small moments of calm help. Is there anything I can do to support you?";
        } else if(userMessageLower.includes('happy') || userMessageLower.includes('joy') || userMessageLower.includes('excited')) {
          return "Your happiness matters. What's bringing you joy today?";
        } else {
          return "I'm here with you. Is there anything you'd like to share?";
        }
      
      default:
        return "That's interesting. How does that make you feel?";
    }
  }

  /**
   * Handle user response and generate next companion message
   */
  async handleUserMessage(userText: string): Promise<CompanionMessage | null> {
    if(this.disposed || this.state === 'complete' || this.state === 'idle') {
      return null;
    }

    // Add user message
    const userMessage: CompanionMessage = {
      role: 'user',
      text: userText,
      timestamp: Date.now(),
      state: this.state
    };
    this.messages.push(userMessage);
    this.callbacks.onMessage?.(userMessage);

    // Check if user is signaling they want to end the conversation
    const shouldEnd = this.shouldEndConversation(userText);
    if(shouldEnd) {
      this.state = 'wrapping_up';
      this.callbacks.onStateChange?.(this.state);
      const goodbyeMessage = this.generateGoodbye();
      return this.createAndSendModelMessage(goodbyeMessage, 'goodbye', true);
    }

    // Determine next state and generate response
    const nextState = this.determineNextState();
    
    if(nextState === 'wrapping_up' || nextState === 'goodbye' || nextState === 'complete') {
      this.state = nextState;
      this.callbacks.onStateChange?.(this.state);
      const responseText = this.generateGoodbye();
      return this.createAndSendModelMessage(responseText, nextState, true);
    }

    this.state = nextState;
    this.callbacks.onStateChange?.(this.state);

    // Generate response based on state
    let responseText: string;
    if(this.turnCount < 2) {
      // First follow-up after greeting
      responseText = this.generateFollowUpQuestion(userText, this.state);
    } else if(this.isAtMaxTurns()) {
      // Time to wrap up
      this.state = 'wrapping_up';
      this.callbacks.onStateChange?.(this.state);
      responseText = this.generateWrapUp();
    } else {
      // Continue conversation
      responseText = this.generateFollowUpQuestion(userText, this.state);
    }

    this.turnCount++;
    return this.createAndSendModelMessage(responseText, this.state, false);
  }

  /**
   * Create and send a model message
   */
  private createAndSendModelMessage(
    text: string,
    state: CompanionSessionState,
    isFinal: boolean
  ): CompanionMessage {
    const message: CompanionMessage = {
      role: 'model',
      text,
      timestamp: Date.now(),
      state
    };
    this.messages.push(message);
    this.callbacks.onMessage?.(message);

    if(isFinal) {
      this.state = 'complete';
      this.callbacks.onStateChange?.(this.state);
      this.callbacks.onComplete?.();
      this.clearConversationTimeout();
    }

    return message;
  }

  /**
   * Determine the next state based on turn count and conversation flow
   */
  private determineNextState(): CompanionSessionState {
    const states: CompanionSessionState[] = [
      'greeting',
      'wellbeing',
      'meals',
      'rest',
      'focus',
      'follow_up',
      'follow_up',
      'wrapping_up'
    ];

    // If we're already in wrapping_up, stay there
    if(this.state === 'wrapping_up' || this.state === 'goodbye') {
      return 'goodbye';
    }

    // Get next state in sequence
    const currentIndex = states.indexOf(this.state);
    const nextIndex = currentIndex + 1;

    if(nextIndex >= states.length) {
      return 'wrapping_up';
    }

    return states[nextIndex];
  }

  /**
   * Check if user message signals end of conversation
   */
  private shouldEndConversation(userText: string): boolean {
    const textLower = userText.toLowerCase();
    const endSignals = [
      'goodbye',
      'bye',
      'see you',
      'talk later',
      'catch you later',
      'got to go',
      'need to work',
      'back to work',
      'busy',
      'later',
      'bye bye',
      'take care',
      'see ya'
    ];
    return endSignals.some(signal => textLower.includes(signal));
  }

  /**
   * Generate wrap-up message
   */
  private generateWrapUp(): string {
    const wrapUps = [
      "It's been nice talking. Take care of yourself, okay?",
      "I should let you get back to things. Remember to be kind to yourself.",
      "Our little chat means a lot. Don't forget to look after yourself.",
      "I'll let you go. Stay well, friend.",
      "Time for me to step back. You're doing great."
    ];
    return wrapUps[Math.floor(Math.random() * wrapUps.length)];
  }

  /**
   * Generate final goodbye message
   */
  private generateGoodbye(): string {
    const goodbyes = [
      "Talk to you next time my friend... take care",
      "Take care, my friend. Until next time.",
      "Goodbye for now. Talk to you next time, my friend... take care",
      "See you next time. Take care of yourself.",
      "Until we meet again. Take care, my friend."
    ];
    return goodbyes[Math.floor(Math.random() * goodbyes.length)];
  }

  /**
   * Wrap up the session gracefully
   */
  async wrapUpSession(): Promise<CompanionMessage | null> {
    if(this.disposed || this.state === 'complete') {
      return null;
    }

    this.state = 'wrapping_up';
    this.callbacks.onStateChange?.(this.state);

    const wrapUpMessage = this.generateWrapUp();
    this.createAndSendModelMessage(wrapUpMessage, 'wrapping_up', false);

    // Wait a moment then send final goodbye
    await new Promise(resolve => setTimeout(resolve, 1500));

    if(this.disposed) return null;

    const goodbyeMessage = this.generateGoodbye();
    return this.createAndSendModelMessage(goodbyeMessage, 'goodbye', true);
  }

  /**
   * Send message using Gemini API (for dynamic responses)
   */
  async sendWithGemini(userMessage: string): Promise<CompanionMessage | null> {
    if(this.disposed || !this.apiKey || this.state === 'complete') {
      return null;
    }

    // Build conversation context
    const turns: GeminiTurn[] = [
      {role: 'user', text: GeminiCompanionSession.SYSTEM_PROMPT},
      ...this.messages.map(m => ({role: m.role, text: m.text}))
    ];
    
    // Add the new user message
    turns.push({role: 'user', text: userMessage});

    this.activeController?.abort();
    const controller = new AbortController();
    this.activeController = controller;

    try {
      const request = buildGeminiRequest(this.apiKey, turns);
      const response = await fetch(request.url, {
        ...request.init,
        signal: controller.signal
      });

      if(!response.ok) {
        throw new Error(`Gemini request failed: ${response.status}`);
      }

      const payload = await response.json();
      const text = getGeminiResponseText(payload);
      
      return this.createAndSendModelMessage(text, this.state, false);
    } catch(error) {
      if(error instanceof Error && error.name === 'AbortError') {
        return null; // Request was cancelled
      }
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      return null;
    } finally {
      if(this.activeController === controller) {
        this.activeController = null;
      }
    }
  }

  /**
   * Cancel any ongoing request
   */
  cancelRequest(): void {
    this.activeController?.abort();
    this.activeController = null;
  }

  /**
   * Clear conversation timeout
   */
  private clearConversationTimeout(): void {
    if(this.conversationTimeout) {
      window.clearTimeout(this.conversationTimeout);
      this.conversationTimeout = null;
    }
  }

  /**
   * Reset the session
   */
  reset(): void {
    this.cancelRequest();
    this.clearConversationTimeout();
    this.state = 'idle';
    this.messages = [];
    this.turnCount = 0;
    this.callbacks.onStateChange?.(this.state);
  }

  /**
   * Dispose of the session
   */
  dispose(): void {
    this.disposed = true;
    this.cancelRequest();
    this.clearConversationTimeout();
    this.state = 'idle';
  }
}

/**
 * Create a companion session with focus/visibility trigger integration
 */
export function createCompanionSessionWithTriggers(
  apiKey: string,
  config: CompanionConfig = {},
  callbacks: CompanionEventCallback = {}
): { session: GeminiCompanionSession, dispose: () => void } {
  const session = new GeminiCompanionSession(apiKey, config);
  session.setCallbacks(callbacks);

  let visibilityHandler: (() => void) | null = null;
  let focusHandler: (() => void) | null = null;

  const startOnFocus = () => {
    if(document.visibilityState === 'visible') {
      // Start session when page becomes visible and focused
      if(!session.isActive()) {
        session.startSession();
      }
    }
  };

  const handleVisibilityChange = () => {
    if(document.visibilityState === 'visible') {
      // User has returned to the page
      if(!session.isActive()) {
        session.startSession();
      }
    }
  };

  const handleFocus = () => {
    if(!session.isActive()) {
      session.startSession();
    }
  };

  // Set up event listeners
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);

  // Initial check
  if(document.visibilityState === 'visible') {
    setTimeout(() => handleFocus(), 100);
  }

  const dispose = () => {
    session.dispose();
    if(visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
    }
    if(focusHandler) {
      window.removeEventListener('focus', focusHandler);
    }
  };

  return {session, dispose};
}
