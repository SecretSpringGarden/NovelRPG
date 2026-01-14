import { LLMService } from './LLMService';
import { NovelAnalysis } from '../models';

export interface FallbackStrategy {
  trigger: 'api_failure' | 'quota_exceeded' | 'timeout' | 'network_error' | 'configuration_disabled';
  action: 'direct_llm' | 'chunked_processing' | 'cached_result' | 'user_notification';
  retryCount: number;
  maxRetries: number;
}

export interface ProcessingContext {
  novelText: string;
  novelPath?: string;
  originalError?: Error;
  attemptCount: number;
  maxAttempts: number;
}

export interface FallbackResult {
  success: boolean;
  analysis?: NovelAnalysis;
  strategy: FallbackStrategy;
  fallbackActivated: boolean;
  userNotified: boolean;
  errorMessage?: string;
}

export interface FallbackHandler {
  handleFailure(error: AssistantAPIError, context: ProcessingContext): Promise<FallbackResult>;
  determineFallbackStrategy(error: AssistantAPIError): FallbackStrategy;
  fallbackToDirectLLM(context: ProcessingContext): Promise<NovelAnalysis>;
  processInChunks(context: ProcessingContext): Promise<NovelAnalysis>;
  retrieveCachedResult(context: ProcessingContext): Promise<NovelAnalysis>;
  notifyUser(strategy: FallbackStrategy, error: AssistantAPIError): void;
  chunkText(text: string, maxChunkSize: number): string[];
  truncateText(text: string, maxLength: number): string;
}

export class AssistantAPIError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly isRetryable: boolean;

  constructor(message: string, code: string, statusCode?: number, isRetryable: boolean = false) {
    super(message);
    this.name = 'AssistantAPIError';
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }

  static fromError(error: Error): AssistantAPIError {
    if (error instanceof AssistantAPIError) {
      return error;
    }

    const message = error.message;
    
    // Check for network errors first (including network timeouts and connection failures)
    if (message.includes('network') || 
        message.includes('ENOTFOUND') || 
        message.includes('ECONNREFUSED') ||
        message.includes('Connection failed') ||
        message.includes('connection failed') ||
        message.includes('Connection') && message.includes('failed')) {
      return new AssistantAPIError(message, 'network_error', undefined, true);
    }
    
    // Check for timeout errors (but not network timeouts which are handled above)
    if (message.includes('timeout') || message.includes('ECONNRESET') || message.includes('ETIMEDOUT')) {
      return new AssistantAPIError(message, 'timeout', undefined, true);
    }
    
    // Check for quota/rate limit errors
    if (message.includes('429') || message.includes('Rate limit') || message.includes('quota')) {
      return new AssistantAPIError(message, 'quota_exceeded', 429, true);
    }
    
    // Check for authentication errors
    if (message.includes('401') || message.includes('403') || message.includes('API key')) {
      return new AssistantAPIError(message, 'api_failure', 401, false);
    }
    
    // Default to generic API failure
    return new AssistantAPIError(message, 'api_failure', undefined, false);
  }
}

export class FallbackExhaustedException extends Error {
  constructor(originalError: string) {
    super(`All fallback strategies exhausted. Original error: ${originalError}`);
    this.name = 'FallbackExhaustedException';
  }
}

export class DefaultFallbackHandler implements FallbackHandler {
  private llmService: LLMService;
  private cache: Map<string, NovelAnalysis> = new Map();
  private notificationCallback?: (message: string) => void;

  constructor(llmService: LLMService, notificationCallback?: (message: string) => void) {
    this.llmService = llmService;
    this.notificationCallback = notificationCallback;
  }

  /**
   * Main entry point for handling Assistant API failures
   * Requirement 3.1: Automatic fallback triggers for API failures, quota exceeded, and network issues
   */
  async handleFailure(error: AssistantAPIError, context: ProcessingContext): Promise<FallbackResult> {
    console.log(`🔄 Fallback handler activated for error: ${error.code}`);
    
    const strategy = this.determineFallbackStrategy(error);
    let analysis: NovelAnalysis | undefined;
    let success = false;
    let userNotified = false;

    try {
      switch (strategy.action) {
        case 'direct_llm':
          console.log('📝 Falling back to direct LLM calls...');
          analysis = await this.fallbackToDirectLLM(context);
          success = true;
          break;
          
        case 'chunked_processing':
          console.log('🔪 Falling back to chunked processing...');
          analysis = await this.processInChunks(context);
          success = true;
          break;
          
        case 'cached_result':
          console.log('💾 Attempting to retrieve cached result...');
          analysis = await this.retrieveCachedResult(context);
          success = true;
          break;
          
        case 'user_notification':
          console.log('📢 Notifying user of fallback activation...');
          this.notifyUser(strategy, error);
          userNotified = true;
          throw new FallbackExhaustedException(error.message);
      }

      // Requirement 3.5: Log all fallback events for monitoring and debugging
      console.log(`✅ Fallback strategy '${strategy.action}' completed successfully`);
      
      return {
        success,
        analysis,
        strategy,
        fallbackActivated: true,
        userNotified
      };

    } catch (fallbackError) {
      const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.error(`❌ Fallback strategy '${strategy.action}' failed: ${errorMessage}`);
      
      return {
        success: false,
        strategy,
        fallbackActivated: true,
        userNotified,
        errorMessage
      };
    }
  }

