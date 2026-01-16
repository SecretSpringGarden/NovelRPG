import { GameManager } from '../core/GameManager';
import { CohesionRanker, GameResult } from './CohesionRanker';
import { LLMService } from '../services/LLMService';
import { NovelAnalysis } from '../models/GameState';
import { StoryEnding } from '../models/StoryEnding';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration for ending variation test execution
 * Requirement 3.1: Test three distinct ending types
 */
export interface EndingVariationTestConfig {
  novelFile: string;
  rounds: number; // Fixed at 5 for quick testing
  outputDirectory: string;
  quotePercentage: number; // 0-100
}

/**
 * Quote usage statistics for a game
 * Requirement 3.7: Include quote usage stats in reports
 */
export interface QuoteUsageStats {
  totalActions: number;
  bookQuotesUsed: number;
  llmGeneratedUsed: number;
  actualPercentage: number;
}

/**
 * Results from a single game with a specific ending type
 */
export interface EndingGameResult {
  endingType: 'original' | 'opposite' | 'random';
  endingDescription: string;
  rounds: number;
  cohesionScore: number; // 1-10
  segmentsCount: number;
  wordCount: number;
  quoteUsageStats: QuoteUsageStats;
  gameStateFile: string;
  gameResult: GameResult;
}

/**
 * Comparison statistics across all three ending types
 * Requirement 3.8: Identify which ending type achieved highest cohesion
 */
export interface EndingComparison {
  highestCohesion: 'original' | 'opposite' | 'random';
  cohesionScores: {
    original: number;
    opposite: number;
    random: number;
  };
  averageWordCount: {
    original: number;
    opposite: number;
    random: number;
  };
  quoteUsageStats: {
    original: QuoteUsageStats;
    opposite: QuoteUsageStats;
    random: QuoteUsageStats;
  };
}

/**
 * Complete ending variation test report
 * Requirement 3.7: Generate comparative report
 */
export interface EndingVariationReport {
  originalEndingGame: EndingGameResult;
  oppositeEndingGame: EndingGameResult;
  randomEndingGame: EndingGameResult;
  comparison: EndingComparison;
  generatedAt: Date;
  testConfiguration: EndingVariationTestConfig;
}

/**
 * EndingVariationTestFramework class for comparing different ending types
 * Implements Requirements 3.1-3.9 for ending variation testing and comparative analysis
 */
export class EndingVariationTestFramework {
  private gameManager: GameManager;
  private cohesionRanker: CohesionRanker;
  private llmService: LLMService;
  private config: EndingVariationTestConfig;

  constructor(config: EndingVariationTestConfig) {
    console.log('🧪 EndingVariationTestFramework initialized');
    
    // Validate and store configuration
    this.config = this.validateConfiguration(config);
    
    // Initialize services
    this.gameManager = new GameManager();
    this.llmService = new (require('../services/LLMService').OpenAILLMService)();
    this.cohesionRanker = new CohesionRanker(this.llmService);
    
    // Ensure output directory exists
    this.ensureOutputDirectory();
  }

