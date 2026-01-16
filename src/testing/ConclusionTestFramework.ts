import { NovelAnalyzer, DefaultNovelAnalyzer, createNovelAnalyzer } from '../services/NovelAnalyzer';
import { LLMService } from '../services/LLMService';
import { ConfigManager } from '../config/ConfigManager';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration for conclusion test execution
 * Requirement 2.1: Configurable test parameters
 */
export interface ConclusionTestConfig {
  novelFile: string;
  iterations: number; // 1-10
  outputDirectory: string;
}

/**
 * Results from a single conclusion test iteration
 * Requirement 2.2: Extract and store conclusion from each analysis
 */
export interface ConclusionIteration {
  iterationNumber: number;
  conclusionText: string;
  accuracyScore: number; // 1-10
  completenessScore: number; // 1-10
  coherenceScore: number; // 1-10
  wordCount: number;
  keyElements: string[];
}

/**
 * Consistency analysis results
 * Requirement 2.3, 2.6: Compare conclusions for consistency
 */
export interface ConsistencyScore {
  score: number; // 0-10
  similarityMatrix: number[][]; // Pairwise similarity scores
  outliers: number[]; // Iteration numbers that differ significantly
}

/**
 * Quality scores for a conclusion
 * Requirement 2.4: Score accuracy, completeness, coherence
 */
export interface QualityScores {
  accuracy: number; // 1-10
  completeness: number; // 1-10
  coherence: number; // 1-10
  reasoning: string;
}

/**
 * Complete test report
 * Requirement 2.5: Generate reports in multiple formats
 */
export interface ConclusionTestReport {
  iterations: ConclusionIteration[];
  consistencyScore: ConsistencyScore;
  averageAccuracy: number; // 0-10
  averageCompleteness: number; // 0-10
  averageCoherence: number; // 0-10
  generatedAt: Date;
  testConfiguration: ConclusionTestConfig;
}

/**
 * ConclusionTestFramework class for validating book conclusion identification
 * Implements Requirements 2.1-2.7 for conclusion testing and consistency scoring
 */
export class ConclusionTestFramework {
  private novelAnalyzer: DefaultNovelAnalyzer;
  private llmService: LLMService;
  private config: ConclusionTestConfig;

  constructor(config: ConclusionTestConfig) {
    console.log('🧪 ConclusionTestFramework initialized');
    
    // Validate and store configuration
    this.config = this.validateConfiguration(config);
    
    // Initialize services
    this.novelAnalyzer = createNovelAnalyzer() as DefaultNovelAnalyzer;
    const llmConfig = ConfigManager.getInstance().getLLMConfig();
    this.llmService = new (require('../services/LLMService').OpenAILLMService)();
    
    // Ensure output directory exists
    this.ensureOutputDirectory();
  }

