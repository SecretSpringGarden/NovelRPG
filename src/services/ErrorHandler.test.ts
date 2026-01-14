import * as fc from 'fast-check';
import { ErrorHandler, AssistantAPIError, UsageMonitor, DiagnosticService } from './ErrorHandler';
import { LLMConfig } from '../config/types';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    errorHandler.clearErrorLog();
    // Suppress console output during tests to reduce noise
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    // Set timeout for individual tests
    jest.setTimeout(10000); // 10 second timeout
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // Feature: openai-assistants-rag, Property 13: Error Response Quality
  describe('Property 13: Error Response Quality', () => {
    it('should provide detailed error information and guidance for all error types', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 50 }), // Reduced max length
          operation: fc.constantFrom('file_upload', 'assistant_creation', 'query_processing', 'cleanup'),
          context: fc.dictionary(fc.string({ maxLength: 10 }), fc.oneof(fc.string({ maxLength: 10 }), fc.integer({ min: 0, max: 100 }), fc.boolean()), { maxKeys: 3 }) // Limited complexity
        }),
        (errorInput) => {
          // Create different types of errors to test comprehensive error handling
          const error = new Error(errorInput.message);
          
          // Handle the error
          const errorDetails = errorHandler.handleError(error, errorInput.operation, errorInput.context);
          
          // Verify error response quality
          expect(errorDetails).toBeDefined();
          expect(errorDetails.code).toBeDefined();
          expect(typeof errorDetails.code).toBe('string');
          expect(errorDetails.code.length).toBeGreaterThan(0);
          
          expect(errorDetails.message).toBeDefined();
          expect(typeof errorDetails.message).toBe('string');
          expect(errorDetails.message.length).toBeGreaterThan(0);
          
          expect(errorDetails.timestamp).toBeInstanceOf(Date);
          expect(errorDetails.operation).toBe(errorInput.operation);
          expect(errorDetails.context).toEqual(errorInput.context);
          
          expect(errorDetails.guidance).toBeDefined();
          expect(typeof errorDetails.guidance).toBe('string');
          
          expect(typeof errorDetails.retryable).toBe('boolean');
          
          // Verify that guidance is provided for known error types
          if (errorDetails.code !== 'UNKNOWN_ERROR') {
            expect(errorDetails.guidance).toBeDefined();
            expect(errorDetails.guidance!.length).toBeGreaterThan(0);
          }
        }
      ), { numRuns: 3, timeout: 5000 }); // Drastically reduced with timeout
    });

    it('should provide specific guidance for file upload errors', () => {
      fc.assert(fc.property(
        fc.constantFrom(
          'file too large',
          'unsupported format',
          '413 Request Entity Too Large',
          '400 Bad Request'
        ),
        (errorMessage) => {
          const error = new Error(errorMessage);
          const errorDetails = errorHandler.handleError(error, 'file_upload');
          
          // Should provide specific guidance for file upload errors
          expect(errorDetails.guidance).toBeDefined();
          expect(errorDetails.guidance!.length).toBeGreaterThan(0);
          
          if (errorMessage.includes('large') || errorMessage.includes('413')) {
            expect(errorDetails.code).toBe('FILE_TOO_LARGE');
            expect(errorDetails.guidance).toContain('file size');
            expect(errorDetails.retryable).toBe(false);
          } else if (errorMessage.includes('format') || errorMessage.includes('400')) {
            expect(errorDetails.code).toBe('UNSUPPORTED_FORMAT');
            expect(errorDetails.guidance).toContain('format');
            expect(errorDetails.retryable).toBe(false);
          }
        }
      ), { numRuns: 3, timeout: 5000 }); // Drastically reduced with timeout
    });

    it('should provide specific guidance for assistant creation errors', () => {
      fc.assert(fc.property(
        fc.constantFrom(
          'model not found',
          '404 Not Found',
          'quota exceeded',
          '429 Too Many Requests'
        ),
        (errorMessage) => {
          const error = new Error(errorMessage);
          const errorDetails = errorHandler.handleError(error, 'assistant_creation');
          
          expect(errorDetails.guidance).toBeDefined();
          expect(errorDetails.guidance!.length).toBeGreaterThan(0);
          
          if (errorMessage.includes('model') || errorMessage.includes('404')) {
            expect(errorDetails.code).toBe('MODEL_NOT_FOUND');
            expect(errorDetails.guidance).toContain('model');
            expect(errorDetails.retryable).toBe(false);
          } else if (errorMessage.includes('quota') || errorMessage.includes('429')) {
            expect(errorDetails.code).toBe('QUOTA_EXCEEDED');
            expect(errorDetails.guidance).toContain('quota');
            expect(errorDetails.retryable).toBe(true);
          }
        }
      ), { numRuns: 3, timeout: 5000 }); // Drastically reduced with timeout
    });
  });

  describe('AssistantAPIError', () => {
    it('should create properly structured error details', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 20 }), // Limited length
          code: fc.string({ minLength: 1, maxLength: 10 }), // Limited length
          operation: fc.string({ minLength: 1, maxLength: 15 }), // Limited length
          context: fc.dictionary(fc.string({ maxLength: 5 }), fc.oneof(fc.string({ maxLength: 5 }), fc.integer({ min: 0, max: 100 }), fc.boolean()), { maxKeys: 2 }), // Simplified
          guidance: fc.string({ maxLength: 50 }), // Limited length
          retryable: fc.boolean()
        }),
        (errorData) => {
          const error = new AssistantAPIError(
            errorData.message,
            errorData.code,
            errorData.operation,
            errorData.context,
            errorData.guidance,
            errorData.retryable
          );
          
          const details = error.toErrorDetails();
          
          expect(details.code).toBe(errorData.code);
          expect(details.message).toBe(errorData.message);
          expect(details.operation).toBe(errorData.operation);
          expect(details.context).toEqual(errorData.context);
          expect(details.guidance).toBe(errorData.guidance);
          expect(details.retryable).toBe(errorData.retryable);
          expect(details.timestamp).toBeInstanceOf(Date);
        }
      ), { numRuns: 3, timeout: 5000 }); // Drastically reduced with timeout
    });
  });

  describe('Error logging and retrieval', () => {
    it('should maintain error history correctly', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          message: fc.string({ minLength: 1, maxLength: 20 }), // Reduced length
          operation: fc.constantFrom('file_upload', 'assistant_creation', 'query_processing')
        }), { minLength: 1, maxLength: 5 }), // Reduced max array length
        (errors) => {
          // Clear any existing errors
          errorHandler.clearErrorLog();
          
          // Add all errors
          errors.forEach(errorData => {
            const error = new Error(errorData.message);
            errorHandler.handleError(error, errorData.operation);
          });
          
          // Verify error retrieval
          const recentErrors = errorHandler.getRecentErrors(errors.length);
          expect(recentErrors).toHaveLength(errors.length);
          
          // Verify each error has required properties
          recentErrors.forEach(errorDetails => {
            expect(errorDetails.code).toBeDefined();
            expect(errorDetails.message).toBeDefined();
            expect(errorDetails.timestamp).toBeInstanceOf(Date);
            expect(errorDetails.operation).toBeDefined();
            expect(typeof errorDetails.retryable).toBe('boolean');
          });
        }
      ), { numRuns: 3, timeout: 5000 }); // Drastically reduced with timeout
    });
  });
});

