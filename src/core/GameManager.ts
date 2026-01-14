import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../config/ConfigManager';
import { GameFlowManager } from './GameFlowManager';
import { 
  NovelAnalyzer, 
  StoryGenerator, 
  PlayerSystem, 
  GameStateManager,
  LLMService,
  createNovelAnalyzer,
  createStoryGenerator,
  createGameStateManager,
  createLLMService
} from '../services';
import { 
  GameState, 
  GameMetadata, 
  NovelAnalysis, 
  StorySegment,
  GameEvent,
  validateNovelAnalysis,
  validateGameState
} from '../models/GameState';
import { Player, PlayerAction } from '../models/Player';
import { StoryEnding } from '../models/StoryEnding';
import { GameContext } from '../services/StoryGenerator';

/**
 * Validation result interface for input validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Game session interface representing an active game
 */
export interface GameSession {
  gameState: GameState;
  isActive: boolean;
  phase: GamePhase;
}

/**
 * Game phase enumeration
 */
export enum GamePhase {
  INITIALIZATION = 'initialization',
  NOVEL_ANALYSIS = 'novel_analysis',
  CHARACTER_SELECTION = 'character_selection',
  ENDING_GENERATION = 'ending_generation',
  GAMEPLAY = 'gameplay',
  COMPLETED = 'completed',
  TERMINATED = 'terminated'
}

/**
 * GameManager class coordinates all game components and manages the complete game flow
 * from initialization through completion or early termination
 */
export class GameManager {
  private configManager: ConfigManager;
  private gameFlowManager: GameFlowManager;
  private llmService: LLMService;
  private novelAnalyzer: NovelAnalyzer;
  private storyGenerator: StoryGenerator;
  private playerSystem: PlayerSystem;
  private gameStateManager: GameStateManager;
  
  private currentSession: GameSession | null = null;
  private currentPhase: GamePhase = GamePhase.INITIALIZATION;

  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.gameFlowManager = new GameFlowManager();
    
    // Initialize LLM service first
    const llmConfig = this.configManager.getLLMConfig();
    this.llmService = createLLMService(llmConfig);
    
