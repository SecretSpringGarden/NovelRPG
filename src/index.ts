import { ConfigManager } from './config';
import { GameManager } from './core';
import { GameUI } from './ui';
import { TestFramework } from './testing/TestFramework';

/**
 * Application exit codes for different error scenarios
 */
enum ExitCode {
  SUCCESS = 0,
  CONFIGURATION_ERROR = 1,
  INPUT_VALIDATION_ERROR = 2,
  NOVEL_ANALYSIS_ERROR = 3,
  GAME_RUNTIME_ERROR = 4,
  UNEXPECTED_ERROR = 5,
  USER_INTERRUPTION = 6
}

/**
 * Application state for graceful shutdown handling
 */
interface AppState {
  gameUI?: GameUI;
  gameManager?: GameManager;
  isShuttingDown: boolean;
  cleanupHandlers: (() => Promise<void> | void)[];
}

const appState: AppState = {
  isShuttingDown: false,
  cleanupHandlers: []
};

/**
 * Set up graceful shutdown handlers for SIGINT and SIGTERM
 */
function setupGracefulShutdown(): void {
  const handleShutdown = async (signal: string) => {
    if (appState.isShuttingDown) {
      console.log('\n🔄 Shutdown already in progress...');
      return;
    }
    
    console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
    appState.isShuttingDown = true;
    
    try {
      // Run cleanup handlers in reverse order
      for (let i = appState.cleanupHandlers.length - 1; i >= 0; i--) {
        await appState.cleanupHandlers[i]();
      }
      
      console.log('✅ Cleanup completed successfully');
      process.exit(ExitCode.USER_INTERRUPTION);
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      process.exit(ExitCode.UNEXPECTED_ERROR);
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulExit(ExitCode.UNEXPECTED_ERROR);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulExit(ExitCode.UNEXPECTED_ERROR);
  });
}

/**
 * Perform graceful application exit with cleanup
 */
