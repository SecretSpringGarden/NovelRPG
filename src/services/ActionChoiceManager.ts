import { Player } from '../models/Player';
import { GameState, StorySegment, BookQuoteMetadata } from '../models/GameState';
import { StoryEnding } from '../models/StoryEnding';
import { Character } from '../models/Character';

/**
 * ActionOptions interface representing the three choices available to a player
 * Requirement 11.1: Generate both talk and act options
 */
export interface ActionOptions {
  talkOption: string;
  actOption: string;
  doNothingOption: string;
}

/**
 * PlayerChoice interface representing a player's selection
 * Requirement 11.4: Record selected action with content source
 */
export interface PlayerChoice {
  selectedAction: 'talk' | 'act' | 'nothing';
  selectedContent: string;
  timestamp: Date;
  contentSource: 'book_quote' | 'llm_generated';
  bookQuoteMetadata?: BookQuoteMetadata;
}

/**
 * GameContext interface for providing context to action generation
 */
export interface GameContext {
  gameState: GameState;
  actingPlayer: Player;
  recentSegments: StorySegment[];
}

/**
 * ActionChoiceManager interface for managing player action choices
 * Requirements 11.1, 11.2, 11.3, 11.4, 11.5
 */
export interface ActionChoiceManager {
  generateActionOptions(player: Player, gameContext: GameContext): Promise<ActionOptions>;
  presentOptionsToPlayer(player: Player, options: ActionOptions): Promise<PlayerChoice>;
  applyPlayerChoice(choice: PlayerChoice, gameContext: GameContext): Promise<StorySegment>;
}

/**
 * DefaultActionChoiceManager implementation
 * Generates action options using LLM and book quotes
 */
export class DefaultActionChoiceManager implements ActionChoiceManager {
  private llmService: any; // LLMService
  private bookQuoteExtractor: any; // BookQuoteExtractor
  private novelText: string;

  constructor(llmService: any, bookQuoteExtractor: any, novelText: string) {
    this.llmService = llmService;
    this.bookQuoteExtractor = bookQuoteExtractor;
    this.novelText = novelText;
  }

  /**
   * Generate action options for a player's turn
   * Requirements 11.1, 11.3: Generate both talk and act options
   * Requirements 12.2, 12.3: Apply book quote percentage and ending compatibility
   */
  async generateActionOptions(player: Player, gameContext: GameContext): Promise<ActionOptions> {
    const { gameState, recentSegments } = gameContext;
    const character = player.character;

    if (!character) {
      throw new Error('Player must have an assigned character to generate action options');
    }

    // Determine if we should use book quotes based on configuration
    const shouldUseQuotes = gameState.quotePercentage > 0 && gameState.targetEnding;
    
    let talkOption: string;
    let actOption: string;

    // Generate talk option
    if (shouldUseQuotes && gameState.targetEnding) {
      // Try to use book quote for talk option
      const useBookQuote = this.bookQuoteExtractor.shouldUseBookQuote(
        gameState.quotePercentage,
        gameState.targetEnding,
        gameState.targetEnding.type
      );

      if (useBookQuote) {
        // Find dialogue context for current round
        const dialogueContext = await this.bookQuoteExtractor.findDialogueContext(
          gameState.currentRound,
          gameState.totalRounds
        );

        // Extract character dialogue
        const dialogueQuotes = await this.bookQuoteExtractor.extractCharacterDialogue(
          character,
          dialogueContext,
          gameState.targetEnding
        );

        if (dialogueQuotes.length > 0) {
          // Check ending compatibility for the first quote
          const compatibilityScore = await this.bookQuoteExtractor.checkEndingCompatibility(
            dialogueQuotes[0],
            gameState.targetEnding
          );

          if (compatibilityScore.shouldUse) {
            talkOption = `[Book Quote - ${dialogueContext.sceneDescription}]\n"${dialogueQuotes[0]}"`;
          } else {
            // Fallback to LLM if quote doesn't support ending
            talkOption = await this.generateLLMTalkOption(character, gameState, recentSegments);
            gameState.quoteUsageStats.endingCompatibilityAdjustments++;
          }
        } else {
          // Fallback to LLM if no quotes found
          talkOption = await this.generateLLMTalkOption(character, gameState, recentSegments);
        }
      } else {
        // Use LLM based on percentage
        talkOption = await this.generateLLMTalkOption(character, gameState, recentSegments);
      }
    } else {
      // No book quotes configured, use LLM
      talkOption = await this.generateLLMTalkOption(character, gameState, recentSegments);
    }

    // Generate act option
    if (shouldUseQuotes && gameState.targetEnding) {
      // Try to use book quote for act option
      const useBookQuote = this.bookQuoteExtractor.shouldUseBookQuote(
        gameState.quotePercentage,
        gameState.targetEnding,
        gameState.targetEnding.type
      );

      if (useBookQuote) {
        // Find dialogue context for current round
        const dialogueContext = await this.bookQuoteExtractor.findDialogueContext(
          gameState.currentRound,
          gameState.totalRounds
        );

        // Extract character actions
        const actionQuotes = await this.bookQuoteExtractor.extractCharacterActions(
          character,
          dialogueContext,
          gameState.targetEnding
        );

        if (actionQuotes.length > 0) {
          // Check ending compatibility for the first quote
          const compatibilityScore = await this.bookQuoteExtractor.checkEndingCompatibility(
            actionQuotes[0],
            gameState.targetEnding
          );

          if (compatibilityScore.shouldUse) {
            actOption = `[Book Quote - ${dialogueContext.sceneDescription}]\n${actionQuotes[0]}`;
          } else {
            // Fallback to LLM if quote doesn't support ending
            actOption = await this.generateLLMActOption(character, gameState, recentSegments);
            gameState.quoteUsageStats.endingCompatibilityAdjustments++;
          }
        } else {
          // Fallback to LLM if no quotes found
          actOption = await this.generateLLMActOption(character, gameState, recentSegments);
        }
      } else {
        // Use LLM based on percentage
        actOption = await this.generateLLMActOption(character, gameState, recentSegments);
      }
    } else {
      // No book quotes configured, use LLM
      actOption = await this.generateLLMActOption(character, gameState, recentSegments);
    }

    const doNothingOption = 'Do nothing (increases total rounds by 1)';

    return {
      talkOption,
      actOption,
      doNothingOption
    };
  }

