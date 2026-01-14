import { LLMConfig } from '../config/types';
import { RetryManager, createRetryManager } from './RetryManager';

export interface LLMService {
  initialize(config: LLMConfig): Promise<void>;
  analyzeText(prompt: string, text: string): Promise<string>;
  generateContent(prompt: string, context: any): Promise<string>;
  validateResponse(response: string, expectedFormat: string): boolean;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface OpenAIAPIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIAPIError {
  error?: {
    message?: string;
  };
}

export class OpenAILLMService implements LLMService {
  private config: LLMConfig | null = null;
  private initialized = false;
  private retryManager: RetryManager;

  constructor() {
    this.retryManager = createRetryManager({
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 120000, // 2 minutes for rate limits
      backoffMultiplier: 2,
      timeoutMs: 300000 // 5 minutes
    });
  }

  async initialize(config: LLMConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    if (!config.model) {
      throw new Error('OpenAI model is required');
    }

    this.config = { ...config };
    this.initialized = true;
  }

  async analyzeText(prompt: string, text: string): Promise<string> {
    this.ensureInitialized();
    
    const fullPrompt = `${prompt}\n\nText to analyze:\n${text}`;
    return this.retryManager.executeWithRetry(
      () => this.callOpenAIAPI(fullPrompt).then(response => response.content),
      {
        onRetry: (attempt, error, nextDelayMs) => {
          console.log(`🔄 Retrying LLM request (attempt ${attempt}) after ${nextDelayMs}ms: ${error.message}`);
        }
      }
    );
  }

  async generateContent(prompt: string, context: any): Promise<string> {
    this.ensureInitialized();
    
    const contextString = typeof context === 'string' ? context : JSON.stringify(context);
    const fullPrompt = `${prompt}\n\nContext:\n${contextString}`;
    
    return this.retryManager.executeWithRetry(
      () => this.callOpenAIAPI(fullPrompt).then(response => response.content),
      {
        onRetry: (attempt, error, nextDelayMs) => {
          console.log(`🔄 Retrying LLM request (attempt ${attempt}) after ${nextDelayMs}ms: ${error.message}`);
        }
      }
    );
  }

  validateResponse(response: string, expectedFormat: string): boolean {
    if (!response || response.trim().length === 0) {
      return false;
    }

    switch (expectedFormat.toLowerCase()) {
      case 'json':
        try {
          JSON.parse(response);
          return true;
        } catch {
          return false;
        }
      
      case 'text':
        return response.trim().length > 0;
      
      case 'list':
        // Check if response contains list-like structure (lines or numbered items)
        const lines = response.trim().split('\n').filter(line => line.trim().length > 0);
        return lines.length > 0;
      
      default:
        // For custom formats, just check if response is non-empty
        return response.trim().length > 0;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new Error('LLMService must be initialized before use');
    }
  }

  private async callOpenAIAPI(prompt: string): Promise<LLMResponse> {
    if (!this.config) {
      throw new Error('LLMService not initialized');
    }

    const url = this.config.baseUrl || 'https://api.openai.com/v1/chat/completions';
    
    const requestBody = {
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as OpenAIAPIError;
        const errorMessage = `OpenAI API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`;
        
        // Add specific error types for better retry handling
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded: ${errorMessage}`);
        } else if (response.status >= 500) {
          throw new Error(`Server error: ${errorMessage}`);
        } else if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication error: ${errorMessage}`);
        } else {
          throw new Error(errorMessage);
        }
      }

      const data = await response.json() as OpenAIAPIResponse;
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response structure from OpenAI API');
      }

      const content = data.choices[0].message.content;
      
      if (!this.validateResponse(content, 'text')) {
        throw new Error('Invalid response format received from OpenAI');
      }

      return {
        content,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      
      throw error;
    }
  }
}

// Factory function to create appropriate LLM service based on provider
export function createLLMService(config: LLMConfig): LLMService {
  switch (config.provider) {
    case 'openai':
      return new OpenAILLMService();
    case 'anthropic':
      throw new Error('Anthropic provider not yet implemented');
    case 'local':
      throw new Error('Local provider not yet implemented');
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}