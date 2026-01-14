import { OpenAIAssistantService } from './AssistantService';
import { LLMConfig } from '../config/types';

describe('AssistantService - Performance Optimization', () => {
  let service: OpenAIAssistantService;
  let mockConfig: LLMConfig;

  beforeEach(() => {
    service = new OpenAIAssistantService();
    mockConfig = {
      provider: 'openai',
      apiKey: 'test-api-key',
      model: 'gpt-4',
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 30000
    };
  });

  describe('Performance Optimization Methods', () => {
    beforeEach(async () => {
      await service.initialize(mockConfig);
    });

    it('should provide rate limiting optimization', async () => {
      const optimization = await service.optimizeRateLimiting();
      
      expect(optimization).toBeDefined();
      expect(optimization).toHaveProperty('currentRateLimitHits');
      expect(optimization).toHaveProperty('recommendedRequestDelay');
      expect(optimization).toHaveProperty('optimalBatchSize');
      expect(optimization).toHaveProperty('estimatedImprovementPercent');
      expect(optimization).toHaveProperty('actionPlan');
      expect(Array.isArray(optimization.actionPlan)).toBe(true);
    });

    it('should provide concurrent processing optimization', async () => {
      const optimization = await service.optimizeConcurrentProcessing();
      
      expect(optimization).toBeDefined();
      expect(optimization).toHaveProperty('currentConcurrentSessions');
      expect(optimization).toHaveProperty('optimalConcurrencyLevel');
      expect(optimization).toHaveProperty('resourceUtilizationScore');
      expect(optimization).toHaveProperty('bottleneckAnalysis');
      expect(optimization).toHaveProperty('recommendedActions');
      expect(Array.isArray(optimization.bottleneckAnalysis)).toBe(true);
      expect(Array.isArray(optimization.recommendedActions)).toBe(true);
    });

    it('should provide cohesion analysis optimization', async () => {
      const optimization = await service.optimizeCohesionAnalysis();
      
      expect(optimization).toBeDefined();
      expect(optimization).toHaveProperty('currentAverageAnalysisTime');
      expect(optimization).toHaveProperty('targetAnalysisTime');
      expect(optimization).toHaveProperty('potentialSpeedupPercent');
      expect(optimization).toHaveProperty('optimizationStrategies');
      expect(optimization).toHaveProperty('implementationPriority');
      expect(Array.isArray(optimization.optimizationStrategies)).toBe(true);
      expect(Array.isArray(optimization.implementationPriority)).toBe(true);
    });

    it('should provide comprehensive performance insights', async () => {
      const insights = await service.getPerformanceInsights();
      
      expect(insights).toBeDefined();
      expect(insights).toHaveProperty('overallPerformanceScore');
      expect(insights).toHaveProperty('keyBottlenecks');
      expect(insights).toHaveProperty('quickWins');
      expect(insights).toHaveProperty('longTermImprovements');
      expect(insights).toHaveProperty('costEfficiencyRating');
      expect(insights).toHaveProperty('reliabilityScore');
      
      expect(typeof insights.overallPerformanceScore).toBe('number');
      expect(insights.overallPerformanceScore).toBeGreaterThanOrEqual(0);
      expect(insights.overallPerformanceScore).toBeLessThanOrEqual(100);
      
      expect(Array.isArray(insights.keyBottlenecks)).toBe(true);
      expect(Array.isArray(insights.quickWins)).toBe(true);
      expect(Array.isArray(insights.longTermImprovements)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should provide default optimization results when no metrics are available', async () => {
      // Test with uninitialized service (should still work but with default values)
      const uninitializedService = new OpenAIAssistantService();
      
      const rateLimitOpt = await uninitializedService.optimizeRateLimiting();
      expect(rateLimitOpt).toBeDefined();
      expect(rateLimitOpt.currentRateLimitHits).toBe(0);
      
      const concurrencyOpt = await uninitializedService.optimizeConcurrentProcessing();
      expect(concurrencyOpt).toBeDefined();
      expect(concurrencyOpt.currentConcurrentSessions).toBe(0);
      
      const cohesionOpt = await uninitializedService.optimizeCohesionAnalysis();
      expect(cohesionOpt).toBeDefined();
      expect(cohesionOpt.currentAverageAnalysisTime).toBe(0);
      
      const insights = await uninitializedService.getPerformanceInsights();
      expect(insights).toBeDefined();
      expect(typeof insights.overallPerformanceScore).toBe('number');
      expect(insights.overallPerformanceScore).toBeGreaterThanOrEqual(0);
    });
  });
});