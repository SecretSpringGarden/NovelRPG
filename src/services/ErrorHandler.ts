import { LLMConfig } from '../config/types';

export interface ErrorDetails {
  code: string;
  message: string;
  timestamp: Date;
  operation: string;
  context?: Record<string, any>;
  guidance?: string;
  retryable: boolean;
}

export interface UsageMetrics {
  filesUploaded: number;
  totalStorageUsed: number;
  queriesExecuted: number;
  estimatedCost: number;
  lastUpdated: Date;
}

export interface QuotaStatus {
  currentUsage: number;
  limit: number;
  percentageUsed: number;
  warningThreshold: number;
  alertThreshold: number;
}

export interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, any>;
}

export class AssistantAPIError extends Error {
  public readonly code: string;
  public readonly operation: string;
  public readonly context: Record<string, any>;
  public readonly guidance: string;
  public readonly retryable: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    operation: string,
    context: Record<string, any> = {},
    guidance: string = '',
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'AssistantAPIError';
    this.code = code;
    this.operation = operation;
    this.context = context;
    this.guidance = guidance;
    this.retryable = retryable;
    this.timestamp = new Date();
  }

  toErrorDetails(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      operation: this.operation,
      context: this.context,
      guidance: this.guidance,
      retryable: this.retryable
    };
  }
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorDetails[] = [];

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public handleError(error: Error, operation: string, context: Record<string, any> = {}): ErrorDetails {
    const errorDetails = this.createErrorDetails(error, operation, context);
    this.logError(errorDetails);
    return errorDetails;
  }

  private createErrorDetails(error: Error, operation: string, context: Record<string, any>): ErrorDetails {
    if (error instanceof AssistantAPIError) {
      return error.toErrorDetails();
    }

    // Parse different types of errors and provide specific guidance
    const { code, guidance, retryable } = this.analyzeError(error, operation);

    return {
      code,
      message: error.message,
      timestamp: new Date(),
      operation,
      context,
      guidance,
      retryable
    };
  }

  private analyzeError(error: Error, operation: string): { code: string; guidance: string; retryable: boolean } {
    const message = error.message.toLowerCase();

    // File upload errors
    if (operation === 'file_upload') {
      if (message.includes('file too large') || message.includes('413')) {
        return {
          code: 'FILE_TOO_LARGE',
          guidance: 'Reduce file size or split into smaller chunks. Maximum file size is typically 100MB.',
          retryable: false
        };
      }
      if (message.includes('unsupported format') || message.includes('400')) {
        return {
          code: 'UNSUPPORTED_FORMAT',
          guidance: 'Ensure file is in a supported format (txt, pdf, docx, etc.).',
          retryable: false
        };
      }
    }

    // Assistant creation errors
    if (operation === 'assistant_creation') {
      if (message.includes('model not found') || message.includes('404')) {
        return {
          code: 'MODEL_NOT_FOUND',
          guidance: 'Check that the specified model is available and correctly spelled.',
          retryable: false
        };
      }
      if (message.includes('quota') || message.includes('429')) {
        return {
          code: 'QUOTA_EXCEEDED',
          guidance: 'Wait for quota reset or upgrade your plan. Consider using fallback processing.',
          retryable: true
        };
      }
    }

    // Network and API errors
    if (message.includes('network') || message.includes('timeout') || message.includes('enotfound')) {
      return {
        code: 'NETWORK_ERROR',
        guidance: 'Check internet connection and OpenAI service status. Retry in a few moments.',
        retryable: true
      };
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return {
        code: 'UNAUTHORIZED',
        guidance: 'Check that your OpenAI API key is valid and has sufficient permissions.',
        retryable: false
      };
    }

    if (message.includes('rate limit') || message.includes('429')) {
      return {
        code: 'RATE_LIMITED',
        guidance: 'Wait for rate limit reset. Consider implementing exponential backoff.',
        retryable: true
      };
    }

    // Generic server errors
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return {
        code: 'SERVER_ERROR',
        guidance: 'OpenAI service is experiencing issues. Try again later or use fallback processing.',
        retryable: true
      };
    }

    // Default case
    return {
      code: 'UNKNOWN_ERROR',
      guidance: 'An unexpected error occurred. Check logs for more details.',
      retryable: false
    };
  }

  private logError(errorDetails: ErrorDetails): void {
    this.errorLog.push(errorDetails);
    
    // Log to console with appropriate level
    const logMessage = `[${errorDetails.code}] ${errorDetails.operation}: ${errorDetails.message}`;
    
    if (errorDetails.retryable) {
      console.warn(`⚠️  ${logMessage}`);
      if (errorDetails.guidance) {
        console.warn(`💡 ${errorDetails.guidance}`);
      }
    } else {
      console.error(`❌ ${logMessage}`);
      if (errorDetails.guidance) {
        console.error(`💡 ${errorDetails.guidance}`);
      }
    }

    // Keep only last 1000 errors to prevent memory issues
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-1000);
    }
  }

  public getRecentErrors(count: number = 10): ErrorDetails[] {
    return this.errorLog.slice(-count);
  }

  public getErrorsByOperation(operation: string): ErrorDetails[] {
    return this.errorLog.filter(error => error.operation === operation);
  }

  public clearErrorLog(): void {
    this.errorLog = [];
  }
}

