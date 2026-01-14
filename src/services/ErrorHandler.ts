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
    
    // Log to console with appropriate level and detailed information
    const timestamp = errorDetails.timestamp.toISOString();
    const logMessage = `[${timestamp}] [${errorDetails.code}] ${errorDetails.operation}: ${errorDetails.message}`;
    
    if (errorDetails.retryable) {
      console.warn(`⚠️  ${logMessage}`);
      if (errorDetails.guidance) {
        console.warn(`💡 Guidance: ${errorDetails.guidance}`);
      }
      if (errorDetails.context && Object.keys(errorDetails.context).length > 0) {
        console.warn(`📋 Context:`, JSON.stringify(errorDetails.context, null, 2));
      }
    } else {
      console.error(`❌ ${logMessage}`);
      if (errorDetails.guidance) {
        console.error(`💡 Guidance: ${errorDetails.guidance}`);
      }
      if (errorDetails.context && Object.keys(errorDetails.context).length > 0) {
        console.error(`📋 Context:`, JSON.stringify(errorDetails.context, null, 2));
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

  public getErrorStatistics(): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    errorsByOperation: Record<string, number>;
    retryableErrors: number;
    nonRetryableErrors: number;
    recentErrorRate: number;
  } {
    const stats = {
      totalErrors: this.errorLog.length,
      errorsByCode: {} as Record<string, number>,
      errorsByOperation: {} as Record<string, number>,
      retryableErrors: 0,
      nonRetryableErrors: 0,
      recentErrorRate: 0
    };

    // Count errors by code and operation
    this.errorLog.forEach(error => {
      stats.errorsByCode[error.code] = (stats.errorsByCode[error.code] || 0) + 1;
      stats.errorsByOperation[error.operation] = (stats.errorsByOperation[error.operation] || 0) + 1;
      
      if (error.retryable) {
        stats.retryableErrors++;
      } else {
        stats.nonRetryableErrors++;
      }
    });

    // Calculate recent error rate (errors in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentErrors = this.errorLog.filter(error => error.timestamp > fiveMinutesAgo);
    stats.recentErrorRate = recentErrors.length / 5; // Errors per minute

    return stats;
  }

  public getErrorSummary(): string {
    const stats = this.getErrorStatistics();
    
    if (stats.totalErrors === 0) {
      return '✅ No errors recorded';
    }

    const lines = [
      `📊 Error Summary:`,
      `   Total Errors: ${stats.totalErrors}`,
      `   Retryable: ${stats.retryableErrors}`,
      `   Non-Retryable: ${stats.nonRetryableErrors}`,
      `   Recent Error Rate: ${stats.recentErrorRate.toFixed(2)} errors/minute`,
      ``,
      `   Top Error Codes:`
    ];

    // Sort error codes by frequency
    const sortedCodes = Object.entries(stats.errorsByCode)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    sortedCodes.forEach(([code, count]) => {
      lines.push(`      ${code}: ${count}`);
    });

    lines.push(``);
    lines.push(`   Top Operations:`);

    // Sort operations by frequency
    const sortedOps = Object.entries(stats.errorsByOperation)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    sortedOps.forEach(([op, count]) => {
      lines.push(`      ${op}: ${count}`);
    });

    return lines.join('\n');
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

  public getUsageSummary(): string {
    const lines = [
      `📊 Usage Metrics Summary:`,
      `   Files Uploaded: ${this.metrics.filesUploaded}`,
      `   Total Storage: ${(this.metrics.totalStorageUsed / (1024 * 1024)).toFixed(2)} MB`,
      `   Queries Executed: ${this.metrics.queriesExecuted}`,
      `   Estimated Cost: $${this.metrics.estimatedCost.toFixed(4)}`,
      `   Last Updated: ${this.metrics.lastUpdated.toISOString()}`,
      ``,
      `📈 Quota Status:`,
      `   Current Usage: ${this.quotaStatus.currentUsage} / ${this.quotaStatus.limit}`,
      `   Percentage Used: ${this.quotaStatus.percentageUsed.toFixed(1)}%`
    ];

    if (this.quotaStatus.percentageUsed >= this.quotaStatus.alertThreshold) {
      lines.push(`   Status: 🚨 ALERT - Near quota limit!`);
    } else if (this.quotaStatus.percentageUsed >= this.quotaStatus.warningThreshold) {
      lines.push(`   Status: ⚠️  WARNING - Approaching quota limit`);
    } else {
      lines.push(`   Status: ✅ Normal`);
    }

    return lines.join('\n');
  }

  public getCostProjection(daysAhead: number = 30): {
    projectedCost: number;
    projectedQueries: number;
    projectedStorage: number;
    recommendation: string;
  } {
    // Calculate daily averages
    const daysSinceStart = 1; // Simplified - in real implementation would track actual time
    const dailyQueries = this.metrics.queriesExecuted / daysSinceStart;
    const dailyCost = this.metrics.estimatedCost / daysSinceStart;
    const dailyStorage = this.metrics.totalStorageUsed / daysSinceStart;

    const projectedQueries = dailyQueries * daysAhead;
    const projectedCost = dailyCost * daysAhead;
    const projectedStorage = dailyStorage * daysAhead;

    let recommendation = '';
    if (projectedCost > 100) {
      recommendation = 'High cost projection. Consider optimizing query frequency or using smaller models.';
    } else if (projectedCost > 50) {
      recommendation = 'Moderate cost projection. Monitor usage and consider optimization strategies.';
    } else {
      recommendation = 'Cost projection is within reasonable limits.';
    }

    return {
      projectedCost,
      projectedQueries,
      projectedStorage,
      recommendation
    };
  }

  public shouldWarnAdministrator(): boolean {
    return this.quotaStatus.percentageUsed >= this.quotaStatus.warningThreshold;
  }

  public getAdministratorWarning(): string | null {
    if (!this.shouldWarnAdministrator()) {
      return null;
    }

    const projection = this.getCostProjection(30);
    
    const lines = [
      `⚠️  ADMINISTRATOR WARNING`,
      ``,
      `Current usage is at ${this.quotaStatus.percentageUsed.toFixed(1)}% of quota limit.`,
      ``,
      `Current Metrics:`,
      `  - Queries: ${this.metrics.queriesExecuted}`,
      `  - Cost: $${this.metrics.estimatedCost.toFixed(4)}`,
      ``,
      `30-Day Projection:`,
      `  - Queries: ${projection.projectedQueries.toFixed(0)}`,
      `  - Cost: $${projection.projectedCost.toFixed(2)}`,
      ``,
      `Recommendation: ${projection.recommendation}`,
      ``,
      `Actions to consider:`,
      `  1. Review and optimize query patterns`,
      `  2. Implement caching for repeated queries`,
      `  3. Consider upgrading quota limits`,
      `  4. Enable fallback processing for non-critical operations`
    ];

    return lines.join('\n');
  }
}

export class DiagnosticService {
  private config: LLMConfig | null = null;

  constructor(config?: LLMConfig) {
    this.config = config || null;
  }

  public async runDiagnostics(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    console.log('🔍 Running Assistant API diagnostics...\n');

    // Test 1: Configuration validation
    results.push(await this.testConfiguration());

    // Test 2: API connectivity
    results.push(await this.testAPIConnectivity());

    // Test 3: Model availability
    results.push(await this.testModelAvailability());

    // Test 4: File upload capability
    results.push(await this.testFileUploadCapability());

    // Test 5: Assistant creation capability
    results.push(await this.testAssistantCreationCapability());

    // Test 6: Vector store capability
    results.push(await this.testVectorStoreCapability());

    // Print summary
    this.printDiagnosticSummary(results);

    return results;
  }

  private printDiagnosticSummary(results: DiagnosticResult[]): void {
    console.log('\n📊 Diagnostic Summary:');
    console.log('═══════════════════════════════════════\n');

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const warnings = results.filter(r => r.status === 'warning').length;

    results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      console.log(`${icon} ${result.test}: ${result.message}`);
      if (result.details) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
    });

    console.log('\n═══════════════════════════════════════');
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Warnings: ${warnings}`);
    
    if (failed > 0) {
      console.log('\n❌ Some diagnostics failed. Please review the errors above.');
    } else if (warnings > 0) {
      console.log('\n⚠️  All critical tests passed, but there are warnings to review.');
    } else {
      console.log('\n✅ All diagnostics passed successfully!');
    }
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

  private async testAssistantCreationCapability(): Promise<DiagnosticResult> {
    try {
      if (!this.config?.apiKey || !this.config?.model) {
        return {
          test: 'Assistant Creation Capability',
          status: 'fail',
          message: 'Cannot test assistant creation without API key and model'
        };
      }

      // Try to create a minimal assistant
      const response = await fetch('https://api.openai.com/v1/assistants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          name: 'Diagnostic Test Assistant',
          description: 'Temporary assistant for diagnostic testing',
          model: this.config.model,
          instructions: 'This is a test assistant.'
        })
      });

      if (response.ok) {
        const assistant = await response.json() as { id: string };
        
        // Clean up the test assistant
        try {
          await fetch(`https://api.openai.com/v1/assistants/${assistant.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'OpenAI-Beta': 'assistants=v2'
            }
          });
        } catch (cleanupError) {
          // Ignore cleanup errors
        }

        return {
          test: 'Assistant Creation Capability',
          status: 'pass',
          message: 'Assistant creation is working correctly',
          details: {
            assistantId: assistant.id,
            model: this.config.model
          }
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          test: 'Assistant Creation Capability',
          status: 'fail',
          message: `Assistant creation failed with status ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          }
        };
      }
    } catch (error) {
      return {
        test: 'Assistant Creation Capability',
        status: 'fail',
        message: `Assistant creation test error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async testVectorStoreCapability(): Promise<DiagnosticResult> {
    try {
      if (!this.config?.apiKey) {
        return {
          test: 'Vector Store Capability',
          status: 'fail',
          message: 'Cannot test vector store without API key'
        };
      }

      // Try to create a minimal vector store
      const response = await fetch('https://api.openai.com/v1/vector_stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          name: 'Diagnostic Test Vector Store'
        })
      });

      if (response.ok) {
        const vectorStore = await response.json() as { id: string; status: string };
        
        // Clean up the test vector store
        try {
          await fetch(`https://api.openai.com/v1/vector_stores/${vectorStore.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'OpenAI-Beta': 'assistants=v2'
            }
          });
        } catch (cleanupError) {
          // Ignore cleanup errors
        }

        return {
          test: 'Vector Store Capability',
          status: 'pass',
          message: 'Vector store creation is working correctly',
          details: {
            vectorStoreId: vectorStore.id,
            status: vectorStore.status
          }
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          test: 'Vector Store Capability',
          status: 'fail',
          message: `Vector store creation failed with status ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          }
        };
      }
    } catch (error) {
      return {
        test: 'Vector Store Capability',
        status: 'fail',
        message: `Vector store test error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}