    // Initialize services using factory functions
    this.novelAnalyzer = createNovelAnalyzer();
    this.storyGenerator = createStoryGenerator(this.llmService);
    this.playerSystem = new PlayerSystem();
    this.gameStateManager = createGameStateManager();
  }

  /**
   * Initializes the LLM service - must be called before starting games
   */
  async initializeLLMService(): Promise<void> {
    const llmConfig = this.configManager.getLLMConfig();
    await this.llmService.initialize(llmConfig);
  }

  /**
   * Starts a new game session with the provided parameters
   * Validates input, analyzes novel, and initializes game state
   */
  async startGame(novelFile: string, humanPlayers: number, rounds: number, allowZeroHumans: boolean = false): Promise<GameSession> {
    try {
      // Phase 1: Input validation
      this.currentPhase = GamePhase.INITIALIZATION;
      const validation = this.validateInput(novelFile, humanPlayers, rounds, allowZeroHumans);
      if (!validation.isValid) {
        throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
      }

      // Phase 2: Novel analysis
      this.currentPhase = GamePhase.NOVEL_ANALYSIS;
      const novelText = fs.readFileSync(novelFile, 'utf-8');
      const novelAnalysis = await this.novelAnalyzer.analyzeNovel(novelText);
      
      // Validate analysis completeness
      if (!this.validateNovelAnalysis(novelAnalysis)) {
        this.terminateGameEarly('Novel analysis failed to produce required elements');
        throw new Error('Novel analysis incomplete - game terminated');
      }

      // Phase 3: Character selection setup
      this.currentPhase = GamePhase.CHARACTER_SELECTION;
      const players = this.playerSystem.initializePlayers(humanPlayers);
      const orderedPlayers = this.playerSystem.rollForTurnOrder(players);
      this.playerSystem.assignCharacters(orderedPlayers, novelAnalysis.mainCharacters);

      // Phase 4: Story ending generation
      this.currentPhase = GamePhase.ENDING_GENERATION;
      const storyEndings = await this.storyGenerator.generateEndings(novelAnalysis);
      
      // Validate ending generation
      if (!this.storyGenerator.validateEndingGeneration(storyEndings)) {
        this.terminateGameEarly('Story ending generation failed to produce required 8 endings');
        throw new Error('Ending generation incomplete - game terminated');
      }

      // Create game metadata and state
      const novelTitle = this.extractNovelTitle(novelFile);
      const metadata: GameMetadata = {
        startTime: new Date(),
        humanPlayerCount: humanPlayers,
        totalRounds: rounds,
        novelTitle,
        filename: '' // Will be set by createGameStateFile
      };

      const gameState: GameState = {
        metadata,
        novelAnalysis,
        players: orderedPlayers,
        currentRound: 1,
        totalRounds: rounds,
        storySegments: [],
        targetEnding: undefined
      };

      // Create game state file (this will set the filename in metadata)
      const filename = this.gameStateManager.createGameStateFile(metadata);
      
      // Log game start event
      const startEvent: GameEvent = {
        type: 'game_start',
        timestamp: new Date(),
        data: { metadata, playersCount: orderedPlayers.length }
      };
      this.gameStateManager.saveGameEvent(startEvent);

      // Create game session
      this.currentSession = {
        gameState,
        isActive: true,
        phase: GamePhase.GAMEPLAY
      };
      this.currentPhase = GamePhase.GAMEPLAY;

      return this.currentSession;

    } catch (error) {
      this.currentPhase = GamePhase.TERMINATED;
      if (this.currentSession) {
        this.currentSession.isActive = false;
        this.currentSession.phase = GamePhase.TERMINATED;
      }
      throw error;
    }
  }

  /**
   * Validates input parameters for game creation
   */
  validateInput(novelFile: string, humanPlayers: number, rounds: number, allowZeroHumans: boolean = false): ValidationResult {
    const errors: string[] = [];
    const gameConfig = this.configManager.getGameConfig();

    // Validate novel file
    if (!novelFile || typeof novelFile !== 'string') {
      errors.push('Novel file path is required');
    } else {
      // Check if file exists
      if (!fs.existsSync(novelFile)) {
        errors.push('Novel file does not exist');
      } else {
        // Check file size (50MB limit)
        const stats = fs.statSync(novelFile);
        const fileSizeMB = stats.size / (1024 * 1024);
        if (fileSizeMB > gameConfig.maxNovelSizeMB) {
          errors.push(`Novel file exceeds ${gameConfig.maxNovelSizeMB}MB size limit (current: ${fileSizeMB.toFixed(2)}MB)`);
        }

        // Check file extension (basic text file validation)
        const ext = path.extname(novelFile).toLowerCase();
        const supportedExtensions = ['.txt', '.md', '.text'];
        if (!supportedExtensions.includes(ext)) {
          errors.push(`Unsupported file format. Supported formats: ${supportedExtensions.join(', ')}`);
        }
      }
    }

    // Validate human players count (allow 0 for testing mode)
    const minPlayers = allowZeroHumans ? 0 : 1;
    if (!Number.isInteger(humanPlayers) || humanPlayers < minPlayers || humanPlayers > 4) {
      if (allowZeroHumans) {
        errors.push('Number of human players must be between 0 and 4');
      } else {
        errors.push('Number of human players must be between 1 and 4');
      }
    }

    // Validate rounds count
    if (!Number.isInteger(rounds) || rounds < 10 || rounds > 20) {
      errors.push('Number of rounds must be between 10 and 20');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates novel analysis results for completeness
   */
  validateNovelAnalysis(analysis: NovelAnalysis): boolean {
    if (!validateNovelAnalysis(analysis)) {
      return false;
    }

    // Additional business logic validation
    if (!analysis.isComplete) {
      return false;
    }

    if (analysis.validationErrors.length > 0) {
      return false;
    }

    return true;
  }

  /**
   * Terminates the game early with a specific reason
   */
  terminateGameEarly(reason: string): void {
    console.error(`Game terminated early: ${reason}`);
    
    this.currentPhase = GamePhase.TERMINATED;
    
    if (this.currentSession) {
      this.currentSession.isActive = false;
      this.currentSession.phase = GamePhase.TERMINATED;
      
      // Log termination event
      const terminationEvent: GameEvent = {
        type: 'game_end',
        timestamp: new Date(),
        data: { reason, phase: this.currentPhase }
      };
      
      try {
        this.gameStateManager.saveGameEvent(terminationEvent);
      } catch (error) {
        console.error('Failed to log termination event:', error);
      }
    }
  }

  /**
   * Gets the current game phase
   */
  getCurrentPhase(): GamePhase {
    return this.currentPhase;
  }

  /**
   * Processes a player's turn and generates appropriate story content
   */
  async processPlayerTurn(playerId: string, action: PlayerAction): Promise<StorySegment> {
    if (!this.currentSession || !this.currentSession.isActive) {
      throw new Error('No active game session');
    }

    const gameState = this.currentSession.gameState;
    
    // Handle "do nothing" action - increment rounds
    if (action.type === 'nothing') {
      const updatedGameState = this.gameFlowManager.handleDoNothingAction(gameState, action);
      this.currentSession.gameState = updatedGameState;
      
      // Log round increment
      const roundEvent: GameEvent = {
        type: 'round_increment',
        timestamp: new Date(),
        data: { newTotalRounds: updatedGameState.totalRounds, action },
        playerId
      };
      this.gameStateManager.saveGameEvent(roundEvent);
      
      // Create empty story segment for "do nothing"
      const storySegment: StorySegment = {
        content: `${this.getPlayerName(playerId)} chose to do nothing. Total rounds increased to ${updatedGameState.totalRounds}.`,
        wordCount: 0,
        generatedBy: action,
        targetEnding: gameState.targetEnding?.id || 'none',
        timestamp: new Date()
      };
      
      gameState.storySegments.push(storySegment);
      return storySegment;
    }

    // Generate story content for "talk" or "act" actions
    const wordCount = action.type === 'talk' ? 200 : 100;
    const gameContext: GameContext = {
      novelAnalysis: gameState.novelAnalysis,
      currentRound: gameState.currentRound,
      totalRounds: gameState.totalRounds,
      players: gameState.players,
      storySegments: gameState.storySegments,
      targetEnding: gameState.targetEnding
    };

    let content: string;
    if (action.type === 'talk') {
      content = await this.storyGenerator.generateDialogue(gameContext, wordCount);
    } else {
      content = await this.storyGenerator.generateNarrative(gameContext, wordCount);
    }

    // Select or update target ending based on action
    if (!gameState.targetEnding) {
      gameState.targetEnding = this.storyGenerator.selectTargetEnding(gameState, action);
    }

    // Create story segment
    const storySegment: StorySegment = {
      content,
      wordCount: this.countWords(content),
      generatedBy: action,
      targetEnding: gameState.targetEnding.id,
      timestamp: new Date()
    };

    // Add to game state and save
    gameState.storySegments.push(storySegment);
    
    // Log story generation event
    const storyEvent: GameEvent = {
      type: 'story_generation',
      timestamp: new Date(),
      data: { storySegment, action },
      playerId
    };
    this.gameStateManager.saveGameEvent(storyEvent);

    return storySegment;
  }

  /**
   * Runs the complete game loop from current state to completion
   */
  async runGameLoop(): Promise<GameState> {
    if (!this.currentSession || !this.currentSession.isActive) {
      throw new Error('No active game session');
    }

    const gameState = this.currentSession.gameState;
    
    try {
      while (!this.gameFlowManager.shouldEndGame(gameState) && this.currentSession.isActive) {
        // Process each player's turn in order
        for (const player of gameState.players) {
          if (this.gameFlowManager.shouldEndGame(gameState)) {
            break;
          }

          // Get player action (with timeout handling)
          const playerAction = await this.gameFlowManager.processPlayerTurn(player);
          
          // Log player action
          const actionEvent: GameEvent = {
            type: 'player_action',
            timestamp: new Date(),
            data: { action: playerAction },
            playerId: player.id
          };
          this.gameStateManager.saveGameEvent(actionEvent);

          // Process the action and generate story content
          await this.processPlayerTurn(player.id, playerAction);
        }

        // Advance to next round if not ended
        if (!this.gameFlowManager.shouldEndGame(gameState)) {
          const updatedGameState = this.gameFlowManager.advanceToNextRound(gameState);
          this.currentSession.gameState = updatedGameState;
        }
      }

      // Game completed successfully
      this.currentPhase = GamePhase.COMPLETED;
      this.currentSession.phase = GamePhase.COMPLETED;
      this.currentSession.isActive = false;

      // Log game completion
      const completionEvent: GameEvent = {
        type: 'game_end',
        timestamp: new Date(),
        data: { 
          finalRound: gameState.currentRound,
          totalSegments: gameState.storySegments.length,
          targetEnding: gameState.targetEnding?.id
        }
      };
      this.gameStateManager.saveGameEvent(completionEvent);

      return gameState;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.terminateGameEarly(`Game loop error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Gets the current game session
   */
  getCurrentSession(): GameSession | null {
    return this.currentSession;
  }

  /**
   * Helper method to extract novel title from file path
   */
  private extractNovelTitle(novelFile: string): string {
    const basename = path.basename(novelFile, path.extname(novelFile));
    return basename.replace(/[^a-zA-Z0-9\-_]/g, '_');
  }

  /**
   * Helper method to get player by ID
   */
  private getPlayerById(playerId: string): Player | undefined {
    if (!this.currentSession) return undefined;
    return this.currentSession.gameState.players.find(p => p.id === playerId);
  }

  /**
   * Helper method to get player name by ID
   */
  private getPlayerName(playerId: string): string {
    const player = this.getPlayerById(playerId);
    return player?.character?.name || `Player ${playerId}`;
  }

  /**
   * Helper method to get recent player actions
   */
  private getRecentActions(gameState: GameState, count: number): PlayerAction[] {
    return gameState.storySegments
      .slice(-count)
      .map(segment => segment.generatedBy);
  }

  /**
   * Helper method to count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}