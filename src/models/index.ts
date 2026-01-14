// Character models and validation
export { Character, validateCharacter, validateCharacterArray } from './Character';

// PlotPoint models and validation
export { PlotPoint, validatePlotPoint, validatePlotPointArray } from './PlotPoint';

// StoryEnding models and validation
export { StoryEnding, validateStoryEnding, validateStoryEndingArray } from './StoryEnding';

// Player models and validation
export { 
  Player, 
  PlayerAction, 
  validatePlayer, 
  validatePlayerAction, 
  validatePlayerArray 
} from './Player';

// GameState models and validation
export {
  NovelAnalysis,
  NarrativeStructure,
  StorySegment,
  GameMetadata,
  GameState,
  GameEvent,
  validateNovelAnalysis,
  validateStorySegment,
  validateGameMetadata,
  validateGameState
} from './GameState';

// Testing models and validation
export {
  TestConfiguration,
  GameResult,
  CohesionReport,
  validateTestConfiguration,
  validateGameResult,
  validateCohesionReport
} from './Testing';