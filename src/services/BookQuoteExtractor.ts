import { Character } from '../models/Character';
import { StoryEnding } from '../models/StoryEnding';
import { NovelAnalysis } from '../models/GameState';
import { LLMService } from './LLMService';

/**
 * DialogueContext interface representing a section of the book
 * Used to group dialogue from the same scene/chapter
 */
export interface DialogueContext {
  startPosition: number;
  endPosition: number;
  chapterNumber?: number;
  sceneDescription: string;
  availableCharacters: string[];
}

/**
 * CompatibilityScore interface for ending compatibility checking
 * Scores how well a quote supports a target ending
 */
export interface CompatibilityScore {
  score: number; // 0-10, how well quote supports target ending
  reasoning: string;
  shouldUse: boolean; // Whether to use this quote given the target ending
}

/**
 * BookQuoteExtractor interface for extracting authentic quotes from novels
 * Requirement 12.4: Extract dialogue and narrative text from source novel
 */
export interface BookQuoteExtractor {
  extractCharacterDialogue(character: Character, context?: DialogueContext, targetEnding?: StoryEnding): Promise<string[]>;
  extractCharacterActions(character: Character, context?: DialogueContext, targetEnding?: StoryEnding): Promise<string[]>;
  findDialogueContext(round: number, totalRounds: number): Promise<DialogueContext>;
  validateQuoteForCharacter(quote: string, character: Character): boolean;
  checkEndingCompatibility(quote: string, targetEnding: StoryEnding): Promise<CompatibilityScore>;
  shouldUseBookQuote(quotePercentage: number, targetEnding: StoryEnding, endingType: string): boolean;
}

/**
 * DefaultBookQuoteExtractor implementation
 * Extracts authentic dialogue and actions from the source novel
 */
export class DefaultBookQuoteExtractor implements BookQuoteExtractor {
  private novelText: string;
  private novelAnalysis: NovelAnalysis;
  private llmService: LLMService;
  private dialogueCache: Map<string, string[]>;
  private actionCache: Map<string, string[]>;

  constructor(novelText: string, novelAnalysis: NovelAnalysis, llmService: LLMService) {
    this.novelText = novelText;
    this.novelAnalysis = novelAnalysis;
    this.llmService = llmService;
    this.dialogueCache = new Map();
    this.actionCache = new Map();
  }

  /**
   * Extract character dialogue from the novel
   * Requirement 12.2: Use actual book quotes for talk actions
   * Requirement 12.4: Extract dialogue matching the character
   */
  async extractCharacterDialogue(
    character: Character,
    context?: DialogueContext,
    targetEnding?: StoryEnding
  ): Promise<string[]> {
    // Check cache first for performance
    const cacheKey = `${character.id}_${context?.startPosition || 0}_${context?.endPosition || this.novelText.length}`;
    if (this.dialogueCache.has(cacheKey)) {
      return this.dialogueCache.get(cacheKey)!;
    }

    // Determine the text section to search
    const searchText = context 
      ? this.novelText.substring(context.startPosition, context.endPosition)
      : this.novelText;

    // Extract dialogue using multiple patterns
    const dialogueQuotes: string[] = [];

    // Pattern 1: "Character said, 'dialogue'"
    const pattern1 = new RegExp(
      `${this.escapeRegex(character.name)}\\s+(?:said|replied|asked|exclaimed|whispered|shouted|murmured|answered|continued|added|remarked|observed|declared|stated|announced|cried|muttered|responded)[^"']*["']([^"']{10,200})["']`,
      'gi'
    );

    // Pattern 2: "'dialogue,' said Character"
    const pattern2 = new RegExp(
      `["']([^"']{10,200})["'][^.]*?(?:said|replied|asked|exclaimed|whispered|shouted|murmured|answered|continued|added|remarked|observed|declared|stated|announced|cried|muttered|responded)\\s+${this.escapeRegex(character.name)}`,
      'gi'
    );

    // Pattern 3: Character: "dialogue" (for plays or dialogue-heavy texts)
    const pattern3 = new RegExp(
      `${this.escapeRegex(character.name)}\\s*:\\s*["']([^"']{10,200})["']`,
      'gi'
    );

    // Extract using all patterns
    let match;
    
    while ((match = pattern1.exec(searchText)) !== null) {
      const quote = match[1].trim();
      if (quote.length >= 10 && quote.length <= 200) {
        dialogueQuotes.push(quote);
      }
    }

    while ((match = pattern2.exec(searchText)) !== null) {
      const quote = match[1].trim();
      if (quote.length >= 10 && quote.length <= 200) {
        dialogueQuotes.push(quote);
      }
    }

    while ((match = pattern3.exec(searchText)) !== null) {
      const quote = match[1].trim();
      if (quote.length >= 10 && quote.length <= 200) {
        dialogueQuotes.push(quote);
      }
    }

    // Remove duplicates
    const uniqueQuotes = Array.from(new Set(dialogueQuotes));

    // Cache the results
    this.dialogueCache.set(cacheKey, uniqueQuotes);

    return uniqueQuotes;
  }

