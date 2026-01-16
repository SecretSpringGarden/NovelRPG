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
 * BookQuoteMetadata interface for tracking book quote information
 */
export interface BookQuoteMetadata {
  originalText: string; // Exact text from book
  chapterNumber?: number;
  pageNumber?: number;
  contextDescription: string;
  endingCompatibilityScore: number; // How well it supports target ending (0-10)
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
  contentSource: 'book_quote' | 'llm_generated'; // Clear marking of source
  bookQuoteMetadata?: BookQuoteMetadata; // Additional quote information if book quote
  dialogueContext?: { // NEW: Book section used for this round
    chapterNumber?: number;
    sceneDescription: string;
    startPosition: number;
    endPosition: number;
  };
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
 * QuoteUsageStats interface for tracking book quote usage statistics
 */
export interface QuoteUsageStats {
  totalActions: number;
  bookQuotesUsed: number;
  llmGeneratedUsed: number;
  configuredPercentage: number;
  actualPercentage: number;
  endingCompatibilityAdjustments: number; // How many times quotes were rejected due to ending incompatibility
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
  quotePercentage: number; // Configured 0-100
  effectiveQuotePercentage: number; // Actual percentage after ending compatibility adjustments
  quoteUsageStats: QuoteUsageStats; // Track actual usage
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
 * Validates a BookQuoteMetadata object for completeness and data integrity
 */
export function validateBookQuoteMetadata(metadata: any): metadata is BookQuoteMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  // Check required string fields
  if (typeof metadata.originalText !== 'string' || metadata.originalText.trim() === '') {
    return false;
  }

  if (typeof metadata.contextDescription !== 'string' || metadata.contextDescription.trim() === '') {
    return false;
  }

  // Check optional number fields
  if (metadata.chapterNumber !== undefined && 
      (typeof metadata.chapterNumber !== 'number' || metadata.chapterNumber < 1 || !Number.isInteger(metadata.chapterNumber))) {
    return false;
  }

  if (metadata.pageNumber !== undefined && 
      (typeof metadata.pageNumber !== 'number' || metadata.pageNumber < 1 || !Number.isInteger(metadata.pageNumber))) {
    return false;
  }

  // Check endingCompatibilityScore is between 0-10
  if (typeof metadata.endingCompatibilityScore !== 'number' || 
      metadata.endingCompatibilityScore < 0 || 
      metadata.endingCompatibilityScore > 10) {
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

  // Check contentSource is valid
  if (segment.contentSource !== 'book_quote' && segment.contentSource !== 'llm_generated') {
    return false;
  }

  // Check bookQuoteMetadata is optional but if present, must be valid
  if (segment.bookQuoteMetadata !== undefined) {
    if (!validateBookQuoteMetadata(segment.bookQuoteMetadata)) {
      return false;
    }
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
 * Validates a QuoteUsageStats object for completeness and data integrity
 */
export function validateQuoteUsageStats(stats: any): stats is QuoteUsageStats {
  if (!stats || typeof stats !== 'object') {
    return false;
  }

  // Check all required number fields are non-negative integers
  if (typeof stats.totalActions !== 'number' || 
      stats.totalActions < 0 || 
      !Number.isInteger(stats.totalActions)) {
    return false;
  }

  if (typeof stats.bookQuotesUsed !== 'number' || 
      stats.bookQuotesUsed < 0 || 
      !Number.isInteger(stats.bookQuotesUsed)) {
    return false;
  }

  if (typeof stats.llmGeneratedUsed !== 'number' || 
      stats.llmGeneratedUsed < 0 || 
      !Number.isInteger(stats.llmGeneratedUsed)) {
    return false;
  }

  if (typeof stats.endingCompatibilityAdjustments !== 'number' || 
      stats.endingCompatibilityAdjustments < 0 || 
      !Number.isInteger(stats.endingCompatibilityAdjustments)) {
    return false;
  }

  // Check percentage fields are between 0-100
  if (typeof stats.configuredPercentage !== 'number' || 
      stats.configuredPercentage < 0 || 
      stats.configuredPercentage > 100) {
    return false;
  }

  if (typeof stats.actualPercentage !== 'number' || 
      stats.actualPercentage < 0 || 
      stats.actualPercentage > 100) {
    return false;
  }

  // Validate that bookQuotesUsed + llmGeneratedUsed = totalActions
  if (stats.bookQuotesUsed + stats.llmGeneratedUsed !== stats.totalActions) {
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

  // Check quotePercentage is between 0-100
  if (typeof gameState.quotePercentage !== 'number' || 
      gameState.quotePercentage < 0 || 
      gameState.quotePercentage > 100) {
    return false;
  }

  // Check effectiveQuotePercentage is between 0-100
  if (typeof gameState.effectiveQuotePercentage !== 'number' || 
      gameState.effectiveQuotePercentage < 0 || 
      gameState.effectiveQuotePercentage > 100) {
    return false;
  }

  // Check quoteUsageStats is valid
  if (!validateQuoteUsageStats(gameState.quoteUsageStats)) {
    return false;
  }

  return true;
}