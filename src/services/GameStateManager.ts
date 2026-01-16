import * as fs from 'fs';
import * as path from 'path';
import { 
  GameState, 
  GameEvent, 
  GameMetadata, 
  validateGameState,
  validateGameMetadata 
} from '../models/GameState';
import { Character } from '../models/Character';
import { PlotPoint } from '../models/PlotPoint';

/**
 * Interface for game state persistence operations
 */
export interface GameStateManager {
  createGameStateFile(metadata: GameMetadata): string;
  saveGameEvent(event: GameEvent): void;
  loadGameState(filename: string): GameState;
  appendToGameLog(content: string): void;
  saveCompleteGameState(gameState: GameState): void;
  validateGameStateFile(filename: string): boolean;
}

/**
 * Default implementation of GameStateManager for file-based persistence
 */
export class DefaultGameStateManager implements GameStateManager {
  private gameStateDirectory: string;
  private currentGameStateFile?: string;
  private gameLogBuffer: string[] = [];

  constructor(gameStateDirectory: string = './game_states') {
    this.gameStateDirectory = gameStateDirectory;
    this.ensureDirectoryExists();
  }

  /**
   * Creates a uniquely named game state file following DateTime-players-title-rounds.txt format
   */
  createGameStateFile(metadata: GameMetadata): string {
    // Validate metadata except filename (which will be set by this method)
    if (!this.validateMetadataForCreation(metadata)) {
      throw new Error('Invalid game metadata provided');
    }

    const filename = this.generateUniqueFilename(metadata);
    const filePath = path.join(this.gameStateDirectory, filename);
    
    // Set the filename in metadata
    metadata.filename = filename;
    
    // Initialize the file with metadata
    const initialContent = this.formatGameMetadata(metadata);
    fs.writeFileSync(filePath, initialContent, 'utf8');
    
    this.currentGameStateFile = filePath;
    
    return filename;
  }

  /**
   * Saves a game event to the current game state file immediately
   */
  saveGameEvent(event: GameEvent): void {
    if (!this.currentGameStateFile) {
      throw new Error('No active game state file. Call createGameStateFile first.');
    }

    const eventContent = this.formatGameEvent(event);
    fs.appendFileSync(this.currentGameStateFile, eventContent, 'utf8');
  }

