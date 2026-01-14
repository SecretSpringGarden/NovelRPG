import { GameManager } from '../core/GameManager';
import { CohesionRanker, GameResult } from './CohesionRanker';
import { LLMService } from '../services/LLMService';
import { ConfigManager } from '../config/ConfigManager';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test configuration interface matching Requirements 7.1 and 7.2
 */
export interface TestConfiguration {
  roundCounts: number[]; // [10, 12, 14, 16, 18, 20] per requirement 7.2
  iterations: number;
  outputDirectory: string;
}

/**
 * Complete test report interface
 */
export interface TestReport {
  games: GameResult[];
  sortedByCohesion: GameResult[];
  testConfiguration: TestConfiguration;
  generatedAt: Date;
  statistics: {
    totalGames: number;
    averageCohesion: number;
    highestCohesion: number;
    lowestCohesion: number;
  };
}

/**
 * TestFramework class for automated cohesion analysis
 * Implements Requirements 7.1-7.6 for automated testing and cohesion ranking
 */
export class TestFramework {
  private gameManager: GameManager;
  private cohesionRanker: CohesionRanker;
  private llmService: LLMService;
  private testConfiguration: TestConfiguration;

  constructor() {
    console.log('🧪 TestFramework initialized');
    
    // Initialize configuration
    const config = ConfigManager.getInstance().getConfig();
    this.testConfiguration = {
      roundCounts: [10, 12, 14, 16, 18, 20], // Requirement 7.2: increment by 2 from 10 to 20
      iterations: config.testing.testIterations,
      outputDirectory: config.testing.outputDirectory
    };

    // Initialize GameManager (it will create its own properly initialized LLM service)
    this.gameManager = new GameManager();
    
    // Create separate LLM service for cohesion ranking
    this.llmService = new (require('../services/LLMService').OpenAILLMService)();
    this.cohesionRanker = new CohesionRanker(this.llmService);

    // Ensure output directory exists
    this.ensureOutputDirectory();
  }