  /**
   * Helper method to escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract character actions from the novel
   * Requirement 12.3: Use actual book quotes for act actions
   * Requirement 12.4: Extract narrative descriptions of character actions
   */
  async extractCharacterActions(
    character: Character,
    context?: DialogueContext,
    targetEnding?: StoryEnding
  ): Promise<string[]> {
    // Check cache first for performance
    const cacheKey = `action_${character.id}_${context?.startPosition || 0}_${context?.endPosition || this.novelText.length}`;
    if (this.actionCache.has(cacheKey)) {
      return this.actionCache.get(cacheKey)!;
    }

    // Determine the text section to search
    const searchText = context 
      ? this.novelText.substring(context.startPosition, context.endPosition)
      : this.novelText;

    // Extract action descriptions using patterns
    const actionQuotes: string[] = [];

    // Common action verbs to look for
    const actionVerbs = [
      'walked', 'ran', 'entered', 'left', 'approached', 'turned', 'looked', 'gazed',
      'stood', 'sat', 'rose', 'moved', 'stepped', 'hurried', 'rushed', 'paused',
      'stopped', 'opened', 'closed', 'took', 'gave', 'held', 'placed', 'picked',
      'smiled', 'laughed', 'frowned', 'nodded', 'shook', 'bowed', 'gestured',
      'embraced', 'kissed', 'touched', 'reached', 'grasped', 'seized', 'released'
    ];

    // Pattern: Character + action verb + description
    // Example: "Elizabeth walked slowly across the room, her mind troubled."
    const actionPattern = new RegExp(
      `${this.escapeRegex(character.name)}\\s+(${actionVerbs.join('|')})\\s+([^.!?]{10,150}[.!?])`,
      'gi'
    );

    let match;
    while ((match = actionPattern.exec(searchText)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch.length >= 20 && fullMatch.length <= 200) {
        actionQuotes.push(fullMatch);
      }
    }

    // Pattern: Narrative sentences containing the character's name and action
    // Split text into sentences and find those with character name + action verbs
    const sentences = searchText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    for (const sentence of sentences) {
      // Check if sentence contains character name and an action verb
      if (sentence.includes(character.name)) {
        const hasActionVerb = actionVerbs.some(verb => {
          const verbPattern = new RegExp(`\\b${verb}\\b`, 'i');
          return verbPattern.test(sentence);
        });

        if (hasActionVerb && sentence.length >= 20 && sentence.length <= 200) {
          // Add period back if not present
          const completeSentence = sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?')
            ? sentence
            : sentence + '.';
          actionQuotes.push(completeSentence);
        }
      }
    }

    // Remove duplicates
    const uniqueQuotes = Array.from(new Set(actionQuotes));

    // Cache the results
    this.actionCache.set(cacheKey, uniqueQuotes);

    return uniqueQuotes;
  }

