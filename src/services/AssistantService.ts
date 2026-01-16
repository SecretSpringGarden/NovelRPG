import * as fs from 'fs';
import { LLMConfig } from '../config/types';
import { RetryManager, createRetryManager, RetryProgressCallback } from './RetryManager';
import { ProgressTracker, createProgressTracker, ProgressCallback } from './ProgressTracker';
import { ErrorHandler, UsageMonitor, DiagnosticService, AssistantAPIError } from './ErrorHandler';
import { PerformanceMonitor, createPerformanceMonitor, PerformanceOptimizer, createAssistantAPIPerformanceOptimizer } from './PerformanceMonitor';

export interface AssistantService {
  initialize(config: LLMConfig): Promise<void>;
  uploadNovelFile(filePath: string, progressCallback?: ProgressCallback): Promise<string>;
  createNovelAnalysisAssistant(fileId: string, progressCallback?: ProgressCallback): Promise<string>;
  queryAssistant(assistantId: string, query: string, progressCallback?: ProgressCallback): Promise<string>;
  cleanup(assistantId?: string, fileId?: string): Promise<void>;
  getUsageMetrics(): Promise<any>;
  runDiagnostics(): Promise<any[]>;
  getPerformanceReport(timeRange?: { start: Date; end: Date }): Promise<any>;
  getCostAnalysis(timeRange?: { start: Date; end: Date }): Promise<any>;
  getOptimizationRecommendations(): Promise<any[]>;
  optimizeRateLimiting(): Promise<any>;
  optimizeConcurrentProcessing(): Promise<any>;
  optimizeCohesionAnalysis(): Promise<any>;
  getPerformanceInsights(): Promise<any>;
}

interface OpenAIFile {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

interface OpenAIAssistant {
  id: string;
  object: string;
  created_at: number;
  name: string;
  description: string;
  model: string;
  instructions: string;
  tools: Array<{ type: string }>;
  tool_resources?: {
    file_search?: {
      vector_store_ids: string[];
    };
  };
}

interface OpenAIThread {
  id: string;
  object: string;
  created_at: number;
}

interface OpenAIRun {
  id: string;
  object: string;
  created_at: number;
  assistant_id: string;
  thread_id: string;
  status: string;
  completed_at?: number;
  failed_at?: number;
  last_error?: {
    code: string;
    message: string;
  };
}

interface OpenAIMessage {
  id: string;
  object: string;
  created_at: number;
  thread_id: string;
  role: string;
  content: Array<{
    type: string;
    text?: {
      value: string;
      annotations: any[];
    };
  }>;
}

export class OpenAIAssistantService implements AssistantService {
  private config: LLMConfig | null = null;
  private initialized = false;
  private retryManager: RetryManager;
  private progressTracker: ProgressTracker;
  private errorHandler: ErrorHandler;
  private usageMonitor: UsageMonitor;
  private diagnosticService: DiagnosticService | null = null;
  private performanceMonitor: PerformanceMonitor;
  private performanceOptimizer: PerformanceOptimizer;

  constructor() {
    this.retryManager = createRetryManager({
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      timeoutMs: 300000 // 5 minutes
    });
    this.progressTracker = createProgressTracker();
    this.errorHandler = ErrorHandler.getInstance();
    this.usageMonitor = UsageMonitor.getInstance();
    this.performanceMonitor = createPerformanceMonitor();
    this.performanceOptimizer = createAssistantAPIPerformanceOptimizer();
  }

  async initialize(config: LLMConfig): Promise<void> {
    try {
      if (!config.apiKey) {
        throw new AssistantAPIError(
          'OpenAI API key is required',
          'MISSING_API_KEY',
          'initialization',
          { provider: config.provider },
          'Set the OPENAI_API_KEY environment variable or provide apiKey in configuration',
          false
        );
      }

      if (!config.model) {
        throw new AssistantAPIError(
          'OpenAI model is required',
          'MISSING_MODEL',
          'initialization',
          { provider: config.provider },
          'Specify a valid OpenAI model (e.g., gpt-4, gpt-3.5-turbo)',
          false
        );
      }

      this.config = { ...config };
      this.diagnosticService = new DiagnosticService(this.config);
      this.initialized = true;
      
      console.log('✅ AssistantService initialized successfully');
    } catch (error) {
      const errorDetails = this.errorHandler.handleError(error as Error, 'initialization');
      throw error;
    }
  }