  /**
   * Validates configuration parameters
   * Requirement 4.1, 4.4, 4.5: Validate iteration count and output directory
   */
  private validateConfiguration(config: ConclusionTestConfig): ConclusionTestConfig {
    const errors: string[] = [];
    const validated = { ...config };
    
    // Validate novel file path is provided
    if (!validated.novelFile || validated.novelFile.trim() === '') {
      errors.push('Novel file path is required');
    } else {
      // Validate novel file exists
      if (!fs.existsSync(validated.novelFile)) {
        errors.push(`Novel file not found: ${validated.novelFile}`);
      } else {
        // Validate file is readable
        try {
          fs.accessSync(validated.novelFile, fs.constants.R_OK);
        } catch (error) {
          errors.push(`Novel file is not readable: ${validated.novelFile}`);
        }
        
        // Validate file size is reasonable (not empty, not too large)
        const stats = fs.statSync(validated.novelFile);
        if (stats.size === 0) {
          errors.push('Novel file is empty');
        } else if (stats.size > 100 * 1024 * 1024) { // 100MB limit
          errors.push(`Novel file is too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 100MB`);
        }
      }
    }
    
    // Validate iteration count (1-10)
    // Requirement 4.4: Iteration count must be between 1 and 10
    if (validated.iterations === undefined || validated.iterations === null) {
      console.warn(`⚠️  Iteration count not specified, using default value of 5`);
      validated.iterations = 5;
    } else if (!Number.isInteger(validated.iterations)) {
      errors.push(`Iteration count must be an integer, got: ${validated.iterations}`);
    } else if (validated.iterations < 1 || validated.iterations > 10) {
      console.warn(`⚠️  Invalid iteration count ${validated.iterations}, clamping to range 1-10`);
      validated.iterations = Math.max(1, Math.min(10, validated.iterations));
    }
    
    // Use default output directory if not specified
    // Requirement 4.5: Use default output directory when not specified
    if (!validated.outputDirectory || validated.outputDirectory.trim() === '') {
      validated.outputDirectory = 'test_outputs';
      console.log(`ℹ️  Using default output directory: ${validated.outputDirectory}`);
    } else {
      // Validate output directory path is valid
      const invalidChars = /[<>:"|?*]/;
      if (invalidChars.test(validated.outputDirectory)) {
        errors.push(`Output directory contains invalid characters: ${validated.outputDirectory}`);
      }
    }
    
    // Throw error if any validation failed
    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\n  - ${errors.join('\n  - ')}`;
      console.error(`❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }
    
    return validated;
  }

