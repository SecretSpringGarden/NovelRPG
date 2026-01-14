import * as fs from 'fs';
import * as path from 'path';
import { NovelAnalyzer, createNovelAnalyzer } from './NovelAnalyzer';
import { AssistantService, createAssistantService } from './AssistantService';
import { ConfigManager } from '../config/ConfigManager';
import { NovelAnalysis } from '../models/GameState';

/**
 * Model Comparison Test
 * Compares gpt-4-turbo-preview (current) vs gpt-4o-mini (cheapest) for novel analysis
 * 
 * This test is skipped by default to avoid API costs.
 * To run: Change describe.skip to describe
 * 
 * Cost comparison (approximate):
 * - gpt-4-turbo-preview: $10/1M input tokens, $30/1M output tokens
 * - gpt-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens
 * - Savings: ~98% cheaper!
 */
describe.skip('Model Comparison: Novel Analysis Quality', () => {
  let testNovelPath: string;
  let configManager: ConfigManager;

  beforeAll(() => {
    configManager = ConfigManager.getInstance();
    testNovelPath = path.join(__dirname, '../../test_simple_novel.txt');
    
    if (!fs.existsSync(testNovelPath)) {
      throw new Error(`Test novel not found at ${testNovelPath}`);
    }
  });

  /**
   * Helper function to analyze novel with a specific model
   */
  async function analyzeWithModel(modelName: string): Promise<NovelAnalysis> {
    console.log(`\n📊 Testing with model: ${modelName}`);
    console.log('='.repeat(60));
    
    // Create a custom assistant service with the specified model
    const assistantService = createAssistantService();
    
    // Get config and override the model
    const llmConfig = configManager.getLLMConfig();
    const customConfig = {
      ...llmConfig,
      model: modelName
    };
    
    await assistantService.initialize(customConfig);
    
    // Create novel analyzer
    const novelAnalyzer = createNovelAnalyzer();
    
    // Override the assistant service in the analyzer
    (novelAnalyzer as any).assistantService = assistantService;
    
    try {
      const novelText = fs.readFileSync(testNovelPath, 'utf8');
      const startTime = Date.now();
      
      const analysis = await novelAnalyzer.analyzeNovel(novelText);
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Analysis completed in ${duration}s`);
      console.log(`   Characters: ${analysis.mainCharacters.length}`);
      console.log(`   Plot Points: ${analysis.plotPoints.length}`);
      console.log(`   Is Complete: ${analysis.isComplete}`);
      console.log(`   Validation Errors: ${analysis.validationErrors.length}`);
      
      return analysis;
      
    } finally {
      // Cleanup
      await (novelAnalyzer as any).cleanup();
    }
  }

  /**
   * Helper function to compare two analyses
   */
  function compareAnalyses(
    expensiveAnalysis: NovelAnalysis, 
    cheapAnalysis: NovelAnalysis
  ): void {
    console.log('\n📋 COMPARISON RESULTS');
    console.log('='.repeat(60));
    
    // Compare completeness
    console.log('\n1. Completeness:');
    console.log(`   gpt-4-turbo-preview: ${expensiveAnalysis.isComplete ? '✅' : '❌'}`);
    console.log(`   gpt-4o-mini:         ${cheapAnalysis.isComplete ? '✅' : '❌'}`);
    
    // Compare character counts
    console.log('\n2. Character Extraction:');
    console.log(`   gpt-4-turbo-preview: ${expensiveAnalysis.mainCharacters.length} characters`);
    console.log(`   gpt-4o-mini:         ${cheapAnalysis.mainCharacters.length} characters`);
    
    if (expensiveAnalysis.mainCharacters.length > 0 && cheapAnalysis.mainCharacters.length > 0) {
      console.log('\n   Character Names:');
      console.log(`   gpt-4-turbo-preview: ${expensiveAnalysis.mainCharacters.map(c => c.name).join(', ')}`);
      console.log(`   gpt-4o-mini:         ${cheapAnalysis.mainCharacters.map(c => c.name).join(', ')}`);
    }
    
    // Compare plot points
    console.log('\n3. Plot Point Extraction:');
    console.log(`   gpt-4-turbo-preview: ${expensiveAnalysis.plotPoints.length} plot points`);
    console.log(`   gpt-4o-mini:         ${cheapAnalysis.plotPoints.length} plot points`);
    
    // Compare narrative structure lengths
    console.log('\n4. Narrative Structure Quality:');
    console.log(`   Introduction length:`);
    console.log(`     gpt-4-turbo-preview: ${expensiveAnalysis.introduction.length} chars`);
    console.log(`     gpt-4o-mini:         ${cheapAnalysis.introduction.length} chars`);
    console.log(`   Climax length:`);
    console.log(`     gpt-4-turbo-preview: ${expensiveAnalysis.climax.length} chars`);
    console.log(`     gpt-4o-mini:         ${cheapAnalysis.climax.length} chars`);
    console.log(`   Conclusion length:`);
    console.log(`     gpt-4-turbo-preview: ${expensiveAnalysis.conclusion.length} chars`);
    console.log(`     gpt-4o-mini:         ${cheapAnalysis.conclusion.length} chars`);
    
    // Compare validation errors
    console.log('\n5. Validation Errors:');
    console.log(`   gpt-4-turbo-preview: ${expensiveAnalysis.validationErrors.length} errors`);
    if (expensiveAnalysis.validationErrors.length > 0) {
      expensiveAnalysis.validationErrors.forEach(err => console.log(`     - ${err}`));
    }
    console.log(`   gpt-4o-mini:         ${cheapAnalysis.validationErrors.length} errors`);
    if (cheapAnalysis.validationErrors.length > 0) {
      cheapAnalysis.validationErrors.forEach(err => console.log(`     - ${err}`));
    }
    
    // Overall assessment
    console.log('\n6. Overall Assessment:');
    const expensiveScore = calculateQualityScore(expensiveAnalysis);
    const cheapScore = calculateQualityScore(cheapAnalysis);
    console.log(`   gpt-4-turbo-preview quality score: ${expensiveScore}/100`);
    console.log(`   gpt-4o-mini quality score:         ${cheapScore}/100`);
    
    const percentDiff = ((cheapScore / expensiveScore) * 100).toFixed(1);
    console.log(`   gpt-4o-mini is ${percentDiff}% as good as gpt-4-turbo-preview`);
    
    // Recommendation
    console.log('\n7. Recommendation:');
    if (cheapScore >= 80) {
      console.log('   ✅ gpt-4o-mini produces excellent results - RECOMMENDED for cost savings');
    } else if (cheapScore >= 60) {
      console.log('   ⚠️  gpt-4o-mini produces acceptable results - consider for cost savings');
    } else {
      console.log('   ❌ gpt-4o-mini quality is too low - stick with gpt-4-turbo-preview');
    }
    
    console.log('\n' + '='.repeat(60));
  }

  /**
   * Calculate a quality score for an analysis (0-100)
   */
  function calculateQualityScore(analysis: NovelAnalysis): number {
    let score = 0;
    
    // Completeness (30 points)
    if (analysis.isComplete) score += 30;
    
    // Character extraction (20 points)
    if (analysis.mainCharacters.length === 4) {
      score += 20;
    } else if (analysis.mainCharacters.length > 0) {
      score += (analysis.mainCharacters.length / 4) * 20;
    }
    
    // Plot points (20 points)
    if (analysis.plotPoints.length === 5) {
      score += 20;
    } else if (analysis.plotPoints.length > 0) {
      score += (analysis.plotPoints.length / 5) * 20;
    }
    
    // Narrative structure (30 points - 10 each)
    if (analysis.introduction.length > 100) score += 10;
    if (analysis.climax.length > 100) score += 10;
    if (analysis.conclusion.length > 100) score += 10;
    
    // Deduct for validation errors
    score -= analysis.validationErrors.length * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  it('should compare gpt-4-turbo-preview vs gpt-4o-mini for novel analysis', async () => {
    console.log('\n🔬 MODEL COMPARISON TEST');
    console.log('Testing: gpt-4-turbo-preview (current) vs gpt-4o-mini (cheapest)');
    console.log('Novel: test_simple_novel.txt');
    console.log('='.repeat(60));
    
    // Analyze with expensive model (current)
    const expensiveAnalysis = await analyzeWithModel('gpt-4-turbo-preview');
    
    // Wait a bit between API calls
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Analyze with cheap model
    const cheapAnalysis = await analyzeWithModel('gpt-4o-mini');
    
    // Compare results
    compareAnalyses(expensiveAnalysis, cheapAnalysis);
    
    // Assertions
    expect(expensiveAnalysis).toBeDefined();
    expect(cheapAnalysis).toBeDefined();
    
    // Both should be complete
    expect(expensiveAnalysis.isComplete).toBe(true);
    expect(cheapAnalysis.isComplete).toBe(true);
    
    // Both should have characters and plot points
    expect(expensiveAnalysis.mainCharacters.length).toBeGreaterThan(0);
    expect(cheapAnalysis.mainCharacters.length).toBeGreaterThan(0);
    expect(expensiveAnalysis.plotPoints.length).toBeGreaterThan(0);
    expect(cheapAnalysis.plotPoints.length).toBeGreaterThan(0);
    
    // Calculate quality scores
    const expensiveScore = calculateQualityScore(expensiveAnalysis);
    const cheapScore = calculateQualityScore(cheapAnalysis);
    
    // Log final verdict
    console.log('\n🎯 FINAL VERDICT:');
    if (cheapScore >= 80) {
      console.log('✅ Switch to gpt-4o-mini - quality is excellent and you\'ll save ~98% on costs!');
    } else if (cheapScore >= 60) {
      console.log('⚠️  gpt-4o-mini is acceptable but not as good - your choice on cost vs quality');
    } else {
      console.log('❌ Stick with gpt-4-turbo-preview - quality difference is too significant');
    }
    
  }, 120000); // 2 minute timeout for both analyses

  it('should test gpt-4o-mini alone (faster test)', async () => {
    console.log('\n🔬 QUICK TEST: gpt-4o-mini only');
    console.log('='.repeat(60));
    
    const analysis = await analyzeWithModel('gpt-4o-mini');
    
    // Assertions
    expect(analysis).toBeDefined();
    expect(analysis.isComplete).toBe(true);
    expect(analysis.mainCharacters.length).toBe(4);
    expect(analysis.plotPoints.length).toBe(5);
    expect(analysis.introduction.length).toBeGreaterThan(0);
    expect(analysis.climax.length).toBeGreaterThan(0);
    expect(analysis.conclusion.length).toBeGreaterThan(0);
    expect(analysis.validationErrors.length).toBe(0);
    
    const score = calculateQualityScore(analysis);
    console.log(`\n📊 Quality Score: ${score}/100`);
    
    if (score >= 80) {
      console.log('✅ Excellent quality - ready for production use!');
    } else if (score >= 60) {
      console.log('⚠️  Acceptable quality - may need some adjustments');
    } else {
      console.log('❌ Quality too low - not recommended');
    }
    
  }, 60000); // 1 minute timeout
});