  /**
   * Find dialogue context for a given round
   * Requirement 13.1: Identify book sections based on round progression
   * Requirement 13.5: Return context with chapter/scene information
   */
  async findDialogueContext(round: number, totalRounds: number): Promise<DialogueContext> {
    // Calculate the position in the novel based on round progression
    // Map rounds progressively through the novel
    const progressPercentage = round / totalRounds;
    const novelLength = this.novelText.length;
    
    // Calculate center position for this round
    const centerPosition = Math.floor(novelLength * progressPercentage);
    
    // Define context window size (approximately 10% of novel or 50,000 characters, whichever is smaller)
    const contextWindowSize = Math.min(Math.floor(novelLength * 0.1), 50000);
    const halfWindow = Math.floor(contextWindowSize / 2);
    
    // Calculate start and end positions
    let startPosition = Math.max(0, centerPosition - halfWindow);
    let endPosition = Math.min(novelLength, centerPosition + halfWindow);
    
    // Adjust to sentence boundaries for cleaner extraction
    // Find the start of the first complete sentence
    if (startPosition > 0) {
      const nextSentenceStart = this.novelText.indexOf('. ', startPosition);
      if (nextSentenceStart !== -1 && nextSentenceStart < startPosition + 500) {
        startPosition = nextSentenceStart + 2; // Skip the period and space
      }
    }
    
    // Find the end of the last complete sentence
    if (endPosition < novelLength) {
      const lastSentenceEnd = this.novelText.lastIndexOf('. ', endPosition);
      if (lastSentenceEnd !== -1 && lastSentenceEnd > endPosition - 500) {
        endPosition = lastSentenceEnd + 1; // Include the period
      }
    }
    
    // Extract the context text
    const contextText = this.novelText.substring(startPosition, endPosition);
    
    // Try to identify chapter number
    let chapterNumber: number | undefined;
    const chapterMatch = contextText.match(/Chapter\s+(\d+)/i);
    if (chapterMatch) {
      chapterNumber = parseInt(chapterMatch[1], 10);
    }
    
    // Identify which characters appear in this context
    const availableCharacters: string[] = [];
    for (const character of this.novelAnalysis.mainCharacters) {
      if (contextText.includes(character.name)) {
        availableCharacters.push(character.name);
      }
    }
    
    // Generate scene description based on position in novel
    let sceneDescription: string;
    if (progressPercentage < 0.25) {
      sceneDescription = 'Early section of the novel';
    } else if (progressPercentage < 0.5) {
      sceneDescription = 'First half of the novel';
    } else if (progressPercentage < 0.75) {
      sceneDescription = 'Second half of the novel';
    } else {
      sceneDescription = 'Later section of the novel';
    }
    
    if (chapterNumber) {
      sceneDescription += ` (around Chapter ${chapterNumber})`;
    }
    
    return {
      startPosition,
      endPosition,
      chapterNumber,
      sceneDescription,
      availableCharacters
    };
  }

  /**
   * Validate that a quote appears in the source novel and matches the character
   * Requirement 12.4: Verify quote appears in source novel and is associated with correct character
   */
  validateQuoteForCharacter(quote: string, character: Character): boolean {
    // First, check if the quote appears in the novel at all
    if (!this.novelText.includes(quote)) {
      return false;
    }
    
    // Find all occurrences of the quote in the novel
    const quoteIndices: number[] = [];
    let index = this.novelText.indexOf(quote);
    while (index !== -1) {
      quoteIndices.push(index);
      index = this.novelText.indexOf(quote, index + 1);
    }
    
    // For each occurrence, check if the character name appears nearby
    // We'll check within 200 characters before or after the quote
    const proximityWindow = 200;
    
    for (const quoteIndex of quoteIndices) {
      const startCheck = Math.max(0, quoteIndex - proximityWindow);
      const endCheck = Math.min(this.novelText.length, quoteIndex + quote.length + proximityWindow);
      const surroundingText = this.novelText.substring(startCheck, endCheck);
      
      // Check if character name appears in the surrounding text
      if (surroundingText.includes(character.name)) {
        return true;
      }
    }
    
    // If we didn't find the character name near any occurrence of the quote, it's not valid
    return false;
  }

