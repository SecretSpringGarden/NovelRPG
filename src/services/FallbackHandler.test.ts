import { DefaultFallbackHandler, AssistantAPIError, createFallbackHandler } from './FallbackHandler';
import { LLMService } from './LLMService';

// Mock LLMService for testing
class MockLLMService implements LLMService {
  async initialize(): Promise<void> {}
  async analyzeText(): Promise<string> { return 'Mock response'; }
  async generateContent(): Promise<string> { return 'Mock generated content'; }
  validateResponse(): boolean { return true; }
}

describe('FallbackHandler', () => {
  let fallbackHandler: DefaultFallbackHandler;
  let mockLLMService: MockLLMService;

  beforeEach(() => {
    mockLLMService = new MockLLMService();
    fallbackHandler = new DefaultFallbackHandler(mockLLMService);
  });

  it('should create an instance', () => {
    expect(fallbackHandler).toBeDefined();
  });

  it('should determine fallback strategy', () => {
    const error = new AssistantAPIError('Test error', 'api_failure');
    const strategy = fallbackHandler.determineFallbackStrategy(error);
    
    expect(strategy).toBeDefined();
    expect(strategy.trigger).toBe('api_failure');
  });

  it('should chunk text appropriately', () => {
    const text = 'a'.repeat(1000);
    const chunks = fallbackHandler.chunkText(text, 300);
    
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length <= 300)).toBe(true);
  });

  it('should create AssistantAPIError from generic error', () => {
    const genericError = new Error('Rate limit exceeded');
    const apiError = AssistantAPIError.fromError(genericError);
    
    expect(apiError).toBeInstanceOf(AssistantAPIError);
    expect(apiError.code).toBe('quota_exceeded');
  });
});

describe('createFallbackHandler factory', () => {
  it('should create fallback handler', () => {
    const mockLLMService = new MockLLMService();
    const handler = createFallbackHandler(mockLLMService);
    expect(handler).toBeInstanceOf(DefaultFallbackHandler);
  });
});