  async uploadNovelFile(filePath: string, progressCallback?: ProgressCallback): Promise<string> {
    this.ensureInitialized();
    
    const operationId = `upload_${Date.now()}`;
    
    // Start performance monitoring
    this.performanceMonitor.startOperation(operationId, 'file_upload', {
      fileSize: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0
    });
    
    try {
      const result = await this.progressTracker.withProgress(
        operationId,
        [
          { id: 'validate', name: 'Validating file', weight: 1 },
          { id: 'upload', name: 'Uploading to OpenAI', weight: 3 }
        ],
        async (tracker) => {
          console.log(`📤 Uploading novel file: ${filePath}`);
          
          // Step 1: Validate file
          tracker.startStep(operationId, 'validate');
          if (!fs.existsSync(filePath)) {
            throw new AssistantAPIError(
              `Novel file not found: ${filePath}`,
              'FILE_NOT_FOUND',
              'file_upload',
              { filePath },
              'Ensure the file path is correct and the file exists',
              false
            );
          }
          
          const stats = fs.statSync(filePath);
          const fileSizeBytes = stats.size;
          const fileSizeMB = fileSizeBytes / (1024 * 1024);
          
          if (fileSizeMB > 100) { // OpenAI file size limit
            throw new AssistantAPIError(
              `File too large: ${fileSizeMB.toFixed(2)}MB (max 100MB)`,
              'FILE_TOO_LARGE',
              'file_upload',
              { filePath, fileSizeMB },
              'Reduce file size or split into smaller chunks. Maximum file size is 100MB.',
              false
            );
          }
          
          tracker.completeStep(operationId, 'validate');

          // Step 2: Upload file with retry logic
          tracker.startStep(operationId, 'upload');
          const fileId = await this.retryManager.executeWithRetry(async () => {
            const fileName = filePath.split(/[/\\]/).pop() || 'novel.txt';
            
            const formData = new FormData();
            formData.append('file', new Blob([fs.readFileSync(filePath)]), fileName);
            formData.append('purpose', 'assistants');

            const response = await fetch('https://api.openai.com/v1/files', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${this.config!.apiKey}`
              },
              body: formData
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              
              // Record rate limit hits for performance monitoring
              if (response.status === 429) {
                this.performanceMonitor.recordRateLimitHit(operationId);
              }
              
              throw new AssistantAPIError(
                `Failed to upload file: ${response.status} ${response.statusText}`,
                response.status === 413 ? 'FILE_TOO_LARGE' : 
                response.status === 400 ? 'UNSUPPORTED_FORMAT' :
                response.status === 401 ? 'UNAUTHORIZED' :
                response.status === 429 ? 'RATE_LIMITED' : 'UPLOAD_FAILED',
                'file_upload',
                { 
                  filePath, 
                  fileName, 
                  status: response.status, 
                  statusText: response.statusText,
                  errorData 
                },
                response.status === 413 ? 'Reduce file size or split into smaller chunks. Maximum file size is typically 100MB.' :
                response.status === 400 ? 'Ensure file is in a supported format (txt, pdf, docx, etc.).' :
                response.status === 401 ? 'Check that your OpenAI API key is valid and has sufficient permissions.' :
                response.status === 429 ? 'Wait for rate limit reset. Consider implementing exponential backoff.' :
                'Check network connection and try again.',
                response.status === 429 || response.status >= 500
              );
            }

            const fileData = await response.json() as OpenAIFile;
            
            // Record usage metrics
            this.usageMonitor.recordFileUpload(fileSizeBytes);
            
            return fileData.id;
          }, {
            onRetry: (attempt, error, nextDelayMs) => {
              // Record retry for performance monitoring
              this.performanceMonitor.recordRateLimitHit(operationId);
              
              // Only log if we're not in a test environment or tests are still running
              if (process.env.NODE_ENV !== 'test' || !global.afterEach) {
                console.log(`🔄 Retrying file upload (attempt ${attempt}) after ${nextDelayMs}ms: ${error.message}`);
              }
              // Handle the error through our error handler
              this.errorHandler.handleError(error, 'file_upload', { 
                attempt, 
                nextDelayMs, 
                filePath 
              });
            }
          });
          
          tracker.completeStep(operationId, 'upload');
          console.log(`✅ File uploaded successfully: ${fileId}`);
          
          return fileId;
        },
        progressCallback
      );
      
      // End performance monitoring with success
      this.performanceMonitor.endOperation(operationId, true, {
        cost: this.calculateUploadCost(fs.statSync(filePath).size)
      });
      
      return result;
    } catch (error) {
      // End performance monitoring with failure
      this.performanceMonitor.endOperation(operationId, false, {
        errorCode: error instanceof AssistantAPIError ? error.code : 'UNKNOWN_ERROR'
      });
      throw error;
    }
  }

  async createNovelAnalysisAssistant(fileId: string, progressCallback?: ProgressCallback): Promise<string> {
    this.ensureInitialized();
    
    const operationId = `create_assistant_${Date.now()}`;
    
    // Start performance monitoring
    this.performanceMonitor.startOperation(operationId, 'assistant_creation');
    
    try {
      const result = await this.progressTracker.withProgress(
        operationId,
        [
          { id: 'vector_store', name: 'Creating vector store', weight: 2 },
          { id: 'wait_ready', name: 'Waiting for vector store to be ready', weight: 2 },
          { id: 'assistant', name: 'Creating assistant', weight: 3 }
        ],
        async (tracker) => {
          console.log(`🤖 Creating novel analysis assistant with file: ${fileId}`);

          // Step 1: Create vector store with retry logic
          tracker.startStep(operationId, 'vector_store');
          const vectorStoreId = await this.retryManager.executeWithRetry(async () => {
            const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config!.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
              },
              body: JSON.stringify({
                name: 'Novel Analysis Vector Store',
                file_ids: [fileId]
              })
            });

            if (!vectorStoreResponse.ok) {
              const errorData = await vectorStoreResponse.json().catch(() => ({}));
              
              // Record rate limit hits
              if (vectorStoreResponse.status === 429) {
                this.performanceMonitor.recordRateLimitHit(operationId);
              }
              
              throw new Error(`Failed to create vector store: ${vectorStoreResponse.status} - ${JSON.stringify(errorData)}`);
            }

            const vectorStore = await vectorStoreResponse.json() as { id: string };
            return vectorStore.id;
          }, {
            onRetry: (attempt, error, nextDelayMs) => {
              this.performanceMonitor.recordRateLimitHit(operationId);
              console.log(`🔄 Retrying vector store creation (attempt ${attempt}) after ${nextDelayMs}ms: ${error.message}`);
            }
          });
          
          tracker.completeStep(operationId, 'vector_store');
          console.log(`📚 Vector store created: ${vectorStoreId}`);

          // Step 1.5: Wait for vector store to be ready
          tracker.startStep(operationId, 'wait_ready');
          await this.waitForVectorStoreReady(vectorStoreId, operationId);
          tracker.completeStep(operationId, 'wait_ready');
          console.log(`✅ Vector store is ready: ${vectorStoreId}`);
          
          // Additional wait for file indexing to complete
          // Even after vector store reports "ready", file search indexing may still be in progress
          console.log('⏳ Waiting 10 seconds for file search indexing to complete...');
          await new Promise(resolve => setTimeout(resolve, 10000));
          console.log('✅ File search indexing should be complete');

          // Step 2: Create assistant with retry logic
          tracker.startStep(operationId, 'assistant');
          const assistantId = await this.retryManager.executeWithRetry(async () => {
            const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config!.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
              },
              body: JSON.stringify({
                name: 'Novel Analysis Assistant',
                description: 'An assistant specialized in analyzing novels for RPG game creation',
                model: this.config!.model,
                instructions: `You are a specialized assistant for analyzing novels to create RPG games. You have access to the full text of a novel and should use it to provide detailed, accurate analysis.

Your primary tasks are:
1. Character Analysis: Identify main characters with their names, descriptions, and importance rankings
2. Plot Point Analysis: Extract key plot points in chronological order
3. Narrative Structure Analysis: Identify introduction, climax, and conclusion elements
4. Story Generation: Create dialogue and narrative content based on the novel's style and context

Always base your responses on the actual content of the novel. Use the file search tool to find relevant passages to support your analysis. Provide specific, detailed responses that capture the essence of the novel.`,
                tools: [{ type: 'file_search' }],
                tool_resources: {
                  file_search: {
                    vector_store_ids: [vectorStoreId]
                  }
                }
              })
            });

            if (!assistantResponse.ok) {
              const errorData = await assistantResponse.json().catch(() => ({}));
              
              // Record rate limit hits
              if (assistantResponse.status === 429) {
                this.performanceMonitor.recordRateLimitHit(operationId);
              }
              
              throw new Error(`Failed to create assistant: ${assistantResponse.status} - ${JSON.stringify(errorData)}`);
            }

            const assistant = await assistantResponse.json() as OpenAIAssistant;
            return assistant.id;
          }, {
            onRetry: (attempt, error, nextDelayMs) => {
              this.performanceMonitor.recordRateLimitHit(operationId);
              console.log(`🔄 Retrying assistant creation (attempt ${attempt}) after ${nextDelayMs}ms: ${error.message}`);
            }
          });
          
          tracker.completeStep(operationId, 'assistant');
          console.log(`✅ Assistant created successfully: ${assistantId}`);
          
          return assistantId;
        },
        progressCallback
      );
      
      // End performance monitoring with success
      this.performanceMonitor.endOperation(operationId, true, {
        cost: this.calculateAssistantCreationCost()
      });
      
      return result;
    } catch (error) {
      // End performance monitoring with failure
      this.performanceMonitor.endOperation(operationId, false, {
        errorCode: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      });
      throw error;
    }
  }

  async queryAssistant(assistantId: string, query: string, progressCallback?: ProgressCallback): Promise<string> {
    this.ensureInitialized();
    
    const operationId = `query_${Date.now()}`;
    
    // Start performance monitoring
    this.performanceMonitor.startOperation(operationId, 'query_processing', {
      tokensUsed: this.estimateTokens(query)
    });
    
    try {
      const result = await this.progressTracker.withProgress(
        operationId,
        [
          { id: 'thread', name: 'Creating thread', weight: 1 },
          { id: 'message', name: 'Adding message', weight: 1 },
          { id: 'run', name: 'Running assistant', weight: 4 },
          { id: 'response', name: 'Getting response', weight: 1 }
        ],
        async (tracker) => {
          // Step 1: Create thread with retry logic
          tracker.startStep(operationId, 'thread');
          const threadId = await this.retryManager.executeWithRetry(async () => {
            const threadResponse = await fetch('https://api.openai.com/v1/threads', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config!.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
              },
              body: JSON.stringify({})
            });

            if (!threadResponse.ok) {
              if (threadResponse.status === 429) {
                this.performanceMonitor.recordRateLimitHit(operationId);
              }
              throw new Error(`Failed to create thread: ${threadResponse.status}`);
            }

            const thread = await threadResponse.json() as OpenAIThread;
            return thread.id;
          }, {
            onRetry: (attempt, error, nextDelayMs) => {
              this.performanceMonitor.recordRateLimitHit(operationId);
              // Only log if we're not in a test environment or tests are still running
              if (process.env.NODE_ENV !== 'test' || !global.afterEach) {
                console.log(`🔄 Retrying thread creation (attempt ${attempt}) after ${nextDelayMs}ms: ${error.message}`);
              }
            }
          });
          tracker.completeStep(operationId, 'thread');

          // Step 2: Add message with retry logic
          tracker.startStep(operationId, 'message');
          await this.retryManager.executeWithRetry(async () => {
            const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config!.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
              },
              body: JSON.stringify({
                role: 'user',
                content: query
              })
            });

            if (!messageResponse.ok) {
              if (messageResponse.status === 429) {
                this.performanceMonitor.recordRateLimitHit(operationId);
              }
              throw new Error(`Failed to add message: ${messageResponse.status}`);
            }
          }, {
            onRetry: (attempt, error, nextDelayMs) => {
              this.performanceMonitor.recordRateLimitHit(operationId);
              console.log(`🔄 Retrying message creation (attempt ${attempt}) after ${nextDelayMs}ms: ${error.message}`);
            }
          });
          tracker.completeStep(operationId, 'message');

          // Step 3: Run assistant with retry logic
          tracker.startStep(operationId, 'run');
          const runId = await this.retryManager.executeWithRetry(async () => {
            const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config!.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
              },
              body: JSON.stringify({
                assistant_id: assistantId
              })
            });

            if (!runResponse.ok) {
              if (runResponse.status === 429) {
                this.performanceMonitor.recordRateLimitHit(operationId);
              }
              
              const errorData = await runResponse.json().catch(() => ({}));
              
              throw new AssistantAPIError(
                `Failed to run assistant: ${runResponse.status}`,
                runResponse.status === 429 ? 'RATE_LIMITED' : 'RUN_FAILED',
                'query_processing',
                { assistantId, threadId, status: runResponse.status, errorData },
                runResponse.status === 429 ? 'Wait for rate limit reset.' : 'Check assistant configuration and try again.',
                runResponse.status === 429 || runResponse.status >= 500
              );
            }

            const run = await runResponse.json() as OpenAIRun;
            return run.id;
          }, {
            onRetry: (attempt, error, nextDelayMs) => {
              this.performanceMonitor.recordRateLimitHit(operationId);
              console.log(`🔄 Retrying assistant run (attempt ${attempt}) after ${nextDelayMs}ms: ${error.message}`);
            }
          });

          // Wait for completion with progress updates
          await this.waitForRunCompletionWithProgress(threadId, runId, operationId, tracker);
          tracker.completeStep(operationId, 'run');

          // Step 4: Get response with retry logic
          tracker.startStep(operationId, 'response');
          const response = await this.retryManager.executeWithRetry(async () => {
            const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
              headers: {
                'Authorization': `Bearer ${this.config!.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
              }
            });

            if (!messagesResponse.ok) {
              if (messagesResponse.status === 429) {
                this.performanceMonitor.recordRateLimitHit(operationId);
              }
              
              throw new AssistantAPIError(
                `Failed to get messages: ${messagesResponse.status}`,
                messagesResponse.status === 401 ? 'UNAUTHORIZED' :
                messagesResponse.status === 429 ? 'RATE_LIMITED' :
                messagesResponse.status >= 500 ? 'SERVER_ERROR' : 'QUERY_FAILED',
                'query_processing',
                { threadId, status: messagesResponse.status },
                messagesResponse.status === 401 ? 'Check that your OpenAI API key is valid and has sufficient permissions.' :
                messagesResponse.status === 429 ? 'Wait for rate limit reset. Consider implementing exponential backoff.' :
                messagesResponse.status >= 500 ? 'OpenAI service is experiencing issues. Try again later.' :
                'Check network connection and try again.',
                messagesResponse.status === 429 || messagesResponse.status >= 500
              );
            }

            const messages = await messagesResponse.json() as { data: OpenAIMessage[] };
            const assistantMessage = messages.data.find((msg: OpenAIMessage) => msg.role === 'assistant');
            
            if (!assistantMessage || !assistantMessage.content[0]?.text?.value) {
              throw new AssistantAPIError(
                'No response from assistant',
                'NO_RESPONSE',
                'query_processing',
                { threadId, messageCount: messages.data.length },
                'The assistant did not provide a response. Try rephrasing your query or check if the assistant is properly configured.',
                true
              );
            }

            // Record usage metrics (simplified - in real implementation would track actual tokens)
            this.usageMonitor.recordQuery(1000); // Estimated tokens
            
            return assistantMessage.content[0].text.value;
          }, {
            onRetry: (attempt, error, nextDelayMs) => {
              this.performanceMonitor.recordRateLimitHit(operationId);
              console.log(`🔄 Retrying response retrieval (attempt ${attempt}) after ${nextDelayMs}ms: ${error.message}`);
              this.errorHandler.handleError(error, 'query_processing', { 
                attempt, 
                nextDelayMs, 
                threadId 
              });
            }
          });
          tracker.completeStep(operationId, 'response');

          return response;
        },
        progressCallback
      );
      
      // End performance monitoring with success
      const estimatedTokens = this.estimateTokens(query + result);
      this.performanceMonitor.endOperation(operationId, true, {
        tokensUsed: estimatedTokens,
        cost: this.calculateQueryCost(estimatedTokens)
      });
      
      return result;
    } catch (error) {
      // End performance monitoring with failure
      this.performanceMonitor.endOperation(operationId, false, {
        errorCode: error instanceof AssistantAPIError ? error.code : 'UNKNOWN_ERROR'
      });
      throw error;
    }
  }