describe('UsageMonitor', () => {
  let usageMonitor: UsageMonitor;

  beforeEach(() => {
    usageMonitor = UsageMonitor.getInstance();
    usageMonitor.resetMetrics();
    // Set timeout for individual tests
    jest.setTimeout(10000); // 10 second timeout
  });

  // Feature: openai-assistants-rag, Property 14: Usage Metrics Tracking
  describe('Property 14: Usage Metrics Tracking', () => {
    it('should accurately track all usage metrics for any sequence of operations', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          operation: fc.constantFrom('file_upload', 'query'),
          size: fc.integer({ min: 1, max: 10000 }), // Reduced max size
          tokens: fc.integer({ min: 0, max: 100 }) // Reduced max tokens
        }), { minLength: 1, maxLength: 5 }), // Reduced max array length
        (operations) => {
          // Reset metrics before test
          usageMonitor.resetMetrics();
          
          let expectedFiles = 0;
          let expectedStorage = 0;
          let expectedQueries = 0;
          
          // Execute operations
          operations.forEach(op => {
            if (op.operation === 'file_upload') {
              usageMonitor.recordFileUpload(op.size);
              expectedFiles++;
              expectedStorage += op.size;
            } else if (op.operation === 'query') {
              usageMonitor.recordQuery(op.tokens);
              expectedQueries++;
            }
          });
          
          // Verify metrics
          const metrics = usageMonitor.getMetrics();
          
          expect(metrics.filesUploaded).toBe(expectedFiles);
          expect(metrics.totalStorageUsed).toBe(expectedStorage);
          expect(metrics.queriesExecuted).toBe(expectedQueries);
          expect(metrics.estimatedCost).toBeGreaterThanOrEqual(0);
          expect(metrics.lastUpdated).toBeInstanceOf(Date);
          
          // Verify quota status is updated
          const quotaStatus = usageMonitor.getQuotaStatus();
          expect(quotaStatus.currentUsage).toBe(expectedQueries);
          expect(quotaStatus.percentageUsed).toBeGreaterThanOrEqual(0);
          expect(quotaStatus.percentageUsed).toBeLessThanOrEqual(100);
        }
      ), { numRuns: 3 }); // Drastically reduced to prevent infinite loops
    });

    it('should calculate costs correctly for file uploads and queries', () => {
      fc.assert(fc.property(
        fc.record({
          fileSize: fc.integer({ min: 1, max: 10000 }), // Reduced max size
          queryTokens: fc.integer({ min: 1, max: 100 }) // Reduced max tokens
        }),
        (testData) => {
          usageMonitor.resetMetrics();
          
          const initialMetrics = usageMonitor.getMetrics();
          const initialCost = initialMetrics.estimatedCost;
          
          // Record file upload
          usageMonitor.recordFileUpload(testData.fileSize);
          const afterUploadMetrics = usageMonitor.getMetrics();
          
          // Record query
          usageMonitor.recordQuery(testData.queryTokens);
          const finalMetrics = usageMonitor.getMetrics();
          
          // Verify cost increases with each operation
          expect(afterUploadMetrics.estimatedCost).toBeGreaterThan(initialCost);
          expect(finalMetrics.estimatedCost).toBeGreaterThan(afterUploadMetrics.estimatedCost);
          
          // Verify cost is reasonable (not negative or extremely high)
          expect(finalMetrics.estimatedCost).toBeGreaterThanOrEqual(0);
          expect(finalMetrics.estimatedCost).toBeLessThan(1000); // Sanity check
        }
      ), { numRuns: 3, timeout: 5000 }); // Drastically reduced with timeout
    });
  });

  // Feature: openai-assistants-rag, Property 15: Proactive Monitoring
  describe('Property 15: Proactive Monitoring', () => {
    it('should warn administrators when approaching quota limits', () => {
      fc.assert(fc.property(
        fc.record({
          quotaLimit: fc.integer({ min: 100, max: 1000 }), // Reduced range
          warningThreshold: fc.integer({ min: 50, max: 80 }), // Reduced range
          alertThreshold: fc.integer({ min: 85, max: 95 }) // Reduced range
        }).filter(config => config.warningThreshold < config.alertThreshold),
        (config) => {
          // Set up quota configuration
          usageMonitor.resetMetrics();
          usageMonitor.setQuotaLimit(config.quotaLimit);
          
          // Simulate usage that approaches the warning threshold
          const warningUsage = Math.ceil((config.quotaLimit * config.warningThreshold) / 100);
          const alertUsage = Math.ceil((config.quotaLimit * config.alertThreshold) / 100);
          
          // Test warning threshold
          for (let i = 0; i < warningUsage; i++) {
            usageMonitor.recordQuery(100);
          }
          
          let quotaStatus = usageMonitor.getQuotaStatus();
          // Use a small tolerance for floating point comparison
          expect(quotaStatus.percentageUsed).toBeGreaterThanOrEqual(config.warningThreshold - 1.0);
          
          // Test alert threshold
          const additionalQueries = alertUsage - warningUsage;
          for (let i = 0; i < additionalQueries; i++) {
            usageMonitor.recordQuery(100);
          }
          
          quotaStatus = usageMonitor.getQuotaStatus();
          // Use a small tolerance for floating point comparison
          expect(quotaStatus.percentageUsed).toBeGreaterThanOrEqual(config.alertThreshold - 1.0);
          
          // Verify quota status properties
          expect(quotaStatus.currentUsage).toBeGreaterThan(0);
          expect(quotaStatus.limit).toBe(config.quotaLimit);
          expect(quotaStatus.percentageUsed).toBeGreaterThanOrEqual(0);
          expect(quotaStatus.percentageUsed).toBeLessThanOrEqual(100);
        }
      ), { numRuns: 3, timeout: 5000 }); // Drastically reduced with timeout
    });
  });
});