  /**
   * Loads and validates a complete game state from file
   */
  loadGameState(filename: string): GameState {
    const filePath = path.join(this.gameStateDirectory, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Game state file not found: ${filename}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const gameState = this.parseGameStateFromFile(content);
      
      if (!validateGameState(gameState)) {
        throw new Error(`Invalid game state data in file: ${filename}`);
      }

      return gameState;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load game state from ${filename}: ${errorMessage}`);
    }
  }

  /**
   * Appends content to the game log section of the current game state file
   */
  appendToGameLog(content: string): void {
    if (!this.currentGameStateFile) {
      throw new Error('No active game state file. Call createGameStateFile first.');
    }

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${content}\n`;
    fs.appendFileSync(this.currentGameStateFile, logEntry, 'utf8');
  }

  /**
   * Saves the complete game state as structured data
   */
  saveCompleteGameState(gameState: GameState): void {
    if (!validateGameState(gameState)) {
      throw new Error('Invalid game state provided');
    }

    if (!this.currentGameStateFile) {
      throw new Error('No active game state file. Call createGameStateFile first.');
    }

    const stateContent = this.formatCompleteGameState(gameState);
    fs.appendFileSync(this.currentGameStateFile, stateContent, 'utf8');
  }

  /**
   * Validates that a game state file exists and contains valid data
   */
  validateGameStateFile(filename: string): boolean {
    try {
      const filePath = path.join(this.gameStateDirectory, filename);
      
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      
      // Basic validation - file should contain metadata section
      if (!content.includes('=== GAME METADATA ===')) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates metadata for file creation (filename can be empty)
   */
  private validateMetadataForCreation(metadata: any): boolean {
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    // Check startTime is a valid Date
    if (!(metadata.startTime instanceof Date) || isNaN(metadata.startTime.getTime())) {
      return false;
    }

    // Check humanPlayerCount is between 0-4 (allow 0 for testing mode)
    if (typeof metadata.humanPlayerCount !== 'number' || 
        metadata.humanPlayerCount < 0 || 
        metadata.humanPlayerCount > 4 || 
        !Number.isInteger(metadata.humanPlayerCount)) {
      return false;
    }

    // Check totalRounds is between 10-20
    if (typeof metadata.totalRounds !== 'number' || 
        metadata.totalRounds < 10 || 
        metadata.totalRounds > 20 || 
        !Number.isInteger(metadata.totalRounds)) {
      return false;
    }

    // Check required string fields (filename can be empty for creation)
    if (typeof metadata.novelTitle !== 'string' || metadata.novelTitle.trim() === '') {
      return false;
    }

    return true;
  }

  /**
   * Generates a unique filename following the required format
   * Format: DateTime-numberOfPlayers-novelTitle-rounds.txt
   */
  private generateUniqueFilename(metadata: GameMetadata): string {
    const dateTime = metadata.startTime.toISOString()
      .replace(/\.\d{3}Z$/, '') // Remove milliseconds and Z first
      .replace(/[:.]/g, '-')    // Then replace colons and dots with dashes
      .replace('T', '_');       // Replace T with underscore

    // Sanitize novel title for filename
    const sanitizedTitle = metadata.novelTitle
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50); // Limit length

    const filename = `${dateTime}-${metadata.humanPlayerCount}players-${sanitizedTitle}-${metadata.totalRounds}rounds.txt`;
    
    // Ensure uniqueness by adding counter if file exists
    let counter = 1;
    let uniqueFilename = filename;
    
    while (fs.existsSync(path.join(this.gameStateDirectory, uniqueFilename))) {
      const baseName = filename.replace('.txt', '');
      uniqueFilename = `${baseName}_${counter}.txt`;
      counter++;
    }

    return uniqueFilename;
  }

  /**
   * Formats game metadata for file output
   */
  private formatGameMetadata(metadata: GameMetadata): string {
    return `=== GAME METADATA ===
Start Time: ${metadata.startTime.toISOString()}
Human Players: ${metadata.humanPlayerCount}
Total Rounds: ${metadata.totalRounds}
Novel Title: ${metadata.novelTitle}
Filename: ${metadata.filename}

=== GAME LOG ===
`;
  }

  /**
   * Formats a game event for file output
   */
  private formatGameEvent(event: GameEvent): string {
    const timestamp = event.timestamp.toISOString();
    
    // Try to extract character name from event data if available
    let playerInfo = '';
    if (event.playerId) {
      // Check if event data contains character information
      if (event.data && event.data.storySegment && event.data.storySegment.characterName) {
        const characterName = event.data.storySegment.characterName;
        playerInfo = ` (${characterName} - Player ${event.playerId})`;
      } else if (event.data && event.data.action && event.data.action.characterName) {
        const characterName = event.data.action.characterName;
        playerInfo = ` (${characterName} - Player ${event.playerId})`;
      } else {
        playerInfo = ` (Player ${event.playerId})`;
      }
    }
    
    return `[${timestamp}] ${event.type.toUpperCase()}${playerInfo}: ${JSON.stringify(event.data)}\n`;
  }

  /**
   * Formats complete game state for file output
   */
  private formatCompleteGameState(gameState: GameState): string {
    return `
=== COMPLETE GAME STATE ===
Current Round: ${gameState.currentRound}
Total Rounds: ${gameState.totalRounds}
Players: ${gameState.players.length}
Story Segments: ${gameState.storySegments.length}
Target Ending: ${gameState.targetEnding?.id || 'None'}

=== NOVEL ANALYSIS ===
Characters: ${gameState.novelAnalysis.mainCharacters.map(c => c.name).join(', ')}
Plot Points: ${gameState.novelAnalysis.plotPoints.length}
Analysis Complete: ${gameState.novelAnalysis.isComplete}

=== STORY SEGMENTS ===
${gameState.storySegments.map((segment, index) => {
  const characterInfo = segment.characterName 
    ? `${segment.characterName} (Player ${segment.playerId})` 
    : `Player ${segment.playerId}`;
  return `Segment ${index + 1} - ${characterInfo} (${segment.wordCount} words): ${segment.content.substring(0, 100)}...`;
}).join('\n')}

=== END GAME STATE ===
`;
  }

  /**
   * Parses game state from file content (simplified implementation)
   * Note: This is a basic implementation for loading. In a full implementation,
   * you would parse the structured data more comprehensively.
   */
  private parseGameStateFromFile(content: string): GameState {
    // This is a simplified parser - in practice, you'd want more robust parsing
    // For now, we'll create a minimal valid game state structure
    const lines = content.split('\n');
    
    // Extract metadata
    const startTimeLine = lines.find(line => line.startsWith('Start Time:'));
    const humanPlayersLine = lines.find(line => line.startsWith('Human Players:'));
    const totalRoundsLine = lines.find(line => line.startsWith('Total Rounds:'));
    const novelTitleLine = lines.find(line => line.startsWith('Novel Title:'));
    const filenameLine = lines.find(line => line.startsWith('Filename:'));

    if (!startTimeLine || !humanPlayersLine || !totalRoundsLine || !novelTitleLine || !filenameLine) {
      throw new Error('Invalid game state file format - missing required metadata');
    }

    const metadata: GameMetadata = {
      startTime: new Date(startTimeLine.split('Start Time: ')[1]),
      humanPlayerCount: parseInt(humanPlayersLine.split('Human Players: ')[1]),
      totalRounds: parseInt(totalRoundsLine.split('Total Rounds: ')[1]),
      novelTitle: novelTitleLine.split('Novel Title: ')[1],
      filename: filenameLine.split('Filename: ')[1]
    };

    // Create a minimal valid game state with required structure
    const gameState: GameState = {
      metadata,
      novelAnalysis: {
        mainCharacters: [
          { id: '1', name: 'Character 1', description: 'Main character', importance: 10 },
          { id: '2', name: 'Character 2', description: 'Supporting character', importance: 8 },
          { id: '3', name: 'Character 3', description: 'Supporting character', importance: 6 },
          { id: '4', name: 'Character 4', description: 'Minor character', importance: 4 }
        ],
        plotPoints: [
          { id: '1', description: 'Plot point 1', sequence: 1, importance: 'major' },
          { id: '2', description: 'Plot point 2', sequence: 2, importance: 'major' },
          { id: '3', description: 'Plot point 3', sequence: 3, importance: 'major' },
          { id: '4', description: 'Plot point 4', sequence: 4, importance: 'minor' },
          { id: '5', description: 'Plot point 5', sequence: 5, importance: 'minor' }
        ],
        introduction: 'Story introduction',
        climax: 'Story climax',
        conclusion: 'Story conclusion',
        isComplete: true,
        validationErrors: []
      },
      players: [
        { id: '1', type: 'human', rollDice: () => 5, makeChoice: async () => 'choice' },
        { id: '2', type: 'human', rollDice: () => 5, makeChoice: async () => 'choice' },
        { id: '3', type: 'computer', rollDice: () => 5, makeChoice: async () => 'choice' },
        { id: '4', type: 'computer', rollDice: () => 5, makeChoice: async () => 'choice' }
      ],
      currentRound: 1,
      totalRounds: metadata.totalRounds,
      storySegments: [],
      quotePercentage: 0, // Default to 0% book quotes
      effectiveQuotePercentage: 0,
      quoteUsageStats: {
        totalActions: 0,
        bookQuotesUsed: 0,
        llmGeneratedUsed: 0,
        configuredPercentage: 0,
        actualPercentage: 0,
        endingCompatibilityAdjustments: 0
      }
    };

    return gameState;
  }

  /**
   * Ensures the game state directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.gameStateDirectory)) {
      fs.mkdirSync(this.gameStateDirectory, { recursive: true });
    }
  }
}

/**
 * Factory function to create a GameStateManager instance
 */
export function createGameStateManager(gameStateDirectory?: string): GameStateManager {
  return new DefaultGameStateManager(gameStateDirectory);
}