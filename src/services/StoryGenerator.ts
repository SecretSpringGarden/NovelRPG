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
   * Generates exactly 8 story endings with the required distribution:
   * - 1 original ending (matches novel's conclusion)
   * - 3 similar endings (80% similar to original)
   * - 1 opposite ending (direct opposite of original)
   * - 3 random alternative endings
   */
  async generateEndings(analysis: NovelAnalysis): Promise<StoryEnding[]> {
    const endings: StoryEnding[] = [];

    try {
      // Generate original ending (matches novel's conclusion)
      console.log('🎯 Generating original ending...');
      const originalEnding = await this.generateOriginalEnding(analysis);
      endings.push(originalEnding);

      // Generate 3 similar endings (80% similar to original)
      for (let i = 0; i < 3; i++) {
        console.log(`🔄 Generating similar ending ${i + 1}/3...`);
        const similarEnding = await this.generateSimilarEnding(analysis, originalEnding, i + 1);
        endings.push(similarEnding);
      }

      // Generate opposite ending (direct opposite of original)
      console.log('🔄 Generating opposite ending...');
      const oppositeEnding = await this.generateOppositeEnding(analysis, originalEnding);
      endings.push(oppositeEnding);

      // Generate 3 random alternative endings
      for (let i = 0; i < 3; i++) {
        console.log(`🎲 Generating random ending ${i + 1}/3...`);
        const randomEnding = await this.generateRandomEnding(analysis, i + 1);
        endings.push(randomEnding);
      }

      // Validate the generated endings
      if (!this.validateEndingGeneration(endings)) {
        throw new Error('Generated endings do not meet required distribution or validation criteria');
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
   * Selects which of the 8 endings to target based on current game state and player action
   */
  selectTargetEnding(currentState: GameState, playerAction: PlayerAction): StoryEnding {
    if (this.generatedEndings.length === 0) {
      throw new Error('No endings have been generated yet');
    }

    // Simple targeting logic based on game progression and action type
    const progressRatio = currentState.currentRound / currentState.totalRounds;
    
    // Early game (first third) - lean toward original or similar endings
    if (progressRatio < 0.33) {
      const conservativeEndings = this.generatedEndings.filter(e => 
        e.type === 'original' || e.type === 'similar'
      );
      return this.selectRandomFromArray(conservativeEndings);
    }
    
    // Mid game (middle third) - any ending is possible
    if (progressRatio < 0.66) {
      return this.selectRandomFromArray(this.generatedEndings);
    }
    
    // Late game (final third) - weight selection based on action type
    if (playerAction.type === 'talk') {
      // Talking actions lean toward original or similar endings
      const talkEndings = this.generatedEndings.filter(e => 
        e.type === 'original' || e.type === 'similar'
      );
      return this.selectRandomFromArray(talkEndings);
    } else if (playerAction.type === 'act') {
      // Acting actions can lead to any ending, including dramatic ones
      return this.selectRandomFromArray(this.generatedEndings);
    } else {
      // "Nothing" actions lean toward random or opposite endings
      const passiveEndings = this.generatedEndings.filter(e => 
        e.type === 'random' || e.type === 'opposite'
      );
      return this.selectRandomFromArray(passiveEndings);
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

  private async generateSimilarEnding(analysis: NovelAnalysis, originalEnding: StoryEnding, index: number): Promise<StoryEnding> {
    const prompt = `Based on the novel analysis and original ending provided, create a story ending that is approximately 80% similar to the original but with some variation.

Original ending: ${originalEnding.description}
Novel conclusion: ${analysis.conclusion}
Main characters: ${analysis.mainCharacters.map(c => c.name).join(', ')}

Generate a story ending that maintains the core elements and tone of the original but introduces minor variations in details, character outcomes, or specific events. The ending should feel like a natural alternative to the original. The description should be 2-3 sentences.`;

    const description = await this.llmService.generateContent(prompt, analysis);
    
    return {
      id: `similar-${index}`,
      type: 'similar',
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

    return `Generate approximately ${wordCount} words of dialogue between characters in this interactive story.

Story Context:
- Novel: Based on analysis of ${context.novelAnalysis.mainCharacters.map(c => c.name).join(', ')}
- Current round: ${context.currentRound} of ${context.totalRounds}
- ${targetEndingInfo}

Recent story segments:
${recentSegments.map(s => s.content).join('\n\n')}

Characters available: ${context.novelAnalysis.mainCharacters.map(c => `${c.name} - ${c.description}`).join('; ')}

Generate dialogue that:
1. Advances the story toward the target ending (if set)
2. Feels natural for these characters
3. Builds on recent story events
4. Is approximately ${wordCount} words
5. Uses proper dialogue formatting with character names

Focus on character interaction and development through conversation.`;
  }

  private buildNarrativePrompt(context: GameContext, wordCount: number): string {
    const recentSegments = context.storySegments.slice(-3); // Last 3 segments for context
    const targetEndingInfo = context.targetEnding ? 
      `Target ending: ${context.targetEnding.description}` : 
      'No specific target ending set';

    return `Generate approximately ${wordCount} words of narrative action for this interactive story.

Story Context:
- Novel: Based on analysis of ${context.novelAnalysis.mainCharacters.map(c => c.name).join(', ')}
- Current round: ${context.currentRound} of ${context.totalRounds}
- ${targetEndingInfo}

Recent story segments:
${recentSegments.map(s => s.content).join('\n\n')}

Characters available: ${context.novelAnalysis.mainCharacters.map(c => `${c.name} - ${c.description}`).join('; ')}

Generate narrative that:
1. Describes action, events, or developments
2. Advances the story toward the target ending (if set)
3. Builds on recent story events
4. Is approximately ${wordCount} words
5. Uses vivid, engaging prose

Focus on plot advancement and dramatic action rather than dialogue.`;
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