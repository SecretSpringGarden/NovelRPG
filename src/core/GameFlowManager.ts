import { Player, PlayerAction } from '../models/Player';
import { GameState, GameEvent } from '../models/GameState';

/**
 * GameFlowManager handles the core game flow logic including action mapping,
 * round management, and player timeout handling
 */
export class GameFlowManager {
  private readonly PLAYER_TIMEOUT_MS = 60000; // 1 minute timeout

  /**
   * Maps dice roll to action type according to game rules:
   * - Even numbers (2,4,6,8,10) -> "talk"
   * - Odd numbers 1,3,5 -> "act" 
   * - Numbers 7,9 -> "do nothing"
   */
  mapDiceToAction(diceRoll: number): 'talk' | 'act' | 'nothing' {
    if (diceRoll < 1 || diceRoll > 10 || !Number.isInteger(diceRoll)) {
      throw new Error(`Invalid dice roll: ${diceRoll}. Must be integer between 1-10.`);
    }

    if (diceRoll % 2 === 0) {
      // Even numbers (2,4,6,8,10) -> talk
      return 'talk';
    } else if (diceRoll === 1 || diceRoll === 3 || diceRoll === 5) {
      // 1, 3, 5 -> act
      return 'act';
    } else {
      // 7, 9 -> do nothing
      return 'nothing';
    }
  }

  /**
   * Processes a player's turn with timeout handling
   * Returns the player action based on dice roll or timeout
   */
  async processPlayerTurn(player: Player, timeoutMs: number = this.PLAYER_TIMEOUT_MS): Promise<PlayerAction> {
    const startTime = Date.now();
    
    try {
      // Create a promise that resolves when player input is received or timeout occurs
      const inputPromise = this.waitForPlayerInput(player, timeoutMs);
      const timeoutPromise = this.createTimeoutPromise(timeoutMs);
      
      // Race between player input and timeout
      const result = await Promise.race([inputPromise, timeoutPromise]);
      
      if (result.timedOut) {
        // Timeout occurred - roll dice automatically
        const diceRoll = player.rollDice();
        const actionType = this.mapDiceToAction(diceRoll);
        
        return {
          type: actionType,
          diceRoll,
          timestamp: new Date(),
          playerId: player.id,
          contentSource: 'llm_generated' // Default to LLM generated
        };
      } else {
        // Player input received
        return result.action;
      }
    } catch (error) {
      // Fallback: roll dice if any error occurs
      const diceRoll = player.rollDice();
      const actionType = this.mapDiceToAction(diceRoll);
      
      return {
        type: actionType,
        diceRoll,
        timestamp: new Date(),
        playerId: player.id,
        contentSource: 'llm_generated' // Default to LLM generated
      };
    }
  }

  /**
   * Handles round increment logic when a player chooses "do nothing"
   * Returns updated game state with incremented round count
   */
  handleDoNothingAction(gameState: GameState, playerAction: PlayerAction): GameState {
    if (playerAction.type !== 'nothing') {
      return gameState; // No change for non-"nothing" actions
    }

    // Increment total rounds for "do nothing" action
    const updatedGameState: GameState = {
      ...gameState,
      totalRounds: gameState.totalRounds + 1
    };

    return updatedGameState;
  }

  /**
   * Creates a game event for logging purposes
   */
  createGameEvent(type: GameEvent['type'], data: any, playerId?: string): GameEvent {
    return {
      type,
      timestamp: new Date(),
      data,
      playerId
    };
  }

  /**
   * Validates that a dice roll produces the expected action type
   */
  validateActionMapping(diceRoll: number, expectedAction: 'talk' | 'act' | 'nothing'): boolean {
    try {
      const actualAction = this.mapDiceToAction(diceRoll);
      return actualAction === expectedAction;
    } catch {
      return false;
    }
  }

  /**
   * Gets all possible dice rolls that map to a specific action type
   */
  getDiceRollsForAction(actionType: 'talk' | 'act' | 'nothing'): number[] {
    const rolls: number[] = [];
    
    for (let roll = 1; roll <= 10; roll++) {
      if (this.mapDiceToAction(roll) === actionType) {
        rolls.push(roll);
      }
    }
    
    return rolls;
  }

  /**
   * Private method to wait for player input (simulated for now)
   */
  private async waitForPlayerInput(player: Player, timeoutMs: number): Promise<{ action: PlayerAction; timedOut: false }> {
    // In a real implementation, this would wait for actual user input (space bar press)
    // For now, we simulate immediate dice roll
    const diceRoll = player.rollDice();
    const actionType = this.mapDiceToAction(diceRoll);
    
    const action: PlayerAction = {
      type: actionType,
      diceRoll,
      timestamp: new Date(),
      playerId: player.id,
      contentSource: 'llm_generated' // Default to LLM generated
    };

    return { action, timedOut: false };
  }

  /**
   * Private method to create a timeout promise
   */
  private async createTimeoutPromise(timeoutMs: number): Promise<{ timedOut: true }> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({ timedOut: true });
      }, timeoutMs);
      
      // Store timeout ID for cleanup if needed
      (resolve as any).timeoutId = timeoutId;
    });
  }

  /**
   * Determines if the current round should end based on all players having taken actions
   */
  shouldEndRound(gameState: GameState, actionsThisRound: PlayerAction[]): boolean {
    // Round ends when all 4 players have taken an action
    return actionsThisRound.length >= 4;
  }

  /**
   * Advances to the next round and resets round-specific state
   */
  advanceToNextRound(gameState: GameState): GameState {
    return {
      ...gameState,
      currentRound: gameState.currentRound + 1
    };
  }

  /**
   * Checks if the game should end based on current round vs total rounds
   */
  shouldEndGame(gameState: GameState): boolean {
    return gameState.currentRound >= gameState.totalRounds;
  }
}