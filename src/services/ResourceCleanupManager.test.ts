import { OpenAIResourceCleanupManager, createResourceCleanupManager } from './ResourceCleanupManager';
import { LLMConfig } from '../config/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('ResourceCleanupManager', () => {
  let manager: OpenAIResourceCleanupManager;
  let mockConfig: LLMConfig;

  beforeEach(() => {
    manager = new OpenAIResourceCleanupManager();
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

  afterEach(() => {
    manager.destroy();
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
});

describe('createResourceCleanupManager factory', () => {
  it('should create a ResourceCleanupManager instance', () => {
    const manager = createResourceCleanupManager();
    expect(manager).toBeInstanceOf(OpenAIResourceCleanupManager);
  });
});