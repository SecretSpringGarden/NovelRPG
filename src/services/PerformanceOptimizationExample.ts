/**
 * Example usage of Assistant API Performance Monitoring and Optimization
 * 
 * This file demonstrates how to use the new performance monitoring and optimization
 * features implemented for the OpenAI Assistants API integration.
 */

import { createAssistantService } from './AssistantService';
import { LLMConfig } from '../config/types';

export async function demonstratePerformanceOptimization() {
  // Initialize the Assistant Service
  const assistantService = createAssistantService();
  
  const config: LLMConfig = {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4',
    maxTokens: 4000,
    temperature: 0.7,
    timeout: 30000
  };

  await assistantService.initialize(config);

  console.log('🚀 Assistant API Performance Optimization Demo');
  console.log('================================================');

  try {
    // 1. Get current performance insights
    console.log('\n📊 Current Performance Insights:');
    const insights = await assistantService.getPerformanceInsights();
    console.log(`Overall Performance Score: ${insights.overallPerformanceScore}/100`);
    console.log(`Cost Efficiency Rating: ${insights.costEfficiencyRating}/100`);
    console.log(`Reliability Score: ${insights.reliabilityScore}/100`);
    
    if (insights.keyBottlenecks.length > 0) {
      console.log('\n⚠️  Key Bottlenecks:');
      insights.keyBottlenecks.forEach((bottleneck: string, index: number) => {
        console.log(`  ${index + 1}. ${bottleneck}`);
      });
    }

    if (insights.quickWins.length > 0) {
      console.log('\n⚡ Quick Wins:');
      insights.quickWins.forEach((win: string, index: number) => {
        console.log(`  ${index + 1}. ${win}`);
      });
    }

    // 2. Rate Limiting Optimization
    console.log('\n🔄 Rate Limiting Optimization:');
    const rateLimitOpt = await assistantService.optimizeRateLimiting();
    console.log(`Current Rate Limit Hits: ${rateLimitOpt.currentRateLimitHits}`);
    console.log(`Recommended Request Delay: ${rateLimitOpt.recommendedRequestDelay}ms`);
    console.log(`Optimal Batch Size: ${rateLimitOpt.optimalBatchSize}`);
    console.log(`Estimated Improvement: ${rateLimitOpt.estimatedImprovementPercent.toFixed(1)}%`);
    
    console.log('\n📋 Action Plan:');
    rateLimitOpt.actionPlan.forEach((action: string, index: number) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 3. Concurrent Processing Optimization
    console.log('\n⚡ Concurrent Processing Optimization:');
    const concurrencyOpt = await assistantService.optimizeConcurrentProcessing();
    console.log(`Current Concurrent Sessions: ${concurrencyOpt.currentConcurrentSessions}`);
    console.log(`Optimal Concurrency Level: ${concurrencyOpt.optimalConcurrencyLevel}`);
    console.log(`Resource Utilization Score: ${concurrencyOpt.resourceUtilizationScore}/100`);
    
    if (concurrencyOpt.bottleneckAnalysis.length > 0) {
      console.log('\n🔍 Bottleneck Analysis:');
      concurrencyOpt.bottleneckAnalysis.forEach((bottleneck: string, index: number) => {
        console.log(`  ${index + 1}. ${bottleneck}`);
      });
    }

    console.log('\n💡 Recommended Actions:');
    concurrencyOpt.recommendedActions.forEach((action: string, index: number) => {
      console.log(`  ${index + 1}. ${action}`);
    });

    // 4. Cohesion Analysis Optimization
    console.log('\n🎯 Cohesion Analysis Optimization:');
    const cohesionOpt = await assistantService.optimizeCohesionAnalysis();
    console.log(`Current Average Analysis Time: ${(cohesionOpt.currentAverageAnalysisTime / 1000).toFixed(1)}s`);
    console.log(`Target Analysis Time: ${(cohesionOpt.targetAnalysisTime / 1000).toFixed(1)}s`);
    console.log(`Potential Speedup: ${cohesionOpt.potentialSpeedupPercent.toFixed(1)}%`);
    
    console.log('\n🛠️  Optimization Strategies:');
    cohesionOpt.optimizationStrategies.forEach((strategy: string, index: number) => {
      const priority = cohesionOpt.implementationPriority[index];
      const priorityEmoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
      console.log(`  ${priorityEmoji} ${strategy} (${priority} priority)`);
    });

    // 5. Performance Report
    console.log('\n📈 Performance Report:');
    const report = await assistantService.getPerformanceReport();
    console.log(`Total Operations: ${report.totalOperations}`);
    console.log(`Success Rate: ${report.successRate.toFixed(1)}%`);
    console.log(`Average Response Time: ${(report.averageResponseTime / 1000).toFixed(1)}s`);
    console.log(`Total Cost: $${report.totalCost.toFixed(4)}`);
    console.log(`Rate Limit Hits: ${report.rateLimitHits}`);

    // 6. Cost Analysis
    console.log('\n💰 Cost Analysis:');
    const costAnalysis = await assistantService.getCostAnalysis();
    console.log(`Total Cost: $${costAnalysis.totalCost.toFixed(4)}`);
    console.log(`Average Cost Per Operation: $${costAnalysis.averageCostPerOperation.toFixed(6)}`);
    console.log(`Projected Monthly Cost: $${costAnalysis.projectedMonthlyCost.toFixed(2)}`);
    console.log(`Cost Efficiency Score: ${costAnalysis.costEfficiencyScore}/100`);
    
    console.log('\n💡 Cost Optimization Opportunities:');
    console.log(`  File Reuse Savings: $${costAnalysis.costOptimizationOpportunities.fileReuse.toFixed(4)}`);
    console.log(`  Rate Limit Reduction Savings: $${costAnalysis.costOptimizationOpportunities.rateLimitReduction.toFixed(4)}`);
    console.log(`  Caching Savings: $${costAnalysis.costOptimizationOpportunities.caching.toFixed(4)}`);

  } catch (error) {
    console.error('❌ Error during performance optimization demo:', error);
  }

  console.log('\n✅ Performance optimization demo completed!');
}

// Example of how to use performance monitoring during actual operations
export async function monitoredNovelAnalysis(novelPath: string) {
  const assistantService = createAssistantService();
  
  const config: LLMConfig = {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4',
    maxTokens: 4000,
    temperature: 0.7,
    timeout: 30000
  };

  await assistantService.initialize(config);

  console.log(`📚 Starting monitored analysis of: ${novelPath}`);
  
  try {
    // Upload novel with performance monitoring
    const fileId = await assistantService.uploadNovelFile(novelPath, (progress) => {
      console.log(`Upload progress: ${progress.percentage.toFixed(1)}% - ${progress.currentStep}`);
    });

    // Create assistant with performance monitoring
    const assistantId = await assistantService.createNovelAnalysisAssistant(fileId, (progress) => {
      console.log(`Assistant creation progress: ${progress.percentage.toFixed(1)}% - ${progress.currentStep}`);
    });

    // Perform queries with performance monitoring
    const characterQuery = "Extract the main characters from this novel, including their names, descriptions, and importance rankings.";
    const characters = await assistantService.queryAssistant(assistantId, characterQuery, (progress) => {
      console.log(`Query progress: ${progress.percentage.toFixed(1)}% - ${progress.currentStep}`);
    });

    console.log('✅ Analysis completed successfully');
    
    // Get performance insights after the operation
    const insights = await assistantService.getPerformanceInsights();
    console.log(`\n📊 Post-Analysis Performance Score: ${insights.overallPerformanceScore}/100`);
    
    // Cleanup with monitoring
    await assistantService.cleanup(assistantId, fileId);
    console.log('🗑️  Resources cleaned up successfully');

  } catch (error) {
    console.error('❌ Error during monitored novel analysis:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstratePerformanceOptimization().catch(console.error);
}