  /**
   * Determines the appropriate fallback strategy based on error type
   * Requirement 3.1, 3.3, 3.4: Different fallback triggers for different error types
   */
  determineFallbackStrategy(error: AssistantAPIError): FallbackStrategy {
    const baseStrategy: Omit<FallbackStrategy, 'trigger' | 'action'> = {
      retryCount: 0,
      maxRetries: 3
    };

    switch (error.code) {
      case 'quota_exceeded':
        // Requirement 3.3: When Assistant API quota is exceeded, fall back to direct LLM
        return {
          ...baseStrategy,
          trigger: 'quota_exceeded',
          action: 'direct_llm'
        };
        
      case 'network_error':
        // Requirement 3.4: When network connectivity issues prevent access, use cached results or fallback
        return {
          ...baseStrategy,
          trigger: 'network_error',
          action: 'cached_result'
        };
        
      case 'timeout':
        // Timeout errors should retry with chunked processing
        return {
          ...baseStrategy,
          trigger: 'timeout',
          action: 'chunked_processing'
        };
        
      case 'api_failure':
      default:
        // Requirement 3.1: When Assistant API is unavailable or returns errors, fall back to direct LLM
        return {
          ...baseStrategy,
          trigger: 'api_failure',
          action: 'direct_llm'
        };
    }
  }

  /**
   * Fallback to direct LLM calls
   * Requirement 3.1: Automatic fallback to original LLM service
   */
  async fallbackToDirectLLM(context: ProcessingContext): Promise<NovelAnalysis> {
    const { novelText } = context;
    
    try {
      // Use the existing NovelAnalyzer fallback method
      const { DefaultNovelAnalyzer } = require('./NovelAnalyzer');
      const analyzer = new DefaultNovelAnalyzer(this.llmService);
      
      return await analyzer.fallbackToDirectLLM(novelText);
    } catch (error) {
      // If NovelAnalyzer fails, create a minimal analysis
      console.warn('NovelAnalyzer fallback failed, creating minimal analysis');
      return this.createMinimalAnalysis(novelText);
    }
  }

