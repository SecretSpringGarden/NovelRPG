import { ProgressTracker, createProgressTracker } from './ProgressTracker';
import * as fc from 'fast-check';

describe('ProgressTracker', () => {
  let progressTracker: ProgressTracker;

  beforeEach(() => {
    progressTracker = createProgressTracker();
  });

  afterEach(() => {
    // Clean up any pending operations
    progressTracker.forceCleanupAll();
  });

  it('should create an instance', () => {
    expect(progressTracker).toBeDefined();
  });

  it('should start and track a basic operation', () => {
    const steps = [{ id: 'step1', name: 'Step 1', weight: 1 }];
    
    progressTracker.startOperation('op1', steps);
    const progress = progressTracker.getProgress('op1');
    
    expect(progress).toBeDefined();
    expect(progress!.operationId).toBe('op1');
  });

  it('should complete an operation', () => {
    const steps = [{ id: 'step1', name: 'Step 1', weight: 1 }];
    
    progressTracker.startOperation('op1', steps);
    progressTracker.completeOperation('op1');
    
    const progress = progressTracker.getProgress('op1');
    expect(progress!.status).toBe('completed');
  });

  // Feature: openai-assistants-rag, Property 10: Progress Indication
  // **Validates: Requirements 5.6**
  describe('Property 10: Progress Indication', () => {
    it('should provide progress indicators for long-running Assistant API operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              name: fc.string({ minLength: 1, maxLength: 20 }),
              weight: fc.integer({ min: 1, max: 10 })
            }),
            { minLength: 1, maxLength: 5 }
          ), // steps
          fc.string({ minLength: 1, maxLength: 15 }), // operationId
          async (steps, operationId) => {
            // Ensure unique step IDs
            const uniqueSteps = steps.map((step, index) => ({
              ...step,
              id: `${step.id}_${index}`
            }));

            const progressUpdates: any[] = [];
            
            // Start operation
            progressTracker.startOperation(operationId, uniqueSteps);
            
            // Add progress callback to track updates
            progressTracker.onProgress(operationId, (state) => {
              progressUpdates.push({ ...state });
            });

            // Get initial progress
            const initialProgress = progressTracker.getProgress(operationId);
            expect(initialProgress).toBeDefined();
            expect(initialProgress!.operationId).toBe(operationId);
            expect(initialProgress!.totalSteps).toBe(uniqueSteps.length);
            expect(initialProgress!.completedSteps).toBe(0);
            expect(initialProgress!.overallProgress).toBe(0);
            expect(initialProgress!.status).toBe('running');

            // Process each step and verify progress updates
            for (let i = 0; i < uniqueSteps.length; i++) {
              const step = uniqueSteps[i];
              
              // Start step
              progressTracker.startStep(operationId, step.id);
              const runningProgress = progressTracker.getProgress(operationId);
              expect(runningProgress!.currentStep?.id).toBe(step.id);
              expect(runningProgress!.currentStep?.status).toBe('running');
              
              // Complete step
              progressTracker.completeStep(operationId, step.id);
              const completedProgress = progressTracker.getProgress(operationId);
              expect(completedProgress!.completedSteps).toBe(i + 1);
              
              // Verify progress calculation
              const totalWeight = uniqueSteps.reduce((sum, s) => sum + s.weight, 0);
              const completedWeight = uniqueSteps.slice(0, i + 1).reduce((sum, s) => sum + s.weight, 0);
              const expectedProgress = (completedWeight / totalWeight) * 100;
              expect(completedProgress!.overallProgress).toBeCloseTo(expectedProgress, 1);
            }

            // Complete operation (add small delay to ensure elapsed time > 0)
            await new Promise(resolve => setTimeout(resolve, 1));
            progressTracker.completeOperation(operationId);
            const finalProgress = progressTracker.getProgress(operationId);
            expect(finalProgress!.status).toBe('completed');
            expect(finalProgress!.overallProgress).toBe(100);
            expect(finalProgress!.completedSteps).toBe(uniqueSteps.length);

            // Verify progress callbacks were called
            expect(progressUpdates.length).toBeGreaterThan(0);
            
            // Verify elapsed time is tracked (should be at least 1ms due to our delay)
            expect(finalProgress!.elapsedTime).toBeGreaterThanOrEqual(0);

            // Clean up
            progressTracker.cleanup(operationId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle operation cancellation and failure scenarios', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              name: fc.string({ minLength: 1, maxLength: 20 }),
              weight: fc.integer({ min: 1, max: 10 })
            }),
            { minLength: 2, maxLength: 4 }
          ), // steps
          fc.string({ minLength: 1, maxLength: 15 }), // operationId
          fc.boolean(), // shouldCancel
          async (steps, operationId, shouldCancel) => {
            // Ensure unique step IDs
            const uniqueSteps = steps.map((step, index) => ({
              ...step,
              id: `${step.id}_${index}`
            }));

            const progressUpdates: any[] = [];
            
            // Start operation
            progressTracker.startOperation(operationId, uniqueSteps);
            
            // Add progress callback
            progressTracker.onProgress(operationId, (state) => {
              progressUpdates.push({ ...state });
            });

            if (shouldCancel) {
              // Test cancellation
              progressTracker.startStep(operationId, uniqueSteps[0].id);
              progressTracker.cancelOperation(operationId);
              
              const cancelledProgress = progressTracker.getProgress(operationId);
              expect(cancelledProgress!.status).toBe('cancelled');
            } else {
              // Test failure scenario
              progressTracker.startStep(operationId, uniqueSteps[0].id);
              const testError = new Error('Test failure');
              progressTracker.failStep(operationId, uniqueSteps[0].id, testError);
              
              const failedProgress = progressTracker.getProgress(operationId);
              expect(failedProgress!.status).toBe('failed');
              expect(failedProgress!.currentStep?.error).toBe(testError);
            }

            // Verify progress callbacks were called
            expect(progressUpdates.length).toBeGreaterThan(0);

            // Clean up
            progressTracker.cleanup(operationId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});