  /**
   * Generate a talk option using LLM
   */
  private async generateLLMTalkOption(
    character: Character,
    gameState: GameState,
    recentSegments: StorySegment[]
  ): Promise<string> {
    const recentStory = recentSegments
      .slice(-3)
      .map(seg => seg.content)
      .join('\n\n');

    const prompt = `You are generating dialogue for ${character.name} in a story based on "${gameState.metadata.novelTitle}".

Character: ${character.name}
Description: ${character.description}

Current Round: ${gameState.currentRound} of ${gameState.totalRounds}
Target Ending: ${gameState.targetEnding?.description || 'Not yet determined'}

Recent Story:
${recentStory || 'Story is just beginning...'}

Generate a single line of dialogue (1-2 sentences, 20-50 words) that ${character.name} might say in this situation. The dialogue should:
1. Be in character and match their personality
2. Move the story toward the target ending
3. Be engaging and natural
4. Be enclosed in quotation marks

Respond with ONLY the dialogue, nothing else.`;

    const response = await this.llmService.generateContent(prompt, {});
    
    // Clean up response - remove extra quotes if present
    let dialogue = response.trim();
    if (dialogue.startsWith('"') && dialogue.endsWith('"')) {
      dialogue = dialogue.slice(1, -1);
    }
    
    return `[LLM Generated]\n"${dialogue}"`;
  }

  /**
   * Generate an act option using LLM
   */
  private async generateLLMActOption(
    character: Character,
    gameState: GameState,
    recentSegments: StorySegment[]
  ): Promise<string> {
    const recentStory = recentSegments
      .slice(-3)
      .map(seg => seg.content)
      .join('\n\n');

    const prompt = `You are generating a narrative action for ${character.name} in a story based on "${gameState.metadata.novelTitle}".

Character: ${character.name}
Description: ${character.description}

Current Round: ${gameState.currentRound} of ${gameState.totalRounds}
Target Ending: ${gameState.targetEnding?.description || 'Not yet determined'}

Recent Story:
${recentStory || 'Story is just beginning...'}

Generate a brief narrative description (1-2 sentences, 20-50 words) of an action that ${character.name} might take in this situation. The action should:
1. Be in character and match their personality
2. Move the story toward the target ending
3. Be engaging and descriptive
4. Be written in third person

Respond with ONLY the action description, nothing else.`;

    const response = await this.llmService.generateContent(prompt, {});
    
    return `[LLM Generated]\n${response.trim()}`;
  }

