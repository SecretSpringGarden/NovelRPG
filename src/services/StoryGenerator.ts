import { LLMService } from './LLMService';
import { 
  NovelAnalysis, 
  StorySegment, 
  GameState 
} from '../models/GameState';
import { 
  StoryEnding, 
  validateStoryEnding, 
  validateStoryEndingArray 
} from '../models/StoryEnding';
import { PlayerAction } from '../models/Player';

/**
 * GameContext interface for providing context to story generation
 */
export interface GameContext {
  novelAnalysis: NovelAnalysis;
  currentRound: number;
  totalRounds: number;
  players: any[]; // Player array
  storySegments: StorySegment[];
  targetEnding?: StoryEnding;
  actingCharacter?: any; // The character assigned to the player taking this action
}

/**
 * StoryGenerator interface for creating dynamic narrative content
 */
export interface StoryGenerator {
  generateEndings(analysis: NovelAnalysis): Promise<StoryEnding[]>;
  generateDialogue(context: GameContext, wordCount: number): Promise<string>;
  generateNarrative(context: GameContext, wordCount: number): Promise<string>;
  selectTargetEnding(currentState: GameState, playerAction: PlayerAction): StoryEnding;
  validateEndingGeneration(endings: StoryEnding[]): boolean;
}

/**
 * Default implementation of StoryGenerator using LLM services
 */