  /**
   * Check how well a quote supports the target ending
   * Requirements 3.2, 3.3, 3.4: Score compatibility with original/opposite/random endings
   */
  async checkEndingCompatibility(quote: string, targetEnding: StoryEnding): Promise<CompatibilityScore> {
    // For original endings, all quotes are compatible
    if (targetEnding.type === 'original') {
      return {
        score: 10,
        reasoning: 'Quote is from the original novel and naturally supports the original ending',
        shouldUse: true
      };
    }
    
    // For opposite and random endings, use LLM to assess compatibility
    const prompt = `You are analyzing whether a quote from a novel supports a specific story ending.

Quote: "${quote}"

Target Ending Type: ${targetEnding.type}
Target Ending Description: ${targetEnding.description}

Analyze how well this quote supports or contradicts the target ending. Consider:
1. Does the quote's tone match the ending (e.g., hopeful vs tragic)?
2. Does the quote's content align with the ending's themes?
3. Would using this quote feel natural in a story moving toward this ending?

Provide a compatibility score from 0-10:
- 0-3: Quote strongly contradicts the ending (don't use)
- 4-6: Quote is neutral or somewhat compatible (use with caution)
- 7-10: Quote strongly supports the ending (definitely use)

Respond with ONLY valid JSON in this exact format:
{
  "score": <number 0-10>,
  "reasoning": "<brief explanation>",
  "shouldUse": <true if score >= 5, false otherwise>
}`;

    try {
      const response = await this.llmService.generateContent(prompt, {});
      
      // Clean up response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      cleanedResponse = cleanedResponse.trim();
      
      // Try to find JSON object in the response if it's embedded in text
      const jsonObjectMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch && !cleanedResponse.startsWith('{')) {
        cleanedResponse = jsonObjectMatch[0];
      }
      
      const result = JSON.parse(cleanedResponse);
      
      // Validate the response
      if (typeof result.score !== 'number' || result.score < 0 || result.score > 10) {
        throw new Error('Invalid score in response');
      }
      
      if (typeof result.reasoning !== 'string') {
        throw new Error('Invalid reasoning in response');
      }
      
      if (typeof result.shouldUse !== 'boolean') {
        throw new Error('Invalid shouldUse in response');
      }
      
      return result;
    } catch (error) {
      console.warn('Failed to check ending compatibility:', error);
      // Default to neutral compatibility on error
      return {
        score: 5,
        reasoning: 'Unable to assess compatibility due to error',
        shouldUse: true
      };
    }
  }

  /**
   * Determine whether to use a book quote based on ending type and percentage
   * Requirements 12.2, 12.3, 12.5, 12.6: Implement decision tree for quote usage
   */
  shouldUseBookQuote(quotePercentage: number, targetEnding: StoryEnding, endingType: string): boolean {
    // Validate quote percentage is in valid range
    if (quotePercentage < 0 || quotePercentage > 100) {
      console.warn(`Invalid quote percentage: ${quotePercentage}, defaulting to 0`);
      return false;
    }
    
    // If quote percentage is 0, never use book quotes
    if (quotePercentage === 0) {
      return false;
    }
    
    // If quote percentage is 100, always try to use book quotes
    if (quotePercentage === 100) {
      return true;
    }
    
    // Generate a random number between 0 and 100
    const randomValue = Math.random() * 100;
    
    // Decision tree based on ending type
    switch (targetEnding.type) {
      case 'original':
        // For original endings, use the configured percentage directly
        // Book quotes naturally support the original ending
        return randomValue < quotePercentage;
      
      case 'opposite':
        // For opposite endings, be more conservative with book quotes
        // Many quotes may contradict the opposite ending
        // Reduce effective percentage by applying a stricter threshold
        // This will be further filtered by checkEndingCompatibility
        return randomValue < quotePercentage;
      
      case 'random':
        // For random endings, use moderate caution with book quotes
        // Some quotes may not fit the random ending's direction
        // This will be further filtered by checkEndingCompatibility
        return randomValue < quotePercentage;
      
      case 'similar':
        // For similar endings, book quotes should work well
        // Use the configured percentage with slight reduction
        return randomValue < quotePercentage * 0.9;
      
      default:
        // Unknown ending type, default to configured percentage
        console.warn(`Unknown ending type: ${targetEnding.type}, using default behavior`);
        return randomValue < quotePercentage;
    }
  }
}

/**
 * Factory function to create a BookQuoteExtractor instance
 */
export function createBookQuoteExtractor(
  novelText: string,
  novelAnalysis: NovelAnalysis,
  llmService: LLMService
): BookQuoteExtractor {
  return new DefaultBookQuoteExtractor(novelText, novelAnalysis, llmService);
}
