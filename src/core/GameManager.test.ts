import { GameManager } from './GameManager';
import { ConfigManager } from '../config/ConfigManager';

// Mock dependencies
jest.mock('../config/ConfigManager');
jest.mock('fs');

const mockConfigManager = {
  getInstance: jest.fn().mockReturnValue({
    getLLMConfig: jest.fn().mockReturnValue({
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-key',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30000
    }),
    getGameConfig: jest.fn().mockReturnValue({
      defaultRounds: 15,
      maxPlayers: 4,
      turnTimeoutSeconds: 60,
      gameStateDirectory: './game_states',
      maxNovelSizeMB: 50
    }),
    getTestConfig: jest.fn().mockReturnValue({
      outputDirectory: './test_outputs',
      cohesionAnalysisModel: 'gpt-4',
      testIterations: 6
    })
  })
};

(ConfigManager as any).getInstance = mockConfigManager.getInstance;

describe('GameManager', () => {
  let gameManager: GameManager;

  beforeEach(() => {
    jest.clearAllMocks();
    gameManager = new GameManager();
  });

  it('should create an instance', () => {
    expect(gameManager).toBeDefined();
  });
});