export class DefaultStoryGenerator implements StoryGenerator {
  private llmService: LLMService;
  private generatedEndings: StoryEnding[] = [];

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * Generates exactly 3 story endings:
   * - 1 original ending (matches novel's conclusion)
   * - 1 opposite ending (direct opposite of original)
   * - 1 random alternative ending
   */
  async generateEndings(analysis: NovelAnalysis): Promise<StoryEnding[]> {
    const endings: StoryEnding[] = [];

    try {
      // Generate original ending (matches novel's conclusion)
      console.log('🎯 Generating original ending...');
      const originalEnding = await this.generateOriginalEnding(analysis);
      endings.push(originalEnding);

      // Generate opposite ending (direct opposite of original)
      console.log('🔄 Generating opposite ending...');
      const oppositeEnding = await this.generateOppositeEnding(analysis, originalEnding);
      endings.push(oppositeEnding);

      // Generate 1 random alternative ending
      console.log(`🎲 Generating random ending...`);
      const randomEnding = await this.generateRandomEnding(analysis, 1);
      endings.push(randomEnding);

      // Validate the generated endings
      if (!this.validateEndingGeneration(endings)) {
        throw new Error('Generated endings do not meet required validation criteria');
      }

      this.generatedEndings = endings;
      return endings;

    } catch (error) {
      throw new Error(`Failed to generate story endings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates dialogue content based on player "talk" actions
   */
  async generateDialogue(context: GameContext, wordCount: number = 200): Promise<string> {
    const prompt = this.buildDialoguePrompt(context, wordCount);
    
    try {
      const dialogue = await this.llmService.generateContent(prompt, context);
      
      // Validate word count is approximately correct (within 20% tolerance)
      const actualWordCount = this.countWords(dialogue);
      const tolerance = wordCount * 0.2;
      
      if (Math.abs(actualWordCount - wordCount) > tolerance) {
        console.warn(`Generated dialogue word count (${actualWordCount}) differs significantly from target (${wordCount})`);
      }

      return dialogue.trim();
    } catch (error) {
      throw new Error(`Failed to generate dialogue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates narrative content based on player "act" actions
   */
  async generateNarrative(context: GameContext, wordCount: number = 100): Promise<string> {
    const prompt = this.buildNarrativePrompt(context, wordCount);
    
    try {
      const narrative = await this.llmService.generateContent(prompt, context);
      
      // Validate word count is approximately correct (within 20% tolerance)
      const actualWordCount = this.countWords(narrative);
      const tolerance = wordCount * 0.2;
      
      if (Math.abs(actualWordCount - wordCount) > tolerance) {
        console.warn(`Generated narrative word count (${actualWordCount}) differs significantly from target (${wordCount})`);
      }

      return narrative.trim();
    } catch (error) {
      throw new Error(`Failed to generate narrative: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Selects which of the 3 endings to target based on current game state and player action
   */
  selectTargetEnding(currentState: GameState, playerAction: PlayerAction): StoryEnding {
    if (this.generatedEndings.length === 0) {
      throw new Error('No endings have been generated yet');
    }

    // Simple targeting logic based on game progression and action type
    const progressRatio = currentState.currentRound / currentState.totalRounds;
    
    // Early game (first third) - lean toward original ending
    if (progressRatio < 0.33) {
      const originalEnding = this.generatedEndings.find(e => e.type === 'original');
      return originalEnding || this.selectRandomFromArray(this.generatedEndings);
    }
    
    // Mid game (middle third) - any ending is possible
    if (progressRatio < 0.66) {
      return this.selectRandomFromArray(this.generatedEndings);
    }
    
    // Late game (final third) - weight selection based on action type
    if (playerAction.type === 'talk') {
      // Talking actions lean toward original ending
      const originalEnding = this.generatedEndings.find(e => e.type === 'original');
      return originalEnding || this.selectRandomFromArray(this.generatedEndings);
    } else if (playerAction.type === 'act') {
      // Acting actions can lead to any ending, including dramatic ones
      return this.selectRandomFromArray(this.generatedEndings);
    } else {
      // "Nothing" actions lean toward random or opposite endings
      const passiveEndings = this.generatedEndings.filter(e => 
        e.type === 'random' || e.type === 'opposite'
      );
      return passiveEndings.length > 0 ? this.selectRandomFromArray(passiveEndings) : this.selectRandomFromArray(this.generatedEndings);
    }
  }

  /**
   * Validates that exactly 8 endings were generated with correct distribution
   */
  validateEndingGeneration(endings: StoryEnding[]): boolean {
    return validateStoryEndingArray(endings);
  }

  // Private helper methods

  private async generateOriginalEnding(analysis: NovelAnalysis): Promise<StoryEnding> {
    const prompt = `Based on the novel analysis provided, create a story ending that closely matches the original novel's conclusion.

Novel conclusion: ${analysis.conclusion}
Main characters: ${analysis.mainCharacters.map(c => c.name).join(', ')}
Key plot points: ${analysis.plotPoints.map(p => p.description).join('; ')}

Generate a story ending description that stays true to the original novel's conclusion. The description should be 2-3 sentences that capture the essence of how the story should end.`;

    const description = await this.llmService.generateContent(prompt, analysis);
    
    return {
      id: 'original-1',
      type: 'original',
      description: description.trim(),
      targetScore: 0 // Will be calculated based on usage
    };
  }

  private async generateOppositeEnding(analysis: NovelAnalysis, originalEnding: StoryEnding): Promise<StoryEnding> {
    const prompt = `Based on the novel analysis and original ending provided, create a story ending that is the direct opposite of the original ending.

Original ending: ${originalEnding.description}
Novel conclusion: ${analysis.conclusion}
Main characters: ${analysis.mainCharacters.map(c => c.name).join(', ')}

Generate a story ending that directly contradicts or reverses the key outcomes, themes, or character fates from the original ending. If the original is happy, make it tragic; if characters succeed, have them fail; if there's resolution, create conflict. The description should be 2-3 sentences.`;

    const description = await this.llmService.generateContent(prompt, analysis);
    
    return {
      id: 'opposite-1',
      type: 'opposite',
      description: description.trim(),
      targetScore: 0 // Will be calculated based on usage
    };
  }

  private async generateRandomEnding(analysis: NovelAnalysis, index: number): Promise<StoryEnding> {
    const prompt = `Based on the novel analysis provided, create a completely alternative story ending that takes the story in a new, unexpected direction.

Novel elements to work with:
- Main characters: ${analysis.mainCharacters.map(c => c.name).join(', ')}
- Plot points: ${analysis.plotPoints.map(p => p.description).join('; ')}
- Introduction: ${analysis.introduction}
- Climax: ${analysis.climax}

Generate a creative, unexpected story ending that uses the established characters and world but takes the narrative in a completely different direction from the original. Be imaginative and surprising while staying consistent with the characters and world. The description should be 2-3 sentences.`;

    const description = await this.llmService.generateContent(prompt, analysis);
    
    return {
      id: `random-${index}`,
      type: 'random',
      description: description.trim(),
      targetScore: 0 // Will be calculated based on usage
    };
  }

  private buildDialoguePrompt(context: GameContext, wordCount: number): string {
    const recentSegments = context.storySegments.slice(-3); // Last 3 segments for context
    const targetEndingInfo = context.targetEnding ? 
      `Target ending: ${context.targetEnding.description}` : 
      'No specific target ending set';

    // Identify the speaking character
    const speakingCharacter = context.actingCharacter;
    const speakingCharacterInfo = speakingCharacter ? 
      `${speakingCharacter.name} - ${speakingCharacter.description}` : 
      'Unknown character';

    return `Generate approximately ${wordCount} words of dialogue for the character ${speakingCharacter?.name || 'Unknown'} in this interactive story.

IMPORTANT: The dialogue MUST be spoken by ${speakingCharacter?.name || 'Unknown'} in their persona and voice. This character is taking the "talk" action.

Character speaking: ${speakingCharacterInfo}

Story Context:
- Novel: Based on analysis of ${context.novelAnalysis.mainCharacters.map(c => c.name).join(', ')}
- Current round: ${context.currentRound} of ${context.totalRounds}
- ${targetEndingInfo}

Recent story segments:
${recentSegments.map(s => s.content).join('\n\n')}

All characters in the story: ${context.novelAnalysis.mainCharacters.map(c => `${c.name} - ${c.description}`).join('; ')}

Generate dialogue that:
1. Is spoken BY ${speakingCharacter?.name || 'Unknown'} (the character taking this action)
2. Stays true to ${speakingCharacter?.name || 'Unknown'}'s personality and voice as described: "${speakingCharacter?.description || 'Unknown'}"
3. May involve other characters responding, but ${speakingCharacter?.name || 'Unknown'} should be the primary speaker
4. Advances the story toward the target ending (if set)
5. Builds on recent story events
6. Is approximately ${wordCount} words
7. Uses proper dialogue formatting with character names

Focus on ${speakingCharacter?.name || 'Unknown'}'s character development and interaction with others through their dialogue.`;
  }

  private buildNarrativePrompt(context: GameContext, wordCount: number): string {
    const recentSegments = context.storySegments.slice(-3); // Last 3 segments for context
    const targetEndingInfo = context.targetEnding ? 
      `Target ending: ${context.targetEnding.description}` : 
      'No specific target ending set';

    // Identify the acting character
    const actingCharacter = context.actingCharacter;
    const actingCharacterInfo = actingCharacter ? 
      `${actingCharacter.name} - ${actingCharacter.description}` : 
      'Unknown character';

    return `Generate approximately ${wordCount} words of narrative action for the character ${actingCharacter?.name || 'Unknown'} in this interactive story.

IMPORTANT: The action MUST be performed by ${actingCharacter?.name || 'Unknown'}. This character is taking the "act" action.

Character acting: ${actingCharacterInfo}

Story Context:
- Novel: Based on analysis of ${context.novelAnalysis.mainCharacters.map(c => c.name).join(', ')}
- Current round: ${context.currentRound} of ${context.totalRounds}
- ${targetEndingInfo}

Recent story segments:
${recentSegments.map(s => s.content).join('\n\n')}

All characters in the story: ${context.novelAnalysis.mainCharacters.map(c => `${c.name} - ${c.description}`).join('; ')}

Generate narrative that:
1. Describes action performed BY ${actingCharacter?.name || 'Unknown'} (the character taking this action)
2. Stays true to ${actingCharacter?.name || 'Unknown'}'s personality and capabilities as described: "${actingCharacter?.description || 'Unknown'}"
3. May involve other characters reacting, but ${actingCharacter?.name || 'Unknown'} should be the primary actor
4. Advances the story toward the target ending (if set)
5. Builds on recent story events
6. Is approximately ${wordCount} words
7. Uses vivid, engaging prose

Focus on ${actingCharacter?.name || 'Unknown'}'s actions and their impact on the story.`;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private selectRandomFromArray<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot select from empty array');
    }
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  }

  /**
   * Sleep utility for adding delays between API calls
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create a StoryGenerator instance
 */
export function createStoryGenerator(llmService: LLMService): StoryGenerator {
  return new DefaultStoryGenerator(llmService);
}