  private async waitForVectorStoreReady(vectorStoreId: string, operationId: string): Promise<void> {
    const maxWaitTimeMs = 180000; // 3 minutes max
    const pollIntervalMs = 5000; // Check every 5 seconds
    const startTime = Date.now();
    
    console.log(`⏳ Waiting for vector store ${vectorStoreId} to be ready...`);
    
    while (Date.now() - startTime < maxWaitTimeMs) {
      try {
        const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new AssistantAPIError(
            `Failed to check vector store status: ${response.status}`,
            response.status === 429 ? 'RATE_LIMITED' : 'STATUS_CHECK_FAILED',
            'vector_store_validation',
            { vectorStoreId, status: response.status, errorData },
            response.status === 429 ? 'Wait for rate limit reset.' : 'Check network connection and try again.',
            response.status === 429 || response.status >= 500
          );
        }

        const vectorStore = await response.json() as {
          id: string;
          status: 'in_progress' | 'completed' | 'expired';
          file_counts: {
            in_progress: number;
            completed: number;
            failed: number;
            cancelled: number;
            total: number;
          };
        };

        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        console.log(`📊 Vector store status: ${vectorStore.status}, files: ${vectorStore.file_counts.completed}/${vectorStore.file_counts.total} completed (${elapsedSeconds}s elapsed)`);

        // Check if vector store is ready
        if (vectorStore.status === 'completed' && vectorStore.file_counts.completed === vectorStore.file_counts.total) {
          console.log(`✅ Vector store ${vectorStoreId} is ready after ${elapsedSeconds}s`);
          return;
        }

        // Check for failures
        if (vectorStore.status === 'expired') {
          throw new AssistantAPIError(
            'Vector store expired before processing completed',
            'VECTOR_STORE_EXPIRED',
            'vector_store_validation',
            { vectorStoreId, status: vectorStore.status },
            'The vector store expired. Try creating a new one with a longer expiration time.',
            false
          );
        }

        if (vectorStore.file_counts.failed > 0) {
          throw new AssistantAPIError(
            `Vector store has ${vectorStore.file_counts.failed} failed files`,
            'VECTOR_STORE_FILE_FAILED',
            'vector_store_validation',
            { vectorStoreId, failedCount: vectorStore.file_counts.failed },
            'Some files failed to process. Check file format and size limits.',
            false
          );
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      } catch (error) {
        if (error instanceof AssistantAPIError) {
          throw error;
        }
        
        // Handle other errors
        this.errorHandler.handleError(error as Error, 'vector_store_validation', { vectorStoreId });
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }
    }

    // Timeout reached
    throw new AssistantAPIError(
      `Vector store ${vectorStoreId} did not become ready within ${maxWaitTimeMs / 1000} seconds`,
      'VECTOR_STORE_TIMEOUT',
      'vector_store_validation',
      { vectorStoreId, maxWaitTimeMs },
      'Vector store processing is taking longer than expected. Try with a smaller file or contact support.',
      true
    );
  }

