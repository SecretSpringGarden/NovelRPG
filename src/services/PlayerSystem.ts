import { Player, PlayerAction } from '../models/Player';
import { Character } from '../models/Character';

/**
 * Concrete implementation of Player interface for human players
 */
export class HumanPlayer implements Player {
  public id: string;
  public type: 'human' = 'human';
  public character?: Character;

  constructor(id: string) {
    this.id = id;
  }

  rollDice(): number {
    return Math.floor(Math.random() * 10) + 1;
  }

  async makeChoice(options: string[]): Promise<string> {
    // In a real implementation, this would prompt the user
    // For now, return the first option as a placeholder
    return options[0] || '';
  }
}

/**
 * Concrete implementation of Player interface for computer players
 */
export class ComputerPlayer implements Player {
  public id: string;
  public type: 'computer' = 'computer';
  public character?: Character;

  constructor(id: string) {
    this.id = id;
  }

  rollDice(): number {
    return Math.floor(Math.random() * 10) + 1;
  }

  async makeChoice(options: string[]): Promise<string> {
    // Computer makes random choice
    if (options.length === 0) return '';
    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex];
  }
}

/**
 * PlayerSystem manages both human and computer players, handling turn mechanics and character assignments
 */
export class PlayerSystem {
  /**
   * Initialize players with the specified number of human players and fill remaining slots with computer players
   * Always creates exactly 4 total players
   */
  initializePlayers(humanCount: number): Player[] {
    if (humanCount < 0 || humanCount > 4) {
      throw new Error('Human player count must be between 0 and 4');
    }

    const players: Player[] = [];

    // Create human players
    for (let i = 1; i <= humanCount; i++) {
      players.push(new HumanPlayer(`human-${i}`));
    }

    // Fill remaining slots with computer players
    const computerCount = 4 - humanCount;
    for (let i = 1; i <= computerCount; i++) {
      players.push(new ComputerPlayer(`computer-${i}`));
    }

    return players;
  }

  /**
   * Determine turn order based on dice rolls (highest roll gets Player 1, etc.)
   */
  rollForTurnOrder(players: Player[]): Player[] {
    if (players.length !== 4) {
      throw new Error('Exactly 4 players required for turn order determination');
    }

    // Create array of players with their dice rolls
    const playersWithRolls = players.map(player => ({
      player,
      roll: player.rollDice()
    }));

    // Sort by dice roll (highest first), then by player ID for tie-breaking
    playersWithRolls.sort((a, b) => {
      if (a.roll !== b.roll) {
        return b.roll - a.roll; // Highest roll first
      }
      // Tie-breaker: sort by player ID for consistent ordering
      return a.player.id.localeCompare(b.player.id);
    });

    // Return players in turn order
    return playersWithRolls.map(item => item.player);
  }

  /**
   * Assign characters to players ensuring each character is only assigned once
   * Players select in turn order, with remaining characters assigned to computer players
   * Note: This method now expects characters to be pre-assigned by the UI system
   */
  assignCharacters(players: Player[], characters: Character[]): void {
    if (players.length !== 4) {
      throw new Error('Exactly 4 players required for character assignment');
    }

    if (characters.length !== 4) {
      throw new Error('Exactly 4 characters required for assignment');
    }

    // Check if characters are already assigned (by UI system)
    const hasAssignedCharacters = players.some(p => p.character !== undefined);
    if (hasAssignedCharacters) {
      // Characters already assigned by UI, just validate uniqueness
      if (!this.validateCharacterUniqueness(players)) {
        throw new Error('Character assignment validation failed - duplicate characters detected');
      }
      return;
    }

    // Fallback: automatic assignment for non-UI scenarios (like testing)
    const availableCharacters = [...characters]; // Create a copy to avoid mutating original

    // Assign characters to players in order
    for (const player of players) {
      if (availableCharacters.length === 0) {
        throw new Error('No more characters available for assignment');
      }

      let selectedCharacter: Character;

      if (player.type === 'human') {
        // For human players, in a real implementation this would prompt the user
        // For now, we'll assign the first available character
        selectedCharacter = availableCharacters[0];
      } else {
        // Computer players get random selection from remaining characters
        const randomIndex = Math.floor(Math.random() * availableCharacters.length);
        selectedCharacter = availableCharacters[randomIndex];
      }

      // Assign character to player
      player.character = selectedCharacter;

      // Remove selected character from available list
      const characterIndex = availableCharacters.findIndex(c => c.id === selectedCharacter.id);
      if (characterIndex !== -1) {
        availableCharacters.splice(characterIndex, 1);
      }
    }
  }

  /**
   * Process player input with timeout handling
   * Returns the player action based on dice roll
   * @deprecated Use GameFlowManager.processPlayerTurn() instead for full timeout handling
   */
  async processPlayerInput(player: Player, timeLimit: number = 60000): Promise<PlayerAction> {
    // Simple implementation for backward compatibility
    // For full timeout handling, use GameFlowManager.processPlayerTurn()
    const diceRoll = player.rollDice();
    
    // Map dice roll to action type according to requirements
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
      playerId: player.id
    };
  }

  /**
   * Validate that all players have unique characters assigned
   */
  validateCharacterUniqueness(players: Player[]): boolean {
    const assignedCharacterIds = new Set<string>();
    
    for (const player of players) {
      if (!player.character) {
        return false; // All players must have characters
      }
      
      if (assignedCharacterIds.has(player.character.id)) {
        return false; // Duplicate character found
      }
      
      assignedCharacterIds.add(player.character.id);
    }
    
    return assignedCharacterIds.size === players.length;
  }
}