export class UsageMonitor {
  private static instance: UsageMonitor;
  private metrics: UsageMetrics = {
    filesUploaded: 0,
    totalStorageUsed: 0,
    queriesExecuted: 0,
    estimatedCost: 0,
    lastUpdated: new Date()
  };
  private quotaStatus: QuotaStatus = {
    currentUsage: 0,
    limit: 1000, // Default limit
    percentageUsed: 0,
    warningThreshold: 80,
    alertThreshold: 95
  };

  private constructor() {}

  public static getInstance(): UsageMonitor {
    if (!UsageMonitor.instance) {
      UsageMonitor.instance = new UsageMonitor();
    }
    return UsageMonitor.instance;
  }

  public recordFileUpload(sizeBytes: number): void {
    this.metrics.filesUploaded++;
    this.metrics.totalStorageUsed += sizeBytes;
    this.metrics.estimatedCost += this.calculateStorageCost(sizeBytes);
    this.metrics.lastUpdated = new Date();
    
    this.updateQuotaStatus();
    this.checkThresholds();
  }

  public recordQuery(tokensUsed: number = 0): void {
    this.metrics.queriesExecuted++;
    this.metrics.estimatedCost += this.calculateQueryCost(tokensUsed);
    this.metrics.lastUpdated = new Date();
    
    this.updateQuotaStatus();
    this.checkThresholds();
  }

  private calculateStorageCost(sizeBytes: number): number {
    // OpenAI charges $0.10/GB/day, simplified to per upload
    const sizeGB = sizeBytes / (1024 * 1024 * 1024);
    return sizeGB * 0.10;
  }

  private calculateQueryCost(tokensUsed: number): number {
    // Simplified cost calculation - actual costs vary by model
    const costPerToken = 0.00003; // Approximate GPT-4 cost
    return tokensUsed * costPerToken;
  }

  private updateQuotaStatus(): void {
    this.quotaStatus.currentUsage = this.metrics.queriesExecuted;
    this.quotaStatus.percentageUsed = (this.quotaStatus.currentUsage / this.quotaStatus.limit) * 100;
  }

  private checkThresholds(): void {
    if (this.quotaStatus.percentageUsed >= this.quotaStatus.alertThreshold) {
      console.error(`🚨 ALERT: Usage at ${this.quotaStatus.percentageUsed.toFixed(1)}% of quota limit!`);
      console.error(`💰 Estimated cost: $${this.metrics.estimatedCost.toFixed(2)}`);
    } else if (this.quotaStatus.percentageUsed >= this.quotaStatus.warningThreshold) {
      console.warn(`⚠️  WARNING: Usage at ${this.quotaStatus.percentageUsed.toFixed(1)}% of quota limit`);
      console.warn(`💰 Estimated cost: $${this.metrics.estimatedCost.toFixed(2)}`);
    }
  }

  public getMetrics(): UsageMetrics {
    return { ...this.metrics };
  }

  public getQuotaStatus(): QuotaStatus {
    return { ...this.quotaStatus };
  }

  public setQuotaLimit(limit: number): void {
    this.quotaStatus.limit = limit;
    this.updateQuotaStatus();
  }

  public resetMetrics(): void {
    this.metrics = {
      filesUploaded: 0,
      totalStorageUsed: 0,
      queriesExecuted: 0,
      estimatedCost: 0,
      lastUpdated: new Date()
    };
    this.updateQuotaStatus();
  }
}

export class DiagnosticService {
  private config: LLMConfig | null = null;