  /**
   * Ensures output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.config.outputDirectory)) {
      fs.mkdirSync(this.config.outputDirectory, { recursive: true });
      console.log(`📁 Created output directory: ${this.config.outputDirectory}`);
    }
  }

  /**
   * Runs the complete conclusion test
   * Requirement 2.1, 2.2: Execute novel analysis N times and extract conclusions
   * Requirement 10.1, 10.2, 10.3, 10.4, 10.5: Handle errors and continue with remaining tests
   */
  async runConclusionTest(): Promise<ConclusionTestReport> {
    console.log(`🚀 Running conclusion test for: ${path.basename(this.config.novelFile)}`);
    console.log(`📊 Configuration: ${this.config.iterations} iterations`);
    console.log('⏱️  Adding delays between operations to respect API rate limits...');
    
    // Initialize LLM service
    try {
      const llmConfig = ConfigManager.getInstance().getLLMConfig();
      await this.llmService.initialize(llmConfig);
      console.log('✅ LLM service initialized for testing');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to initialize LLM service: ${errorMessage}`);
      throw new Error(`LLM initialization failed: ${errorMessage}`);
    }
    
    const iterations: ConclusionIteration[] = [];
    const errors: string[] = [];
    
    try {
      // Execute N iterations of novel analysis
      for (let i = 1; i <= this.config.iterations; i++) {
        console.log(`\n📖 Running iteration ${i}/${this.config.iterations}...`);
        
        try {
          // Add delay between iterations to respect rate limits
          if (i > 1) {
            console.log('⏳ Waiting 30 seconds between iterations to respect API rate limits...');
            await this.sleep(30000); // 30 second delay between iterations
          }
          
          // Analyze novel
          console.log('🔍 Analyzing novel...');
          const novelText = fs.readFileSync(this.config.novelFile, 'utf-8');
          const analysis = await this.novelAnalyzer.analyzeNovel(novelText);
          
          // Extract conclusion
          const conclusionText = analysis.conclusion;
          console.log(`✅ Conclusion extracted (${conclusionText.length} characters)`);
          
          // Score conclusion quality
          console.log('📊 Scoring conclusion quality...');
          await this.sleep(5000); // Small delay before scoring
          
          let qualityScores: QualityScores;
          try {
            qualityScores = await this.scoreConclusionQuality(conclusionText, conclusionText);
          } catch (error) {
            // Requirement 10.2: Handle scoring failures
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`⚠️  Failed to score conclusion quality: ${errorMessage}`);
            errors.push(`Iteration ${i}: Scoring failed - ${errorMessage}`);
            
            // Use default scores
            qualityScores = {
              accuracy: 5,
              completeness: 5,
              coherence: 5,
              reasoning: `Scoring failed: ${errorMessage}`
            };
          }
          
          // Extract key elements (simple word extraction for now)
          const keyElements = this.extractKeyElements(conclusionText);
          
          // Create iteration result
          const iteration: ConclusionIteration = {
            iterationNumber: i,
            conclusionText,
            accuracyScore: qualityScores.accuracy,
            completenessScore: qualityScores.completeness,
            coherenceScore: qualityScores.coherence,
            wordCount: conclusionText.split(/\s+/).length,
            keyElements
          };
          
          iterations.push(iteration);
          console.log(`✅ Iteration ${i} complete`);
          console.log(`   Accuracy: ${qualityScores.accuracy}/10`);
          console.log(`   Completeness: ${qualityScores.completeness}/10`);
          console.log(`   Coherence: ${qualityScores.coherence}/10`);
          
          // Cleanup after each iteration
          await this.novelAnalyzer.cleanup();
          
        } catch (error) {
          // Requirement 10.1: Handle analysis failures in iterations
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`❌ Iteration ${i} failed: ${errorMessage}`);
          errors.push(`Iteration ${i}: Analysis failed - ${errorMessage}`);
          
          // Continue with remaining iterations
          console.log(`⚠️  Continuing with remaining iterations...`);
        }
      }
      
      // Check if we have any successful iterations
      if (iterations.length === 0) {
        throw new Error('All iterations failed. No data to analyze.');
      }
      
      console.log(`\n🔍 Analyzing consistency across ${iterations.length} iterations...`);
      
      // Analyze consistency
      let consistencyScore: ConsistencyScore;
      try {
        await this.sleep(5000); // Small delay before consistency analysis
        consistencyScore = await this.analyzeConclusionConsistency(
          iterations.map(it => it.conclusionText)
        );
      } catch (error) {
        // Requirement 10.2: Handle scoring failures
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  Failed to analyze consistency: ${errorMessage}`);
        errors.push(`Consistency analysis failed: ${errorMessage}`);
        
        // Use default consistency score
        consistencyScore = {
          score: 5,
          similarityMatrix: iterations.map(() => iterations.map(() => 0.5)),
          outliers: []
        };
      }
      
      // Calculate averages
      const averageAccuracy = this.calculateAverage(iterations.map(it => it.accuracyScore));
      const averageCompleteness = this.calculateAverage(iterations.map(it => it.completenessScore));
      const averageCoherence = this.calculateAverage(iterations.map(it => it.coherenceScore));
      
      // Generate final report
      const report: ConclusionTestReport = {
        iterations,
        consistencyScore,
        averageAccuracy,
        averageCompleteness,
        averageCoherence,
        generatedAt: new Date(),
        testConfiguration: this.config
      };
      
      console.log(`\n📋 Conclusion test complete!`);
      console.log(`📊 Average Accuracy: ${averageAccuracy.toFixed(2)}/10`);
      console.log(`📊 Average Completeness: ${averageCompleteness.toFixed(2)}/10`);
      console.log(`📊 Average Coherence: ${averageCoherence.toFixed(2)}/10`);
      console.log(`📊 Consistency Score: ${consistencyScore.score.toFixed(2)}/10`);
      
      if (errors.length > 0) {
        console.log(`\n⚠️  ${errors.length} error(s) occurred during testing:`);
        errors.forEach(err => console.log(`   - ${err}`));
      }
      
