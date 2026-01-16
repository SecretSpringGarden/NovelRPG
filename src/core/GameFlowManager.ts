import { Player, PlayerAction } from '../models/Player';
import { GameState, GameEvent } from '../models/GameState';

/**
 * GameFlowManager handles the core game flow logic including action mapping,
 * round management, and player timeout handling
 */
export class GameFlowManager {
  private readonly PLAYER_TIMEOUT_MS = 60000; // 1 minute timeout

  // Dice-roll-based action determination has been removed.
  // Use ActionChoiceManager for generating and processing player actions.

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

  // validateActionMapping() and getDiceRollsForAction() methods have been removed.
  // These were part of the old dice-roll system.

  // waitForPlayerInput() method has been removed.
  // Use ActionChoiceManager for player input handling.

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