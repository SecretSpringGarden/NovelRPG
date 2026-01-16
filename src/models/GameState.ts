import { Character } from './Character';
import { PlotPoint } from './PlotPoint';
import { StoryEnding } from './StoryEnding';
import { Player, PlayerAction } from './Player';

/**
 * NovelAnalysis interface representing the results of novel processing
 */
export interface NovelAnalysis {
  mainCharacters: Character[];
  plotPoints: PlotPoint[];
  introduction: string;
  climax: string;
  conclusion: string;
  isComplete: boolean;
  validationErrors: string[];
}

/**
 * NarrativeStructure interface for story organization
 */
export interface NarrativeStructure {
  introduction: string;
  climax: string;
  conclusion: string;
}

/**
 * StorySegment interface representing generated narrative content
 */
export interface StorySegment {
  content: string;
  wordCount: number;
  generatedBy: PlayerAction;
  targetEnding: string;
  timestamp: Date;
  characterName?: string; // Character who performed the action
  playerId: string; // Player ID for reference
}

/**
 * GameMetadata interface for game session information
 */
export interface GameMetadata {
  startTime: Date;
  humanPlayerCount: number;
  totalRounds: number;
  novelTitle: string;
  filename: string;
}

/**
 * GameState interface representing the complete game state
 */
export interface GameState {
  metadata: GameMetadata;
  novelAnalysis: NovelAnalysis;
  players: Player[];
  currentRound: number;
  totalRounds: number;
  storySegments: StorySegment[];
  targetEnding?: StoryEnding;
}

/**
 * GameEvent interface for logging game activities
 */
export interface GameEvent {
  type: 'player_action' | 'story_generation' | 'round_increment' | 'game_start' | 'game_end';
  timestamp: Date;
  data: any;
  playerId?: string;
}

/**
 * Validates a NovelAnalysis object for completeness and data integrity
 */
export function validateNovelAnalysis(analysis: any): analysis is NovelAnalysis {
  if (!analysis || typeof analysis !== 'object') {
    return false;
  }

  // Check required arrays
  if (!Array.isArray(analysis.mainCharacters) || analysis.mainCharacters.length !== 4) {
    return false;
  }

  if (!Array.isArray(analysis.plotPoints) || analysis.plotPoints.length !== 5) {
    return false;
  }

  // Check required string fields
  if (typeof analysis.introduction !== 'string' || analysis.introduction.trim() === '') {
    return false;
  }

  if (typeof analysis.climax !== 'string' || analysis.climax.trim() === '') {
    return false;
  }

  if (typeof analysis.conclusion !== 'string' || analysis.conclusion.trim() === '') {
    return false;
  }

  // Check boolean field
  if (typeof analysis.isComplete !== 'boolean') {
    return false;
  }

  // Check validation errors array
  if (!Array.isArray(analysis.validationErrors)) {
    return false;
  }

  return true;
}

/**
 * Validates a StorySegment object for completeness and data integrity
 */
export function validateStorySegment(segment: any): segment is StorySegment {
  if (!segment || typeof segment !== 'object') {
    return false;
  }

  // Check required string fields
  if (typeof segment.content !== 'string' || segment.content.trim() === '') {
    return false;
  }

  if (typeof segment.targetEnding !== 'string' || segment.targetEnding.trim() === '') {
    return false;
  }

  // Check playerId is a non-empty string
  if (typeof segment.playerId !== 'string' || segment.playerId.trim() === '') {
    return false;
  }

  // Check characterName is optional but if present, must be a non-empty string
  if (segment.characterName !== undefined && 
      (typeof segment.characterName !== 'string' || segment.characterName.trim() === '')) {
    return false;
  }

  // Check wordCount is a positive number
  if (typeof segment.wordCount !== 'number' || segment.wordCount < 0) {
    return false;
  }

  // Check timestamp is a valid Date
  if (!(segment.timestamp instanceof Date) || isNaN(segment.timestamp.getTime())) {
    return false;
  }

  // Check generatedBy is a valid PlayerAction (basic check)
  if (!segment.generatedBy || typeof segment.generatedBy !== 'object') {
    return false;
  }

  return true;
}

/**
 * Validates a GameMetadata object for completeness and data integrity
 */
export function validateGameMetadata(metadata: any): metadata is GameMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  // Check startTime is a valid Date
  if (!(metadata.startTime instanceof Date) || isNaN(metadata.startTime.getTime())) {
    return false;
  }

  // Check humanPlayerCount is between 1-4
  if (typeof metadata.humanPlayerCount !== 'number' || 
      metadata.humanPlayerCount < 1 || 
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

  // Check required string fields
  if (typeof metadata.novelTitle !== 'string' || metadata.novelTitle.trim() === '') {
    return false;
  }

  if (typeof metadata.filename !== 'string' || metadata.filename.trim() === '') {
    return false;
  }

  return true;
}

/**
 * Validates a GameState object for completeness and data integrity
 */
export function validateGameState(gameState: any): gameState is GameState {
  if (!gameState || typeof gameState !== 'object') {
    return false;
  }

  // Check metadata is valid
  if (!validateGameMetadata(gameState.metadata)) {
    return false;
  }

  // Check novelAnalysis is valid
  if (!validateNovelAnalysis(gameState.novelAnalysis)) {
    return false;
  }

  // Check players array
  if (!Array.isArray(gameState.players) || gameState.players.length !== 4) {
    return false;
  }

  // Check round numbers
  if (typeof gameState.currentRound !== 'number' || 
      gameState.currentRound < 1 || 
      !Number.isInteger(gameState.currentRound)) {
    return false;
  }

  if (typeof gameState.totalRounds !== 'number' || 
      gameState.totalRounds < 10 || 
      gameState.totalRounds > 20 || 
      !Number.isInteger(gameState.totalRounds)) {
    return false;
  }

  // Check storySegments array
  if (!Array.isArray(gameState.storySegments)) {
    return false;
  }

  // Check optional targetEnding
  if (gameState.targetEnding !== undefined && 
      (!gameState.targetEnding || typeof gameState.targetEnding !== 'object')) {
    return false;
  }

  return true;
}