      // Save reports
      try {
        await this.saveReports(report);
      } catch (error) {
        // Requirement 10.3: Handle report generation failures
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to save reports: ${errorMessage}`);
        errors.push(`Report generation failed: ${errorMessage}`);
        // Don't throw - we still have the report data
      }
      
      return report;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Conclusion test failed:', errorMessage);
      
      // If we have partial results, try to return them
      if (iterations.length > 0) {
        console.log(`⚠️  Returning partial results from ${iterations.length} successful iteration(s)`);
        
        const partialReport: ConclusionTestReport = {
          iterations,
          consistencyScore: {
            score: 0,
            similarityMatrix: [],
            outliers: []
          },
          averageAccuracy: this.calculateAverage(iterations.map(it => it.accuracyScore)),
          averageCompleteness: this.calculateAverage(iterations.map(it => it.completenessScore)),
          averageCoherence: this.calculateAverage(iterations.map(it => it.coherenceScore)),
          generatedAt: new Date(),
          testConfiguration: this.config
        };
        
        return partialReport;
      }
      
      throw error;
    }
  }

  /**
   * Analyzes consistency between conclusions
   * Requirement 2.3, 2.6, 2.7: Calculate pairwise similarity and identify outliers
   */
  async analyzeConclusionConsistency(conclusions: string[]): Promise<ConsistencyScore> {
    if (conclusions.length < 2) {
      return {
        score: 10, // Perfect consistency with only one conclusion
        similarityMatrix: [[1]],
        outliers: []
      };
    }
    
    console.log('🔍 Calculating pairwise similarity between conclusions...');
    
    // Calculate pairwise similarity matrix
    const n = conclusions.length;
    const similarityMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          similarityMatrix[i][j] = 1.0; // Perfect similarity with self
        } else {
          // Use LLM to score similarity
          const similarity = await this.calculateSimilarity(conclusions[i], conclusions[j]);
          similarityMatrix[i][j] = similarity;
          similarityMatrix[j][i] = similarity; // Symmetric matrix
          
          // Add small delay between similarity calculations
          await this.sleep(2000);
        }
      }
    }
    
    // Calculate average similarity for each conclusion
    const avgSimilarities = similarityMatrix.map((row, idx) => {
      const sum = row.reduce((acc, val, jdx) => idx !== jdx ? acc + val : acc, 0);
      return sum / (n - 1);
    });
    
    // Calculate overall consistency score (0-10)
    const overallAvgSimilarity = avgSimilarities.reduce((acc, val) => acc + val, 0) / n;
    const consistencyScore = overallAvgSimilarity * 10;
    
    // Identify outliers (conclusions with avg similarity < 0.6)
    const outliers = avgSimilarities
      .map((sim, idx) => ({ idx, sim }))
      .filter(item => item.sim < 0.6)
      .map(item => item.idx + 1); // Convert to 1-based iteration numbers
    
    console.log(`✅ Consistency analysis complete`);
    console.log(`   Overall consistency: ${consistencyScore.toFixed(2)}/10`);
    if (outliers.length > 0) {
      console.log(`   ⚠️  Outliers detected: iterations ${outliers.join(', ')}`);
    }
    
    return {
      score: consistencyScore,
      similarityMatrix,
      outliers
    };
  }

  /**
   * Calculates similarity between two conclusions using LLM
   * Returns a score between 0 and 1
   */
  private async calculateSimilarity(conclusion1: string, conclusion2: string): Promise<number> {
    const prompt = `Compare these two novel conclusions and rate their similarity on a scale of 0.0 to 1.0.

Consider:
- Do they describe the same key events?
- Do they mention the same character outcomes?
- Do they convey the same overall resolution?
- Are the main plot points consistent?

Return ONLY a number between 0.0 and 1.0, where:
- 1.0 = Identical or nearly identical conclusions
- 0.7-0.9 = Very similar, minor differences in wording or detail
- 0.4-0.6 = Somewhat similar, same general outcome but different emphasis
- 0.0-0.3 = Very different conclusions

Conclusion 1:
${conclusion1}

Conclusion 2:
${conclusion2}

Similarity score (0.0-1.0):`;

    try {
      const response = await this.llmService.generateContent(prompt, '');
      const score = parseFloat(response.trim());
      
      if (isNaN(score) || score < 0 || score > 1) {
        console.warn(`⚠️  Invalid similarity score: ${response}, using 0.5 as default`);
        return 0.5;
      }
      
      return score;
    } catch (error) {
      console.warn(`⚠️  Error calculating similarity: ${error}, using 0.5 as default`);
      return 0.5;
    }
  }

  /**
   * Scores conclusion quality using LLM
   * Requirement 2.4: Score accuracy, completeness, coherence (1-10 each)
   */
  async scoreConclusionQuality(conclusion: string, bookConclusion: string): Promise<QualityScores> {
    const prompt = `Evaluate this novel conclusion on three dimensions. Rate each on a scale of 1-10.

ACCURACY (1-10): How accurately does it capture the key events and outcomes?
- 10 = Perfectly captures all major events and character outcomes
- 7-9 = Captures most key events with minor omissions
- 4-6 = Captures some key events but misses important details
- 1-3 = Misses most key events or contains inaccuracies

COMPLETENESS (1-10): How complete is the conclusion?
- 10 = Covers all major plot threads and character arcs
- 7-9 = Covers most plot threads with minor gaps
- 4-6 = Covers some plot threads but leaves significant gaps
- 1-3 = Very incomplete, major plot threads unaddressed

COHERENCE (1-10): How well-structured and coherent is the text?
- 10 = Perfectly clear, logical, and well-organized
- 7-9 = Clear and logical with minor issues
- 4-6 = Somewhat unclear or disorganized
- 1-3 = Confusing or poorly structured

Conclusion to evaluate:
${conclusion}

Respond in this EXACT JSON format (no markdown, no code blocks):
{
  "accuracy": 8,
  "completeness": 7,
  "coherence": 9,
  "reasoning": "Brief explanation of the scores"
}`;

    try {
      const response = await this.llmService.generateContent(prompt, '');
      
      // Clean up response
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      cleanedResponse = cleanedResponse.trim();
      
      const scores = JSON.parse(cleanedResponse);
      
      // Validate scores are in range 1-10
      const accuracy = Math.max(1, Math.min(10, scores.accuracy || 5));
      const completeness = Math.max(1, Math.min(10, scores.completeness || 5));
      const coherence = Math.max(1, Math.min(10, scores.coherence || 5));
      
      return {
        accuracy,
        completeness,
        coherence,
        reasoning: scores.reasoning || 'No reasoning provided'
      };
    } catch (error) {
      console.warn(`⚠️  Error scoring conclusion quality: ${error}, using default scores`);
      return {
        accuracy: 5,
        completeness: 5,
        coherence: 5,
        reasoning: 'Error during scoring, default values used'
      };
    }
  }

  /**
   * Extracts key elements from conclusion text
   */
  private extractKeyElements(conclusionText: string): string[] {
    // Simple extraction: get important words (nouns, proper nouns)
    // This is a simplified version - could be enhanced with NLP
    const words = conclusionText.split(/\s+/);
    const keyWords = words
      .filter(word => word.length > 4) // Filter short words
      .filter(word => /^[A-Z]/.test(word)) // Capitalized words (likely names/places)
      .slice(0, 10); // Take top 10
    
    // Remove duplicates using Array.from instead of spread operator
    return Array.from(new Set(keyWords));
  }

  /**
   * Calculates average of an array of numbers
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    return parseFloat((sum / numbers.length).toFixed(2));
  }

  /**
   * Sleep utility for adding delays
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Saves reports in multiple formats
   * Requirement 2.5: Generate CSV, JSON, and text table reports
   */
  private async saveReports(report: ConclusionTestReport): Promise<void> {
    const novelName = path.basename(this.config.novelFile, path.extname(this.config.novelFile));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save JSON report
    const jsonPath = path.join(this.config.outputDirectory, `conclusion-test-${novelName}-${timestamp}.json`);
    await fs.promises.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`📄 JSON report saved: ${jsonPath}`);
    
    // Save CSV report
    const csvContent = this.generateCSVReport(report);
    const csvPath = path.join(this.config.outputDirectory, `conclusion-test-${novelName}-${timestamp}.csv`);
    await fs.promises.writeFile(csvPath, csvContent, 'utf8');
    console.log(`📄 CSV report saved: ${csvPath}`);
    
    // Save text table report
    const tableContent = this.generateTableReport(report);
    const tablePath = path.join(this.config.outputDirectory, `conclusion-test-${novelName}-${timestamp}.txt`);
    await fs.promises.writeFile(tablePath, tableContent, 'utf8');
    console.log(`📄 Text report saved: ${tablePath}`);
  }

  /**
   * Generates CSV report
   */
  private generateCSVReport(report: ConclusionTestReport): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Iteration,Conclusion Text,Accuracy Score,Completeness Score,Coherence Score,Word Count');
    
    // Data rows
    for (const iteration of report.iterations) {
      const conclusionEscaped = `"${iteration.conclusionText.replace(/"/g, '""')}"`;
      lines.push(
        `${iteration.iterationNumber},${conclusionEscaped},${iteration.accuracyScore},${iteration.completenessScore},${iteration.coherenceScore},${iteration.wordCount}`
      );
    }
    
    // Summary section
    lines.push('');
    lines.push('Summary Statistics');
    lines.push(`Average Accuracy,${report.averageAccuracy}`);
    lines.push(`Average Completeness,${report.averageCompleteness}`);
    lines.push(`Average Coherence,${report.averageCoherence}`);
    lines.push(`Consistency Score,${report.consistencyScore.score.toFixed(2)}`);
    lines.push(`Outliers,"${report.consistencyScore.outliers.join(', ')}"`);
    
    return lines.join('\n');
  }

  /**
   * Generates text table report
   */
  private generateTableReport(report: ConclusionTestReport): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(80));
    lines.push('CONCLUSION TEST REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(`Novel: ${path.basename(this.config.novelFile)}`);
    lines.push(`Iterations: ${this.config.iterations}`);
    lines.push(`Generated: ${report.generatedAt.toISOString()}`);
    lines.push('');
    
    lines.push('SUMMARY STATISTICS');
    lines.push('-'.repeat(80));
    lines.push(`Average Accuracy:     ${report.averageAccuracy.toFixed(2)}/10`);
    lines.push(`Average Completeness: ${report.averageCompleteness.toFixed(2)}/10`);
    lines.push(`Average Coherence:    ${report.averageCoherence.toFixed(2)}/10`);
    lines.push(`Consistency Score:    ${report.consistencyScore.score.toFixed(2)}/10`);
    if (report.consistencyScore.outliers.length > 0) {
      lines.push(`Outliers:             Iterations ${report.consistencyScore.outliers.join(', ')}`);
    } else {
      lines.push(`Outliers:             None`);
    }
    lines.push('');
    
    lines.push('ITERATION DETAILS');
    lines.push('-'.repeat(80));
    
    for (const iteration of report.iterations) {
      lines.push('');
      lines.push(`Iteration ${iteration.iterationNumber}:`);
      lines.push(`  Accuracy:     ${iteration.accuracyScore}/10`);
      lines.push(`  Completeness: ${iteration.completenessScore}/10`);
      lines.push(`  Coherence:    ${iteration.coherenceScore}/10`);
      lines.push(`  Word Count:   ${iteration.wordCount}`);
      lines.push(`  Conclusion:   ${iteration.conclusionText.substring(0, 200)}...`);
    }
    
    lines.push('');
    lines.push('='.repeat(80));
    
    return lines.join('\n');
  }
}
