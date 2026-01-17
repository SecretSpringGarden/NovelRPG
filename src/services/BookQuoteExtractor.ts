import { Character } from '../models/Character';
import { StoryEnding } from '../models/StoryEnding';
import { NovelAnalysis } from '../models/GameState';
import { LLMService } from './LLMService';
import { AssistantService } from './AssistantService';

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
 * GameContext interface for providing context to quote selection
 */
export interface GameContext {
  recentSegments: Array<{ content: string; characterName?: string }>;
  currentRound: number;
  totalRounds: number;
  novelTitle: string;
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
  extractContextualQuotesForRound(characters: Character[], context: DialogueContext, targetEnding?: StoryEnding): Promise<Map<string, { dialogue: string[], actions: string[] }>>;
  expandContextForMissingCharacters(characters: Character[], context: DialogueContext, targetEnding?: StoryEnding): Promise<{ expandedContext: DialogueContext, quotesMap: Map<string, { dialogue: string[], actions: string[] }> }>; // NEW
  selectContextualQuote(quotes: string[], character: Character, gameContext: GameContext, targetEnding: StoryEnding): Promise<string | null>; // NEW
}

/**
 * DefaultBookQuoteExtractor implementation
 * Extracts authentic dialogue and actions from the source novel
 */
export class DefaultBookQuoteExtractor implements BookQuoteExtractor {
  private novelText: string;
  private novelAnalysis: NovelAnalysis;
  private llmService: LLMService;
  private assistantService: AssistantService;
  private dialogueCache: Map<string, string[]>;
  private actionCache: Map<string, string[]>;
  private quoteCache: Map<string, string | null>; // Cache for RAG-based quote extraction

  constructor(novelText: string, novelAnalysis: NovelAnalysis, llmService: LLMService, assistantService: AssistantService) {
    this.novelText = novelText;
    this.novelAnalysis = novelAnalysis;
    this.llmService = llmService;
    this.assistantService = assistantService;
    this.dialogueCache = new Map();
    this.actionCache = new Map();
    this.quoteCache = new Map();
  }

