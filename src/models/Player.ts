import { Character } from './Character';
import { BookQuoteMetadata } from './GameState';

/**
 * Player interface representing both human and computer players
 * Note: rollDice() method is deprecated and optional for backward compatibility
 */
export interface Player {
  id: string;
  type: 'human' | 'computer';
  character?: Character;
  rollDice?(): number; // Optional for backward compatibility
  makeChoice(options: string[]): Promise<string>;
}

/**
 * PlayerAction interface representing actions taken during gameplay
 * Note: diceRoll field is deprecated and optional for backward compatibility
 */
export interface PlayerAction {
  type: 'talk' | 'act' | 'nothing';
  diceRoll?: number; // Optional for backward compatibility
  timestamp: Date;
  playerId: string;
  characterName?: string; // Character name for display (Requirement 14.2)
  contentSource: 'book_quote' | 'llm_generated'; // Clear marking of source
  bookQuoteMetadata?: BookQuoteMetadata; // If book quote, include metadata
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
  if (typeof player.makeChoice !== 'function') {
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

  // Check timestamp is a valid Date
  if (!(action.timestamp instanceof Date) || isNaN(action.timestamp.getTime())) {
    return false;
  }

  // Check playerId is a non-empty string
  if (typeof action.playerId !== 'string' || action.playerId.trim() === '') {
    return false;
  }

  // Check contentSource is valid
  if (action.contentSource !== 'book_quote' && action.contentSource !== 'llm_generated') {
    return false;
  }

  // Check bookQuoteMetadata is optional but if present, must be valid
  // Note: We can't import validateBookQuoteMetadata here to avoid circular dependency
  // So we do a basic validation
  if (action.bookQuoteMetadata !== undefined) {
    if (!action.bookQuoteMetadata || typeof action.bookQuoteMetadata !== 'object') {
      return false;
    }
    // Basic validation of required fields
    if (typeof action.bookQuoteMetadata.originalText !== 'string' || 
        action.bookQuoteMetadata.originalText.trim() === '') {
      return false;
    }
    if (typeof action.bookQuoteMetadata.contextDescription !== 'string' || 
        action.bookQuoteMetadata.contextDescription.trim() === '') {
      return false;
    }
    if (typeof action.bookQuoteMetadata.endingCompatibilityScore !== 'number' || 
        action.bookQuoteMetadata.endingCompatibilityScore < 0 || 
        action.bookQuoteMetadata.endingCompatibilityScore > 10) {
      return false;
    }
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