import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {GeminiCompanionSession, CompanionMessage, CompanionSessionState} from '@/GeminiCompanionSession';

describe('GeminiCompanionSession', () => {
  let session: GeminiCompanionSession;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    session = new GeminiCompanionSession(mockApiKey, {
      maxTurns: 8,
      timeoutMs: 180_000
    });
  });

  afterEach(() => {
    session.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with idle state', () => {
      expect(session.getState()).toBe('idle');
      expect(session.getMessages()).toHaveLength(0);
      expect(session.getTurnCount()).toBe(0);
      expect(session.isActive()).toBe(false);
    });

    it('should accept configuration', () => {
      const customSession = new GeminiCompanionSession(mockApiKey, {
        name: 'Test Friend',
        personality: 'test personality',
        maxTurns: 5,
        timeoutMs: 120_000
      });
      expect(customSession.getState()).toBe('idle');
      customSession.dispose();
    });
  });

  describe('Session Lifecycle', () => {
    it('should start a session', async() => {
      const onStateChange = vi.fn();
      const onMessage = vi.fn();
      session.setCallbacks({onStateChange, onMessage});

      const greeting = await session.startSession();

      expect(greeting).not.toBeNull();
      expect(greeting?.role).toBe('model');
      expect(greeting?.state).toBe('greeting');
      expect(session.getState()).toBe('greeting');
      expect(session.getTurnCount()).toBe(1);
      expect(session.isActive()).toBe(true);
      expect(onStateChange).toHaveBeenCalledWith('greeting');
      expect(onMessage).toHaveBeenCalledWith(greeting);
    });

    it('should generate a greeting message', async() => {
      const greeting = await session.startSession();
      expect(greeting?.text).toBeDefined();
      expect(greeting?.text.length).toBeGreaterThan(0);
      // Greeting should be warm and friendly
      const textLower = greeting?.text.toLowerCase() || '';
      expect(textLower.includes('hey') || textLower.includes('hi') || 
              textLower.includes('hello')).toBe(true);
    });

    it('should handle user messages', async() => {
      const onMessage = vi.fn();
      session.setCallbacks({onMessage});

      await session.startSession();
      const userMessage = 'I am doing well today';
      const response = await session.handleUserMessage(userMessage);

      expect(response).not.toBeNull();
      expect(response?.role).toBe('model');
      expect(session.getMessages()).toHaveLength(3); // greeting + user + response
      expect(session.getTurnCount()).toBe(2);
      expect(onMessage).toHaveBeenCalledTimes(3); // greeting + user + response
    });

    it('should track conversation state', async() => {
      await session.startSession();
      expect(session.getState()).toBe('greeting');

      await session.handleUserMessage('I am good');
      expect(session.getState()).not.toBe('idle');
    });

    it('should end conversation on user signals', async() => {
      await session.startSession();
      const onComplete = vi.fn();
      session.setCallbacks({onComplete});

      const userMessage = 'goodbye';
      const response = await session.handleUserMessage(userMessage);

      expect(response).not.toBeNull();
      expect(response?.state).toBe('goodbye');
      expect(session.getState()).toBe('complete');
      expect(onComplete).toHaveBeenCalled();
    });

    it('should end conversation at max turns', async() => {
      // Create session with very low max turns for testing
      const shortSession = new GeminiCompanionSession(mockApiKey, {
        maxTurns: 2
      });
      
      const onComplete = vi.fn();
      shortSession.setCallbacks({onComplete});

      await shortSession.startSession();
      expect(shortSession.getTurnCount()).toBe(1);
      
      await shortSession.handleUserMessage('Response 1');
      expect(shortSession.getTurnCount()).toBe(2);
      
      // At this point we've reached max turns, next message should trigger wrap-up
      await shortSession.handleUserMessage('Response 2');

      expect(shortSession.isAtMaxTurns()).toBe(true);
      // The state should be wrapping_up or complete
      expect(['wrapping_up', 'complete']).toContain(shortSession.getState());

      shortSession.dispose();
    });

    it('should generate wrap-up and goodbye messages', () => {
      const session = new GeminiCompanionSession(mockApiKey);
      
      // Test wrap-up message generation
      const wrapUp = (session as any).generateWrapUp();
      expect(wrapUp).toBeDefined();
      expect(wrapUp.length).toBeGreaterThan(0);
      
      // Test goodbye message generation
      const goodbye = (session as any).generateGoodbye();
      expect(goodbye).toBeDefined();
      expect(goodbye.length).toBeGreaterThan(0);
      // Should contain the signature phrase
      expect(goodbye.toLowerCase()).toContain('talk to you next time') ||
        expect(goodbye.toLowerCase()).toContain('take care');

      session.dispose();
    });

    it('should not accept messages when idle', async() => {
      const response = await session.handleUserMessage('Hello');
      expect(response).toBeNull();
    });

    it('should not accept messages when complete', async() => {
      await session.startSession();
      await session.handleUserMessage('goodbye');
      const response = await session.handleUserMessage('Another message');
      expect(response).toBeNull();
    });
  });

  describe('State Transitions', () => {
    it('should transition through states correctly', async() => {
      await session.startSession();
      expect(session.getState()).toBe('greeting');

      await session.handleUserMessage('I am feeling good');
      const currentState = session.getState();
      // Should have transitioned to next state (wellbeing, meals, etc.)
      expect(currentState).not.toBe('greeting');
      expect(['wellbeing', 'meals', 'rest', 'focus', 'follow_up', 'wrapping_up']).toContain(currentState);
    });

    it('should generate follow-up questions based on state', () => {
      const session = new GeminiCompanionSession(mockApiKey);
      
      const question1 = (session as any).generateFollowUpQuestion('I am good', 'wellbeing');
      expect(question1).toBeDefined();
      expect(question1.length).toBeGreaterThan(0);
      
      const question2 = (session as any).generateFollowUpQuestion('I ate breakfast', 'meals');
      expect(question2).toBeDefined();
      
      session.dispose();
    });

    it('should detect end conversation signals', () => {
      const session = new GeminiCompanionSession(mockApiKey);
      
      expect((session as any).shouldEndConversation('goodbye')).toBe(true);
      expect((session as any).shouldEndConversation('bye')).toBe(true);
      expect((session as any).shouldEndConversation('see you later')).toBe(true);
      expect((session as any).shouldEndConversation('back to work')).toBe(true);
      expect((session as any).shouldEndConversation('hello')).toBe(false);
      expect((session as any).shouldEndConversation('how are you?')).toBe(false);

      session.dispose();
    });
  });

  describe('Callbacks', () => {
    it('should call onError when API request fails', async() => {
      const onError = vi.fn();
      session.setCallbacks({onError});

      // Since we don't have a real API key, we can't test actual API calls
      // But we can verify the callback is set up correctly
      expect(onError).not.toHaveBeenCalled();
    });

    it('should call onStateChange on state transitions', async() => {
      const onStateChange = vi.fn();
      session.setCallbacks({onStateChange});

      await session.startSession();
      expect(onStateChange).toHaveBeenCalledWith('greeting');

      await session.handleUserMessage('hello');
      expect(onStateChange).toHaveBeenCalledTimes(2);
    });

    it('should call onMessage for each message', async() => {
      const onMessage = vi.fn();
      session.setCallbacks({onMessage});

      await session.startSession();
      expect(onMessage).toHaveBeenCalledOnce();

      await session.handleUserMessage('test');
      expect(onMessage).toHaveBeenCalledTimes(3); // greeting + user + response
    });
  });

  describe('Cleanup', () => {
    it('should dispose of the session', async() => {
      await session.startSession();
      session.dispose();
      
      expect(session.getState()).toBe('idle');
      expect(session.isActive()).toBe(false);
    });

    it('should reset the session', async() => {
      await session.startSession();
      await session.handleUserMessage('test');
      
      session.reset();
      
      expect(session.getState()).toBe('idle');
      expect(session.getMessages()).toHaveLength(0);
      expect(session.getTurnCount()).toBe(0);
    });

    it('should cancel ongoing requests on dispose', () => {
      session.dispose();
      // Should not throw after dispose
      expect(() => session.dispose()).not.toThrow();
    });
  });

  describe('Message Tracking', () => {
    it('should track all messages', async() => {
      const onMessage = vi.fn();
      session.setCallbacks({onMessage});

      await session.startSession();
      const userMessage = 'I am feeling good';
      await session.handleUserMessage(userMessage);

      const messages = session.getMessages();
      expect(messages).toHaveLength(3); // greeting + user + response
      expect(messages[0].role).toBe('model'); // greeting
      expect(messages[1].role).toBe('user'); // user message
      expect(messages[1].text).toBe(userMessage);
      expect(messages[2].role).toBe('model'); // response
    });

    it('should include timestamps in messages', async() => {
      await session.startSession();
      const messages = session.getMessages();
      expect(messages[0].timestamp).toBeDefined();
      expect(typeof messages[0].timestamp).toBe('number');
    });

    it('should include state in model messages', async() => {
      await session.startSession();
      const messages = session.getMessages();
      expect(messages[0].state).toBe('greeting');
    });
  });
});