  /**
   * Extract character dialogue from the novel
   * Requirement 12.2: Use actual book quotes for talk actions
   * Requirement 12.4: Extract dialogue matching the character
   * Requirement 12.7: Handle no quotes found gracefully
   */
  async extractCharacterDialogue(
    character: Character,
    context?: DialogueContext,
    targetEnding?: StoryEnding
  ): Promise<string[]> {
    try {
      // Validate inputs
      if (!character || !character.name) {
        console.warn('⚠️  Invalid character provided to extractCharacterDialogue');
        return [];
      }
      
      // Debug: Log character name
      console.log(`   🔍 Extracting dialogue for: "${character.name}" (length: ${character.name.length})`);
      
      // Check cache first for performance
      const cacheKey = `${character.id}_${context?.startPosition || 0}_${context?.endPosition || this.novelText.length}`;
      if (this.dialogueCache.has(cacheKey)) {
        console.log(`   📦 Using cached result`);
        return this.dialogueCache.get(cacheKey)!;
      }

      // Determine the text section to search
      const searchText = context 
        ? this.novelText.substring(context.startPosition, context.endPosition)
        : this.novelText;
      
      // Validate search text is not empty
      if (!searchText || searchText.trim().length === 0) {
        console.warn(`⚠️  Empty search text for character ${character.name}`);
        return [];
      }

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

      // Extract using all patterns with error handling
      let match;
      
      // Debug: Test if character name appears in text at all
      const nameCount = (searchText.match(new RegExp(this.escapeRegex(character.name), 'gi')) || []).length;
      console.log(`   📊 Character name "${character.name}" appears ${nameCount} times in search text`);
      
      // Debug: Test if "said [name]" appears
      const saidPattern = new RegExp(`said\\s+${this.escapeRegex(character.name)}`, 'gi');
      const saidCount = (searchText.match(saidPattern) || []).length;
      console.log(`   📊 "said ${character.name}" appears ${saidCount} times`);
      
      // Debug: Show a sample of text around "said [name]"
      const saidMatch = saidPattern.exec(searchText);
      if (saidMatch) {
        const sampleStart = Math.max(0, saidMatch.index - 100);
        const sampleEnd = Math.min(searchText.length, saidMatch.index + 100);
        const sample = searchText.substring(sampleStart, sampleEnd);
        console.log(`   📝 Sample text around "said ${character.name}":`);
        console.log(`      "${sample.replace(/\n/g, ' ')}"`);
      }
      
      try {
        while ((match = pattern1.exec(searchText)) !== null) {
          const quote = match[1].trim();
          if (quote.length >= 10 && quote.length <= 200) {
            dialogueQuotes.push(quote);
          }
        }
        console.log(`   ✓ Pattern 1 found ${dialogueQuotes.length} quotes`);
      } catch (error) {
        console.warn(`⚠️  Error extracting dialogue with pattern 1 for ${character.name}:`, error);
      }

      try {
        while ((match = pattern2.exec(searchText)) !== null) {
          const quote = match[1].trim();
          if (quote.length >= 10 && quote.length <= 200) {
            dialogueQuotes.push(quote);
          }
        }
        console.log(`   ✓ Pattern 2 found ${dialogueQuotes.length} total quotes`);
      } catch (error) {
        console.warn(`⚠️  Error extracting dialogue with pattern 2 for ${character.name}:`, error);
      }

      try {
        while ((match = pattern3.exec(searchText)) !== null) {
          const quote = match[1].trim();
          if (quote.length >= 10 && quote.length <= 200) {
            dialogueQuotes.push(quote);
          }
        }
        console.log(`   ✓ Pattern 3 found ${dialogueQuotes.length} total quotes`);
      } catch (error) {
        console.warn(`⚠️  Error extracting dialogue with pattern 3 for ${character.name}:`, error);
      }

      // Remove duplicates
      const uniqueQuotes = Array.from(new Set(dialogueQuotes));

      // Cache the results
      this.dialogueCache.set(cacheKey, uniqueQuotes);
      
      // Log if no quotes found
      if (uniqueQuotes.length === 0) {
        console.log(`ℹ️  No dialogue quotes found for ${character.name} in the specified context`);
      }

      return uniqueQuotes;
    } catch (error) {
      // Requirement 12.7: Handle extraction errors gracefully
      console.error(`❌ Error extracting dialogue for ${character.name}:`, error);
      return []; // Return empty array to allow fallback to LLM
    }
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
   * Requirement 12.7: Handle no quotes found gracefully
   */
  async extractCharacterActions(
    character: Character,
    context?: DialogueContext,
    targetEnding?: StoryEnding
  ): Promise<string[]> {
    try {
      // Validate inputs
      if (!character || !character.name) {
        console.warn('⚠️  Invalid character provided to extractCharacterActions');
        return [];
      }
      
      // Check cache first for performance
      const cacheKey = `action_${character.id}_${context?.startPosition || 0}_${context?.endPosition || this.novelText.length}`;
      if (this.actionCache.has(cacheKey)) {
        return this.actionCache.get(cacheKey)!;
      }

      // Determine the text section to search
      const searchText = context 
        ? this.novelText.substring(context.startPosition, context.endPosition)
        : this.novelText;
      
      // Validate search text is not empty
      if (!searchText || searchText.trim().length === 0) {
        console.warn(`⚠️  Empty search text for character ${character.name}`);
        return [];
      }

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
      try {
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
      } catch (error) {
        console.warn(`⚠️  Error extracting actions with pattern for ${character.name}:`, error);
      }

      // Pattern: Narrative sentences containing the character's name and action
      // Split text into sentences and find those with character name + action verbs
      try {
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
      } catch (error) {
        console.warn(`⚠️  Error extracting actions from sentences for ${character.name}:`, error);
      }

      // Remove duplicates
      const uniqueQuotes = Array.from(new Set(actionQuotes));

      // Cache the results
      this.actionCache.set(cacheKey, uniqueQuotes);
      
      // Log if no quotes found
      if (uniqueQuotes.length === 0) {
        console.log(`ℹ️  No action quotes found for ${character.name} in the specified context`);
      }

      return uniqueQuotes;
    } catch (error) {
      // Requirement 12.7: Handle extraction errors gracefully
      console.error(`❌ Error extracting actions for ${character.name}:`, error);
      return []; // Return empty array to allow fallback to LLM
    }
  }

  /**
   * Find dialogue context for a given round
   * Requirement 13.1: Identify book sections based on round progression
   * Requirement 13.5: Return context with chapter/scene information
   * 
   * Enhanced to identify coherent scenes by looking for chapter boundaries
   * and scene markers, mapping rounds progressively through the novel
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
    
    // Calculate initial start and end positions
    let startPosition = Math.max(0, centerPosition - halfWindow);
    let endPosition = Math.min(novelLength, centerPosition + halfWindow);
    
    // Try to find chapter boundaries for more coherent scenes
    // Look for chapter markers near the start position
    const chapterPattern = /Chapter\s+\d+|CHAPTER\s+[IVXLCDM]+|\n\n[IVXLCDM]+\.\s/gi;
    
    // Search for chapter start before our start position (within 5000 chars)
    const searchStart = Math.max(0, startPosition - 5000);
    const beforeText = this.novelText.substring(searchStart, startPosition + 1000);
    const chapterMatches = Array.from(beforeText.matchAll(chapterPattern));
    
    if (chapterMatches.length > 0) {
      // Use the last chapter marker found before our position
      const lastChapterMatch = chapterMatches[chapterMatches.length - 1];
      const chapterStartInSearch = lastChapterMatch.index!;
      const actualChapterStart = searchStart + chapterStartInSearch;
      
      // If the chapter start is reasonably close, use it as our start position
      if (actualChapterStart >= startPosition - 3000 && actualChapterStart < startPosition + 1000) {
        startPosition = actualChapterStart;
      }
    }
    
    // Look for scene breaks (paragraph breaks, section markers)
    // Adjust to paragraph boundaries for cleaner extraction
    if (startPosition > 0) {
      // Look for double newline (paragraph break) or sentence end
      const paragraphBreak = this.novelText.indexOf('\n\n', startPosition);
      const sentenceEnd = this.novelText.indexOf('. ', startPosition);
      
      if (paragraphBreak !== -1 && paragraphBreak < startPosition + 500) {
        startPosition = paragraphBreak + 2; // Skip the newlines
      } else if (sentenceEnd !== -1 && sentenceEnd < startPosition + 500) {
        startPosition = sentenceEnd + 2; // Skip the period and space
      }
    }
    
    // Find the end of a coherent scene
    if (endPosition < novelLength) {
      // Look for chapter boundary, scene break, or paragraph break
      const nextChapterMatch = this.novelText.substring(endPosition - 1000, endPosition + 5000).match(chapterPattern);
      
      if (nextChapterMatch && nextChapterMatch.index !== undefined) {
        const nextChapterPos = endPosition - 1000 + nextChapterMatch.index;
        if (nextChapterPos > endPosition && nextChapterPos < endPosition + 3000) {
          // End before the next chapter starts
          endPosition = nextChapterPos - 1;
        }
      }
      
      // Otherwise, find paragraph or sentence boundary
      const paragraphBreak = this.novelText.lastIndexOf('\n\n', endPosition);
      const sentenceEnd = this.novelText.lastIndexOf('. ', endPosition);
      
      if (paragraphBreak !== -1 && paragraphBreak > endPosition - 500) {
        endPosition = paragraphBreak;
      } else if (sentenceEnd !== -1 && sentenceEnd > endPosition - 500) {
        endPosition = sentenceEnd + 1; // Include the period
      }
    }
    
    // Extract the context text
    const contextText = this.novelText.substring(startPosition, endPosition);
    
    // Try to identify chapter number with multiple patterns
    let chapterNumber: number | undefined;
    
    // Pattern 1: "Chapter 5" or "CHAPTER 5"
    const chapterNumMatch = contextText.match(/Chapter\s+(\d+)/i);
    if (chapterNumMatch) {
      chapterNumber = parseInt(chapterNumMatch[1], 10);
    }
    
    // Pattern 2: Roman numerals "Chapter V" or "V."
    if (!chapterNumber) {
      const romanMatch = contextText.match(/Chapter\s+([IVXLCDM]+)|^([IVXLCDM]+)\./im);
      if (romanMatch) {
        const romanNumeral = romanMatch[1] || romanMatch[2];
        chapterNumber = this.romanToInt(romanNumeral);
      }
    }
    
    // Identify which characters appear in this context
    const availableCharacters: string[] = [];
    for (const character of this.novelAnalysis.mainCharacters) {
      if (contextText.includes(character.name)) {
        availableCharacters.push(character.name);
      }
    }
    
    // Generate detailed scene description based on position and content
    let sceneDescription: string;
    if (progressPercentage < 0.2) {
      sceneDescription = 'Opening section of the novel';
    } else if (progressPercentage < 0.4) {
      sceneDescription = 'Early-middle section of the novel';
    } else if (progressPercentage < 0.6) {
      sceneDescription = 'Middle section of the novel';
    } else if (progressPercentage < 0.8) {
      sceneDescription = 'Late-middle section of the novel';
    } else {
      sceneDescription = 'Concluding section of the novel';
    }
    
    if (chapterNumber) {
      sceneDescription += ` (Chapter ${chapterNumber})`;
    }
    
    // Add character presence information
    if (availableCharacters.length > 0) {
      sceneDescription += ` - Features: ${availableCharacters.slice(0, 3).join(', ')}`;
      if (availableCharacters.length > 3) {
        sceneDescription += ` and ${availableCharacters.length - 3} more`;
      }
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
   * Helper method to convert Roman numerals to integers
   */
  private romanToInt(roman: string): number {
    const romanMap: { [key: string]: number } = {
      'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000
    };
    
    let result = 0;
    for (let i = 0; i < roman.length; i++) {
      const current = romanMap[roman[i]];
      const next = romanMap[roman[i + 1]];
      
      if (next && current < next) {
        result -= current;
      } else {
        result += current;
      }
    }
    
    return result;
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
   * Requirement 12.7: Handle LLM failures gracefully
   */
  async checkEndingCompatibility(quote: string, targetEnding: StoryEnding): Promise<CompatibilityScore> {
    try {
      // Validate inputs
      if (!quote || quote.trim().length === 0) {
        console.warn('⚠️  Empty quote provided to checkEndingCompatibility');
        return {
          score: 5,
          reasoning: 'Empty quote provided',
          shouldUse: true
        };
      }
      
      if (!targetEnding || !targetEnding.type) {
        console.warn('⚠️  Invalid target ending provided to checkEndingCompatibility');
        return {
          score: 5,
          reasoning: 'Invalid target ending',
          shouldUse: true
        };
      }
      
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

      // Set timeout for LLM call
      const timeoutMs = 15000; // 15 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LLM call timeout')), timeoutMs);
      });
      
      const llmPromise = this.llmService.generateContent(prompt, {});
      
      const response = await Promise.race([llmPromise, timeoutPromise]);
      
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
      // Requirement 12.7: Handle LLM failures gracefully
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Failed to check ending compatibility: ${errorMessage}`);
      
      // Default to neutral compatibility on error
      return {
        score: 5,
        reasoning: `Unable to assess compatibility due to error: ${errorMessage}`,
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
      
      default:
        // Unknown ending type, default to configured percentage
        console.warn(`Unknown ending type: ${targetEnding.type}, using default behavior`);
        return randomValue < quotePercentage;
    }
  }

  /**
   * Extract contextual quotes for all characters in a round from the same book section
   * Requirements 13.2, 13.3: Prefer quotes from same context for all characters in a round
   * 
   * This method attempts to extract dialogue and actions for all characters from the
   * same dialogue context (scene/chapter), ensuring conversations feel natural and
   * contextually related.
   */
  async extractContextualQuotesForRound(
    characters: Character[],
    context: DialogueContext,
    targetEnding?: StoryEnding
  ): Promise<Map<string, { dialogue: string[], actions: string[] }>> {
    const quotesMap = new Map<string, { dialogue: string[], actions: string[] }>();
    
    // Extract quotes for each character from the same context
    for (const character of characters) {
      // Only extract for characters that appear in this context
      if (context.availableCharacters.includes(character.name)) {
        const dialogue = await this.extractCharacterDialogue(character, context, targetEnding);
        const actions = await this.extractCharacterActions(character, context, targetEnding);
        
        quotesMap.set(character.id, {
          dialogue,
          actions
        });
      } else {
        // Character not in this context, return empty arrays
        quotesMap.set(character.id, {
          dialogue: [],
          actions: []
        });
      }
    }
    
    return quotesMap;
  }

  /**
   * Expand context when not all characters have quotes available
   * Requirement 13.4: When context doesn't have quotes for all characters, expand search
   * 
   * This method progressively expands the dialogue context to find quotes for
   * characters that weren't found in the initial context. If expansion fails,
   * it returns empty arrays, allowing the caller to fall back to LLM generation.
   */
  async expandContextForMissingCharacters(
    characters: Character[],
    context: DialogueContext,
    targetEnding?: StoryEnding
  ): Promise<{ expandedContext: DialogueContext, quotesMap: Map<string, { dialogue: string[], actions: string[] }> }> {
    
    // First, try to extract quotes from the original context
    let quotesMap = await this.extractContextualQuotesForRound(characters, context, targetEnding);
    
    // Check which characters are missing quotes
    const missingCharacters: Character[] = [];
    for (const character of characters) {
      const quotes = quotesMap.get(character.id);
      if (!quotes || (quotes.dialogue.length === 0 && quotes.actions.length === 0)) {
        missingCharacters.push(character);
      }
    }
    
    // If all characters have quotes, return the original context
    if (missingCharacters.length === 0) {
      return { expandedContext: context, quotesMap };
    }
    
    console.log(`⚠️  Context expansion: ${missingCharacters.length} character(s) missing quotes`);
    console.log(`   Missing: ${missingCharacters.map(c => c.name).join(', ')}`);
    
    // Try expanding the context in multiple steps
    const expansionSteps = [
      { multiplier: 1.5, description: '50% expansion' },
      { multiplier: 2.0, description: '100% expansion' },
      { multiplier: 3.0, description: '200% expansion' }
    ];
    
    let expandedContext = context;
    
    for (const step of expansionSteps) {
      // Calculate expanded window
      const originalSize = context.endPosition - context.startPosition;
      const expandedSize = Math.floor(originalSize * step.multiplier);
      const additionalSize = expandedSize - originalSize;
      const halfAdditional = Math.floor(additionalSize / 2);
      
      // Expand symmetrically around the original context
      const newStartPosition = Math.max(0, context.startPosition - halfAdditional);
      const newEndPosition = Math.min(this.novelText.length, context.endPosition + halfAdditional);
      
      // Adjust to paragraph boundaries
      let adjustedStart = newStartPosition;
      let adjustedEnd = newEndPosition;
      
      if (adjustedStart > 0) {
        const paragraphBreak = this.novelText.indexOf('\n\n', adjustedStart);
        if (paragraphBreak !== -1 && paragraphBreak < adjustedStart + 500) {
          adjustedStart = paragraphBreak + 2;
        }
      }
      
      if (adjustedEnd < this.novelText.length) {
        const paragraphBreak = this.novelText.lastIndexOf('\n\n', adjustedEnd);
        if (paragraphBreak !== -1 && paragraphBreak > adjustedEnd - 500) {
          adjustedEnd = paragraphBreak;
        }
      }
      
      // Create expanded context
      const expandedContextText = this.novelText.substring(adjustedStart, adjustedEnd);
      
      // Update available characters
      const availableCharacters: string[] = [];
      for (const character of this.novelAnalysis.mainCharacters) {
        if (expandedContextText.includes(character.name)) {
          availableCharacters.push(character.name);
        }
      }
      
      expandedContext = {
        startPosition: adjustedStart,
        endPosition: adjustedEnd,
        chapterNumber: context.chapterNumber,
        sceneDescription: `${context.sceneDescription} (expanded: ${step.description})`,
        availableCharacters
      };
      
      console.log(`   Trying ${step.description}...`);
      
      // Try to extract quotes for missing characters from expanded context
      for (const character of missingCharacters) {
        if (expandedContext.availableCharacters.includes(character.name)) {
          const dialogue = await this.extractCharacterDialogue(character, expandedContext, targetEnding);
          const actions = await this.extractCharacterActions(character, expandedContext, targetEnding);
          
          // Update quotes map if we found any quotes
          if (dialogue.length > 0 || actions.length > 0) {
            quotesMap.set(character.id, { dialogue, actions });
            console.log(`   ✅ Found quotes for ${character.name}`);
          }
        }
      }
      
      // Check if we now have quotes for all characters
      const stillMissing = characters.filter(character => {
        const quotes = quotesMap.get(character.id);
        return !quotes || (quotes.dialogue.length === 0 && quotes.actions.length === 0);
      });
      
      if (stillMissing.length === 0) {
        console.log(`   ✅ All characters now have quotes after ${step.description}`);
        return { expandedContext, quotesMap };
      }
    }
    
    // If we still have missing characters after all expansions, log it
    const finalMissing = characters.filter(character => {
      const quotes = quotesMap.get(character.id);
      return !quotes || (quotes.dialogue.length === 0 && quotes.actions.length === 0);
    });
    
    if (finalMissing.length > 0) {
      console.log(`   ⚠️  After all expansions, ${finalMissing.length} character(s) still missing quotes`);
      console.log(`   Will fall back to LLM generation for: ${finalMissing.map(c => c.name).join(', ')}`);
    }
    
    return { expandedContext, quotesMap };
  }

  /**
   * Extract a contextual quote using RAG (Assistant API) instead of regex
   * This is the NEW approach that intelligently finds quotes based on game context
   * 
   * @param character - The character who will speak/act
   * @param gameContext - Current game state context (recent story, round info)
   * @param targetEnding - The ending the story is moving toward
   * @param actionType - Whether this is dialogue ('talk') or action ('act')
   * @returns A single contextually appropriate quote, or null if none found
   */
  async extractContextualQuoteWithRAG(
    character: Character,
    gameContext: GameContext,
    targetEnding: StoryEnding,
    actionType: 'talk' | 'act'
  ): Promise<string | null> {
    try {
      // Validate inputs
      if (!character || !character.name) {
        console.warn('⚠️  Invalid character provided to extractContextualQuoteWithRAG');
        return null;
      }

      if (!gameContext) {
        console.warn('⚠️  Invalid game context provided to extractContextualQuoteWithRAG');
        return null;
      }

      // Check if assistant is available
      if (!this.novelAnalysis.assistantId) {
        console.warn('⚠️  No assistant ID available for RAG-based quote extraction');
        console.log('   Falling back to regex-based extraction');
        return null;
      }

      // Check cache first
      const cacheKey = `${character.id}_${actionType}_${gameContext.currentRound}_${targetEnding.type}`;
      if (this.quoteCache.has(cacheKey)) {
        console.log(`   📦 Using cached RAG quote for ${character.name}`);
        return this.quoteCache.get(cacheKey)!;
      }

      // Build recent story context
      const recentStory = gameContext.recentSegments
        .slice(-3)
        .map(seg => seg.content)
        .join('\n\n');

      // Build the query for the Assistant API
      const actionTypeDescription = actionType === 'talk' 
        ? 'dialogue (something the character says)'
        : 'action (something the character does, described in narrative form)';

      const query = `You have access to "${gameContext.novelTitle}" through file search. Find an appropriate quote for this situation:

Character: ${character.name}
Character Description: ${character.description}

Action Type: ${actionTypeDescription}

Current Story Progress: Round ${gameContext.currentRound} of ${gameContext.totalRounds}
Target Ending: ${targetEnding.description}

Recent Story Events:
${recentStory || 'Story is just beginning...'}

Find a quote from the novel where ${character.name} ${actionType === 'talk' ? 'speaks' : 'performs an action'} that:
1. Is authentic ${actionType === 'talk' ? 'dialogue' : 'narrative description'} from the novel
2. Fits ${character.name}'s personality and the current situation
3. Could naturally follow from the recent story events
4. Moves the story toward the target ending
5. ${actionType === 'talk' ? 'Is actual spoken dialogue by the character' : 'Describes a physical action or behavior'}

IMPORTANT: 
- Return ONLY the exact quote text from the novel, nothing else
- ${actionType === 'talk' ? 'The quote should be dialogue (words spoken by the character)' : 'The quote should be a narrative description of an action'}
- Do not add any explanation, context, or commentary
- If no appropriate quote exists, respond with exactly: "NO_QUOTE_FOUND"`;

      console.log(`   🔍 Querying Assistant API for ${actionType} quote for ${character.name}...`);

      // Query the assistant with timeout
      const timeoutMs = 20000; // 20 seconds for RAG query
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Assistant API query timeout')), timeoutMs);
      });

      const queryPromise = this.assistantService.queryAssistant(
        this.novelAnalysis.assistantId,
        query
      );

      const response = await Promise.race([queryPromise, timeoutPromise]);

      // Clean up the response
      const cleanedResponse = response.trim();

      // Check if no quote was found
      if (cleanedResponse === 'NO_QUOTE_FOUND' || cleanedResponse.length === 0) {
        console.log(`   ℹ️  No appropriate quote found by RAG for ${character.name}`);
        this.quoteCache.set(cacheKey, null);
        return null;
      }

      // Remove any quotes or formatting that might have been added
      let quote = cleanedResponse;
      
      // Remove surrounding quotes if present
      if ((quote.startsWith('"') && quote.endsWith('"')) || 
          (quote.startsWith("'") && quote.endsWith("'"))) {
        quote = quote.slice(1, -1);
      }

      // Validate quote length (should be reasonable)
      if (quote.length < 10 || quote.length > 300) {
        console.warn(`⚠️  Quote length unusual (${quote.length} chars), may not be valid`);
        this.quoteCache.set(cacheKey, null);
        return null;
      }

      console.log(`   ✅ Found ${actionType} quote via RAG for ${character.name}`);
      console.log(`      "${quote.substring(0, 60)}${quote.length > 60 ? '...' : ''}"`);

      // Cache the result
      this.quoteCache.set(cacheKey, quote);

      return quote;
    } catch (error) {
      // Handle errors gracefully
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Failed to extract quote via RAG: ${errorMessage}`);
      console.log(`   Will fall back to LLM generation`);
      
      // Cache the failure to avoid repeated attempts
      const cacheKey = `${character.id}_${actionType}_${gameContext.currentRound}_${targetEnding.type}`;
      this.quoteCache.set(cacheKey, null);
      
      return null;
    }
  }

  /**
   * Select the most contextually appropriate quote from a list of candidates
   * Uses LLM to intelligently choose a quote that moves the story forward
   * 
   * @param quotes - Array of candidate quotes extracted from the novel
   * @param character - The character who will speak/act
   * @param gameContext - Current game state context (recent story, round info)
   * @param targetEnding - The ending the story is moving toward
   * @returns The selected quote, or null if no appropriate quote found
   */
  async selectContextualQuote(
    quotes: string[],
    character: Character,
    gameContext: GameContext,
    targetEnding: StoryEnding
  ): Promise<string | null> {
    try {
      // Validate inputs
      if (!quotes || quotes.length === 0) {
        console.log(`ℹ️  No quotes provided for selection`);
        return null;
      }

      if (quotes.length === 1) {
        // Only one quote available, return it directly
        return quotes[0];
      }

      if (!character || !character.name) {
        console.warn('⚠️  Invalid character provided to selectContextualQuote');
        return null;
      }

      if (!gameContext) {
        console.warn('⚠️  Invalid game context provided to selectContextualQuote');
        return null;
      }

      // Build recent story context
      const recentStory = gameContext.recentSegments
        .slice(-3)
        .map(seg => seg.content)
        .join('\n\n');

      // Build prompt for LLM to select the best quote
      const prompt = `You are helping to select the most appropriate quote from "${gameContext.novelTitle}" for the current story situation.

Character: ${character.name}
Description: ${character.description}

Current Round: ${gameContext.currentRound} of ${gameContext.totalRounds}
Target Ending: ${targetEnding.description}

Recent Story:
${recentStory || 'Story is just beginning...'}

Available Quotes (numbered):
${quotes.map((quote, index) => `${index + 1}. "${quote}"`).join('\n\n')}

Analyze each quote and select the ONE that:
1. Best fits ${character.name}'s personality and voice
2. Naturally follows from the recent story events
3. Moves the story forward toward the target ending
4. Feels like a logical next step in the narrative
5. Creates interesting story progression

Consider:
- Does the quote's tone match the current story mood?
- Does it respond to or build on what just happened?
- Does it advance the plot toward the target ending?
- Would it feel natural for ${character.name} to say/do this now?

Respond with ONLY valid JSON in this exact format:
{
  "selectedIndex": <number 1-${quotes.length}>,
  "reasoning": "<brief explanation of why this quote is best>"
}`;

      // Set timeout for LLM call
      const timeoutMs = 15000; // 15 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LLM call timeout')), timeoutMs);
      });

      const llmPromise = this.llmService.generateContent(prompt, {});
      const response = await Promise.race([llmPromise, timeoutPromise]);

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
      if (typeof result.selectedIndex !== 'number' || result.selectedIndex < 1 || result.selectedIndex > quotes.length) {
        throw new Error(`Invalid selectedIndex in response: ${result.selectedIndex}`);
      }

      if (typeof result.reasoning !== 'string') {
        throw new Error('Invalid reasoning in response');
      }

      // Convert 1-based index to 0-based
      const selectedQuote = quotes[result.selectedIndex - 1];
      
      console.log(`✅ Selected quote ${result.selectedIndex}/${quotes.length} for ${character.name}`);
      console.log(`   Reasoning: ${result.reasoning}`);

      return selectedQuote;
    } catch (error) {
      // Handle LLM failures gracefully
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Failed to select contextual quote: ${errorMessage}`);
      console.log(`   Falling back to first available quote`);
      
      // Default to first quote on error
      return quotes.length > 0 ? quotes[0] : null;
    }
  }
}

/**
 * Factory function to create a BookQuoteExtractor instance
 */
export function createBookQuoteExtractor(
  novelText: string,
  novelAnalysis: NovelAnalysis,
  llmService: LLMService,
  assistantService: AssistantService
): BookQuoteExtractor {
  return new DefaultBookQuoteExtractor(novelText, novelAnalysis, llmService, assistantService);
}
