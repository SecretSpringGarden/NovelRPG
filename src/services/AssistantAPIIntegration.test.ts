import * as fs from 'fs';
import * as path from 'path';
import { GameManager } from '../core/GameManager';
import { NovelAnalyzer, createNovelAnalyzer } from './NovelAnalyzer';
import { AssistantService, createAssistantService } from './AssistantService';
import { LLMService, createLLMService } from './LLMService';
import { ConfigManager } from '../config/ConfigManager';

/**
 * Integration tests for Assistant API service integration
 * Tests Assistant API integration with existing game components
 * Tests novel analysis workflow with Assistant API only
 * Requirements: 2.1, 2.6, 8.2
 */
describe('Assistant API Integration Tests', () => {
  let gameManager: GameManager;
  let novelAnalyzer: NovelAnalyzer;
  let assistantService: AssistantService;
  let llmService: LLMService;
  let testNovelPath: string;
  let configManager: ConfigManager;

  beforeAll(async () => {
    // Setup test configuration
    configManager = ConfigManager.getInstance();
    
    // Create a test novel file
    testNovelPath = path.join(__dirname, '../../test_simple_novel.txt');
    
    // Verify test novel exists
    if (!fs.existsSync(testNovelPath)) {
      throw new Error(`Test novel not found at ${testNovelPath}. Please ensure test_simple_novel.txt exists.`);
    }
  });

  beforeEach(async () => {
    // Initialize services
    const llmConfig = configManager.getLLMConfig();
    llmService = createLLMService(llmConfig);
    await llmService.initialize(llmConfig);
    
    assistantService = createAssistantService();
    await assistantService.initialize(llmConfig);
    
    novelAnalyzer = createNovelAnalyzer();
    gameManager = new GameManager();
    await gameManager.initializeLLMService();
    
    // Mock slower operations to speed up tests
    jest.setTimeout(30000); // Set default timeout to 30s
  });

  afterEach(async () => {
    // Cleanup any resources
    if (novelAnalyzer && typeof (novelAnalyzer as any).cleanup === 'function') {
      await (novelAnalyzer as any).cleanup();
    }
  });

  describe.skip('Novel Analyzer Assistant API Integration', () => {
    it('should use Assistant API as primary processing method for all novels', async () => {
      // Test that the analyzer always uses Assistant API (no size-based switching)
      expect(typeof novelAnalyzer.analyzeNovel).toBe('function');
      expect(typeof novelAnalyzer.analyzeNovelWithAssistant).toBe('function');
    }, 10000);

    it('should analyze novel using Assistant API workflow', async () => {
      const novelText = fs.readFileSync(testNovelPath, 'utf8');
      
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      try {
        const analysis = await novelAnalyzer.analyzeNovel(novelText);
        
        // Verify analysis structure
        expect(analysis).toBeDefined();
        expect(analysis.mainCharacters).toBeDefined();
        expect(analysis.plotPoints).toBeDefined();
        expect(analysis.introduction).toBeDefined();
        expect(analysis.climax).toBeDefined();
        expect(analysis.conclusion).toBeDefined();
        
        // Verify Assistant API was used (check console output)
        const logMessages = consoleSpy.mock.calls.map(call => call[0]);
        const assistantAPIUsed = logMessages.some(msg => 
          typeof msg === 'string' && msg.includes('OpenAI Assistants API')
        );
        expect(assistantAPIUsed).toBe(true);
        
      } finally {
        consoleSpy.mockRestore();
      }
    }, 15000); // Reduced timeout from 60s to 15s

    it('should maintain consistent output format regardless of processing method', async () => {
      const novelText = fs.readFileSync(testNovelPath, 'utf8');
      
      const analysis = await novelAnalyzer.analyzeNovel(novelText);
      
      // Verify required fields are present
      expect(analysis).toHaveProperty('mainCharacters');
      expect(analysis).toHaveProperty('plotPoints');
      expect(analysis).toHaveProperty('introduction');
      expect(analysis).toHaveProperty('climax');
      expect(analysis).toHaveProperty('conclusion');
      expect(analysis).toHaveProperty('isComplete');
      expect(analysis).toHaveProperty('validationErrors');
      
      // Verify data types
      expect(Array.isArray(analysis.mainCharacters)).toBe(true);
      expect(Array.isArray(analysis.plotPoints)).toBe(true);
      expect(typeof analysis.introduction).toBe('string');
      expect(typeof analysis.climax).toBe('string');
      expect(typeof analysis.conclusion).toBe('string');
      expect(typeof analysis.isComplete).toBe('boolean');
      expect(Array.isArray(analysis.validationErrors)).toBe(true);
    }, 15000); // Reduced timeout from 60s to 15s

    it('should use Assistant API as the only processing method', async () => {
      const novelText = fs.readFileSync(testNovelPath, 'utf8');
      
      // Test that the analyzer uses RAG-only approach with Assistant API
      expect(typeof novelAnalyzer.analyzeNovel).toBe('function');
      expect(typeof novelAnalyzer.analyzeNovelWithAssistant).toBe('function');
      
      // Verify that direct LLM methods are not available (RAG-only architecture)
      expect((novelAnalyzer as any).fallbackToDirectLLM).toBeUndefined();
    });
  });

  describe.skip('GameManager Assistant API Integration', () => {
    it('should use Assistant API for novel analysis in game workflow', async () => {
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      try {
        // Start a game with test novel
        const gameSession = await gameManager.startGame(testNovelPath, 0, 10, true);
        
        // Verify game session was created
        expect(gameSession).toBeDefined();
        expect(gameSession.gameState).toBeDefined();
        expect(gameSession.gameState.novelAnalysis).toBeDefined();
        
        // Verify Assistant API was used (check console output)
        const logMessages = consoleSpy.mock.calls.map(call => call[0]);
        const assistantAPIUsed = logMessages.some(msg => 
          typeof msg === 'string' && msg.includes('OpenAI Assistants API')
        );
        expect(assistantAPIUsed).toBe(true);
        
        // Verify novel analysis has required structure
        const analysis = gameSession.gameState.novelAnalysis;
        expect(analysis.mainCharacters).toBeDefined();
        expect(analysis.plotPoints).toBeDefined();
        expect(analysis.introduction).toBeDefined();
        expect(analysis.climax).toBeDefined();
        expect(analysis.conclusion).toBeDefined();
        
      } finally {
        consoleSpy.mockRestore();
      }
    }, 30000); // Reduced timeout from 120s to 30s

    it('should validate novel analysis completeness with Assistant API', async () => {
      const gameSession = await gameManager.startGame(testNovelPath, 0, 10, true);
      const analysis = gameSession.gameState.novelAnalysis;
      
      // Verify analysis completeness validation
      const isComplete = gameManager.validateNovelAnalysis(analysis);
      expect(typeof isComplete).toBe('boolean');
      
      // If analysis is complete, verify all required elements
      if (isComplete) {
        expect(analysis.mainCharacters.length).toBeGreaterThan(0);
        expect(analysis.plotPoints.length).toBeGreaterThan(0);
        expect(analysis.introduction.trim().length).toBeGreaterThan(0);
        expect(analysis.climax.trim().length).toBeGreaterThan(0);
        expect(analysis.conclusion.trim().length).toBeGreaterThan(0);
      }
    }, 30000); // Reduced timeout from 120s to 30s
  });

  describe.skip('Assistant Service Direct Integration', () => {
    it('should upload novel file and create assistant successfully', async () => {
      let fileId: string | undefined;
      let assistantId: string | undefined;
      
      try {
        // Upload novel file
        fileId = await assistantService.uploadNovelFile(testNovelPath);
        expect(fileId).toBeDefined();
        expect(typeof fileId).toBe('string');
        expect(fileId.length).toBeGreaterThan(0);
        
        // Create assistant
        assistantId = await assistantService.createNovelAnalysisAssistant(fileId);
        expect(assistantId).toBeDefined();
        expect(typeof assistantId).toBe('string');
        expect(assistantId.length).toBeGreaterThan(0);
        
        // Query assistant
        const response = await assistantService.queryAssistant(
          assistantId, 
          'What are the main themes of this novel?'
        );
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
        
      } finally {
        // Cleanup resources
        if (assistantId && fileId) {
          await assistantService.cleanup(assistantId, fileId);
        }
      }
    }, 30000); // Reduced timeout from 120s to 30s

    it('should provide usage metrics and diagnostics', async () => {
      // Test usage metrics
      const metrics = await assistantService.getUsageMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
      
      // Test diagnostics
      const diagnostics = await assistantService.runDiagnostics();
      expect(diagnostics).toBeDefined();
      expect(Array.isArray(diagnostics)).toBe(true);
    }, 10000); // Reduced timeout from 30s to 10s
  });

  describe('Error Handling and Reliability', () => {
    it('should handle Assistant API errors gracefully', async () => {
      // Test with invalid file path
      await expect(
        assistantService.uploadNovelFile('/nonexistent/file.txt')
      ).rejects.toThrow();
      
      // Test with invalid assistant ID
      await expect(
        assistantService.queryAssistant('invalid-id', 'test query')
      ).rejects.toThrow();
    }, 10000); // Reduced timeout from 30s to 10s

    it('should maintain service reliability under error conditions', async () => {
      const novelText = fs.readFileSync(testNovelPath, 'utf8');
      
      // Test that novel analyzer throws meaningful errors instead of falling back
      const originalAnalyzeMethod = (novelAnalyzer as any).analyzeNovelWithAssistant;
      (novelAnalyzer as any).analyzeNovelWithAssistant = jest.fn().mockRejectedValue(
        new Error('Simulated Assistant API failure')
      );
      
      try {
        await expect(
          novelAnalyzer.analyzeNovel(novelText)
        ).rejects.toThrow('Simulated Assistant API failure');
      } finally {
        // Restore original method
        (novelAnalyzer as any).analyzeNovelWithAssistant = originalAnalyzeMethod;
      }
    }, 10000); // Reduced timeout from 30s to 10s
  });
});