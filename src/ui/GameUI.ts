import * as readline from 'readline';
import { Player, PlayerAction } from '../models/Player';
import { Character } from '../models/Character';
import { GameState, GameMetadata } from '../models/GameState';
import { StorySegment } from '../models/GameState';
import { ValidationResult } from '../core/GameManager';

/**
 * Game setup parameters collected from user input
 */
export interface GameSetupParams {
  novelFile: string;
  humanPlayers: number;
  rounds: number;
}

/**
 * GameUI handles all command-line interface interactions for the Novel RPG Game
 * Implements space bar input handling, character selection prompts, and game progress display
 */
export class GameUI {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Configure stdin for raw mode to capture space bar presses
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
  }

  /**
   * Display welcome message and collect game setup parameters
   */
  async setupGame(): Promise<GameSetupParams> {
    this.displayWelcome();
    
    const novelFile = await this.promptForNovelFile();
    const humanPlayers = await this.promptForPlayerCount();
    const rounds = await this.promptForRounds();

    return { novelFile, humanPlayers, rounds };
  }

  /**
   * Display validation errors to the user
   */
  displayValidationErrors(validation: ValidationResult): void {
    console.log('\n❌ Input validation failed:');
    validation.errors.forEach(error => {
      console.log(`   • ${error}`);
    });
    console.log();
  }

  /**
   * Display game initialization progress
   */
  displayGameInitialization(metadata: GameMetadata): void {
    console.log('\n🎮 Starting Novel RPG Game');
    console.log('═'.repeat(50));
    console.log(`📖 Novel: ${metadata.novelTitle}`);
    console.log(`👥 Human Players: ${metadata.humanPlayerCount}`);
    console.log(`🎯 Total Rounds: ${metadata.totalRounds}`);
    console.log(`📁 Game File: ${metadata.filename}`);
    console.log('═'.repeat(50));
  }

  /**
   * Display novel analysis progress
   */
  displayAnalysisProgress(): void {
    console.log('\n🔍 Analyzing novel...');
    console.log('   • Extracting main characters');
    console.log('   • Identifying plot points');
    console.log('   • Analyzing narrative structure');
  }

  /**
   * Display analysis results
   */
  displayAnalysisResults(gameState: GameState): void {
    console.log('\n✅ Novel analysis complete!');
    console.log('\n📚 Main Characters:');
    gameState.novelAnalysis.mainCharacters.forEach((char, index) => {
      console.log(`   ${index + 1}. ${char.name} - ${char.description}`);
    });

    console.log('\n📋 Plot Points:');
    gameState.novelAnalysis.plotPoints.forEach((plot, index) => {
      console.log(`   ${index + 1}. ${plot.description}`);
    });
  }

  /**
   * Handle character selection for human players
   */
  async selectCharacter(player: Player, availableCharacters: Character[]): Promise<Character> {
    console.log(`\n🎭 ${player.id.toUpperCase()} - Character Selection`);
    console.log('Available characters:');
    
    availableCharacters.forEach((char, index) => {
      console.log(`   ${index + 1}. ${char.name} - ${char.description}`);
    });

    while (true) {
      const choice = await this.promptForInput('\nEnter character number (1-' + availableCharacters.length + '): ');
      const choiceNum = parseInt(choice);
      
      if (choiceNum >= 1 && choiceNum <= availableCharacters.length) {
        const selectedCharacter = availableCharacters[choiceNum - 1];
        console.log(`✅ You selected: ${selectedCharacter.name}`);
        return selectedCharacter;
      } else {
        console.log('❌ Invalid selection. Please try again.');
      }
    }
  }

  /**
   * Display character assignments after selection
   */
  displayCharacterAssignments(players: Player[]): void {
    console.log('\n🎭 Character Assignments:');
    console.log('─'.repeat(40));
    players.forEach((player, index) => {
      const playerType = player.type === 'human' ? '👤' : '🤖';
      console.log(`   Player ${index + 1} ${playerType}: ${player.character?.name || 'Unassigned'}`);
    });
    console.log();
  }

  /**
   * Display story ending generation progress
   */
  displayEndingGeneration(): void {
    console.log('\n📝 Generating story endings...');
    console.log('   • Creating original ending');
    console.log('   • Generating similar variations');
    console.log('   • Creating opposite ending');
    console.log('   • Adding random alternatives');
  }

  // rollDiceForPlayer() method has been removed.
  // This was part of the old dice-roll system.
  // Use ActionChoiceManager for player action selection.

  /**
   * Display player action
   * Requirement 14.3: Show character names and player numbers for all past turns
   */
  displayPlayerAction(player: Player, action: PlayerAction): void {
    // Format character info: "Character_Name (Player X)" or "Player X"
    const displayName = player.character?.name 
      ? `${player.character.name} (Player ${player.id})` 
      : `Player ${player.id}`;
    
    const actionEmoji = this.getActionEmoji(action.type);
    const actionText = this.getActionText(action.type);
    
    console.log(`${actionEmoji} ${displayName} chose to ${actionText}`);
    
    if (action.type === 'nothing') {
      console.log('   ⏭️  Round count increased by 1');
    }
  }

  /**
   * Display generated story content
   * Requirement 14.3: Show character names and player numbers for all past turns
   */
  displayStoryContent(segment: StorySegment): void {
    if (segment.generatedBy.type === 'nothing') {
      return; // Don't display content for "do nothing" actions
    }

    // Format character info: "Character_Name (Player X)" or "Player X"
    const characterInfo = segment.characterName 
      ? `${segment.characterName} (Player ${segment.playerId})` 
      : `Player ${segment.playerId}`;

    console.log(`\n📖 Story continues... [${characterInfo}]`);
    console.log('─'.repeat(60));
    console.log(this.formatStoryText(segment.content));
    console.log('─'.repeat(60));
    console.log(`Words: ${segment.wordCount} | Target: ${segment.targetEnding}`);
  }

  /**
   * Display current game progress
   */
  displayGameProgress(gameState: GameState): void {
    const progress = (gameState.currentRound / gameState.totalRounds) * 100;
    const progressBar = this.createProgressBar(progress);
    
    console.log(`\n📊 Game Progress: Round ${gameState.currentRound}/${gameState.totalRounds}`);
    console.log(`${progressBar} ${progress.toFixed(1)}%`);
    console.log(`📚 Story segments: ${gameState.storySegments.length}`);
    
    if (gameState.targetEnding) {
      console.log(`🎯 Target ending: ${gameState.targetEnding.type}`);
    }
  }

  /**
   * Display game completion message
   */
  displayGameComplete(gameState: GameState): void {
    console.log('\n🎉 Game Complete!');
    console.log('═'.repeat(50));
    console.log(`📖 Final story has ${gameState.storySegments.length} segments`);
    console.log(`🎯 Achieved ending: ${gameState.targetEnding?.type || 'Unknown'}`);
    console.log(`📁 Full story saved to: ${gameState.metadata.filename}`);
    console.log('═'.repeat(50));
  }

  /**
   * Display early termination message
   */
  displayEarlyTermination(reason: string): void {
    console.log('\n⚠️  Game Terminated Early');
    console.log('═'.repeat(50));
    console.log(`Reason: ${reason}`);
    console.log('═'.repeat(50));
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    try {
      // Remove all event listeners from stdin
      if (process.stdin && process.stdin.removeAllListeners) {
        process.stdin.removeAllListeners('data');
        process.stdin.removeAllListeners('keypress');
      }
      
      // Restore raw mode if it was set
      if (process.stdin && process.stdin.isTTY && process.stdin.setRawMode) {
        try {
          process.stdin.setRawMode(false);
        } catch (error) {
          // Ignore errors when restoring raw mode
        }
      }
      
      // Close readline interface
      if (this.rl) {
        this.rl.close();
        this.rl = null as any;
      }
    } catch (error) {
      // Ignore cleanup errors in tests
      if (process.env.NODE_ENV !== 'test') {
        console.warn('GameUI cleanup warning:', error);
      }
    }
  }

  // Private helper methods

  private displayWelcome(): void {
    console.log('\n🎮 Welcome to Novel RPG Game!');
    console.log('═'.repeat(50));
    console.log('Transform any novel into an interactive RPG experience');
    console.log('Support for 1-4 human players with AI companions');
    console.log('═'.repeat(50));
  }

  private async promptForNovelFile(): Promise<string> {
    while (true) {
      const file = await this.promptForInput('\n📖 Enter path to novel file (.txt, .md): ');
      if (file.trim()) {
        return file.trim();
      }
      console.log('❌ Please enter a valid file path.');
    }
  }

  private async promptForPlayerCount(): Promise<number> {
    while (true) {
      const input = await this.promptForInput('\n👥 Number of human players (1-4): ');
      const count = parseInt(input);
      if (count >= 1 && count <= 4) {
        return count;
      }
      console.log('❌ Please enter a number between 1 and 4.');
    }
  }

  private async promptForRounds(): Promise<number> {
    while (true) {
      const input = await this.promptForInput('\n🎯 Number of rounds (10-20): ');
      const rounds = parseInt(input);
      if (rounds >= 10 && rounds <= 20) {
        return rounds;
      }
      console.log('❌ Please enter a number between 10 and 20.');
    }
  }

  private async promptForInput(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  // waitForSpaceBar() method has been removed.
  // This was part of the old dice-roll system.

  private getActionEmoji(actionType: 'talk' | 'act' | 'nothing'): string {
    switch (actionType) {
      case 'talk': return '💬';
      case 'act': return '⚡';
      case 'nothing': return '⏸️';
      default: return '❓';
    }
  }

  private getActionText(actionType: 'talk' | 'act' | 'nothing'): string {
    switch (actionType) {
      case 'talk': return 'talk';
      case 'act': return 'act';
      case 'nothing': return 'do nothing';
      default: return 'unknown';
    }
  }

  private formatStoryText(text: string): string {
    // Wrap text to 60 characters per line for better readability
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= 60) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
  }

  private createProgressBar(percentage: number): string {
    const barLength = 20;
    const filledLength = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    return `[${bar}]`;
  }
}