  /**
   * Runs automated tests for a novel file
   * Implements Requirements 7.1: Generate games with all computer players
   * Implements Requirements 7.2: Create games for round counts from 10 to 20, incrementing by 2
   */
  async runAutomatedTests(novelFile: string): Promise<TestReport> {
    console.log(`🚀 Running automated cohesion tests for: ${path.basename(novelFile)}`);
    console.log(`📊 Test configuration: ${this.testConfiguration.roundCounts.join(', ')} rounds`);
    console.log('⏱️  Adding delays between operations to respect API rate limits...');
    
    // Initialize LLM service for GameManager
    await this.gameManager.initializeLLMService();
    console.log('✅ LLM service initialized for testing');
    
    const gameResults: GameResult[] = [];
    let completedGames = 0;
    const totalGames = this.testConfiguration.roundCounts.length;

    try {
      // Run games for each round count configuration
      for (const roundCount of this.testConfiguration.roundCounts) {
        console.log(`\n🎮 Running game with ${roundCount} rounds...`);
        
        // Add delay between games to respect rate limits
        if (completedGames > 0) {
          console.log('⏳ Waiting 1 minute between games to respect API rate limits...');
          await this.sleep(60000); // 1 minute delay between games
        }
        
        // Validate input first
        const validation = this.gameManager.validateInput(novelFile, 0, roundCount, true); // Allow zero humans for testing
        if (!validation.isValid) {
          const errorMsg = `Input validation failed for ${roundCount} rounds: ${validation.errors.join(', ')}`;
          console.error(`❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }

        // Start game with all computer players (Requirement 7.1)
        console.log('📖 Starting novel analysis and game setup...');
        const gameSession = await this.gameManager.startGame(
          novelFile,
          0, // 0 human players = all computer players
          roundCount,
          true // Allow zero human players for testing mode
        );

        // Add delay after game setup to respect rate limits
        console.log('⏳ Waiting 10 seconds after game setup to respect API rate limits...');
        await this.sleep(10000);

        console.log('🎲 Running game simulation...');
        // Run the complete game simulation with rate limiting
        await this.simulateCompleteGameWithRateLimit(gameSession);

        // Create game result
        const gameResult: GameResult = {
          rounds: roundCount,
          endingAchieved: this.extractEndingDescription(gameSession.gameState),
          cohesionRank: 0, // Will be filled by cohesion analysis
          filename: this.generateGameFilename(novelFile, roundCount),
          gameState: gameSession.gameState
        };

        // Save game state to file
        await this.saveGameResult(gameResult);
        gameResults.push(gameResult);
        
        completedGames++;
        console.log(`✅ Game completed (${completedGames}/${totalGames})`);
      }

      console.log(`\n🔍 Analyzing cohesion for ${gameResults.length} completed games...`);
      
      // Analyze cohesion for all games (Requirement 7.4)
      const rankedResults = await this.cohesionRanker.rankGamesByCohesion(gameResults);
      
      // Generate final report (Requirements 7.5, 7.6)
      const report: TestReport = {
        games: rankedResults,
        sortedByCohesion: rankedResults, // Already sorted by rankGamesByCohesion
        testConfiguration: this.testConfiguration,
        generatedAt: new Date(),
        statistics: this.calculateStatistics(rankedResults)
      };

      // Save report to files
      await this.saveTestReport(report, novelFile);
      
      console.log(`\n📋 Cohesion analysis complete!`);
      console.log(`📊 Average cohesion: ${report.statistics.averageCohesion.toFixed(2)}/10`);
      console.log(`🏆 Best game: ${report.statistics.highestCohesion}/10 (${report.sortedByCohesion[0]?.rounds} rounds)`);
      console.log(`📁 Results saved to: ${this.testConfiguration.outputDirectory}`);

      return report;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Automated testing failed:', errorMessage);
      throw error;
    }
  }

  /**
   * Simulates a complete game by processing all player turns with rate limiting
   */
  private async simulateCompleteGameWithRateLimit(gameSession: any): Promise<void> {
    const gameState = gameSession.gameState;
    let turnCount = 0;
    
    while (gameSession.isActive && gameState.currentRound <= gameState.totalRounds) {
      // Process each player's turn
      for (const player of gameState.players) {
        if (!gameSession.isActive || gameState.currentRound > gameState.totalRounds) {
          break;
        }

        turnCount++;
        
        // Add delay every few turns to respect rate limits
        if (turnCount > 1 && turnCount % 3 === 0) {
          console.log(`⏳ Pausing after ${turnCount} turns to respect API rate limits...`);
          await this.sleep(5000); // 5 second delay every 3 turns
        }

        // Generate dice roll for computer player
        const diceRoll = Math.floor(Math.random() * 10) + 1;
        
        // Create player action based on dice roll
        const playerAction = this.createPlayerAction(player.id, diceRoll);
        
        // Process the action through game manager (this may call LLM)
        try {
          await this.gameManager.processPlayerTurn(player.id, playerAction);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
            console.log('⏳ Hit rate limit, waiting 1 minute before retrying...');
            await this.sleep(60000); // Wait 1 minute for rate limit reset
            // Retry the turn
            await this.gameManager.processPlayerTurn(player.id, playerAction);
          } else {
            throw error; // Re-throw non-rate-limit errors
          }
        }
      }
      
      // Advance to next round
      gameState.currentRound++;
    }
  }

  /**
   * Sleep utility for adding delays
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Creates player action based on dice roll according to game rules
   */
  private createPlayerAction(playerId: string, diceRoll: number): any {
    let actionType: 'talk' | 'act' | 'nothing';
    
    if (diceRoll % 2 === 0) {
      // Even numbers (2,4,6,8,10) -> talk
      actionType = 'talk';
    } else if (diceRoll === 1 || diceRoll === 3 || diceRoll === 5) {
      // 1, 3, 5 -> act
      actionType = 'act';
    } else {
      // 7, 9 -> do nothing
      actionType = 'nothing';
    }
    
    return {
      type: actionType,
      diceRoll,
      timestamp: new Date(),
      playerId
    };
  }

  /**
   * Extracts ending description from game state
   */
  private extractEndingDescription(gameState: any): string {
    if (gameState.targetEnding) {
      return `${gameState.targetEnding.type}: ${gameState.targetEnding.description}`;
    }
    
    // Fallback: use the last story segment
    if (gameState.storySegments && gameState.storySegments.length > 0) {
      const lastSegment = gameState.storySegments[gameState.storySegments.length - 1];
      return lastSegment.content.substring(0, 100) + '...';
    }
    
    return 'Unknown ending';
  }

  /**
   * Generates filename for game result
   */
  private generateGameFilename(novelFile: string, rounds: number): string {
    const novelName = path.basename(novelFile, path.extname(novelFile));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `game-${novelName}-${rounds}rounds-${timestamp}.txt`;
  }

  /**
   * Saves game result to file
   */
  private async saveGameResult(gameResult: GameResult): Promise<void> {
    const filePath = path.join(this.testConfiguration.outputDirectory, gameResult.filename);
    
    const content = [
      `=== GAME RESULT ===`,
      `Rounds: ${gameResult.rounds}`,
      `Ending: ${gameResult.endingAchieved}`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `=== GAME STATE ===`,
      JSON.stringify(gameResult.gameState, null, 2)
    ].join('\n');
    
    await fs.promises.writeFile(filePath, content, 'utf8');
  }

  /**
   * Saves test report in multiple formats
   */
  private async saveTestReport(report: TestReport, novelFile: string): Promise<void> {
    const novelName = path.basename(novelFile, path.extname(novelFile));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save JSON report
    const jsonPath = path.join(this.testConfiguration.outputDirectory, `cohesion-report-${novelName}-${timestamp}.json`);
    await fs.promises.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    
    // Save CSV report (Requirements 7.5, 7.6)
    const csvReport = this.cohesionRanker.generateCohesionReport(report.sortedByCohesion, {
      format: 'csv',
      includeHeaders: true,
      sortOrder: 'desc'
    });
    const csvPath = path.join(this.testConfiguration.outputDirectory, `cohesion-report-${novelName}-${timestamp}.csv`);
    await fs.promises.writeFile(csvPath, csvReport.content, 'utf8');
    
    // Save table report
    const tableReport = this.cohesionRanker.generateCohesionReport(report.sortedByCohesion, {
      format: 'table',
      includeHeaders: true,
      sortOrder: 'desc'
    });
    const tablePath = path.join(this.testConfiguration.outputDirectory, `cohesion-report-${novelName}-${timestamp}.txt`);
    await fs.promises.writeFile(tablePath, tableReport.content, 'utf8');
    
    console.log(`📄 Reports saved:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   CSV:  ${csvPath}`);
    console.log(`   TXT:  ${tablePath}`);
  }

  /**
   * Calculates statistics for the test report
   */
  private calculateStatistics(gameResults: GameResult[]): any {
    if (gameResults.length === 0) {
      return { totalGames: 0, averageCohesion: 0, highestCohesion: 0, lowestCohesion: 0 };
    }
    
    const cohesionRanks = gameResults.map(g => g.cohesionRank);
    const avgCohesion = cohesionRanks.reduce((sum, rank) => sum + rank, 0) / cohesionRanks.length;
    const maxCohesion = Math.max(...cohesionRanks);
    const minCohesion = Math.min(...cohesionRanks);
    
    return {
      totalGames: gameResults.length,
      averageCohesion: parseFloat(avgCohesion.toFixed(2)),
      highestCohesion: maxCohesion,
      lowestCohesion: minCohesion
    };
  }

  /**
   * Ensures output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.testConfiguration.outputDirectory)) {
      fs.mkdirSync(this.testConfiguration.outputDirectory, { recursive: true });
      console.log(`📁 Created output directory: ${this.testConfiguration.outputDirectory}`);
    }
  }

  /**
   * Gets the test configuration
   */
  getTestConfiguration(): TestConfiguration {
    return { ...this.testConfiguration };
  }
}