  /**
   * Validates configuration parameters
   * Requirement 4.2, 4.3, 4.5: Validate round count and quote percentage
   */
  private validateConfiguration(config: EndingVariationTestConfig): EndingVariationTestConfig {
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
    
    // Validate round count (1-20)
    // Requirement 4.2: Round count must be between 1 and 20
    if (validated.rounds === undefined || validated.rounds === null) {
      validated.rounds = 5; // Default value
      console.log(`ℹ️  Using default round count: ${validated.rounds}`);
    } else if (!Number.isInteger(validated.rounds)) {
      errors.push(`Round count must be an integer, got: ${validated.rounds}`);
    } else if (validated.rounds < 1 || validated.rounds > 20) {
      console.warn(`⚠️  Invalid round count ${validated.rounds}, clamping to range 1-20`);
      validated.rounds = Math.max(1, Math.min(20, validated.rounds));
    }
    
    // Validate quote percentage (0-100)
    // Requirement 4.3: Quote percentage must be between 0 and 100
    if (validated.quotePercentage === undefined || validated.quotePercentage === null) {
      validated.quotePercentage = 0; // Default value
      console.log(`ℹ️  Using default quote percentage: ${validated.quotePercentage}%`);
    } else if (!Number.isFinite(validated.quotePercentage)) {
      errors.push(`Quote percentage must be a number, got: ${validated.quotePercentage}`);
    } else if (validated.quotePercentage < 0 || validated.quotePercentage > 100) {
      console.warn(`⚠️  Invalid quote percentage ${validated.quotePercentage}, clamping to range 0-100`);
      validated.quotePercentage = Math.max(0, Math.min(100, validated.quotePercentage));
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
   * Sleep utility for adding delays
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Runs ending variation test with three games (original, opposite, random endings)
   * Requirement 3.5, 6.1: Analyze novel once, reuse for all games, run three games with 5 rounds each
   * Requirement 10.1, 10.2, 10.3, 10.4, 10.5: Handle errors and continue with remaining tests
   */
  async runEndingVariationTest(): Promise<EndingVariationReport> {
    console.log('🚀 Starting ending variation test...');
    console.log(`📖 Novel: ${path.basename(this.config.novelFile)}`);
    console.log(`🎲 Rounds per game: ${this.config.rounds}`);
    console.log(`📊 Quote percentage: ${this.config.quotePercentage}%`);
    
    const errors: string[] = [];
    
    // Initialize LLM service for GameManager
    try {
      await this.gameManager.initializeLLMService();
      console.log('✅ LLM service initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to initialize LLM service: ${errorMessage}`);
      throw new Error(`LLM initialization failed: ${errorMessage}`);
    }
    
    // OPTIMIZATION: Analyze novel ONCE before all games
    let novelAnalysis: any;
    try {
      console.log('\n📖 Analyzing novel (this will be reused for all three games)...');
      const { createNovelAnalyzer } = require('../services');
      const novelAnalyzer = createNovelAnalyzer();
      const novelText = fs.readFileSync(this.config.novelFile, 'utf-8');
      novelAnalysis = await novelAnalyzer.analyzeNovel(novelText);
      console.log('✅ Novel analysis complete - will be reused for all games');
      console.log(`   📊 Found ${novelAnalysis.mainCharacters.length} characters, ${novelAnalysis.plotPoints.length} plot points`);
    } catch (error) {
      // Requirement 10.1: Handle analysis failures
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to analyze novel: ${errorMessage}`);
      throw new Error(`Novel analysis failed: ${errorMessage}`);
    }
    
    // Generate three different endings
    console.log('\n🎯 Generating three different endings...');
    let originalEnding: StoryEnding;
    let oppositeEnding: StoryEnding;
    let randomEnding: StoryEnding;
    
    try {
      originalEnding = await this.generateOriginalEnding(novelAnalysis);
      await this.sleep(2000); // Rate limiting
    } catch (error) {
      // Requirement 10.1: Handle ending generation failures
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to generate original ending: ${errorMessage}`);
      errors.push(`Original ending generation failed: ${errorMessage}`);
      
      // Use fallback ending
      originalEnding = {
        id: 'original-ending',
        type: 'original',
        description: novelAnalysis.conclusion || 'The story concludes as written in the novel.',
        targetScore: 0
      };
    }
    
    try {
      oppositeEnding = await this.generateOppositeEnding(novelAnalysis);
      await this.sleep(2000); // Rate limiting
    } catch (error) {
      // Requirement 10.1: Handle ending generation failures
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to generate opposite ending: ${errorMessage}`);
      errors.push(`Opposite ending generation failed: ${errorMessage}`);
      
      // Use fallback ending
      oppositeEnding = {
        id: 'opposite-ending',
        type: 'opposite',
        description: 'The story takes an opposite turn from the original conclusion.',
        targetScore: 0
      };
    }
    
    try {
      randomEnding = await this.generateRandomEnding(novelAnalysis);
      await this.sleep(2000); // Rate limiting
    } catch (error) {
      // Requirement 10.1: Handle ending generation failures
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to generate random ending: ${errorMessage}`);
      errors.push(`Random ending generation failed: ${errorMessage}`);
      
      // Use fallback ending
      randomEnding = {
        id: 'random-ending',
        type: 'random',
        description: 'The story takes an unexpected creative turn.',
        targetScore: 0
      };
    }
    
    console.log('✅ All three endings generated');
    
    // Run three games, one for each ending type
    console.log('\n🎮 Running three games with different endings...');
    
    let originalGame: EndingGameResult | null = null;
    let oppositeGame: EndingGameResult | null = null;
    let randomGame: EndingGameResult | null = null;
    
    try {
      originalGame = await this.runSingleGame(
        novelAnalysis,
        originalEnding,
        'original'
      );
    } catch (error) {
      // Requirement 10.4: Continue with remaining tests on error
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Original ending game failed: ${errorMessage}`);
      errors.push(`Original game failed: ${errorMessage}`);
    }
    
    try {
      oppositeGame = await this.runSingleGame(
        novelAnalysis,
        oppositeEnding,
        'opposite'
      );
    } catch (error) {
      // Requirement 10.4: Continue with remaining tests on error
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Opposite ending game failed: ${errorMessage}`);
      errors.push(`Opposite game failed: ${errorMessage}`);
    }
    
    try {
      randomGame = await this.runSingleGame(
        novelAnalysis,
        randomEnding,
        'random'
      );
    } catch (error) {
      // Requirement 10.4: Continue with remaining tests on error
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Random ending game failed: ${errorMessage}`);
      errors.push(`Random game failed: ${errorMessage}`);
    }
    
    // Check if we have at least one successful game
    if (!originalGame && !oppositeGame && !randomGame) {
      throw new Error('All games failed. No data to analyze.');
    }
    
    // Create comparison statistics (use defaults for failed games)
    console.log('\n📊 Generating comparative analysis...');
    const comparison = this.createComparison(
      originalGame || this.createDefaultGameResult('original', originalEnding),
      oppositeGame || this.createDefaultGameResult('opposite', oppositeEnding),
      randomGame || this.createDefaultGameResult('random', randomEnding)
    );
    
    // Create final report
    const report: EndingVariationReport = {
      originalEndingGame: originalGame || this.createDefaultGameResult('original', originalEnding),
      oppositeEndingGame: oppositeGame || this.createDefaultGameResult('opposite', oppositeEnding),
      randomEndingGame: randomGame || this.createDefaultGameResult('random', randomEnding),
      comparison,
      generatedAt: new Date(),
      testConfiguration: this.config
    };
    
    console.log('\n✅ Ending variation test complete!');
    console.log(`   🏆 Highest cohesion: ${comparison.highestCohesion} ending`);
    console.log(`   📈 Cohesion scores: Original=${comparison.cohesionScores.original}, Opposite=${comparison.cohesionScores.opposite}, Random=${comparison.cohesionScores.random}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  ${errors.length} error(s) occurred during testing:`);
      errors.forEach(err => console.log(`   - ${err}`));
    }
    
    // Generate and save reports in multiple formats
    console.log('\n📊 Generating comparative reports...');
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
  }
  
  /**
   * Creates a default game result for failed games
   */
  private createDefaultGameResult(
    endingType: 'original' | 'opposite' | 'random',
    ending: StoryEnding
  ): EndingGameResult {
    return {
      endingType,
      endingDescription: ending.description,
      rounds: this.config.rounds,
      cohesionScore: 0,
      segmentsCount: 0,
      wordCount: 0,
      quoteUsageStats: {
        totalActions: 0,
        bookQuotesUsed: 0,
        llmGeneratedUsed: 0,
        actualPercentage: 0
      },
      gameStateFile: 'game-failed.json',
      gameResult: {
        rounds: this.config.rounds,
        endingAchieved: ending.description,
        cohesionRank: 0,
        filename: 'game-failed.json',
        gameState: null as any
      }
    };
  }
  
  /**
   * Runs a single game with a specific ending type
   * Requirement 3.5: Run game with specific ending, collect statistics
   */
  private async runSingleGame(
    novelAnalysis: any,
    ending: StoryEnding,
    endingType: 'original' | 'opposite' | 'random'
  ): Promise<EndingGameResult> {
    console.log(`\n🎮 Running ${endingType} ending game...`);
    
    // Add delay between games to respect rate limits
    await this.sleep(5000);
    
    // Start game with pre-analyzed novel data
    const gameSession = await this.gameManager.startGame(
      this.config.novelFile,
      0, // 0 human players = all computer players
      this.config.rounds,
      true, // Allow zero human players for testing mode
      novelAnalysis // Pass pre-analyzed data to skip analysis
    );
    
    // Set the target ending for this game
    gameSession.gameState.targetEnding = ending;
    
    // Set quote percentage configuration
    gameSession.gameState.quotePercentage = this.config.quotePercentage;
    gameSession.gameState.effectiveQuotePercentage = this.config.quotePercentage;
    gameSession.gameState.quoteUsageStats.configuredPercentage = this.config.quotePercentage;
    
    console.log(`   🎯 Target ending set: ${endingType}`);
    console.log(`   📊 Quote percentage: ${this.config.quotePercentage}%`);
    
    // Simulate the complete game
    await this.simulateCompleteGame(gameSession);
    
    // Analyze cohesion
    console.log(`   🔍 Analyzing cohesion for ${endingType} ending game...`);
    const cohesionScore = await this.cohesionRanker.analyzeSimpleCohesion(gameSession.gameState);
    console.log(`   ✅ Cohesion score: ${cohesionScore}/10`);
    
    // Extract quote usage statistics
    const quoteStats = this.extractQuoteUsageStats(gameSession.gameState);
    
    // Calculate word count
    const wordCount = gameSession.gameState.storySegments.reduce(
      (sum, segment) => sum + segment.wordCount,
      0
    );
    
    // Save game state file with ending type in filename
    const gameStateFile = this.saveGameStateFile(gameSession.gameState, endingType);
    
    // Create game result
    const gameResult: EndingGameResult = {
      endingType,
      endingDescription: ending.description,
      rounds: this.config.rounds,
      cohesionScore,
      segmentsCount: gameSession.gameState.storySegments.length,
      wordCount,
      quoteUsageStats: quoteStats,
      gameStateFile,
      gameResult: {
        rounds: this.config.rounds,
        endingAchieved: ending.description,
        cohesionRank: cohesionScore,
        filename: gameStateFile,
        gameState: gameSession.gameState
      }
    };
    
    console.log(`   ✅ ${endingType} ending game complete`);
    console.log(`      Segments: ${gameResult.segmentsCount}, Words: ${gameResult.wordCount}`);
    console.log(`      Quote usage: ${quoteStats.actualPercentage.toFixed(1)}% (${quoteStats.bookQuotesUsed}/${quoteStats.totalActions})`);
    
    return gameResult;
  }
  
  /**
   * Simulates a complete game by processing all player turns
   */
  private async simulateCompleteGame(gameSession: any): Promise<void> {
    const gameState = gameSession.gameState;
    let turnCount = 0;
    
    while (gameState.currentRound <= gameState.totalRounds) {
      // Process each player's turn in order
      for (const player of gameState.players) {
        if (gameState.currentRound > gameState.totalRounds) {
          break;
        }
        
        turnCount++;
        
        // Create a random player action (talk or act)
        const actionType: 'talk' | 'act' = Math.random() < 0.5 ? 'talk' : 'act';
        const playerAction = {
          type: actionType,
          timestamp: new Date(),
          playerId: player.id,
          contentSource: 'llm_generated' as const,
          characterName: player.character?.name
        };
        
        // Process the turn
        await this.gameManager.processPlayerTurn(player.id, playerAction);
        
        // Add small delay between turns to respect rate limits
        if (turnCount % 4 === 0) {
          await this.sleep(2000);
        }
      }
      
      // Advance to next round
      gameState.currentRound++;
    }
    
    console.log(`   ✅ Game simulation complete: ${turnCount} turns processed`);
  }
  
  /**
   * Extracts quote usage statistics from game state
   */
  private extractQuoteUsageStats(gameState: any): QuoteUsageStats {
    const stats = gameState.quoteUsageStats;
    
    // If stats are already populated, use them
    if (stats && stats.totalActions > 0) {
      return stats;
    }
    
    // Otherwise, calculate from story segments
    const totalActions = gameState.storySegments.length;
    const bookQuotesUsed = gameState.storySegments.filter(
      (seg: any) => seg.contentSource === 'book_quote'
    ).length;
    const llmGeneratedUsed = totalActions - bookQuotesUsed;
    const actualPercentage = totalActions > 0 
      ? (bookQuotesUsed / totalActions) * 100 
      : 0;
    
    return {
      totalActions,
      bookQuotesUsed,
      llmGeneratedUsed,
      actualPercentage: parseFloat(actualPercentage.toFixed(2))
    };
  }
  
  /**
   * Saves game state to file with ending type in filename
   * Requirement 3.9: Save separate game state file for each ending variation
   */
  private saveGameStateFile(gameState: any, endingType: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const novelTitle = path.basename(this.config.novelFile, path.extname(this.config.novelFile));
    const filename = `${timestamp}-${novelTitle}-${endingType}-${this.config.rounds}rounds.json`;
    const filepath = path.join(this.config.outputDirectory, filename);
    
    // Create a serializable version of the game state
    const serializable = {
      ...gameState,
      metadata: {
        ...gameState.metadata,
        startTime: gameState.metadata.startTime.toISOString()
      },
      storySegments: gameState.storySegments.map((seg: any) => ({
        ...seg,
        timestamp: seg.timestamp.toISOString(),
        generatedBy: {
          ...seg.generatedBy,
          timestamp: seg.generatedBy.timestamp.toISOString()
        }
      }))
    };
    
    fs.writeFileSync(filepath, JSON.stringify(serializable, null, 2));
    console.log(`   💾 Game state saved: ${filename}`);
    
    return filename;
  }
  
  /**
   * Creates comparison statistics across all three ending types
   * Requirement 3.8: Identify which ending type achieved highest cohesion
   */
  private createComparison(
    originalGame: EndingGameResult,
    oppositeGame: EndingGameResult,
    randomGame: EndingGameResult
  ): EndingComparison {
    // Determine highest cohesion
    let highestCohesion: 'original' | 'opposite' | 'random' = 'original';
    let maxScore = originalGame.cohesionScore;
    
    if (oppositeGame.cohesionScore > maxScore) {
      highestCohesion = 'opposite';
      maxScore = oppositeGame.cohesionScore;
    }
    
    if (randomGame.cohesionScore > maxScore) {
      highestCohesion = 'random';
    }
    
    return {
      highestCohesion,
      cohesionScores: {
        original: originalGame.cohesionScore,
        opposite: oppositeGame.cohesionScore,
        random: randomGame.cohesionScore
      },
      averageWordCount: {
        original: originalGame.wordCount,
        opposite: oppositeGame.wordCount,
        random: randomGame.wordCount
      },
      quoteUsageStats: {
        original: originalGame.quoteUsageStats,
        opposite: oppositeGame.quoteUsageStats,
        random: randomGame.quoteUsageStats
      }
    };
  }

  /**
   * Generates an original ending that matches the book's actual conclusion
   * Requirement 3.2: Extract and use book's actual conclusion
   */
  async generateOriginalEnding(analysis: NovelAnalysis): Promise<StoryEnding> {
    console.log('📖 Generating original ending from book conclusion...');
    
    // Use the book's actual conclusion from the analysis
    const originalConclusion = analysis.conclusion;
    
    // Create a story ending that represents the original book ending
    const ending: StoryEnding = {
      id: 'original-ending',
      type: 'original',
      description: originalConclusion,
      targetScore: 0 // Not used in variation tests
    };
    
    console.log(`✅ Original ending generated (${originalConclusion.length} characters)`);
    console.log(`   Preview: ${originalConclusion.substring(0, 100)}...`);
    
    return ending;
  }

  /**
   * Generates an opposite ending that inverts the book's conclusion outcome
   * Requirement 3.3: Invert the book's conclusion outcome (happy → tragic, success → failure)
   */
  async generateOppositeEnding(analysis: NovelAnalysis): Promise<StoryEnding> {
    console.log('🔄 Generating opposite ending using LLM...');
    
    const originalConclusion = analysis.conclusion;
    
    const prompt = `Given the following novel conclusion, generate an OPPOSITE ending that inverts the outcome.

Guidelines:
- If the original is happy, make it tragic
- If the original is tragic, make it happy
- If characters succeed, make them fail
- If characters fail, make them succeed
- If relationships unite, make them separate
- If relationships separate, make them unite
- Maintain the same characters and setting
- Keep similar length and style
- Ensure semantic opposition (not just negation)

Original Conclusion:
${originalConclusion}

Generate an opposite ending that inverts the outcome. Return ONLY the opposite ending text, no explanations or preamble:`;

    try {
      const oppositeDescription = await this.llmService.generateContent(prompt, '');
      
      const ending: StoryEnding = {
        id: 'opposite-ending',
        type: 'opposite',
        description: oppositeDescription.trim(),
        targetScore: 0 // Not used in variation tests
      };
      
      console.log(`✅ Opposite ending generated (${oppositeDescription.length} characters)`);
      console.log(`   Preview: ${oppositeDescription.substring(0, 100)}...`);
      
      return ending;
    } catch (error) {
      console.error('❌ Failed to generate opposite ending:', error);
      throw new Error(`Opposite ending generation failed: ${error}`);
    }
  }

  /**
   * Generates a random creative ending unrelated to the book's conclusion
   * Requirement 3.4: Create creative alternative unrelated to book's conclusion
   */
  async generateRandomEnding(analysis: NovelAnalysis): Promise<StoryEnding> {
    console.log('🎲 Generating random creative ending using LLM...');
    
    const originalConclusion = analysis.conclusion;
    const characters = analysis.mainCharacters.map(c => c.name).join(', ');
    
    const prompt = `Given the following novel conclusion and characters, generate a COMPLETELY DIFFERENT creative ending that is unrelated to the original.

Guidelines:
- Create a creative alternative ending
- Must be distinct from both the original and its opposite
- Can introduce unexpected plot twists
- Can take the story in a completely new direction
- Maintain the same characters and setting
- Keep similar length and style
- Be creative and surprising, but still coherent

Characters: ${characters}

Original Conclusion (for reference only - do NOT use this):
${originalConclusion}

Generate a creative random ending that is completely different from the original. Return ONLY the random ending text, no explanations or preamble:`;

    try {
      const randomDescription = await this.llmService.generateContent(prompt, '');
      
      const ending: StoryEnding = {
        id: 'random-ending',
        type: 'random',
        description: randomDescription.trim(),
        targetScore: 0 // Not used in variation tests
      };
      
      console.log(`✅ Random ending generated (${randomDescription.length} characters)`);
      console.log(`   Preview: ${randomDescription.substring(0, 100)}...`);
      
      return ending;
    } catch (error) {
      console.error('❌ Failed to generate random ending:', error);
      throw new Error(`Random ending generation failed: ${error}`);
    }
  }

  /**
   * Saves reports in multiple formats
   * Requirement 3.7, 3.8: Generate CSV, JSON, and text reports comparing all three ending types
   */
  private async saveReports(report: EndingVariationReport): Promise<void> {
    const novelName = path.basename(this.config.novelFile, path.extname(this.config.novelFile));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save JSON report
    const jsonPath = path.join(this.config.outputDirectory, `ending-variation-test-${novelName}-${timestamp}.json`);
    await fs.promises.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`   📄 JSON report saved: ${jsonPath}`);
    
    // Save CSV report
    const csvContent = this.generateCSVReport(report);
    const csvPath = path.join(this.config.outputDirectory, `ending-variation-test-${novelName}-${timestamp}.csv`);
    await fs.promises.writeFile(csvPath, csvContent, 'utf8');
    console.log(`   📄 CSV report saved: ${csvPath}`);
    
    // Save text table report
    const tableContent = this.generateTableReport(report);
    const tablePath = path.join(this.config.outputDirectory, `ending-variation-test-${novelName}-${timestamp}.txt`);
    await fs.promises.writeFile(tablePath, tableContent, 'utf8');
    console.log(`   📄 Text report saved: ${tablePath}`);
  }

  /**
   * Generates CSV report comparing all three ending types
   * Requirement 3.7: Include cohesion scores, word counts, quote usage stats
   */
  private generateCSVReport(report: EndingVariationReport): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Ending Type,Ending Description,Rounds,Cohesion Score,Segments Count,Word Count,Total Actions,Book Quotes Used,LLM Generated,Actual Quote %,Game State File');
    
    // Data rows for each ending type
    const games = [
      report.originalEndingGame,
      report.oppositeEndingGame,
      report.randomEndingGame
    ];
    
    for (const game of games) {
      const descriptionEscaped = `"${game.endingDescription.substring(0, 100).replace(/"/g, '""')}..."`;
      lines.push(
        `${game.endingType},${descriptionEscaped},${game.rounds},${game.cohesionScore},${game.segmentsCount},${game.wordCount},${game.quoteUsageStats.totalActions},${game.quoteUsageStats.bookQuotesUsed},${game.quoteUsageStats.llmGeneratedUsed},${game.quoteUsageStats.actualPercentage.toFixed(2)},${game.gameStateFile}`
      );
    }
    
    // Summary section
    lines.push('');
    lines.push('Comparative Analysis');
    lines.push(`Highest Cohesion,${report.comparison.highestCohesion}`);
    lines.push(`Original Cohesion,${report.comparison.cohesionScores.original}`);
    lines.push(`Opposite Cohesion,${report.comparison.cohesionScores.opposite}`);
    lines.push(`Random Cohesion,${report.comparison.cohesionScores.random}`);
    lines.push(`Original Avg Word Count,${report.comparison.averageWordCount.original}`);
    lines.push(`Opposite Avg Word Count,${report.comparison.averageWordCount.opposite}`);
    lines.push(`Random Avg Word Count,${report.comparison.averageWordCount.random}`);
    
    // Configuration
    lines.push('');
    lines.push('Test Configuration');
    lines.push(`Novel File,${report.testConfiguration.novelFile}`);
    lines.push(`Rounds per Game,${report.testConfiguration.rounds}`);
    lines.push(`Quote Percentage,${report.testConfiguration.quotePercentage}%`);
    lines.push(`Generated At,${report.generatedAt.toISOString()}`);
    
    return lines.join('\n');
  }

  /**
   * Generates text table report comparing all three ending types
   * Requirement 3.7, 3.8: Identify which ending type achieved highest cohesion
   */
  private generateTableReport(report: EndingVariationReport): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(100));
    lines.push('ENDING VARIATION TEST REPORT');
    lines.push('='.repeat(100));
    lines.push('');
    lines.push(`Novel: ${path.basename(this.config.novelFile)}`);
    lines.push(`Rounds per Game: ${this.config.rounds}`);
    lines.push(`Quote Percentage: ${this.config.quotePercentage}%`);
    lines.push(`Generated: ${report.generatedAt.toISOString()}`);
    lines.push('');
    
    lines.push('COMPARATIVE ANALYSIS');
    lines.push('-'.repeat(100));
    lines.push(`🏆 Highest Cohesion: ${report.comparison.highestCohesion.toUpperCase()} ending`);
    lines.push('');
    lines.push('Cohesion Scores:');
    lines.push(`  Original: ${report.comparison.cohesionScores.original}/10`);
    lines.push(`  Opposite: ${report.comparison.cohesionScores.opposite}/10`);
    lines.push(`  Random:   ${report.comparison.cohesionScores.random}/10`);
    lines.push('');
    lines.push('Average Word Count:');
    lines.push(`  Original: ${report.comparison.averageWordCount.original} words`);
    lines.push(`  Opposite: ${report.comparison.averageWordCount.opposite} words`);
    lines.push(`  Random:   ${report.comparison.averageWordCount.random} words`);
    lines.push('');
    lines.push('Quote Usage Statistics:');
    lines.push(`  Original: ${report.comparison.quoteUsageStats.original.actualPercentage.toFixed(1)}% (${report.comparison.quoteUsageStats.original.bookQuotesUsed}/${report.comparison.quoteUsageStats.original.totalActions} actions)`);
    lines.push(`  Opposite: ${report.comparison.quoteUsageStats.opposite.actualPercentage.toFixed(1)}% (${report.comparison.quoteUsageStats.opposite.bookQuotesUsed}/${report.comparison.quoteUsageStats.opposite.totalActions} actions)`);
    lines.push(`  Random:   ${report.comparison.quoteUsageStats.random.actualPercentage.toFixed(1)}% (${report.comparison.quoteUsageStats.random.bookQuotesUsed}/${report.comparison.quoteUsageStats.random.totalActions} actions)`);
    lines.push('');
    
    lines.push('GAME DETAILS');
    lines.push('-'.repeat(100));
    
    const games = [
      { label: 'ORIGINAL ENDING', game: report.originalEndingGame },
      { label: 'OPPOSITE ENDING', game: report.oppositeEndingGame },
      { label: 'RANDOM ENDING', game: report.randomEndingGame }
    ];
    
    for (const { label, game } of games) {
      lines.push('');
      lines.push(`${label}:`);
      lines.push(`  Cohesion Score:    ${game.cohesionScore}/10`);
      lines.push(`  Rounds:            ${game.rounds}`);
      lines.push(`  Segments:          ${game.segmentsCount}`);
      lines.push(`  Word Count:        ${game.wordCount}`);
      lines.push(`  Quote Usage:       ${game.quoteUsageStats.actualPercentage.toFixed(1)}% (${game.quoteUsageStats.bookQuotesUsed} book quotes, ${game.quoteUsageStats.llmGeneratedUsed} LLM generated)`);
      lines.push(`  Game State File:   ${game.gameStateFile}`);
      lines.push(`  Ending Description:`);
      
      // Wrap ending description to 90 characters
      const description = game.endingDescription;
      const maxWidth = 90;
      let currentLine = '';
      const words = description.split(' ');
      
      for (const word of words) {
        if ((currentLine + ' ' + word).length > maxWidth) {
          lines.push(`    ${currentLine}`);
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      }
      if (currentLine) {
        lines.push(`    ${currentLine}`);
      }
    }
    
    lines.push('');
    lines.push('='.repeat(100));
    lines.push('');
    lines.push('INTERPRETATION GUIDE:');
    lines.push('- Cohesion Score: Measures how well the generated story aligns with the source novel (1-10)');
    lines.push('- Higher cohesion = Better alignment with novel\'s style, characters, and themes');
    lines.push('- Quote Usage: Percentage of actions using actual book quotes vs LLM-generated content');
    lines.push('- Original ending should typically have highest cohesion (follows book\'s actual conclusion)');
    lines.push('- Opposite/Random endings may have lower cohesion due to diverging from source material');
    lines.push('');
    lines.push('='.repeat(100));
    
    return lines.join('\n');
  }
}
