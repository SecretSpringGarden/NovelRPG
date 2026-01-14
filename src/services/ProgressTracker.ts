/**
 * ProgressTracker - Provides progress indicators for long-running Assistant API operations
 * 
 * Features:
 * - Progress tracking for multi-step operations
 * - Time estimation and ETA calculation
 * - Progress callbacks and event emission
 * - Operation cancellation support
 */

export interface ProgressStep {
  id: string;
  name: string;
  weight: number; // Relative weight for progress calculation
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: Error;
}

export interface ProgressState {
  operationId: string;
  totalSteps: number;
  completedSteps: number;
  currentStep?: ProgressStep;
  overallProgress: number; // 0-100
  estimatedTimeRemaining?: number; // milliseconds
  elapsedTime: number; // milliseconds
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface ProgressCallback {
  (state: ProgressState): void;
}

export class ProgressTracker {
  private operations = new Map<string, {
    steps: ProgressStep[];
    callbacks: ProgressCallback[];
    startTime: Date;
    cancelled: boolean;
  }>();

  /**
   * Start tracking a new operation
   */
  startOperation(operationId: string, steps: Omit<ProgressStep, 'status' | 'startTime' | 'endTime'>[]): void {
    const progressSteps: ProgressStep[] = steps.map(step => ({
      ...step,
      status: 'pending'
    }));

    this.operations.set(operationId, {
      steps: progressSteps,
      callbacks: [],
      startTime: new Date(),
      cancelled: false
    });

    console.log(`📊 Started tracking operation: ${operationId} with ${steps.length} steps`);
  }

  /**
   * Add a progress callback for an operation
   */
  onProgress(operationId: string, callback: ProgressCallback): void {
    const operation = this.operations.get(operationId);
    if (operation) {
      operation.callbacks.push(callback);
    }
  }

  /**
   * Mark a step as started
   */
  startStep(operationId: string, stepId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation || operation.cancelled) return;

    const step = operation.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'running';
      step.startTime = new Date();
      
      console.log(`🔄 Step started: ${step.name}`);
      this.notifyProgress(operationId);
    }
  }

  /**
   * Mark a step as completed
   */
  completeStep(operationId: string, stepId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation || operation.cancelled) return;

    const step = operation.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'completed';
      step.endTime = new Date();
      
      console.log(`✅ Step completed: ${step.name}`);
      this.notifyProgress(operationId);
    }
  }

  /**
   * Mark a step as failed
   */
  failStep(operationId: string, stepId: string, error: Error): void {
    const operation = this.operations.get(operationId);
    if (!operation || operation.cancelled) return;

    const step = operation.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'failed';
      step.endTime = new Date();
      step.error = error;
      
      console.error(`❌ Step failed: ${step.name}`, error);
      this.notifyProgress(operationId);
    }
  }

  /**
   * Cancel an operation
   */
  cancelOperation(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (operation) {
      operation.cancelled = true;
      console.log(`🚫 Operation cancelled: ${operationId}`);
      this.notifyProgress(operationId);
    }
  }

  /**
   * Complete an operation
   */
  completeOperation(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation || operation.cancelled) return;

    // Mark any remaining steps as completed
    operation.steps.forEach(step => {
      if (step.status === 'pending' || step.status === 'running') {
        step.status = 'completed';
        step.endTime = new Date();
      }
    });

    console.log(`🎉 Operation completed: ${operationId}`);
    this.notifyProgress(operationId);
  }

  /**
   * Get current progress state for an operation
   */
  getProgress(operationId: string): ProgressState | null {
    const operation = this.operations.get(operationId);
    if (!operation) return null;

    const totalWeight = operation.steps.reduce((sum, step) => sum + step.weight, 0);
    const completedWeight = operation.steps
      .filter(step => step.status === 'completed')
      .reduce((sum, step) => sum + step.weight, 0);

    const currentStep = operation.steps.find(step => step.status === 'running' || step.status === 'failed');
    const completedSteps = operation.steps.filter(step => step.status === 'completed').length;
    const failedSteps = operation.steps.filter(step => step.status === 'failed').length;
    
    const overallProgress = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
    const elapsedTime = Date.now() - operation.startTime.getTime();
    
    let estimatedTimeRemaining: number | undefined;
    if (overallProgress > 0 && overallProgress < 100) {
      const timePerPercent = elapsedTime / overallProgress;
      estimatedTimeRemaining = timePerPercent * (100 - overallProgress);
    }

    let status: ProgressState['status'];
    if (operation.cancelled) {
      status = 'cancelled';
    } else if (failedSteps > 0) {
      status = 'failed';
    } else if (completedSteps === operation.steps.length) {
      status = 'completed';
    } else {
      status = 'running';
    }

    return {
      operationId,
      totalSteps: operation.steps.length,
      completedSteps,
      currentStep,
      overallProgress,
      estimatedTimeRemaining,
      elapsedTime,
      status
    };
  }

  /**
   * Notify all callbacks about progress update
   */
  private notifyProgress(operationId: string): void {
    const operation = this.operations.get(operationId);
    const progress = this.getProgress(operationId);
    
    if (operation && progress) {
      operation.callbacks.forEach(callback => {
        try {
          callback(progress);
        } catch (error) {
          console.error('Error in progress callback:', error);
        }
      });
    }
  }

  /**
   * Clean up completed or failed operations
   */
  cleanup(operationId: string): void {
    const progress = this.getProgress(operationId);
    if (progress && (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled')) {
      this.operations.delete(operationId);
      // Only log if we're not in a test environment or tests are still running
      if (process.env.NODE_ENV !== 'test' || !global.afterEach) {
        console.log(`🧹 Cleaned up operation: ${operationId}`);
      }
    }
  }

  /**
   * Force cleanup all operations (for test cleanup)
   */
  forceCleanupAll(): void {
    for (const [operationId, progress] of this.operations.entries()) {
      // Clear any pending cleanup timeouts
      if ((progress as any).cleanupTimeout) {
        clearTimeout((progress as any).cleanupTimeout);
      }
      this.operations.delete(operationId);
    }
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): string[] {
    return Array.from(this.operations.keys()).filter(operationId => {
      const progress = this.getProgress(operationId);
      return progress && progress.status === 'running';
    });
  }

  /**
   * Create a progress wrapper for async operations
   */
  async withProgress<T>(
    operationId: string,
    steps: Omit<ProgressStep, 'status' | 'startTime' | 'endTime'>[],
    operation: (tracker: ProgressTracker) => Promise<T>,
    callback?: ProgressCallback
  ): Promise<T> {
    this.startOperation(operationId, steps);
    
    if (callback) {
      this.onProgress(operationId, callback);
    }

    try {
      const result = await operation(this);
      this.completeOperation(operationId);
      return result;
    } catch (error) {
      // Mark current running step as failed
      const progress = this.getProgress(operationId);
      if (progress?.currentStep) {
        this.failStep(operationId, progress.currentStep.id, error as Error);
      }
      throw error;
    } finally {
      // Clean up after a delay to allow final progress updates
      const cleanupTimeout = setTimeout(() => this.cleanup(operationId), 1000);
      
      // Store timeout ID for potential cleanup
      const progress = this.getProgress(operationId);
      if (progress) {
        (progress as any).cleanupTimeout = cleanupTimeout;
      }
    }
  }
}

/**
 * Factory function to create a ProgressTracker instance
 */
export function createProgressTracker(): ProgressTracker {
  return new ProgressTracker();
}

/**
 * Global progress tracker instance for shared use
 */
export const globalProgressTracker = createProgressTracker();