import { PerformanceMonitor, createPerformanceMonitor, AssistantAPIAnalyticsService, createAssistantAPIAnalytics } from './PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = createPerformanceMonitor();
    monitor.clearMetrics();
  });

  afterEach(() => {
    monitor.clearMetrics();
  });

  it('should create an instance', () => {
    expect(monitor).toBeDefined();
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
});