import { GameManager } from '../core/GameManager';
import { CohesionRanker, GameResult } from './CohesionRanker';
import { LLMService } from '../services/LLMService';
import { ConfigManager } from '../config/ConfigManager';
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
    const validated = { ...config };
    
    // Validate round count (1-20)
    if (!validated.rounds || validated.rounds < 1 || validated.rounds > 20) {
      console.warn(`⚠️  Invalid round count ${validated.rounds}, clamping to range 1-20`);
      validated.rounds = Math.max(1, Math.min(20, validated.rounds || 5));
    }
    
    // Validate quote percentage (0-100)
    if (validated.quotePercentage === undefined || validated.quotePercentage < 0 || validated.quotePercentage > 100) {
      console.warn(`⚠️  Invalid quote percentage ${validated.quotePercentage}, clamping to range 0-100`);
      validated.quotePercentage = Math.max(0, Math.min(100, validated.quotePercentage || 0));
    }
    
    // Use default output directory if not specified
    if (!validated.outputDirectory) {
      validated.outputDirectory = 'test_outputs';
      console.log(`ℹ️  Using default output directory: ${validated.outputDirectory}`);
    }
    
    // Validate novel file exists
    if (!fs.existsSync(validated.novelFile)) {
      throw new Error(`Novel file not found: ${validated.novelFile}`);
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
   */
  async runEndingVariationTest(): Promise<EndingVariationReport> {
    console.log('🚀 Starting ending variation test...');
    console.log(`📖 Novel: ${path.basename(this.config.novelFile)}`);
    console.log(`🎲 Rounds per game: ${this.config.rounds}`);
    console.log(`📊 Quote percentage: ${this.config.quotePercentage}%`);
    
    // Initialize LLM service for GameManager
    await this.gameManager.initializeLLMService();
    console.log('✅ LLM service initialized');
    
    // OPTIMIZATION: Analyze novel ONCE before all games
    console.log('\n📖 Analyzing novel (this will be reused for all three games)...');
    const { createNovelAnalyzer } = require('../services');
    const novelAnalyzer = createNovelAnalyzer();
    const novelText = fs.readFileSync(this.config.novelFile, 'utf-8');
    const novelAnalysis = await novelAnalyzer.analyzeNovel(novelText);
    console.log('✅ Novel analysis complete - will be reused for all games');
    console.log(`   📊 Found ${novelAnalysis.mainCharacters.length} characters, ${novelAnalysis.plotPoints.length} plot points`);
    
    // Generate three different endings
    console.log('\n🎯 Generating three different endings...');
    const originalEnding = await this.generateOriginalEnding(novelAnalysis);
    await this.sleep(2000); // Rate limiting
    
    const oppositeEnding = await this.generateOppositeEnding(novelAnalysis);
    await this.sleep(2000); // Rate limiting
    
    const randomEnding = await this.generateRandomEnding(novelAnalysis);
    await this.sleep(2000); // Rate limiting
    
    console.log('✅ All three endings generated');
    
    // Run three games, one for each ending type
    console.log('\n🎮 Running three games with different endings...');
    
    const originalGame = await this.runSingleGame(
      novelAnalysis,
      originalEnding,
      'original'
    );
    
    const oppositeGame = await this.runSingleGame(
      novelAnalysis,
      oppositeEnding,
      'opposite'
    );
    
    const randomGame = await this.runSingleGame(
      novelAnalysis,
      randomEnding,
      'random'
    );
    
    // Create comparison statistics
    console.log('\n📊 Generating comparative analysis...');
    const comparison = this.createComparison(originalGame, oppositeGame, randomGame);
    
    // Create final report
    const report: EndingVariationReport = {
      originalEndingGame: originalGame,
      oppositeEndingGame: oppositeGame,
      randomEndingGame: randomGame,
      comparison,
      generatedAt: new Date(),
      testConfiguration: this.config
    };
    
    console.log('\n✅ Ending variation test complete!');
    console.log(`   🏆 Highest cohesion: ${comparison.highestCohesion} ending`);
    console.log(`   📈 Cohesion scores: Original=${comparison.cohesionScores.original}, Opposite=${comparison.cohesionScores.opposite}, Random=${comparison.cohesionScores.random}`);
    
    return report;
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
          diceRoll: Math.floor(Math.random() * 6) + 1,
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
}