  /**
   * Present options to player and get their choice
   * Requirement 11.2: For human players, display options and wait for input
   * Requirement 11.3: For computer players, randomly select from three options
   * Requirement 11.5: Computer players use random selection
   */
  async presentOptionsToPlayer(player: Player, options: ActionOptions): Promise<PlayerChoice> {
    const characterName = player.character?.name || `Player ${player.id}`;
    
    if (player.type === 'human') {
      // For human players: display options and wait for input
      console.log(`\n🎭 ${characterName}'s Turn - Choose an action:`);
      console.log(`1. TALK: ${options.talkOption}`);
      console.log(`2. ACT: ${options.actOption}`);
      console.log(`3. DO NOTHING: ${options.doNothingOption}`);
      
      // Use the player's makeChoice method to get selection
      const choiceOptions = ['1', '2', '3'];
      const selection = await player.makeChoice(choiceOptions);
      
      // Map selection to action type
      let selectedAction: 'talk' | 'act' | 'nothing';
      let selectedContent: string;
      let contentSource: 'book_quote' | 'llm_generated';
      let bookQuoteMetadata: BookQuoteMetadata | undefined;
      
      switch (selection) {
        case '1':
          selectedAction = 'talk';
          selectedContent = options.talkOption;
          contentSource = this.extractContentSource(options.talkOption);
          bookQuoteMetadata = this.extractBookQuoteMetadata(options.talkOption, contentSource);
          break;
        case '2':
          selectedAction = 'act';
          selectedContent = options.actOption;
          contentSource = this.extractContentSource(options.actOption);
          bookQuoteMetadata = this.extractBookQuoteMetadata(options.actOption, contentSource);
          break;
        case '3':
        default:
          selectedAction = 'nothing';
          selectedContent = options.doNothingOption;
          contentSource = 'llm_generated'; // System-generated
          break;
      }
      
      return {
        selectedAction,
        selectedContent,
        timestamp: new Date(),
        contentSource,
        bookQuoteMetadata
      };
    } else {
      // For computer players: randomly select from three options
      const randomChoice = Math.floor(Math.random() * 3);
      
      let selectedAction: 'talk' | 'act' | 'nothing';
      let selectedContent: string;
      let contentSource: 'book_quote' | 'llm_generated';
      let bookQuoteMetadata: BookQuoteMetadata | undefined;
      
      switch (randomChoice) {
        case 0:
          selectedAction = 'talk';
          selectedContent = options.talkOption;
          contentSource = this.extractContentSource(options.talkOption);
          bookQuoteMetadata = this.extractBookQuoteMetadata(options.talkOption, contentSource);
          console.log(`🤖 ${characterName} (Computer) chose: TALK`);
          break;
        case 1:
          selectedAction = 'act';
          selectedContent = options.actOption;
          contentSource = this.extractContentSource(options.actOption);
          bookQuoteMetadata = this.extractBookQuoteMetadata(options.actOption, contentSource);
          console.log(`🤖 ${characterName} (Computer) chose: ACT`);
          break;
        case 2:
        default:
          selectedAction = 'nothing';
          selectedContent = options.doNothingOption;
          contentSource = 'llm_generated'; // System-generated
          console.log(`🤖 ${characterName} (Computer) chose: DO NOTHING`);
          break;
      }
      
      return {
        selectedAction,
        selectedContent,
        timestamp: new Date(),
        contentSource,
        bookQuoteMetadata
      };
    }
  }

  /**
   * Extract content source from option text
   */
  private extractContentSource(optionText: string): 'book_quote' | 'llm_generated' {
    if (optionText.startsWith('[Book Quote')) {
      return 'book_quote';
    }
    return 'llm_generated';
  }

  /**
   * Extract book quote metadata from option text if it's a book quote
   */
  private extractBookQuoteMetadata(
    optionText: string,
    contentSource: 'book_quote' | 'llm_generated'
  ): BookQuoteMetadata | undefined {
    if (contentSource !== 'book_quote') {
      return undefined;
    }

    // Extract context description from [Book Quote - context] format
    const contextMatch = optionText.match(/\[Book Quote - ([^\]]+)\]/);
    const contextDescription = contextMatch ? contextMatch[1] : 'Unknown context';