  constructor(config?: LLMConfig) {
    this.config = config || null;
  }

  public async runDiagnostics(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    // Test 1: Configuration validation
    results.push(await this.testConfiguration());

    // Test 2: API connectivity
    results.push(await this.testAPIConnectivity());

    // Test 3: Model availability
    results.push(await this.testModelAvailability());

    // Test 4: File upload capability
    results.push(await this.testFileUploadCapability());

    return results;
  }

  private async testConfiguration(): Promise<DiagnosticResult> {
    try {
      if (!this.config) {
        return {
          test: 'Configuration',
          status: 'fail',
          message: 'No configuration provided'
        };
      }

      if (!this.config.apiKey) {
        return {
          test: 'Configuration',
          status: 'fail',
          message: 'OpenAI API key is missing'
        };
      }

      if (!this.config.model) {
        return {
          test: 'Configuration',
          status: 'fail',
          message: 'Model is not specified'
        };
      }

      return {
        test: 'Configuration',
        status: 'pass',
        message: 'Configuration is valid',
        details: {
          model: this.config.model,
          hasApiKey: !!this.config.apiKey,
          timeout: this.config.timeout
        }
      };
    } catch (error) {
      return {
        test: 'Configuration',
        status: 'fail',
        message: `Configuration error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async testAPIConnectivity(): Promise<DiagnosticResult> {
    try {
      if (!this.config?.apiKey) {
        return {
          test: 'API Connectivity',
          status: 'fail',
          message: 'Cannot test connectivity without API key'
        };
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (response.ok) {
        return {
          test: 'API Connectivity',
          status: 'pass',
          message: 'Successfully connected to OpenAI API',
          details: {
            status: response.status,
            responseTime: Date.now() // Simplified
          }
        };
      } else {
        return {
          test: 'API Connectivity',
          status: 'fail',
          message: `API request failed with status ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText
          }
        };
      }
    } catch (error) {
      return {
        test: 'API Connectivity',
        status: 'fail',
        message: `Network error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async testModelAvailability(): Promise<DiagnosticResult> {
    try {
      if (!this.config?.apiKey || !this.config?.model) {
        return {
          test: 'Model Availability',
          status: 'fail',
          message: 'Cannot test model without API key and model name'
        };
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        return {
          test: 'Model Availability',
          status: 'fail',
          message: `Failed to fetch models: ${response.status}`
        };
      }

      const data = await response.json() as { data: any[] };
      const models = data.data || [];
      const modelExists = models.some((model: any) => model.id === this.config!.model);

      if (modelExists) {
        return {
          test: 'Model Availability',
          status: 'pass',
          message: `Model ${this.config.model} is available`,
          details: {
            model: this.config.model,
            totalModels: models.length
          }
        };
      } else {
        return {
          test: 'Model Availability',
          status: 'warning',
          message: `Model ${this.config.model} not found in available models`,
          details: {
            requestedModel: this.config.model,
            availableModels: models.slice(0, 5).map((m: any) => m.id)
          }
        };
      }
    } catch (error) {
      return {
        test: 'Model Availability',
        status: 'fail',
        message: `Error checking model: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async testFileUploadCapability(): Promise<DiagnosticResult> {
    try {
      if (!this.config?.apiKey) {
        return {
          test: 'File Upload Capability',
          status: 'fail',
          message: 'Cannot test file upload without API key'
        };
      }

      // Create a small test file
      const testContent = 'This is a test file for diagnostic purposes.';
      const formData = new FormData();
      formData.append('file', new Blob([testContent]), 'diagnostic-test.txt');
      formData.append('purpose', 'assistants');

      const response = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: formData
      });

      if (response.ok) {
        const fileData = await response.json() as { id: string };
        
        // Clean up the test file
        try {
          await fetch(`https://api.openai.com/v1/files/${fileData.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`
            }
          });
        } catch (cleanupError) {
          // Ignore cleanup errors
        }

        return {
          test: 'File Upload Capability',
          status: 'pass',
          message: 'File upload is working correctly',
          details: {
            testFileSize: testContent.length,
            uploadedFileId: fileData.id
          }
        };
      } else {
        return {
          test: 'File Upload Capability',
          status: 'fail',
          message: `File upload failed with status ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText
          }
        };
      }
    } catch (error) {
      return {
        test: 'File Upload Capability',
        status: 'fail',
        message: `File upload test error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}