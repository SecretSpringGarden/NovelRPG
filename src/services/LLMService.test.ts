import { OpenAILLMService, createLLMService } from './LLMService';
import { LLMConfig } from '../config/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('LLMService', () => {
  let service: OpenAILLMService;
  let mockConfig: LLMConfig;

  beforeEach(() => {
    service = new OpenAILLMService();
    mockConfig = {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-api-key',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30000
    };
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  it('should create an instance', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with valid config', async () => {
    await expect(service.initialize(mockConfig)).resolves.not.toThrow();
  });

  it('should throw error without API key', async () => {
    const invalidConfig = { ...mockConfig, apiKey: undefined };
    await expect(service.initialize(invalidConfig)).rejects.toThrow('OpenAI API key is required');
  });

  it('should validate JSON response correctly', async () => {
    await service.initialize(mockConfig);
    
    expect(service.validateResponse('{"key": "value"}', 'json')).toBe(true);
    expect(service.validateResponse('invalid json', 'json')).toBe(false);
  });

  it('should validate text response correctly', async () => {
    await service.initialize(mockConfig);
    
    expect(service.validateResponse('Some text', 'text')).toBe(true);
    expect(service.validateResponse('', 'text')).toBe(false);
  });
});

describe('createLLMService factory', () => {
  it('should create OpenAI service', () => {
    const config: LLMConfig = {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-key',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30000
    };

    const service = createLLMService(config);
    expect(service).toBeInstanceOf(OpenAILLMService);
  });
});