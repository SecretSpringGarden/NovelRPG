/**
 * RetryManager - Handles retry logic and rate limiting for Assistant API operations
 * 
 * Features:
 * - Exponential backoff retry logic for API failures
 * - Request queuing system for rate limit handling
 * - Progress indicators for long-running operations
 * - Timeout and error recovery mechanisms
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

export interface QueuedRequest<T> {
  id: string;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retryCount: number;
  createdAt: Date;
  callbacks?: RetryProgressCallback;
  timeoutHandle?: NodeJS.Timeout;
  retryTimeoutHandle?: NodeJS.Timeout;
}

export interface RetryProgressCallback {
  onProgress?: (progress: { current: number; total: number; message: string }) => void;
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  onQueued?: (position: number) => void;
}

export class RetryManager {
  private config: RetryConfig;
  private requestQueue: QueuedRequest<any>[] = [];
  private isProcessingQueue = false;
  private isQueueCleared = false;
  private activeRequests = 0;
  private maxConcurrentRequests = 3;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      timeoutMs: 300000, // 5 minutes
      ...config
    };
  }

  /**
   * Execute an operation with retry logic and rate limiting
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    callbacks?: RetryProgressCallback
  ): Promise<T> {
    // Reset cleared flag when new requests come in
    this.isQueueCleared = false;
    
    return new Promise<T>((resolve, reject) => {
      const requestId = this.generateRequestId();
      const queuedRequest: QueuedRequest<T> = {
        id: requestId,
        operation,
        resolve,
        reject,
        retryCount: 0,
        createdAt: new Date(),
        callbacks
      };

      this.requestQueue.push(queuedRequest);
      
      if (callbacks?.onQueued) {
        callbacks.onQueued(this.requestQueue.length);
      }

      this.processQueue();
    });
  }

  /**
   * Process the request queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.activeRequests >= this.maxConcurrentRequests) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      if (request) {
        this.activeRequests++;
        this.executeRequest(request).finally(() => {
          this.activeRequests--;
          this.processQueue(); // Process next request
        });
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    try {
      // Check if queue was cleared
      if (this.isQueueCleared) {
        throw new Error('Queue cleared');
      }
      
      // Check for timeout based on creation time
      const elapsedTime = Date.now() - request.createdAt.getTime();
      if (elapsedTime > this.config.timeoutMs) {
        throw new Error(`Request timeout after ${this.config.timeoutMs}ms`);
      }

      // Create a timeout promise for the remaining time
      const remainingTime = this.config.timeoutMs - elapsedTime;
      const timeoutPromise = new Promise<never>((_, reject) => {
        request.timeoutHandle = setTimeout(() => {
          reject(new Error(`Request timeout after ${this.config.timeoutMs}ms`));
        }, remainingTime);
      });

      // Race the operation against the timeout
      const result = await Promise.race([
        request.operation(),
        timeoutPromise
      ]);
      
      // Clear timeout if operation completed successfully
      if (request.timeoutHandle) {
        clearTimeout(request.timeoutHandle);
        request.timeoutHandle = undefined;
      }
      
      request.resolve(result);
    } catch (error) {
      // Clear any existing timeouts
      if (request.timeoutHandle) {
        clearTimeout(request.timeoutHandle);
        request.timeoutHandle = undefined;
      }
      
      const shouldRetry = this.shouldRetry(error as Error, request.retryCount);
      
      if (shouldRetry && request.retryCount < this.config.maxRetries) {
        request.retryCount++;
        const delayMs = this.calculateDelay(request.retryCount);
        
        // Only log if we're not in a test environment or tests are still running
        if (process.env.NODE_ENV !== 'test' || !global.afterEach) {
          console.log(`🔄 Retrying request ${request.id} (attempt ${request.retryCount}/${this.config.maxRetries}) after ${delayMs}ms`);
        }
        
        if (request.callbacks?.onRetry) {
          request.callbacks.onRetry(request.retryCount, error as Error, delayMs);
        }
        
        request.retryTimeoutHandle = setTimeout(() => {
          request.retryTimeoutHandle = undefined;
          this.executeRequest(request);
        }, delayMs);
      } else {
        console.error(`❌ Request ${request.id} failed after ${request.retryCount} retries:`, error);
        request.reject(error as Error);
      }
    }
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetry(error: Error, retryCount: number): boolean {
    if (retryCount >= this.config.maxRetries) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();
    
    // Retry on rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return true;
    }

    // Retry on network errors
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('econnreset')) {
      return true;
    }

    // Retry on temporary server errors
    if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503') || errorMessage.includes('504')) {
      return true;
    }

    // Don't retry on authentication or permission errors
    if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('invalid api key')) {
      return false;
    }

    // Don't retry on client errors (400, 404, etc.)
    if (errorMessage.includes('400') || errorMessage.includes('404')) {
      return false;
    }

    // Default to retry for unknown errors
    return true;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateDelay(retryCount: number): number {
    const delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, retryCount - 1);
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): { queueLength: number; activeRequests: number } {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests
    };
  }

  /**
   * Clear the request queue (for testing or emergency situations)
   */
  clearQueue(): void {
    // Clear queued requests
    this.requestQueue.forEach(request => {
      // Clear any pending timeouts
      if (request.timeoutHandle) {
        clearTimeout(request.timeoutHandle);
        request.timeoutHandle = undefined;
      }
      if (request.retryTimeoutHandle) {
        clearTimeout(request.retryTimeoutHandle);
        request.retryTimeoutHandle = undefined;
      }
      
      request.reject(new Error('Queue cleared'));
    });
    this.requestQueue = [];
    
    // Also clear any active requests by setting a flag
    this.isQueueCleared = true;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Factory function to create a RetryManager instance
 */
export function createRetryManager(config?: Partial<RetryConfig>): RetryManager {
  return new RetryManager(config);
}