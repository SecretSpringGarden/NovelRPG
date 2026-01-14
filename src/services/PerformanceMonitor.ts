export interface PerformanceMetrics {
  operationId: string;
  operationType: 'file_upload' | 'assistant_creation' | 'query_processing' | 'cleanup';
  startTime: Date;
  endTime?: Date;
  duration?: number; // in milliseconds
  success: boolean;
  tokensUsed?: number;
  cost?: number;
  fileSize?: number;
  errorCode?: string;
  retryCount?: number;
  // Assistant API specific metrics
  assistantId?: string;
  fileId?: string;
  vectorStoreId?: string;
  queryType?: 'character_extraction' | 'plot_analysis' | 'narrative_structure' | 'story_generation';
  rateLimitDelay?: number; // milliseconds delayed due to rate limiting
  cacheHit?: boolean; // whether result was served from cache
}

export interface OptimizationRecommendation {
  type: 'cost' | 'performance' | 'efficiency' | 'rate_limiting' | 'caching';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  potentialSavings?: number; // cost savings in dollars
  performanceImprovement?: number; // percentage improvement
  actionRequired: string;
  implementationComplexity?: 'low' | 'medium' | 'high';
  estimatedImplementationTime?: string; // e.g., "2 hours", "1 day"
}

export interface PerformanceReport {
  totalOperations: number;
  successRate: number;
  averageResponseTime: number;
  totalCost: number;
  rateLimitHits: number;
  recommendations: OptimizationRecommendation[];
  timeRange: {
    start: Date;
    end: Date;
  };
  // Assistant API specific metrics
  operationBreakdown: {
    file_upload: number;
    assistant_creation: number;
    query_processing: number;
    cleanup: number;
  };
  averageCostByOperation: Record<string, number>;
  cacheHitRate?: number;
  totalRateLimitDelay?: number; // total milliseconds delayed
}

export interface CostAnalysis {
  totalCost: number;
  costByOperation: Record<string, number>;
  averageCostPerOperation: number;
  projectedMonthlyCost: number;
  costTrends: {
    date: Date;
    cost: number;
  }[];
  // Enhanced cost analysis
  costEfficiencyScore: number; // 0-100, higher is better
  costOptimizationOpportunities: {
    fileReuse: number; // potential savings from better file reuse
    rateLimitReduction: number; // potential savings from fewer retries
    caching: number; // potential savings from caching
  };
  costPerQuery: number;
  costPerSuccessfulOperation: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private activeOperations: Map<string, PerformanceMetrics> = new Map();

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public startOperation(
    operationId: string,
    operationType: PerformanceMetrics['operationType'],
    metadata?: Partial<PerformanceMetrics>
  ): void {
    const metric: PerformanceMetrics = {
      operationId,
      operationType,
      startTime: new Date(),
      success: false,
      ...metadata
    };

    this.activeOperations.set(operationId, metric);
  }

  public endOperation(
    operationId: string,
    success: boolean,
    metadata?: Partial<PerformanceMetrics>
  ): PerformanceMetrics | null {
    const metric = this.activeOperations.get(operationId);
    if (!metric) {
      console.warn(`Performance metric not found for operation: ${operationId}`);
      return null;
    }

    const endTime = new Date();
    const completedMetric: PerformanceMetrics = {
      ...metric,
      ...metadata,
      endTime,
      duration: endTime.getTime() - metric.startTime.getTime(),
      success
    };

    this.metrics.push(completedMetric);
    this.activeOperations.delete(operationId);

    // Keep only last 10000 metrics to prevent memory issues
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }

    return completedMetric;
  }

  public recordRateLimitHit(operationId: string, delayMs?: number): void {
    const metric = this.activeOperations.get(operationId);
    if (metric) {
      metric.retryCount = (metric.retryCount || 0) + 1;
      if (delayMs) {
        metric.rateLimitDelay = (metric.rateLimitDelay || 0) + delayMs;
      }
    }
  }

  public getMetrics(
    operationType?: PerformanceMetrics['operationType'],
    timeRange?: { start: Date; end: Date }
  ): PerformanceMetrics[] {
    let filteredMetrics = this.metrics;

    if (operationType) {
      filteredMetrics = filteredMetrics.filter(m => m.operationType === operationType);
    }

    if (timeRange) {
      filteredMetrics = filteredMetrics.filter(m => 
        m.startTime >= timeRange.start && m.startTime <= timeRange.end
      );
    }

    return filteredMetrics;
  }

  public generatePerformanceReport(timeRange?: { start: Date; end: Date }): PerformanceReport {
    const metrics = this.getMetrics(undefined, timeRange);
    
    if (metrics.length === 0) {
      return {
        totalOperations: 0,
        successRate: 0,
        averageResponseTime: 0,
        totalCost: 0,
        rateLimitHits: 0,
        recommendations: [],
        timeRange: timeRange || { start: new Date(), end: new Date() },
        operationBreakdown: {
          file_upload: 0,
          assistant_creation: 0,
          query_processing: 0,
          cleanup: 0
        },
        averageCostByOperation: {},
        cacheHitRate: 0,
        totalRateLimitDelay: 0
      };
    }

    const successfulOperations = metrics.filter(m => m.success);
    const successRate = (successfulOperations.length / metrics.length) * 100;
    
    const completedMetrics = metrics.filter(m => m.duration !== undefined);
    const averageResponseTime = completedMetrics.length > 0 
      ? completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / completedMetrics.length
      : 0;

    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);
    const rateLimitHits = metrics.reduce((sum, m) => sum + (m.retryCount || 0), 0);
    const totalRateLimitDelay = metrics.reduce((sum, m) => sum + (m.rateLimitDelay || 0), 0);

    // Calculate operation breakdown
    const operationBreakdown = {
      file_upload: metrics.filter(m => m.operationType === 'file_upload').length,
      assistant_creation: metrics.filter(m => m.operationType === 'assistant_creation').length,
      query_processing: metrics.filter(m => m.operationType === 'query_processing').length,
      cleanup: metrics.filter(m => m.operationType === 'cleanup').length
    };

    // Calculate average cost by operation
    const averageCostByOperation: Record<string, number> = {};
    for (const opType of ['file_upload', 'assistant_creation', 'query_processing', 'cleanup']) {
      const opMetrics = metrics.filter(m => m.operationType === opType);
      const totalOpCost = opMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);
      averageCostByOperation[opType] = opMetrics.length > 0 ? totalOpCost / opMetrics.length : 0;
    }

    // Calculate cache hit rate
    const metricsWithCacheInfo = metrics.filter(m => m.cacheHit !== undefined);
    const cacheHits = metricsWithCacheInfo.filter(m => m.cacheHit).length;
    const cacheHitRate = metricsWithCacheInfo.length > 0 ? (cacheHits / metricsWithCacheInfo.length) * 100 : 0;

    const recommendations = this.generateOptimizationRecommendations(metrics);

    return {
      totalOperations: metrics.length,
      successRate,
      averageResponseTime,
      totalCost,
      rateLimitHits,
      recommendations,
      timeRange: timeRange || {
        start: metrics[0]?.startTime || new Date(),
        end: metrics[metrics.length - 1]?.startTime || new Date()
      },
      operationBreakdown,
      averageCostByOperation,
      cacheHitRate,
      totalRateLimitDelay
    };
  }

  public generateCostAnalysis(timeRange?: { start: Date; end: Date }): CostAnalysis {
    const metrics = this.getMetrics(undefined, timeRange);
    
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);
    
    const costByOperation: Record<string, number> = {};
    metrics.forEach(m => {
      if (m.cost) {
        costByOperation[m.operationType] = (costByOperation[m.operationType] || 0) + m.cost;
      }
    });

    const averageCostPerOperation = metrics.length > 0 ? totalCost / metrics.length : 0;

    // Project monthly cost based on current usage patterns
    const daysInRange = timeRange 
      ? Math.max(1, (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    const projectedMonthlyCost = (totalCost / daysInRange) * 30;

    // Generate cost trends (simplified - group by day)
    const costTrends = this.generateCostTrends(metrics);

    // Calculate enhanced cost analysis
    const successfulOperations = metrics.filter(m => m.success);
    const costPerSuccessfulOperation = successfulOperations.length > 0 ? totalCost / successfulOperations.length : 0;
    
    const queryMetrics = metrics.filter(m => m.operationType === 'query_processing');
    const costPerQuery = queryMetrics.length > 0 ? 
      queryMetrics.reduce((sum, m) => sum + (m.cost || 0), 0) / queryMetrics.length : 0;

    // Calculate cost efficiency score (0-100)
    const costEfficiencyScore = this.calculateCostEfficiencyScore(metrics);

    // Calculate optimization opportunities
    const costOptimizationOpportunities = this.calculateCostOptimizationOpportunities(metrics);

    return {
      totalCost,
      costByOperation,
      averageCostPerOperation,
      projectedMonthlyCost,
      costTrends,
      costEfficiencyScore,
      costOptimizationOpportunities,
      costPerQuery,
      costPerSuccessfulOperation
    };
  }

  private generateOptimizationRecommendations(metrics: PerformanceMetrics[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze success rate
    const successRate = metrics.filter(m => m.success).length / metrics.length;
    if (successRate < 0.95) {
      recommendations.push({
        type: 'performance',
        priority: successRate < 0.8 ? 'critical' : 'high',
        title: 'Improve Error Handling',
        description: `Success rate is ${(successRate * 100).toFixed(1)}%. Consider implementing better retry logic and error handling.`,
        performanceImprovement: (0.95 - successRate) * 100,
        actionRequired: 'Review error logs and implement more robust retry mechanisms',
        implementationComplexity: 'medium',
        estimatedImplementationTime: '4-6 hours'
      });
    }

    // Analyze response times
    const completedMetrics = metrics.filter(m => m.duration !== undefined);
    if (completedMetrics.length > 0) {
      const averageResponseTime = completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / completedMetrics.length;
      const slowOperations = completedMetrics.filter(m => (m.duration || 0) > averageResponseTime * 2);
      
      if (slowOperations.length > completedMetrics.length * 0.1) {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          title: 'Optimize Slow Operations',
          description: `${slowOperations.length} operations (${((slowOperations.length / completedMetrics.length) * 100).toFixed(1)}%) are significantly slower than average.`,
          performanceImprovement: 25,
          actionRequired: 'Investigate slow operations and consider caching or optimization strategies',
          implementationComplexity: 'medium',
          estimatedImplementationTime: '2-4 hours'
        });
      }
    }

    // Analyze rate limiting with enhanced recommendations
    const rateLimitHits = metrics.reduce((sum, m) => sum + (m.retryCount || 0), 0);
    const totalRateLimitDelay = metrics.reduce((sum, m) => sum + (m.rateLimitDelay || 0), 0);
    
    if (rateLimitHits > metrics.length * 0.05) {
      const avgDelayPerHit = rateLimitHits > 0 ? totalRateLimitDelay / rateLimitHits : 0;
      recommendations.push({
        type: 'rate_limiting',
        priority: rateLimitHits > metrics.length * 0.2 ? 'high' : 'medium',
        title: 'Reduce Rate Limiting',
        description: `${rateLimitHits} rate limit hits detected with ${(totalRateLimitDelay / 1000).toFixed(1)}s total delay. Average delay per hit: ${(avgDelayPerHit / 1000).toFixed(1)}s.`,
        performanceImprovement: 15,
        actionRequired: 'Implement request queuing, exponential backoff, and consider upgrading API tier',
        implementationComplexity: 'high',
        estimatedImplementationTime: '1-2 days'
      });
    }

    // Analyze cost efficiency
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);
    const fileUploads = metrics.filter(m => m.operationType === 'file_upload');
    const queries = metrics.filter(m => m.operationType === 'query_processing');
    
    if (fileUploads.length > 0 && queries.length > 0) {
      const avgQueriesPerUpload = queries.length / fileUploads.length;
      if (avgQueriesPerUpload < 3) {
        const potentialSavings = totalCost * 0.2; // Estimate 20% savings
        recommendations.push({
          type: 'cost',
          priority: 'medium',
          title: 'Improve File Reuse',
          description: `Average of ${avgQueriesPerUpload.toFixed(1)} queries per file upload. Consider reusing uploaded files for multiple queries.`,
          potentialSavings,
          actionRequired: 'Implement file caching and reuse strategies',
          implementationComplexity: 'medium',
          estimatedImplementationTime: '4-8 hours'
        });
      }
    }

    // Analyze caching opportunities
    const metricsWithCacheInfo = metrics.filter(m => m.cacheHit !== undefined);
    if (metricsWithCacheInfo.length > 0) {
      const cacheHits = metricsWithCacheInfo.filter(m => m.cacheHit).length;
      const cacheHitRate = cacheHits / metricsWithCacheInfo.length;
      
      if (cacheHitRate < 0.3) {
        const potentialSavings = totalCost * (0.3 - cacheHitRate) * 0.8; // Estimate savings from improved caching
        recommendations.push({
          type: 'caching',
          priority: 'medium',
          title: 'Improve Caching Strategy',
          description: `Cache hit rate is ${(cacheHitRate * 100).toFixed(1)}%. Implementing better caching could reduce costs and improve performance.`,
          potentialSavings,
          performanceImprovement: 30,
          actionRequired: 'Implement intelligent caching for frequently accessed data',
          implementationComplexity: 'medium',
          estimatedImplementationTime: '6-10 hours'
        });
      }
    }

    // Analyze query type distribution for optimization
    const queryTypeMetrics = metrics.filter(m => m.queryType);
    if (queryTypeMetrics.length > 0) {
      const queryTypes = ['character_extraction', 'plot_analysis', 'narrative_structure', 'story_generation'];
      const queryTypeDistribution: Record<string, number> = {};
      
      queryTypes.forEach(type => {
        queryTypeDistribution[type] = queryTypeMetrics.filter(m => m.queryType === type).length;
      });
      
      const mostCommonQueryType = Object.entries(queryTypeDistribution)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (mostCommonQueryType && mostCommonQueryType[1] > queryTypeMetrics.length * 0.5) {
        recommendations.push({
          type: 'efficiency',
          priority: 'low',
          title: 'Optimize Common Query Types',
          description: `${mostCommonQueryType[0]} queries represent ${((mostCommonQueryType[1] / queryTypeMetrics.length) * 100).toFixed(1)}% of all queries. Consider specialized optimization.`,
          performanceImprovement: 10,
          actionRequired: `Create optimized templates and caching for ${mostCommonQueryType[0]} queries`,
          implementationComplexity: 'low',
          estimatedImplementationTime: '2-3 hours'
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private generateCostTrends(metrics: PerformanceMetrics[]): { date: Date; cost: number }[] {
    const dailyCosts: Record<string, number> = {};
    
    metrics.forEach(m => {
      if (m.cost) {
        const dateKey = m.startTime.toISOString().split('T')[0];
        dailyCosts[dateKey] = (dailyCosts[dateKey] || 0) + m.cost;
      }
    });

    return Object.entries(dailyCosts)
      .map(([date, cost]) => ({ date: new Date(date), cost }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public clearMetrics(): void {
    this.metrics = [];
    this.activeOperations.clear();
  }

  public getActiveOperations(): PerformanceMetrics[] {
    return Array.from(this.activeOperations.values());
  }

  private calculateCostEfficiencyScore(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;

    let score = 100;
    
    // Penalize for low success rate
    const successRate = metrics.filter(m => m.success).length / metrics.length;
    score -= (1 - successRate) * 30;
    
    // Penalize for rate limiting
    const rateLimitHits = metrics.reduce((sum, m) => sum + (m.retryCount || 0), 0);
    const rateLimitPenalty = Math.min((rateLimitHits / metrics.length) * 20, 20);
    score -= rateLimitPenalty;
    
    // Reward for good file reuse
    const fileUploads = metrics.filter(m => m.operationType === 'file_upload').length;
    const queries = metrics.filter(m => m.operationType === 'query_processing').length;
    if (fileUploads > 0 && queries > 0) {
      const reuseRatio = queries / fileUploads;
      if (reuseRatio >= 5) score += 10;
      else if (reuseRatio >= 3) score += 5;
      else score -= 10;
    }
    
    // Reward for good cache hit rate
    const metricsWithCacheInfo = metrics.filter(m => m.cacheHit !== undefined);
    if (metricsWithCacheInfo.length > 0) {
      const cacheHitRate = metricsWithCacheInfo.filter(m => m.cacheHit).length / metricsWithCacheInfo.length;
      score += cacheHitRate * 15;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateCostOptimizationOpportunities(metrics: PerformanceMetrics[]): {
    fileReuse: number;
    rateLimitReduction: number;
    caching: number;
  } {
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);
    
    // File reuse opportunity
    const fileUploads = metrics.filter(m => m.operationType === 'file_upload');
    const queries = metrics.filter(m => m.operationType === 'query_processing');
    let fileReuseSavings = 0;
    
    if (fileUploads.length > 0 && queries.length > 0) {
      const avgQueriesPerUpload = queries.length / fileUploads.length;
      if (avgQueriesPerUpload < 5) {
        // Estimate savings if we could get to 5 queries per upload
        const potentialReduction = Math.max(0, fileUploads.length - (queries.length / 5));
        const avgUploadCost = fileUploads.reduce((sum, m) => sum + (m.cost || 0), 0) / fileUploads.length;
        fileReuseSavings = potentialReduction * avgUploadCost;
      }
    }
    
    // Rate limit reduction opportunity
    const rateLimitHits = metrics.reduce((sum, m) => sum + (m.retryCount || 0), 0);
    const rateLimitSavings = rateLimitHits * 0.01; // Estimate $0.01 per retry avoided
    
    // Caching opportunity
    const metricsWithCacheInfo = metrics.filter(m => m.cacheHit !== undefined);
    let cachingSavings = 0;
    if (metricsWithCacheInfo.length > 0) {
      const cacheHitRate = metricsWithCacheInfo.filter(m => m.cacheHit).length / metricsWithCacheInfo.length;
      if (cacheHitRate < 0.5) {
        // Estimate savings from improving cache hit rate to 50%
        const potentialCacheHits = metricsWithCacheInfo.length * (0.5 - cacheHitRate);
        const avgQueryCost = queries.reduce((sum, m) => sum + (m.cost || 0), 0) / queries.length;
        cachingSavings = potentialCacheHits * avgQueryCost * 0.8; // 80% cost reduction for cached queries
      }
    }
    
    return {
      fileReuse: fileReuseSavings,
      rateLimitReduction: rateLimitSavings,
      caching: cachingSavings
    };
  }
}

export function createPerformanceMonitor(): PerformanceMonitor {
  return PerformanceMonitor.getInstance();
}

// Assistant API specific analytics functions
export interface AssistantAPIAnalytics {
  getQueryTypeDistribution(timeRange?: { start: Date; end: Date }): Record<string, number>;
  getAverageResponseTimeByQueryType(timeRange?: { start: Date; end: Date }): Record<string, number>;
  getCostBreakdownByQueryType(timeRange?: { start: Date; end: Date }): Record<string, number>;
  getFileReuseEfficiency(timeRange?: { start: Date; end: Date }): {
    averageQueriesPerFile: number;
    totalFiles: number;
    totalQueries: number;
    efficiencyScore: number; // 0-100
  };
  getRateLimitingImpact(timeRange?: { start: Date; end: Date }): {
    totalHits: number;
    totalDelay: number; // milliseconds
    averageDelayPerHit: number;
    impactOnPerformance: number; // percentage
  };
}

export class AssistantAPIAnalyticsService implements AssistantAPIAnalytics {
  constructor(private performanceMonitor: PerformanceMonitor) {}

  getQueryTypeDistribution(timeRange?: { start: Date; end: Date }): Record<string, number> {
    const metrics = this.performanceMonitor.getMetrics('query_processing', timeRange);
    const distribution: Record<string, number> = {};
    
    metrics.forEach(m => {
      if (m.queryType) {
        distribution[m.queryType] = (distribution[m.queryType] || 0) + 1;
      }
    });
    
    return distribution;
  }

  getAverageResponseTimeByQueryType(timeRange?: { start: Date; end: Date }): Record<string, number> {
    const metrics = this.performanceMonitor.getMetrics('query_processing', timeRange);
    const responseTimesByType: Record<string, number[]> = {};
    
    metrics.forEach(m => {
      if (m.queryType && m.duration !== undefined) {
        if (!responseTimesByType[m.queryType]) {
          responseTimesByType[m.queryType] = [];
        }
        responseTimesByType[m.queryType].push(m.duration);
      }
    });
    
    const averages: Record<string, number> = {};
    Object.entries(responseTimesByType).forEach(([type, times]) => {
      averages[type] = times.reduce((sum, time) => sum + time, 0) / times.length;
    });
    
    return averages;
  }

  getCostBreakdownByQueryType(timeRange?: { start: Date; end: Date }): Record<string, number> {
    const metrics = this.performanceMonitor.getMetrics('query_processing', timeRange);
    const costsByType: Record<string, number> = {};
    
    metrics.forEach(m => {
      if (m.queryType && m.cost) {
        costsByType[m.queryType] = (costsByType[m.queryType] || 0) + m.cost;
      }
    });
    
    return costsByType;
  }

  getFileReuseEfficiency(timeRange?: { start: Date; end: Date }): {
    averageQueriesPerFile: number;
    totalFiles: number;
    totalQueries: number;
    efficiencyScore: number;
  } {
    const allMetrics = this.performanceMonitor.getMetrics(undefined, timeRange);
    const fileUploads = allMetrics.filter(m => m.operationType === 'file_upload');
    const queries = allMetrics.filter(m => m.operationType === 'query_processing');
    
    const totalFiles = fileUploads.length;
    const totalQueries = queries.length;
    const averageQueriesPerFile = totalFiles > 0 ? totalQueries / totalFiles : 0;
    
    // Calculate efficiency score (0-100)
    // Perfect score (100) = 10+ queries per file
    // Good score (80) = 5+ queries per file
    // Average score (60) = 3+ queries per file
    // Poor score (40) = 2+ queries per file
    // Bad score (20) = 1+ query per file
    let efficiencyScore = 0;
    if (averageQueriesPerFile >= 10) efficiencyScore = 100;
    else if (averageQueriesPerFile >= 5) efficiencyScore = 80;
    else if (averageQueriesPerFile >= 3) efficiencyScore = 60;
    else if (averageQueriesPerFile >= 2) efficiencyScore = 40;
    else if (averageQueriesPerFile >= 1) efficiencyScore = 20;
    
    return {
      averageQueriesPerFile,
      totalFiles,
      totalQueries,
      efficiencyScore
    };
  }

  getRateLimitingImpact(timeRange?: { start: Date; end: Date }): {
    totalHits: number;
    totalDelay: number;
    averageDelayPerHit: number;
    impactOnPerformance: number;
  } {
    const metrics = this.performanceMonitor.getMetrics(undefined, timeRange);
    
    const totalHits = metrics.reduce((sum, m) => sum + (m.retryCount || 0), 0);
    const totalDelay = metrics.reduce((sum, m) => sum + (m.rateLimitDelay || 0), 0);
    const averageDelayPerHit = totalHits > 0 ? totalDelay / totalHits : 0;
    
    // Calculate impact on performance as percentage of total operation time
    const totalOperationTime = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    const impactOnPerformance = totalOperationTime > 0 ? (totalDelay / totalOperationTime) * 100 : 0;
    
    return {
      totalHits,
      totalDelay,
      averageDelayPerHit,
      impactOnPerformance
    };
  }
}

export function createAssistantAPIAnalytics(): AssistantAPIAnalytics {
  return new AssistantAPIAnalyticsService(createPerformanceMonitor());
}

// Enhanced performance optimization for Assistant API
export interface PerformanceOptimizer {
  optimizeRateLimiting(): Promise<RateLimitOptimization>;
  optimizeConcurrentProcessing(): Promise<ConcurrencyOptimization>;
  optimizeCohesionAnalysis(): Promise<CohesionOptimization>;
  generatePerformanceInsights(): Promise<PerformanceInsights>;
}

export interface RateLimitOptimization {
  currentRateLimitHits: number;
  recommendedRequestDelay: number; // milliseconds
  optimalBatchSize: number;
  estimatedImprovementPercent: number;
  actionPlan: string[];
}

export interface ConcurrencyOptimization {
  currentConcurrentSessions: number;
  optimalConcurrencyLevel: number;
  resourceUtilizationScore: number; // 0-100
  bottleneckAnalysis: string[];
  recommendedActions: string[];
}

export interface CohesionOptimization {
  currentAverageAnalysisTime: number; // milliseconds
  targetAnalysisTime: number; // milliseconds
  potentialSpeedupPercent: number;
  optimizationStrategies: string[];
  implementationPriority: ('high' | 'medium' | 'low')[];
}

export interface PerformanceInsights {
  overallPerformanceScore: number; // 0-100
  keyBottlenecks: string[];
  quickWins: string[];
  longTermImprovements: string[];
  costEfficiencyRating: number; // 0-100
  reliabilityScore: number; // 0-100
}

export class AssistantAPIPerformanceOptimizer implements PerformanceOptimizer {
  constructor(
    private performanceMonitor: PerformanceMonitor,
    private analytics: AssistantAPIAnalytics
  ) {}

  async optimizeRateLimiting(): Promise<RateLimitOptimization> {
    const rateLimitingImpact = this.analytics.getRateLimitingImpact();
    const metrics = this.performanceMonitor.getMetrics();
    
    // Analyze current rate limiting patterns
    const recentMetrics = metrics.filter(m => 
      m.startTime > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );
    
    const rateLimitHitsPerHour = this.calculateRateLimitHitsPerHour(recentMetrics);
    const averageDelayPerHit = rateLimitingImpact.averageDelayPerHit;
    
    // Calculate optimal request delay to reduce rate limiting by 80%
    const recommendedRequestDelay = Math.max(100, averageDelayPerHit * 0.3);
    
    // Determine optimal batch size based on current patterns
    const currentRequestsPerMinute = recentMetrics.length / (24 * 60); // Average per minute over 24h
    const optimalBatchSize = Math.max(1, Math.floor(60 / (recommendedRequestDelay / 1000))); // Requests per minute
    
    // Estimate improvement
    const currentRateLimitPercent = (rateLimitingImpact.totalHits / Math.max(1, metrics.length)) * 100;
    const estimatedImprovementPercent = Math.min(80, currentRateLimitPercent * 0.8);
    
    const actionPlan = [
      `Implement ${recommendedRequestDelay}ms delay between requests`,
      `Process requests in batches of ${optimalBatchSize}`,
      'Implement exponential backoff with jitter',
      'Add request queuing system',
      'Monitor rate limit headers and adjust dynamically'
    ];
    
    if (rateLimitingImpact.totalHits > metrics.length * 0.1) {
      actionPlan.unshift('URGENT: Consider upgrading OpenAI API tier');
    }

    return {
      currentRateLimitHits: rateLimitingImpact.totalHits,
      recommendedRequestDelay,
      optimalBatchSize,
      estimatedImprovementPercent,
      actionPlan
    };
  }

  async optimizeConcurrentProcessing(): Promise<ConcurrencyOptimization> {
    const metrics = this.performanceMonitor.getMetrics();
    const activeOperations = this.performanceMonitor.getActiveOperations();
    
    // Analyze concurrent session patterns
    const concurrentSessions = this.analyzeConcurrentSessions(metrics);
    const resourceUtilization = this.calculateResourceUtilization(metrics);
    
    // Determine optimal concurrency level
    const successRateBySessionCount = this.analyzeSuccessRateBySessionCount(metrics);
    const optimalConcurrencyLevel = this.findOptimalConcurrency(successRateBySessionCount);
    
    const bottleneckAnalysis = this.identifyBottlenecks(metrics);
    
    const recommendedActions = [
      `Limit concurrent sessions to ${optimalConcurrencyLevel}`,
      'Implement session queuing for excess requests',
      'Add resource pooling for file uploads',
      'Optimize assistant reuse across sessions'
    ];
    
    if (resourceUtilization < 60) {
      recommendedActions.push('Increase concurrency - resources are underutilized');
    } else if (resourceUtilization > 90) {
      recommendedActions.unshift('URGENT: Reduce concurrency to prevent system overload');
    }

    return {
      currentConcurrentSessions: activeOperations.length,
      optimalConcurrencyLevel,
      resourceUtilizationScore: resourceUtilization,
      bottleneckAnalysis,
      recommendedActions
    };
  }

  async optimizeCohesionAnalysis(): Promise<CohesionOptimization> {
    const queryMetrics = this.performanceMonitor.getMetrics('query_processing');
    const fileReuseEfficiency = this.analytics.getFileReuseEfficiency();
    
    // Calculate current average analysis time
    const completedQueries = queryMetrics.filter(m => m.duration !== undefined);
    const currentAverageAnalysisTime = completedQueries.length > 0
      ? completedQueries.reduce((sum, m) => sum + (m.duration || 0), 0) / completedQueries.length
      : 0;
    
    // Set target based on industry benchmarks and current performance
    const targetAnalysisTime = Math.max(5000, currentAverageAnalysisTime * 0.6); // 40% improvement target
    
    const potentialSpeedupPercent = currentAverageAnalysisTime > 0
      ? ((currentAverageAnalysisTime - targetAnalysisTime) / currentAverageAnalysisTime) * 100
      : 0;
    
    const optimizationStrategies = [
      'Implement intelligent caching for repeated queries',
      'Optimize file upload and reuse strategies',
      'Pre-process common query patterns',
      'Implement parallel query processing where possible',
      'Add query result caching with smart invalidation'
    ];
    
    const implementationPriority: ('high' | 'medium' | 'low')[] = [
      'high',    // Caching
      'high',    // File reuse
      'medium',  // Pre-processing
      'low',     // Parallel processing
      'medium'   // Result caching
    ];
    
    // Adjust priorities based on current performance
    if (fileReuseEfficiency.efficiencyScore < 50) {
      implementationPriority[1] = 'high'; // Boost file reuse priority
    }
    
    if (currentAverageAnalysisTime > 30000) { // > 30 seconds
      implementationPriority[0] = 'high'; // Boost caching priority
      optimizationStrategies.unshift('URGENT: Implement request timeout handling');
      implementationPriority.unshift('high');
    }

    return {
      currentAverageAnalysisTime,
      targetAnalysisTime,
      potentialSpeedupPercent,
      optimizationStrategies,
      implementationPriority
    };
  }

  async generatePerformanceInsights(): Promise<PerformanceInsights> {
    const report = this.performanceMonitor.generatePerformanceReport();
    const costAnalysis = this.performanceMonitor.generateCostAnalysis();
    const rateLimitOpt = await this.optimizeRateLimiting();
    const concurrencyOpt = await this.optimizeConcurrentProcessing();
    const cohesionOpt = await this.optimizeCohesionAnalysis();
    
    // Calculate overall performance score
    const performanceFactors = [
      report.successRate, // Success rate weight: 30%
      Math.max(0, 100 - (report.rateLimitHits / Math.max(1, report.totalOperations)) * 100), // Rate limiting weight: 25%
      concurrencyOpt.resourceUtilizationScore, // Resource utilization weight: 25%
      Math.min(100, (10000 / Math.max(1, report.averageResponseTime)) * 100) // Response time weight: 20%
    ];
    
    const weights = [0.3, 0.25, 0.25, 0.2];
    const overallPerformanceScore = performanceFactors.reduce((sum, factor, index) => 
      sum + ((isNaN(factor) ? 0 : factor) * weights[index]), 0
    );
    
    // Identify key bottlenecks
    const keyBottlenecks = [];
    if (report.successRate < 95) keyBottlenecks.push('Low success rate - improve error handling');
    if (report.rateLimitHits > report.totalOperations * 0.1) keyBottlenecks.push('Excessive rate limiting');
    if (report.averageResponseTime > 15000) keyBottlenecks.push('Slow response times');
    if (concurrencyOpt.resourceUtilizationScore < 60) keyBottlenecks.push('Poor resource utilization');
    
    // Identify quick wins
    const quickWins = [];
    if (rateLimitOpt.estimatedImprovementPercent > 20) {
      quickWins.push(`Reduce rate limiting by ${rateLimitOpt.estimatedImprovementPercent.toFixed(1)}%`);
    }
    if (cohesionOpt.potentialSpeedupPercent > 30) {
      quickWins.push(`Speed up analysis by ${cohesionOpt.potentialSpeedupPercent.toFixed(1)}%`);
    }
    if (costAnalysis.costOptimizationOpportunities.fileReuse > 0.1) {
      quickWins.push(`Save $${costAnalysis.costOptimizationOpportunities.fileReuse.toFixed(2)} through better file reuse`);
    }
    
    // Long-term improvements
    const longTermImprovements = [
      'Implement advanced caching strategies',
      'Develop predictive rate limiting',
      'Build intelligent query optimization',
      'Create automated performance tuning'
    ];
    
    return {
      overallPerformanceScore: Math.round(overallPerformanceScore),
      keyBottlenecks,
      quickWins,
      longTermImprovements,
      costEfficiencyRating: Math.round(costAnalysis.costEfficiencyScore),
      reliabilityScore: Math.round(report.successRate)
    };
  }

  private calculateRateLimitHitsPerHour(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const timeSpanHours = (Date.now() - metrics[0].startTime.getTime()) / (1000 * 60 * 60);
    const totalRateLimitHits = metrics.reduce((sum, m) => sum + (m.retryCount || 0), 0);
    
    return timeSpanHours > 0 ? totalRateLimitHits / timeSpanHours : 0;
  }

  private analyzeConcurrentSessions(metrics: PerformanceMetrics[]): number {
    // Group metrics by time windows to find peak concurrency
    const timeWindows: Record<string, number> = {};
    
    metrics.forEach(m => {
      const timeWindow = Math.floor(m.startTime.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000); // 5-minute windows
      timeWindows[timeWindow] = (timeWindows[timeWindow] || 0) + 1;
    });
    
    return Math.max(...Object.values(timeWindows), 0);
  }

  private calculateResourceUtilization(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const successfulOperations = metrics.filter(m => m.success);
    const failedOperations = metrics.filter(m => !m.success);
    
    // Calculate utilization based on success rate and resource efficiency
    const successRate = successfulOperations.length / metrics.length;
    const avgDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.length;
    
    // Higher utilization = higher success rate + reasonable response times
    const durationScore = Math.max(0, 100 - (avgDuration / 1000)); // Penalize long durations
    
    return Math.round((successRate * 70) + (durationScore * 0.3));
  }

  private analyzeSuccessRateBySessionCount(metrics: PerformanceMetrics[]): Record<number, number> {
    // This is a simplified analysis - in a real implementation, you'd track actual concurrent sessions
    const sessionCounts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const successRates: Record<number, number> = {};
    
    sessionCounts.forEach(count => {
      // Simulate success rate degradation with higher concurrency
      const baseSuccessRate = metrics.filter(m => m.success).length / Math.max(1, metrics.length);
      const degradationFactor = Math.max(0, 1 - (count - 1) * 0.05); // 5% degradation per additional session
      successRates[count] = baseSuccessRate * degradationFactor;
    });
    
    return successRates;
  }

  private findOptimalConcurrency(successRateBySessionCount: Record<number, number>): number {
    let optimalCount = 1;
    let bestScore = 0;
    
    Object.entries(successRateBySessionCount).forEach(([count, successRate]) => {
      const concurrencyCount = parseInt(count);
      // Score = throughput * success rate (balance between speed and reliability)
      const score = concurrencyCount * successRate;
      
      if (score > bestScore && successRate > 0.9) { // Maintain at least 90% success rate
        bestScore = score;
        optimalCount = concurrencyCount;
      }
    });
    
    return optimalCount;
  }

  private identifyBottlenecks(metrics: PerformanceMetrics[]): string[] {
    const bottlenecks: string[] = [];
    
    // Analyze operation types for bottlenecks
    const operationStats = {
      file_upload: metrics.filter(m => m.operationType === 'file_upload'),
      assistant_creation: metrics.filter(m => m.operationType === 'assistant_creation'),
      query_processing: metrics.filter(m => m.operationType === 'query_processing'),
      cleanup: metrics.filter(m => m.operationType === 'cleanup')
    };
    
    Object.entries(operationStats).forEach(([opType, opMetrics]) => {
      if (opMetrics.length === 0) return;
      
      const avgDuration = opMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / opMetrics.length;
      const successRate = opMetrics.filter(m => m.success).length / opMetrics.length;
      
      if (avgDuration > 20000) { // > 20 seconds
        bottlenecks.push(`Slow ${opType} operations (avg: ${(avgDuration / 1000).toFixed(1)}s)`);
      }
      
      if (successRate < 0.9) {
        bottlenecks.push(`Low ${opType} success rate (${(successRate * 100).toFixed(1)}%)`);
      }
    });
    
    return bottlenecks;
  }
}

export function createAssistantAPIPerformanceOptimizer(): PerformanceOptimizer {
  const monitor = createPerformanceMonitor();
  const analytics = createAssistantAPIAnalytics();
  return new AssistantAPIPerformanceOptimizer(monitor, analytics);
}