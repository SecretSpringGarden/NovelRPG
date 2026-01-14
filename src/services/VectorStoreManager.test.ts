import { OpenAIVectorStoreManager, createVectorStoreManager } from './VectorStoreManager';
import { LLMConfig } from '../config/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('VectorStoreManager', () => {
  let manager: OpenAIVectorStoreManager;
  let mockConfig: LLMConfig;

  beforeEach(() => {
    manager = new OpenAIVectorStoreManager();
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
    expect(manager).toBeDefined();
  });

  it('should initialize with valid config', async () => {
    await expect(manager.initialize(mockConfig)).resolves.not.toThrow();
  });

  it('should throw error without API key', async () => {
    const invalidConfig = { ...mockConfig, apiKey: undefined };
    await expect(manager.initialize(invalidConfig)).rejects.toThrow('OpenAI API key is required');
  });

  it('should throw error when not initialized', async () => {
    await expect(manager.createVectorStore('test-store')).rejects.toThrow('VectorStoreManager must be initialized before use');
  });
});

describe('createVectorStoreManager factory', () => {
  it('should create a VectorStoreManager instance', () => {
    const manager = createVectorStoreManager();
    expect(manager).toBeInstanceOf(OpenAIVectorStoreManager);
  });
});