  private async waitForRunCompletionWithProgress(threadId: string, runId: string, operationId: string, tracker: ProgressTracker): Promise<void> {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const run = await this.retryManager.executeWithRetry(async () => {
        const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });

        if (!runResponse.ok) {
          throw new Error(`Failed to check run status: ${runResponse.status}`);
        }

        return await runResponse.json() as OpenAIRun;
      }, {
        onRetry: (attempt, error, nextDelayMs) => {
          console.log(`🔄 Retrying run status check (attempt ${attempt}) after ${nextDelayMs}ms: ${error.message}`);
        }
      });

      if (run.status === 'completed') {
        return;
      }

      if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
        const errorMessage = run.last_error?.message || 'Unknown error';
        const errorCode = run.last_error?.code || 'UNKNOWN';
        
        // Check if error is related to vector store not being ready
        const isVectorStoreError = errorMessage.toLowerCase().includes('vector store') || 
                                   errorMessage.toLowerCase().includes('file search') ||
                                   errorCode.includes('vector_store');
        
        throw new AssistantAPIError(
          `Assistant run failed with status: ${run.status}. Error: ${errorMessage}`,
          isVectorStoreError ? 'VECTOR_STORE_NOT_READY' : 'RUN_FAILED',
          'query_processing',
          { threadId, runId, status: run.status, errorCode, errorMessage },
          isVectorStoreError ? 
            'Vector store may not be ready. Wait a moment and try again.' :
            'Check assistant configuration and query parameters.',
          isVectorStoreError // Retry if it's a vector store error
        );
      }

      // Update progress based on run status
      const progress = this.calculateRunProgress(run.status, attempts, maxAttempts);
      console.log(`⏳ Assistant run in progress: ${run.status} (${progress.toFixed(1)}%)`);

      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new AssistantAPIError(
      'Assistant run timed out',
      'RUN_TIMEOUT',
      'query_processing',
      { threadId, runId, maxAttempts },
      'The assistant run is taking longer than expected. Try with a simpler query or check system status.',
      true
    );
  }

  private calculateRunProgress(status: string, attempts: number, maxAttempts: number): number {
    // Base progress on status and time elapsed
    const timeProgress = (attempts / maxAttempts) * 100;
    
    switch (status) {
      case 'queued':
        return Math.min(timeProgress * 0.1, 10); // 0-10%
      case 'in_progress':
        return Math.min(10 + (timeProgress * 0.8), 90); // 10-90%
      case 'requires_action':
        return Math.min(timeProgress * 0.5, 50); // 0-50%
      default:
        return timeProgress;
    }
  }

  async cleanup(assistantId?: string, fileId?: string): Promise<void> {
    this.ensureInitialized();
    
    const cleanupErrors: string[] = [];
    
    if (assistantId) {
      try {
        const response = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        if (response.ok) {
          console.log(`🗑️ Assistant deleted: ${assistantId}`);
        } else {
          const errorMsg = `Failed to delete assistant ${assistantId}: ${response.status}`;
          cleanupErrors.push(errorMsg);
          this.errorHandler.handleError(new Error(errorMsg), 'cleanup', { assistantId, status: response.status });
        }
      } catch (error) {
        const errorMsg = `Failed to delete assistant: ${error}`;
        cleanupErrors.push(errorMsg);
        this.errorHandler.handleError(error as Error, 'cleanup', { assistantId });
      }
    }

    if (fileId) {
      try {
        const response = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`
          }
        });
        
        if (response.ok) {
          console.log(`🗑️ File deleted: ${fileId}`);
        } else {
          const errorMsg = `Failed to delete file ${fileId}: ${response.status}`;
          cleanupErrors.push(errorMsg);
          this.errorHandler.handleError(new Error(errorMsg), 'cleanup', { fileId, status: response.status });
        }
      } catch (error) {
        const errorMsg = `Failed to delete file: ${error}`;
        cleanupErrors.push(errorMsg);
        this.errorHandler.handleError(error as Error, 'cleanup', { fileId });
      }
    }
    
    if (cleanupErrors.length > 0) {
      console.warn(`⚠️ Cleanup completed with ${cleanupErrors.length} errors. Check logs for details.`);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new AssistantAPIError(
        'AssistantService must be initialized before use',
        'NOT_INITIALIZED',
        'service_access',
        {},
        'Call initialize() with valid configuration before using the service',
        false
      );
    }
  }

  public async getUsageMetrics(): Promise<any> {
    return this.usageMonitor.getMetrics();
  }

  public async runDiagnostics(): Promise<any[]> {
    if (!this.diagnosticService) {
      throw new AssistantAPIError(
        'Diagnostic service not available - service not initialized',
        'NOT_INITIALIZED',
        'diagnostics',
        {},
        'Initialize the service first before running diagnostics',
        false
      );
    }
    
    try {
      return await this.diagnosticService.runDiagnostics();
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'diagnostics');
      throw error;
    }
  }

  public async getPerformanceReport(timeRange?: { start: Date; end: Date }): Promise<any> {
    try {
      return this.performanceMonitor.generatePerformanceReport(timeRange);
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'performance_reporting');
      throw error;
    }
  }

  public async getCostAnalysis(timeRange?: { start: Date; end: Date }): Promise<any> {
    try {
      return this.performanceMonitor.generateCostAnalysis(timeRange);
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'cost_analysis');
      throw error;
    }
  }

  public async getOptimizationRecommendations(): Promise<any[]> {
    try {
      const report = this.performanceMonitor.generatePerformanceReport();
      return report.recommendations;
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'optimization_recommendations');
      throw error;
    }
  }

  public async optimizeRateLimiting(): Promise<any> {
    try {
      return await this.performanceOptimizer.optimizeRateLimiting();
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'rate_limiting_optimization');
      throw error;
    }
  }

  public async optimizeConcurrentProcessing(): Promise<any> {
    try {
      return await this.performanceOptimizer.optimizeConcurrentProcessing();
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'concurrent_processing_optimization');
      throw error;
    }
  }

  public async optimizeCohesionAnalysis(): Promise<any> {
    try {
      return await this.performanceOptimizer.optimizeCohesionAnalysis();
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'cohesion_analysis_optimization');
      throw error;
    }
  }

  public async getPerformanceInsights(): Promise<any> {
    try {
      return await this.performanceOptimizer.generatePerformanceInsights();
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'performance_insights');
      throw error;
    }
  }

  private calculateUploadCost(fileSizeBytes: number): number {
    // OpenAI charges $0.10/GB/day for file storage
    const sizeGB = fileSizeBytes / (1024 * 1024 * 1024);
    return sizeGB * 0.10; // Simplified daily cost
  }

  private calculateAssistantCreationCost(): number {
    // Assistant creation has no direct cost, but there's overhead
    return 0.01; // Minimal overhead cost
  }

  private calculateQueryCost(tokensUsed: number): number {
    // GPT-4 pricing (approximate)
    const inputCostPerToken = 0.00003;
    const outputCostPerToken = 0.00006;
    
    // Assume 50/50 split between input and output tokens
    const inputTokens = tokensUsed * 0.5;
    const outputTokens = tokensUsed * 0.5;
    
    return (inputTokens * inputCostPerToken) + (outputTokens * outputCostPerToken);
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}

export function createAssistantService(): AssistantService {
  return new OpenAIAssistantService();
}