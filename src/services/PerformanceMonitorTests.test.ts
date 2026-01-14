import { PerformanceMonitor, createPerformanceMonitor, AssistantAPIAnalyticsService, createAssistantAPIAnalytics } from './PerformanceMonitor';

describe('PerformanceMonitor - Assistant API Performance Monitoring', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = createPerformanceMonitor();
    monitor.clearMetrics();
  });

  afterEach(() => {
    monitor.clearMetrics();
  });

  describe('Basic Operations', () => {
    it('should create performance monitor instance', () => {
      expect(monitor).toBeDefined();
      expect(typeof monitor.startOperation).toBe('function');
      expect(typeof monitor.endOperation).toBe('function');
    });

    it('should track basic operation metrics', async () => {
      const operationId = 'test-operation';
      
      monitor.startOperation(operationId, 'query_processing');
      
      // Add a small delay to ensure measurable duration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = monitor.endOperation(operationId, true, { 
        tokensUsed: 100, 
        cost: 0.01 
      });
      
      expect(result).toBeTruthy();
      expect(result!.operationId).toBe(operationId);
      expect(result!.success).toBe(true);
      expect(result!.tokensUsed).toBe(100);
      expect(result!.cost).toBe(0.01);
      expect(result!.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track Assistant API specific metadata', () => {
      const operationId = 'assistant-query';
      
      monitor.startOperation(operationId, 'query_processing', { 
        assistantId: 'asst_123',
        queryType: 'character_extraction'
      });
      
      const result = monitor.endOperation(operationId, true, { 
        tokensUsed: 500, 
        cost: 0.02,
        cacheHit: false
      });
      
      expect(result!.assistantId).toBe('asst_123');
      expect(result!.queryType).toBe('character_extraction');
      expect(result!.cacheHit).toBe(false);
    });

    it('should record rate limit hits', () => {
      const operationId = 'rate-limited-op';
      
      monitor.startOperation(operationId, 'assistant_creation');
      monitor.recordRateLimitHit(operationId, 2000);
      
      const result = monitor.endOperation(operationId, false);
      
      expect(result!.retryCount).toBe(1);
      expect(result!.rateLimitDelay).toBe(2000);
    });
  });

  describe('Performance Reports', () => {
    it('should generate comprehensive performance report', () => {
      monitor.startOperation('upload-1', 'file_upload');
      monitor.endOperation('upload-1', true, { cost: 0.10 });
      
      monitor.startOperation('query-1', 'query_processing', { cacheHit: false });
      monitor.endOperation('query-1', true, { cost: 0.02 });
      
      monitor.startOperation('query-2', 'query_processing', { cacheHit: true });
      monitor.endOperation('query-2', true, { cost: 0.01 });
      
      const report = monitor.generatePerformanceReport();
      
      expect(report.totalOperations).toBe(3);
      expect(report.successRate).toBe(100);
      expect(report.totalCost).toBeCloseTo(0.13, 2);
      expect(report.operationBreakdown.file_upload).toBe(1);
      expect(report.operationBreakdown.query_processing).toBe(2);
      expect(report.cacheHitRate).toBe(50);
    });

    it('should generate optimization recommendations', () => {
      for (let i = 0; i < 5; i++) {
        monitor.startOperation(`fail-${i}`, 'query_processing');
        monitor.endOperation(`fail-${i}`, false);
      }
      
      const report = monitor.generatePerformanceReport();
      expect(report.recommendations.length).toBeGreaterThan(0);
      
      const errorRecommendation = report.recommendations.find((r: any) => 
        r.title.includes('Error Handling')
      );
      expect(errorRecommendation).toBeTruthy();
      expect(errorRecommendation!.priority).toBe('critical');
    });
  });

  describe('Cost Analysis', () => {
    it('should generate cost analysis', () => {
      monitor.startOperation('op1', 'file_upload');
      monitor.endOperation('op1', true, { cost: 0.10 });
      
      monitor.startOperation('op2', 'query_processing');
      monitor.endOperation('op2', true, { cost: 0.02 });
      
      const analysis = monitor.generateCostAnalysis();
      
      expect(analysis.totalCost).toBeCloseTo(0.12, 2);
      expect(analysis.averageCostPerOperation).toBeCloseTo(0.06, 2);
      expect(analysis.costEfficiencyScore).toBeGreaterThanOrEqual(0);
      expect(analysis.costEfficiencyScore).toBeLessThanOrEqual(100);
    });
  });
});

describe('AssistantAPIAnalyticsService', () => {
  let monitor: PerformanceMonitor;
  let analytics: AssistantAPIAnalyticsService;

  beforeEach(() => {
    monitor = createPerformanceMonitor();
    monitor.clearMetrics();
    analytics = new AssistantAPIAnalyticsService(monitor);
  });

  afterEach(() => {
    monitor.clearMetrics();
  });

  it('should track query type distribution', () => {
    monitor.startOperation('q1', 'query_processing', { queryType: 'character_extraction' });
    monitor.endOperation('q1', true, { cost: 0.02 });
    
    monitor.startOperation('q2', 'query_processing', { queryType: 'plot_analysis' });
    monitor.endOperation('q2', true, { cost: 0.03 });
    
    const distribution = analytics.getQueryTypeDistribution();
    
    expect(distribution['character_extraction']).toBe(1);
    expect(distribution['plot_analysis']).toBe(1);
  });

  it('should calculate file reuse efficiency', () => {
    monitor.startOperation('upload1', 'file_upload');
    monitor.endOperation('upload1', true);
    
    for (let i = 0; i < 5; i++) {
      monitor.startOperation(`query${i}`, 'query_processing');
      monitor.endOperation(`query${i}`, true);
    }
    
    const efficiency = analytics.getFileReuseEfficiency();
    
    expect(efficiency.totalFiles).toBe(1);
    expect(efficiency.totalQueries).toBe(5);
    expect(efficiency.averageQueriesPerFile).toBe(5);
    expect(efficiency.efficiencyScore).toBe(80);
  });

  it('should analyze rate limiting impact', () => {
    monitor.startOperation('op1', 'query_processing');
    monitor.recordRateLimitHit('op1', 2000);
    const result = monitor.endOperation('op1', true);
    if (result) {
      result.duration = 1000;
    }
    
    const impact = analytics.getRateLimitingImpact();
    
    expect(impact.totalHits).toBe(1);
    expect(impact.totalDelay).toBe(2000);
    expect(impact.averageDelayPerHit).toBe(2000);
  });

  it('should be created via factory function', () => {
    const analyticsService = createAssistantAPIAnalytics();
    expect(analyticsService).toBeInstanceOf(AssistantAPIAnalyticsService);
  });
});