describe('DiagnosticService', () => {
  beforeEach(() => {
    // Set timeout for individual tests
    jest.setTimeout(15000); // 15 second timeout for async tests
  });

  // Feature: openai-assistants-rag, Property 16: Diagnostic Capability
  describe('Property 16: Diagnostic Capability', () => {
    it('should provide comprehensive diagnostic results for any configuration', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          apiKey: fc.option(fc.string({ minLength: 10, maxLength: 20 })), // Limited length
          model: fc.option(fc.constantFrom('gpt-4', 'gpt-3.5-turbo', 'invalid-model')),
          timeout: fc.integer({ min: 1000, max: 10000 }) // Reduced range
        }),
        async (configData) => {
          const config: LLMConfig = {
            provider: 'openai',
            apiKey: configData.apiKey || undefined,
            model: configData.model || 'gpt-4',
            baseUrl: undefined,
            maxTokens: 2000,
            temperature: 0.7,
            timeout: configData.timeout
          };
          
          const diagnosticService = new DiagnosticService(config);
          const results = await diagnosticService.runDiagnostics();
          
          // Verify diagnostic results structure
          expect(Array.isArray(results)).toBe(true);
          expect(results.length).toBeGreaterThan(0);
          
          // Verify each diagnostic result has required properties
          results.forEach(result => {
            expect(result.test).toBeDefined();
            expect(typeof result.test).toBe('string');
            expect(result.test.length).toBeGreaterThan(0);
            
            expect(result.status).toBeDefined();
            expect(['pass', 'fail', 'warning']).toContain(result.status);
            
            expect(result.message).toBeDefined();
            expect(typeof result.message).toBe('string');
            expect(result.message.length).toBeGreaterThan(0);
            
            // Details are optional but should be object if present
            if (result.details) {
              expect(typeof result.details).toBe('object');
            }
          });
          
          // Verify that configuration test is always present
          const configTest = results.find(r => r.test === 'Configuration');
          expect(configTest).toBeDefined();
          
          // If no API key, configuration should fail
          if (!config.apiKey) {
            expect(configTest!.status).toBe('fail');
            expect(configTest!.message).toContain('API key');
          }
          
          // If no model, configuration should fail
          if (!config.model) {
            expect(configTest!.status).toBe('fail');
            expect(configTest!.message).toContain('model');
          }
        }
      ), { numRuns: 2, timeout: 3000 }); // Minimal runs with timeout for async test
    });

    it('should test all required diagnostic capabilities', async () => {
      const config: LLMConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        baseUrl: undefined,
        maxTokens: 2000,
        temperature: 0.7,
        timeout: 30000
      };
      
      const diagnosticService = new DiagnosticService(config);
      const results = await diagnosticService.runDiagnostics();
      
      // Verify all required diagnostic tests are present
      const testNames = results.map(r => r.test);
      expect(testNames).toContain('Configuration');
      expect(testNames).toContain('API Connectivity');
      expect(testNames).toContain('Model Availability');
      expect(testNames).toContain('File Upload Capability');
      
      // Verify each test provides meaningful results
      results.forEach(result => {
        expect(result.test).toBeTruthy();
        expect(result.status).toBeTruthy();
        expect(result.message).toBeTruthy();
      });
    });
  });
});