async function gracefulExit(exitCode: ExitCode): Promise<void> {
  if (appState.isShuttingDown) {
    return;
  }
  
  appState.isShuttingDown = true;
  
  try {
    // Run cleanup handlers
    for (let i = appState.cleanupHandlers.length - 1; i >= 0; i--) {
      await appState.cleanupHandlers[i]();
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
  
  // Display exit message based on code
  switch (exitCode) {
    case ExitCode.SUCCESS:
      console.log('\n✅ Application completed successfully');
      break;
    case ExitCode.CONFIGURATION_ERROR:
      console.log('\n❌ Application terminated due to configuration error');
      break;
    case ExitCode.INPUT_VALIDATION_ERROR:
      console.log('\n❌ Application terminated due to invalid input');
      break;
    case ExitCode.NOVEL_ANALYSIS_ERROR:
      console.log('\n❌ Application terminated due to novel analysis failure');
      break;
    case ExitCode.GAME_RUNTIME_ERROR:
      console.log('\n❌ Application terminated due to game runtime error');
      break;
    case ExitCode.USER_INTERRUPTION:
      console.log('\n🛑 Application interrupted by user');
      break;
    case ExitCode.UNEXPECTED_ERROR:
      console.log('\n💥 Application terminated due to unexpected error');
      break;
  }
  
  process.exit(exitCode);
}

/**
 * Run the application in testing mode
 */
async function runTestingMode(gameManager: GameManager, gameUI: GameUI): Promise<void> {
  console.log('\n🧪 Running in automated testing mode...');
  
  try {
    // Use the full path to Pride and Prejudice for testing
    const novelFile = "C:\\Users\\conce\\OneDrive\\Desktop\\DandD\\TestNovels\\t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt";
    console.log(`📖 Using novel file: ${novelFile}`);
    
    // Validate the novel file with testing parameters
    const inputValidation = gameManager.validateInput(
      novelFile, 
      0, // Testing mode uses 0 human players (all computer players)
      15, // Default rounds for validation, actual rounds will be [10,12,14,16,18,20]
      true // Allow zero human players for testing mode
    );
    
    if (!inputValidation.isValid) {
      console.error('❌ Input validation failed:');
      inputValidation.errors.forEach(error => console.error(`   • ${error}`));
      throw new Error('Invalid input parameters for testing mode');
    }
    
    console.log('✅ Input validated, starting automated cohesion analysis...');
    
    // Initialize and run TestFramework
    const testFramework = new TestFramework();
    const testReport = await testFramework.runAutomatedTests(novelFile);
    
    // Display results summary
    console.log('\n🎉 Automated testing completed successfully!');
    console.log(`📊 Total games analyzed: ${testReport.statistics.totalGames}`);
    console.log(`📈 Average cohesion score: ${testReport.statistics.averageCohesion}/10`);
    console.log(`🏆 Highest cohesion score: ${testReport.statistics.highestCohesion}/10`);
    console.log(`📉 Lowest cohesion score: ${testReport.statistics.lowestCohesion}/10`);
    
    if (testReport.sortedByCohesion.length > 0) {
      console.log('\n🏅 Top 3 most cohesive games:');
      testReport.sortedByCohesion.slice(0, 3).forEach((game, index) => {
        console.log(`   ${index + 1}. ${game.rounds} rounds - Score: ${game.cohesionRank}/10`);
        console.log(`      Ending: ${game.endingAchieved.substring(0, 80)}...`);
      });
    }
    
    console.log('\n📁 Detailed reports have been saved to the test_outputs directory');
    
  } catch (error) {
    console.error('❌ Testing mode failed:', error);
    throw error;
  }
}
/**
 * Main entry point for the Novel RPG Game application
 * Handles complete application lifecycle with comprehensive error handling
 */
async function main() {
  let gameUI: GameUI | undefined;
  let gameManager: GameManager | undefined;
  
  try {
    // Set up graceful shutdown handlers
    setupGracefulShutdown();
    
    // Initialize UI first for user feedback
    gameUI = new GameUI();
    appState.gameUI = gameUI;
    appState.cleanupHandlers.push(() => gameUI?.cleanup());
    
    // Initialize and validate configuration
    console.log('🔧 Initializing application...');
    const configManager = ConfigManager.getInstance();
    
    const validation = configManager.validateConfiguration();
    if (!validation.isValid) {
      console.error('\n❌ Configuration validation failed:');
      validation.errors.forEach(error => console.error(`   • ${error}`));
      console.error('\n💡 Please check your config.json and .env files');
      await gracefulExit(ExitCode.CONFIGURATION_ERROR);
      return;
    }
    
    console.log('✅ Configuration validated successfully');
    
    // Initialize GameManager with error handling
    try {
      gameManager = new GameManager();
      await gameManager.initializeLLMService();
      appState.gameManager = gameManager;
      console.log('✅ Game manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize game manager:', error);
      await gracefulExit(ExitCode.CONFIGURATION_ERROR);
      return;
    }
    
    // Check for testing mode
    const args = process.argv.slice(2);
    if (args.includes('--test') || args.includes('-t')) {
      await runTestingMode(gameManager, gameUI);
      await gracefulExit(ExitCode.SUCCESS);
      return;
    }
    
    // Get game setup parameters from user with validation
    let setupParams;
    try {
      setupParams = await gameUI.setupGame();
    } catch (error) {
      console.error('❌ Failed to collect game setup parameters:', error);
      await gracefulExit(ExitCode.INPUT_VALIDATION_ERROR);
      return;
    }
    
    // Validate input parameters
    const inputValidation = gameManager.validateInput(
      setupParams.novelFile, 
      setupParams.humanPlayers, 
      setupParams.rounds
    );
    
    if (!inputValidation.isValid) {
      gameUI.displayValidationErrors(inputValidation);
      console.log('\n💡 Please check your input parameters and try again');
      await gracefulExit(ExitCode.INPUT_VALIDATION_ERROR);
      return;
    }
    
    console.log('✅ Input parameters validated');
    
    // Start the game with comprehensive error handling
    let gameSession;
    try {
      gameUI.displayAnalysisProgress();
      gameSession = await gameManager.startGame(
        setupParams.novelFile,
        setupParams.humanPlayers,
        setupParams.rounds
      );
      
      console.log('✅ Game session started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('analysis') || errorMessage.includes('Novel analysis')) {
        console.error('\n❌ Novel analysis failed');
        console.error('💡 This could be due to:');
        console.error('   • Novel file format issues');
        console.error('   • LLM service connectivity problems');
        console.error('   • Novel content not suitable for analysis');
        gameUI.displayEarlyTermination(errorMessage);
        await gracefulExit(ExitCode.NOVEL_ANALYSIS_ERROR);
        return;
      } else if (errorMessage.includes('ending generation')) {
        console.error('\n❌ Story ending generation failed');
        console.error('💡 This could be due to LLM service issues');
        gameUI.displayEarlyTermination(errorMessage);
        await gracefulExit(ExitCode.NOVEL_ANALYSIS_ERROR);
        return;
      } else {
        console.error('\n❌ Failed to start game:', errorMessage);
        await gracefulExit(ExitCode.GAME_RUNTIME_ERROR);
        return;
      }
    }
    
    // Display game initialization and results
    gameUI.displayGameInitialization(gameSession.gameState.metadata);
    gameUI.displayAnalysisResults(gameSession.gameState);
    
    // Handle character selection for human players
    try {
      await handleCharacterSelection(gameUI, gameSession.gameState);
      gameUI.displayCharacterAssignments(gameSession.gameState.players);
      console.log('✅ Character selection completed');
    } catch (error) {
      console.error('❌ Character selection failed:', error);
      await gracefulExit(ExitCode.GAME_RUNTIME_ERROR);
      return;
    }
    
    // Display ending generation progress
    gameUI.displayEndingGeneration();
    console.log('✅ Story endings generated');
    
    // Run the main game loop with comprehensive error handling
    try {
      await runGameWithUI(gameManager, gameUI);
      console.log('✅ Game completed successfully');
      await gracefulExit(ExitCode.SUCCESS);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('\n❌ Game runtime error:', errorMessage);
      
      // Check if it's a user interruption
      if (errorMessage.includes('interrupted') || errorMessage.includes('SIGINT')) {
        console.log('🛑 Game interrupted by user');
        await gracefulExit(ExitCode.USER_INTERRUPTION);
      } else {
        gameUI.displayEarlyTermination(errorMessage);
        await gracefulExit(ExitCode.GAME_RUNTIME_ERROR);
      }
    }
    
  } catch (error) {
    // Handle any unexpected errors
    console.error('\n💥 Unexpected application error:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    
    if (gameUI) {
      gameUI.displayEarlyTermination('Unexpected application error occurred');
    }
    
    await gracefulExit(ExitCode.UNEXPECTED_ERROR);
  }
}

/**
 * Handle character selection process with UI integration
 */
async function handleCharacterSelection(gameUI: GameUI, gameState: any) {
  const availableCharacters = [...gameState.novelAnalysis.mainCharacters];
  
  for (const player of gameState.players) {
    if (player.type === 'human' && availableCharacters.length > 0) {
      const selectedCharacter = await gameUI.selectCharacter(player, availableCharacters);
      player.character = selectedCharacter;
      
      // Remove selected character from available list
      const index = availableCharacters.findIndex(c => c.id === selectedCharacter.id);
      if (index !== -1) {
        availableCharacters.splice(index, 1);
      }
    } else if (player.type === 'computer' && availableCharacters.length > 0) {
      // Computer players get random assignment
      const randomIndex = Math.floor(Math.random() * availableCharacters.length);
      player.character = availableCharacters[randomIndex];
      availableCharacters.splice(randomIndex, 1);
    }
  }
}

/**
 * Run the main game loop with UI integration
 */
async function runGameWithUI(gameManager: GameManager, gameUI: GameUI) {
  const session = gameManager.getCurrentSession();
  if (!session) {
    throw new Error('No active game session');
  }
  
  const gameState = session.gameState;
  
  try {
    while (session.isActive && gameState.currentRound <= gameState.totalRounds) {
      // Display current game progress
      gameUI.displayGameProgress(gameState);
      
      // Process each player's turn
      // NOTE: This code uses the old dice-roll system and is deprecated.
      // For new implementations, use GameManager.processPlayerTurnWithChoice()
      // which uses the ActionChoiceManager for player action selection.
      for (const player of gameState.players) {
        if (!session.isActive || gameState.currentRound > gameState.totalRounds) {
          break;
        }
        
        // Create player action using random selection (replaces dice roll)
        const playerAction = createPlayerAction(player.id);
        
        // Display the action
        gameUI.displayPlayerAction(player, playerAction);
        
        // Process the action and generate story content
        const storySegment = await gameManager.processPlayerTurn(player.id, playerAction);
        
        // Display generated story content
        gameUI.displayStoryContent(storySegment);
        
        // Small delay for better user experience
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Advance to next round
      gameState.currentRound++;
    }
    
    // Game completed
    gameUI.displayGameComplete(gameState);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    gameUI.displayEarlyTermination(`Game loop error: ${errorMessage}`);
    throw error;
  }
}

/**
 * Create player action based on random selection
 * NOTE: This replaces the old dice-roll system
 */
function createPlayerAction(playerId: string): any {
  // Randomly select from three options: talk, act, or nothing
  const randomChoice = Math.floor(Math.random() * 3);
  
  let actionType: 'talk' | 'act' | 'nothing';
  
  switch (randomChoice) {
    case 0:
      actionType = 'talk';
      break;
    case 1:
      actionType = 'act';
      break;
    case 2:
    default:
      actionType = 'nothing';
      break;
  }
  
  return {
    type: actionType,
    timestamp: new Date(),
    playerId,
    contentSource: 'llm_generated' // Default to LLM generated
  };
}

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main };