  /**
   * Process large novels in chunks
   * Requirement 3.2: Text chunking strategies for large novels in fallback mode
   */
  async processInChunks(context: ProcessingContext): Promise<NovelAnalysis> {
    const { novelText } = context;
    const maxChunkSize = 50000; // 50k characters per chunk
    
    console.log(`📊 Novel size: ${novelText.length} characters, chunking into ~${maxChunkSize} character segments`);
    
    const chunks = this.chunkText(novelText, maxChunkSize);
    console.log(`🔪 Created ${chunks.length} chunks for processing`);
    
    // Process each chunk and combine results
    const allCharacters: any[] = [];
    const allPlotPoints: any[] = [];
    let combinedIntroduction = '';
    let combinedClimax = '';
    let combinedConclusion = '';
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`📝 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      try {
        // Use direct LLM for each chunk
        const chunkAnalysis = await this.fallbackToDirectLLM({
          ...context,
          novelText: chunk
        });
        
        // Combine results
        allCharacters.push(...chunkAnalysis.mainCharacters);
        allPlotPoints.push(...chunkAnalysis.plotPoints);
        
        if (i === 0) combinedIntroduction = chunkAnalysis.introduction;
        if (i === Math.floor(chunks.length / 2)) combinedClimax = chunkAnalysis.climax;
        if (i === chunks.length - 1) combinedConclusion = chunkAnalysis.conclusion;
        
      } catch (error) {
        console.warn(`⚠️ Failed to process chunk ${i + 1}, creating minimal analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Create minimal analysis for failed chunk
        const minimalAnalysis = this.createMinimalAnalysis(chunk);
        allCharacters.push(...minimalAnalysis.mainCharacters);
        allPlotPoints.push(...minimalAnalysis.plotPoints);
      }
    }
    
    // Deduplicate and select top characters and plot points
    const uniqueCharacters = this.deduplicateCharacters(allCharacters).slice(0, 4);
    const uniquePlotPoints = this.deduplicatePlotPoints(allPlotPoints).slice(0, 5);
    
    return {
      mainCharacters: uniqueCharacters,
      plotPoints: uniquePlotPoints,
      introduction: combinedIntroduction,
      climax: combinedClimax,
      conclusion: combinedConclusion,
      isComplete: uniqueCharacters.length > 0 && uniquePlotPoints.length > 0,
      validationErrors: []
    };
  }

  /**
   * Retrieve cached analysis result
   * Requirement 3.4: Use cached results when network issues prevent API access
   */
  async retrieveCachedResult(context: ProcessingContext): Promise<NovelAnalysis> {
    const cacheKey = this.generateCacheKey(context.novelText);
    const cachedResult = this.cache.get(cacheKey);
    
    if (cachedResult) {
      console.log('💾 Retrieved cached analysis result');
      return cachedResult;
    }
    
    // If no cached result, fall back to direct LLM
    console.log('💾 No cached result found, falling back to direct LLM');
    const result = await this.fallbackToDirectLLM(context);
    
    // Cache the result for future use
    this.cache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Notify user of fallback activation
   * Requirement 3.6: Inform user that reduced functionality is in effect
   */
  notifyUser(strategy: FallbackStrategy, error: AssistantAPIError): void {
    const message = `⚠️ Assistant API unavailable (${error.code}). Using fallback processing with ${strategy.action}. Some features may be limited.`;
    
    console.warn(message);
    
    if (this.notificationCallback) {
      this.notificationCallback(message);
    }
  }

  /**
   * Split text into manageable chunks
   * Requirement 3.2: Text chunking strategies for large novels
   */
  chunkText(text: string, maxChunkSize: number): string[] {
    if (text.length <= maxChunkSize) {
      return [text];
    }
    
    const chunks: string[] = [];
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
      let endIndex = currentIndex + maxChunkSize;
      
      // Try to break at a sentence boundary
      if (endIndex < text.length) {
        const sentenceEnd = text.lastIndexOf('.', endIndex);
        const paragraphEnd = text.lastIndexOf('\n\n', endIndex);
        
        // Use the latest boundary that's not too far back
        const boundary = Math.max(sentenceEnd, paragraphEnd);
        if (boundary > currentIndex + maxChunkSize * 0.7) {
          endIndex = boundary + 1;
        }
      }
      
      chunks.push(text.slice(currentIndex, endIndex));
      currentIndex = endIndex;
    }
    
    return chunks;
  }

  /**
   * Truncate text to maximum length
   * Requirement 3.2: Text truncation strategies for large novels
   */
  truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Try to truncate at a sentence boundary
    const truncated = text.slice(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > maxLength * 0.8) {
      return truncated.slice(0, lastSentence + 1);
    }
    
    return truncated + '...';
  }

  /**
   * Remove duplicate characters based on name similarity
   */
  private deduplicateCharacters(characters: any[]): any[] {
    const unique: any[] = [];
    const seenNames = new Set<string>();
    
    for (const char of characters) {
      const normalizedName = char.name.toLowerCase().trim();
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        unique.push(char);
      }
    }
    
    // Sort by importance and return
    return unique.sort((a, b) => (b.importance || 0) - (a.importance || 0));
  }

  /**
   * Remove duplicate plot points based on description similarity
   */
  private deduplicatePlotPoints(plotPoints: any[]): any[] {
    const unique: any[] = [];
    const seenDescriptions = new Set<string>();
    
    for (const pp of plotPoints) {
      const normalizedDesc = pp.description.toLowerCase().trim().slice(0, 50);
      if (!seenDescriptions.has(normalizedDesc)) {
        seenDescriptions.add(normalizedDesc);
        unique.push(pp);
      }
    }
    
    // Sort by sequence and return
    return unique.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  }

  /**
   * Generate cache key for novel text
   */
  private generateCacheKey(novelText: string): string {
    // Simple hash based on text length and first/last characters
    const start = novelText.slice(0, 100);
    const end = novelText.slice(-100);
    return `${novelText.length}-${start.length}-${end.length}`;
  }

  /**
   * Create minimal analysis when other methods fail
   */
  private createMinimalAnalysis(_novelText: string): NovelAnalysis {
    return {
      mainCharacters: [
        {
          id: 'fallback_char',
          name: 'Unknown Character',
          description: 'Character analysis unavailable due to fallback processing',
          importance: 5
        }
      ],
      plotPoints: [
        {
          id: 'fallback_plot',
          description: 'Plot analysis unavailable due to fallback processing',
          sequence: 1,
          importance: 'major' as const
        }
      ],
      introduction: 'Introduction analysis unavailable due to fallback processing',
      climax: 'Climax analysis unavailable due to fallback processing',
      conclusion: 'Conclusion analysis unavailable due to fallback processing',
      isComplete: false,
      validationErrors: ['Analysis completed using fallback processing with limited functionality']
    };
  }
}

/**
 * Factory function to create a FallbackHandler instance
 */
export function createFallbackHandler(llmService: LLMService, notificationCallback?: (message: string) => void): FallbackHandler {
  return new DefaultFallbackHandler(llmService, notificationCallback);
}