    // Extract the actual quote text (after the bracket notation)
    const quoteText = optionText.replace(/\[Book Quote[^\]]*\]\s*/, '').trim();

    // Try to extract chapter number if present in context
    const chapterMatch = contextDescription.match(/Chapter (\d+)/i);
    const chapterNumber = chapterMatch ? parseInt(chapterMatch[1], 10) : undefined;

    return {
      originalText: quoteText,
      chapterNumber,
      contextDescription,
      endingCompatibilityScore: 7 // Default score, actual score was checked during generation
    };
  }

  /**
   * Apply the player's choice and generate story segment
   * Requirement 11.4: Record selected action with content source
   * Requirement 13.5: Include dialogue context in story segments
   */
  async applyPlayerChoice(choice: PlayerChoice, gameContext: GameContext): Promise<StorySegment> {
    const { gameState, actingPlayer } = gameContext;
    const character = actingPlayer.character;

    if (!character) {
      throw new Error('Player must have an assigned character to apply choice');
    }

    // Find dialogue context for this round (for logging purposes)
    let dialogueContextInfo: { chapterNumber?: number; sceneDescription: string; startPosition: number; endPosition: number } | undefined;
    
    try {
      const dialogueContext = await this.bookQuoteExtractor.findDialogueContext(
        gameState.currentRound,
        gameState.totalRounds
      );
      
      dialogueContextInfo = {
        chapterNumber: dialogueContext.chapterNumber,
        sceneDescription: dialogueContext.sceneDescription,
        startPosition: dialogueContext.startPosition,
        endPosition: dialogueContext.endPosition
      };
      
      // Log which book section is being used for this round
      console.log(`📖 Round ${gameState.currentRound} context: ${dialogueContext.sceneDescription}`);
    } catch (error) {
      console.warn('Failed to retrieve dialogue context for logging:', error);
    }

    // Handle "do nothing" action
    if (choice.selectedAction === 'nothing') {
      // Increment total rounds (this will be handled by GameFlowManager)
      const storySegment: StorySegment = {
        content: `${character.name} (Player ${actingPlayer.id}) chose to do nothing. Total rounds increased to ${gameState.totalRounds + 1}.`,
        wordCount: 0,
        generatedBy: {
          type: 'nothing',
          diceRoll: 0, // No dice roll for "do nothing"
          timestamp: choice.timestamp,
          playerId: actingPlayer.id,
          contentSource: 'llm_generated'
        },
        targetEnding: gameState.targetEnding?.id || 'none',
        timestamp: choice.timestamp,
        characterName: character.name,
        playerId: actingPlayer.id,
        contentSource: 'llm_generated',
        dialogueContext: dialogueContextInfo
      };

      // Update quote usage stats
      gameState.quoteUsageStats.totalActions++;
      gameState.quoteUsageStats.llmGeneratedUsed++;

      return storySegment;
    }

    // Extract the actual content (remove the [Book Quote] or [LLM Generated] prefix)
    let content = choice.selectedContent;
    if (content.startsWith('[Book Quote')) {
      content = content.replace(/\[Book Quote[^\]]*\]\s*/, '').trim();
    } else if (content.startsWith('[LLM Generated]')) {
      content = content.replace(/\[LLM Generated\]\s*/, '').trim();
    }

    // Remove quotes if present for dialogue
    if (choice.selectedAction === 'talk' && content.startsWith('"') && content.endsWith('"')) {
      content = content.slice(1, -1);
    }

    // Generate full story content based on the choice
    let fullContent: string;
    if (choice.selectedAction === 'talk') {
      // Format as dialogue
      fullContent = `${character.name} said, "${content}"`;
    } else {
      // Format as narrative action
      fullContent = content;
    }

    // Count words in the content
    const wordCount = this.countWords(fullContent);

    // Create story segment with dialogue context
    const storySegment: StorySegment = {
      content: fullContent,
      wordCount,
      generatedBy: {
        type: choice.selectedAction,
        diceRoll: 0, // No dice roll in new system
        timestamp: choice.timestamp,
        playerId: actingPlayer.id,
        contentSource: choice.contentSource,
        bookQuoteMetadata: choice.bookQuoteMetadata
      },
      targetEnding: gameState.targetEnding?.id || 'none',
      timestamp: choice.timestamp,
      characterName: character.name,
      playerId: actingPlayer.id,
      contentSource: choice.contentSource,
      bookQuoteMetadata: choice.bookQuoteMetadata,
      dialogueContext: dialogueContextInfo // Include context information
    };

    // Update quote usage stats
    gameState.quoteUsageStats.totalActions++;
    if (choice.contentSource === 'book_quote') {
      gameState.quoteUsageStats.bookQuotesUsed++;
    } else {
      gameState.quoteUsageStats.llmGeneratedUsed++;
    }

    // Update effective quote percentage
    if (gameState.quoteUsageStats.totalActions > 0) {
      gameState.effectiveQuotePercentage = 
        (gameState.quoteUsageStats.bookQuotesUsed / gameState.quoteUsageStats.totalActions) * 100;
    }

    return storySegment;
  }

  /**
   * Helper method to count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}

/**
 * Factory function to create an ActionChoiceManager instance
 */
export function createActionChoiceManager(
  llmService: any,
  bookQuoteExtractor: any,
  novelText: string
): ActionChoiceManager {
  return new DefaultActionChoiceManager(llmService, bookQuoteExtractor, novelText);
}
