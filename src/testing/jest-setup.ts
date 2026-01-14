/**
 * Global Jest setup for handling cleanup and preventing test hangs
 */

// Global timeout for all tests
jest.setTimeout(30000);

// Store original stdin state only if we need to modify it
let originalStdinState: any = null;

// Global afterEach to ensure cleanup
afterEach(() => {
  try {
    // Clear all timers
    jest.clearAllTimers();
    
    // Clear all mocks (but preserve spies that might be needed)
    jest.clearAllMocks();
    
    // Force cleanup of any ProgressTracker operations
    const { createProgressTracker } = require('./src/services/ProgressTracker');
    const tracker = createProgressTracker();
    if (tracker && typeof tracker.forceCleanupAll === 'function') {
      tracker.forceCleanupAll();
    }
    
    // Remove all listeners from process.stdin to prevent hangs
    if (process.stdin && process.stdin.removeAllListeners) {
      process.stdin.removeAllListeners();
    }
    
    // Restore stdin to original state if we modified it
    if (originalStdinState && process.stdin && process.stdin.setRawMode) {
      try {
        process.stdin.setRawMode(false);
      } catch (error) {
        // Ignore errors when restoring raw mode
      }
    }
    
    // Force garbage collection if available (helps with memory leaks)
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    // Ignore cleanup errors but log them in development
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Global test cleanup warning:', error);
    }
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process in tests, just log
});

// Ensure process exits cleanly after tests
process.on('exit', () => {
  try {
    // Final cleanup
    jest.clearAllTimers();
    if (process.stdin && process.stdin.removeAllListeners) {
      process.stdin.removeAllListeners();
    }
    
    // Restore original stdin state if we modified it
    if (originalStdinState && process.stdin.setRawMode) {
      try {
        process.stdin.setRawMode(false);
      } catch (error) {
        // Ignore final cleanup errors
      }
    }
  } catch (error) {
    // Ignore final cleanup errors
  }
});