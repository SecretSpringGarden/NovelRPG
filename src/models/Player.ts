import { Character } from './Character';

/**
 * Player interface representing both human and computer players
 */
export interface Player {
  id: string;
  type: 'human' | 'computer';
  character?: Character;
  rollDice(): number;
  makeChoice(options: string[]): Promise<string>;
}

/**
 * PlayerAction interface representing actions taken during gameplay
 */
export interface PlayerAction {
  type: 'talk' | 'act' | 'nothing';
  diceRoll: number;
  timestamp: Date;
  playerId: string;
}

/**
 * Validates a Player object for completeness and data integrity
 */
export function validatePlayer(player: any): player is Player {
  if (!player || typeof player !== 'object') {
    return false;
  }

  // Check required string fields
  if (typeof player.id !== 'string' || player.id.trim() === '') {
    return false;
  }

  // Check type is valid enum value
  if (player.type !== 'human' && player.type !== 'computer') {
    return false;
  }

  // Check character is optional but if present, must be valid
  if (player.character !== undefined && player.character !== null) {
    // Basic character validation - full validation handled by Character module
    if (!player.character || typeof player.character !== 'object') {
      return false;
    }
  }

  // Check required methods exist
  if (typeof player.rollDice !== 'function' || typeof player.makeChoice !== 'function') {
    return false;
  }

  return true;
}

/**
 * Validates a PlayerAction object for completeness and data integrity
 */
export function validatePlayerAction(action: any): action is PlayerAction {
  if (!action || typeof action !== 'object') {
    return false;
  }

  // Check type is valid enum value
  const validTypes = ['talk', 'act', 'nothing'];
  if (!validTypes.includes(action.type)) {
    return false;
  }

  // Check diceRoll is between 1-10
  if (typeof action.diceRoll !== 'number' || 
      action.diceRoll < 1 || 
      action.diceRoll > 10 || 
      !Number.isInteger(action.diceRoll)) {
    return false;
  }

  // Check timestamp is a valid Date
  if (!(action.timestamp instanceof Date) || isNaN(action.timestamp.getTime())) {
    return false;
  }

  // Check playerId is a non-empty string
  if (typeof action.playerId !== 'string' || action.playerId.trim() === '') {
    return false;
  }

  return true;
}

/**
 * Validates an array of players ensuring exactly 4 players
 */
export function validatePlayerArray(players: any[]): players is Player[] {
  if (!Array.isArray(players) || players.length !== 4) {
    return false;
  }

  return players.every(validatePlayer);
}