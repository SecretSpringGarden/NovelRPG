import { ConfigManager } from './ConfigManager';
import { SystemConfig, LLMConfig, GameConfig, TestConfig, AssistantAPIConfig, FallbackConfig, ResourceManagementConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

describe('ConfigManager', () => {
  let originalConfigFile: string | null = null;
  const configPath = path.join(process.cwd(), 'config.json');

  beforeEach(() => {
    if (fs.existsSync(configPath)) {
      originalConfigFile = fs.readFileSync(configPath, 'utf-8');
    }
    ConfigManager.resetInstance();
  });

  afterEach(() => {
    if (originalConfigFile) {
      fs.writeFileSync(configPath, originalConfigFile);
    } else if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    ConfigManager.resetInstance();
  });

  it('should reject configuration with missing LLM model', () => {
    const invalidConfig = {
      llm: { provider: 'openai', model: '', maxTokens: 2000, temperature: 0.7, timeout: 30000 },
      game: { defaultRounds: 15, maxPlayers: 4, turnTimeoutSeconds: 60, gameStateDirectory: './game_states', maxNovelSizeMB: 50 },
      testing: { outputDirectory: './test_outputs', cohesionAnalysisModel: 'gpt-4', testIterations: 6 },
      assistantAPI: { enabled: false, model: 'gpt-4', maxFileSize: 100, vectorStoreExpiration: 7, autoCleanup: true, usageThreshold: 1000 },
      fallback: { enableFallback: true, chunkSize: 4000, maxChunks: 10, truncationLimit: 40000, retryAttempts: 3 },
      resourceManagement: { cleanupInterval: 60, maxOrphanedResources: 50, costAlertThreshold: 100, monitoringEnabled: true }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2));
    const configManager = ConfigManager.getInstance();
    const validation = configManager.validateConfiguration();
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('LLM model is required');
  });

  it('should reject configuration with invalid player count', () => {
    const invalidConfig = {
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key', maxTokens: 2000, temperature: 0.7, timeout: 30000 },
      game: { defaultRounds: 15, maxPlayers: 5, turnTimeoutSeconds: 60, gameStateDirectory: './game_states', maxNovelSizeMB: 50 },
      testing: { outputDirectory: './test_outputs', cohesionAnalysisModel: 'gpt-4', testIterations: 6 },
      assistantAPI: { enabled: false, model: 'gpt-4', maxFileSize: 100, vectorStoreExpiration: 7, autoCleanup: true, usageThreshold: 1000 },
      fallback: { enableFallback: true, chunkSize: 4000, maxChunks: 10, truncationLimit: 40000, retryAttempts: 3 },
      resourceManagement: { cleanupInterval: 60, maxOrphanedResources: 50, costAlertThreshold: 100, monitoringEnabled: true }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2));
    const configManager = ConfigManager.getInstance();
    const validation = configManager.validateConfiguration();
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Game maxPlayers must be exactly 4');
  });

  it('should accept valid configuration', () => {
    const validConfig = {
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key', maxTokens: 2000, temperature: 0.7, timeout: 30000 },
      game: { defaultRounds: 15, maxPlayers: 4, turnTimeoutSeconds: 60, gameStateDirectory: './game_states', maxNovelSizeMB: 50 },
      testing: { outputDirectory: './test_outputs', cohesionAnalysisModel: 'gpt-4', testIterations: 6 },
      assistantAPI: { enabled: false, model: 'gpt-4', maxFileSize: 100, vectorStoreExpiration: 7, autoCleanup: true, usageThreshold: 1000 },
      fallback: { enableFallback: true, chunkSize: 4000, maxChunks: 10, truncationLimit: 40000, retryAttempts: 3 },
      resourceManagement: { cleanupInterval: 60, maxOrphanedResources: 50, costAlertThreshold: 100, monitoringEnabled: true }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(validConfig, null, 2));
    const configManager = ConfigManager.getInstance();
    const validation = configManager.validateConfiguration();
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should validate Assistant API configuration when enabled', () => {
    // Clear environment variable for this test
    const originalApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    const configWithEnabledAssistantAPI = {
      llm: { provider: 'openai', model: 'gpt-4', apiKey: null, maxTokens: 2000, temperature: 0.7, timeout: 30000 },
      game: { defaultRounds: 15, maxPlayers: 4, turnTimeoutSeconds: 60, gameStateDirectory: './game_states', maxNovelSizeMB: 50 },
      testing: { outputDirectory: './test_outputs', cohesionAnalysisModel: 'gpt-4', testIterations: 6 },
      assistantAPI: { enabled: true, model: '', maxFileSize: -1, vectorStoreExpiration: 7, autoCleanup: true, usageThreshold: 1000 },
      fallback: { enableFallback: true, chunkSize: 4000, maxChunks: 10, truncationLimit: 40000, retryAttempts: 3 },
      resourceManagement: { cleanupInterval: 60, maxOrphanedResources: 50, costAlertThreshold: 100, monitoringEnabled: true }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(configWithEnabledAssistantAPI, null, 2));
    ConfigManager.resetInstance(); // Force reload
    const configManager = ConfigManager.getInstance();
    const config = configManager.getConfig();
    const validation = configManager.validateConfiguration();
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Assistant API model is required when Assistant API is enabled');
    expect(validation.errors).toContain('Assistant API maxFileSize must be greater than 0');
    
    // Only check for API key error if it's actually missing
    if (!config.llm.apiKey) {
      expect(validation.errors).toContain('OpenAI API key is required when Assistant API is enabled');
    }
    
    // Restore environment variable
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it('should return correct feature flag status', () => {
    const configWithAssistantAPIEnabled = {
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key', maxTokens: 2000, temperature: 0.7, timeout: 30000 },
      game: { defaultRounds: 15, maxPlayers: 4, turnTimeoutSeconds: 60, gameStateDirectory: './game_states', maxNovelSizeMB: 50 },
      testing: { outputDirectory: './test_outputs', cohesionAnalysisModel: 'gpt-4', testIterations: 6 },
      assistantAPI: { enabled: true, model: 'gpt-4', maxFileSize: 100, vectorStoreExpiration: 7, autoCleanup: true, usageThreshold: 1000 },
      fallback: { enableFallback: false, chunkSize: 4000, maxChunks: 10, truncationLimit: 40000, retryAttempts: 3 },
      resourceManagement: { cleanupInterval: 60, maxOrphanedResources: 50, costAlertThreshold: 100, monitoringEnabled: true }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(configWithAssistantAPIEnabled, null, 2));
    const configManager = ConfigManager.getInstance();
    
    expect(configManager.isAssistantAPIEnabled()).toBe(true);
    expect(configManager.shouldUseFallback()).toBe(false);
  });

  // Feature: openai-assistants-rag, Property 11: Configuration-Driven Behavior
  // **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
  describe('Property 11: Configuration-Driven Behavior', () => {
    it('should use configured values for all configuration settings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // LLM Config
            llmModel: fc.constantFrom('gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'),
            llmMaxTokens: fc.integer({ min: 100, max: 8000 }),
            llmTemperature: fc.float({ min: 0, max: 2, noNaN: true }),
            llmTimeout: fc.integer({ min: 5000, max: 120000 }),
            
            // Assistant API Config
            assistantAPIEnabled: fc.boolean(),
            assistantAPIModel: fc.constantFrom('gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'),
            assistantAPIMaxFileSize: fc.integer({ min: 1, max: 500 }),
            assistantAPIVectorStoreExpiration: fc.integer({ min: 1, max: 30 }),
            assistantAPIAutoCleanup: fc.boolean(),
            assistantAPIUsageThreshold: fc.integer({ min: 1, max: 10000 }),
            
            // Fallback Config
            fallbackEnabled: fc.boolean(),
            fallbackChunkSize: fc.integer({ min: 1000, max: 10000 }),
            fallbackMaxChunks: fc.integer({ min: 1, max: 50 }),
            fallbackTruncationLimit: fc.integer({ min: 10000, max: 100000 }),
            fallbackRetryAttempts: fc.integer({ min: 0, max: 10 }),
            
            // Resource Management Config
            resourceCleanupInterval: fc.integer({ min: 1, max: 1440 }),
            resourceMaxOrphaned: fc.integer({ min: 0, max: 1000 }),
            resourceCostAlertThreshold: fc.integer({ min: 0, max: 10000 }),
            resourceMonitoringEnabled: fc.boolean()
          }),
          
          async (configValues) => {
            const testConfig = {
              llm: {
                provider: 'openai' as const,
                model: configValues.llmModel,
                apiKey: 'test-key',
                maxTokens: configValues.llmMaxTokens,
                temperature: configValues.llmTemperature,
                timeout: configValues.llmTimeout
              },
              game: {
                defaultRounds: 15,
                maxPlayers: 4,
                turnTimeoutSeconds: 60,
                gameStateDirectory: './game_states',
                maxNovelSizeMB: 50
              },
              testing: {
                outputDirectory: './test_outputs',
                cohesionAnalysisModel: 'gpt-4',
                testIterations: 6
              },
              assistantAPI: {
                enabled: configValues.assistantAPIEnabled,
                model: configValues.assistantAPIModel,
                maxFileSize: configValues.assistantAPIMaxFileSize,
                vectorStoreExpiration: configValues.assistantAPIVectorStoreExpiration,
                autoCleanup: configValues.assistantAPIAutoCleanup,
                usageThreshold: configValues.assistantAPIUsageThreshold
              },
              fallback: {
                enableFallback: configValues.fallbackEnabled,
                chunkSize: configValues.fallbackChunkSize,
                maxChunks: configValues.fallbackMaxChunks,
                truncationLimit: configValues.fallbackTruncationLimit,
                retryAttempts: configValues.fallbackRetryAttempts
              },
              resourceManagement: {
                cleanupInterval: configValues.resourceCleanupInterval,
                maxOrphanedResources: configValues.resourceMaxOrphaned,
                costAlertThreshold: configValues.resourceCostAlertThreshold,
                monitoringEnabled: configValues.resourceMonitoringEnabled
              }
            };
            
            fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
            ConfigManager.resetInstance();
            const configManager = ConfigManager.getInstance();
            const loadedConfig = configManager.getConfig();
            
            // Verify all configured values are used exactly as specified
            expect(loadedConfig.llm.model).toBe(configValues.llmModel);
            expect(loadedConfig.llm.maxTokens).toBe(configValues.llmMaxTokens);
            expect(loadedConfig.llm.temperature).toBe(configValues.llmTemperature);
            expect(loadedConfig.llm.timeout).toBe(configValues.llmTimeout);
            
            expect(loadedConfig.assistantAPI.enabled).toBe(configValues.assistantAPIEnabled);
            expect(loadedConfig.assistantAPI.model).toBe(configValues.assistantAPIModel);
            expect(loadedConfig.assistantAPI.maxFileSize).toBe(configValues.assistantAPIMaxFileSize);
            expect(loadedConfig.assistantAPI.vectorStoreExpiration).toBe(configValues.assistantAPIVectorStoreExpiration);
            expect(loadedConfig.assistantAPI.autoCleanup).toBe(configValues.assistantAPIAutoCleanup);
            expect(loadedConfig.assistantAPI.usageThreshold).toBe(configValues.assistantAPIUsageThreshold);
            
            expect(loadedConfig.fallback.enableFallback).toBe(configValues.fallbackEnabled);
            expect(loadedConfig.fallback.chunkSize).toBe(configValues.fallbackChunkSize);
            expect(loadedConfig.fallback.maxChunks).toBe(configValues.fallbackMaxChunks);
            expect(loadedConfig.fallback.truncationLimit).toBe(configValues.fallbackTruncationLimit);
            expect(loadedConfig.fallback.retryAttempts).toBe(configValues.fallbackRetryAttempts);
            
            expect(loadedConfig.resourceManagement.cleanupInterval).toBe(configValues.resourceCleanupInterval);
            expect(loadedConfig.resourceManagement.maxOrphanedResources).toBe(configValues.resourceMaxOrphaned);
            expect(loadedConfig.resourceManagement.costAlertThreshold).toBe(configValues.resourceCostAlertThreshold);
            expect(loadedConfig.resourceManagement.monitoringEnabled).toBe(configValues.resourceMonitoringEnabled);
            
            // Verify feature flag methods return correct values
            expect(configManager.isAssistantAPIEnabled()).toBe(configValues.assistantAPIEnabled);
            expect(configManager.shouldUseFallback()).toBe(configValues.fallbackEnabled);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate configuration on startup and report issues', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            assistantAPIEnabled: fc.boolean(),
            assistantAPIModel: fc.oneof(fc.constant(''), fc.constantFrom('gpt-4', 'gpt-3.5-turbo')),
            assistantAPIMaxFileSize: fc.integer({ min: -10, max: 500 }),
            fallbackChunkSize: fc.integer({ min: -100, max: 10000 }),
            resourceCleanupInterval: fc.integer({ min: -60, max: 1440 })
          }),
          
          async (configValues) => {
            const testConfig = {
              llm: {
                provider: 'openai' as const,
                model: 'gpt-4',
                apiKey: 'test-key',
                maxTokens: 2000,
                temperature: 0.7,
                timeout: 30000
              },
              game: {
                defaultRounds: 15,
                maxPlayers: 4,
                turnTimeoutSeconds: 60,
                gameStateDirectory: './game_states',
                maxNovelSizeMB: 50
              },
              testing: {
                outputDirectory: './test_outputs',
                cohesionAnalysisModel: 'gpt-4',
                testIterations: 6
              },
              assistantAPI: {
                enabled: configValues.assistantAPIEnabled,
                model: configValues.assistantAPIModel,
                maxFileSize: configValues.assistantAPIMaxFileSize,
                vectorStoreExpiration: 7,
                autoCleanup: true,
                usageThreshold: 1000
              },
              fallback: {
                enableFallback: true,
                chunkSize: configValues.fallbackChunkSize,
                maxChunks: 10,
                truncationLimit: 40000,
                retryAttempts: 3
              },
              resourceManagement: {
                cleanupInterval: configValues.resourceCleanupInterval,
                maxOrphanedResources: 50,
                costAlertThreshold: 100,
                monitoringEnabled: true
              }
            };
            
            fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
            ConfigManager.resetInstance();
            const configManager = ConfigManager.getInstance();
            const validation = configManager.validateConfiguration();
            
            // Determine expected validation results
            const shouldHaveErrors = (
              (configValues.assistantAPIEnabled && configValues.assistantAPIModel === '') ||
              (configValues.assistantAPIEnabled && configValues.assistantAPIMaxFileSize <= 0) ||
              configValues.fallbackChunkSize <= 0 ||
              configValues.resourceCleanupInterval <= 0
            );
            
            expect(validation.isValid).toBe(!shouldHaveErrors);
            
            if (shouldHaveErrors) {
              expect(validation.errors.length).toBeGreaterThan(0);
              
              if (configValues.assistantAPIEnabled && configValues.assistantAPIModel === '') {
                expect(validation.errors).toContain('Assistant API model is required when Assistant API is enabled');
              }
              if (configValues.assistantAPIEnabled && configValues.assistantAPIMaxFileSize <= 0) {
                expect(validation.errors).toContain('Assistant API maxFileSize must be greater than 0');
              }
              if (configValues.fallbackChunkSize <= 0) {
                expect(validation.errors).toContain('Fallback chunkSize must be greater than 0');
              }
              if (configValues.resourceCleanupInterval <= 0) {
                expect(validation.errors).toContain('Resource Management cleanupInterval must be greater than 0');
              }
            } else {
              expect(validation.errors).toHaveLength(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: openai-assistants-rag, Property 12: Feature Flag Enforcement
  // **Validates: Requirements 6.4**
  describe('Property 12: Feature Flag Enforcement', () => {
    it('should enforce feature flag behavior consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // assistantAPIEnabled
          
          async (assistantAPIEnabled) => {
            const testConfig = {
              llm: {
                provider: 'openai' as const,
                model: 'gpt-4',
                apiKey: 'test-key',
                maxTokens: 2000,
                temperature: 0.7,
                timeout: 30000
              },
              game: {
                defaultRounds: 15,
                maxPlayers: 4,
                turnTimeoutSeconds: 60,
                gameStateDirectory: './game_states',
                maxNovelSizeMB: 50
              },
              testing: {
                outputDirectory: './test_outputs',
                cohesionAnalysisModel: 'gpt-4',
                testIterations: 6
              },
              assistantAPI: {
                enabled: assistantAPIEnabled,
                model: 'gpt-4',
                maxFileSize: 100,
                vectorStoreExpiration: 7,
                autoCleanup: true,
                usageThreshold: 1000
              },
              fallback: {
                enableFallback: true,
                chunkSize: 4000,
                maxChunks: 10,
                truncationLimit: 40000,
                retryAttempts: 3
              },
              resourceManagement: {
                cleanupInterval: 60,
                maxOrphanedResources: 50,
                costAlertThreshold: 100,
                monitoringEnabled: true
              }
            };
            
            fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
            ConfigManager.resetInstance();
            const configManager = ConfigManager.getInstance();
            
            // Feature flag should consistently return the configured value
            expect(configManager.isAssistantAPIEnabled()).toBe(assistantAPIEnabled);
            
            // Multiple calls should return the same value
            expect(configManager.isAssistantAPIEnabled()).toBe(assistantAPIEnabled);
            expect(configManager.isAssistantAPIEnabled()).toBe(assistantAPIEnabled);
            
            // Configuration object should reflect the feature flag
            const config = configManager.getConfig();
            expect(config.assistantAPI.enabled).toBe(assistantAPIEnabled);
            
            // Assistant API config should be accessible regardless of flag state
            const assistantAPIConfig = configManager.getAssistantAPIConfig();
            expect(assistantAPIConfig.enabled).toBe(assistantAPIEnabled);
            expect(assistantAPIConfig.model).toBe('gpt-4');
            expect(assistantAPIConfig.maxFileSize).toBe(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle feature flag changes through configuration reloads', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // initialState
          fc.boolean(), // newState
          
          async (initialState, newState) => {
            // Set initial configuration
            const initialConfig = {
              llm: {
                provider: 'openai' as const,
                model: 'gpt-4',
                apiKey: 'test-key',
                maxTokens: 2000,
                temperature: 0.7,
                timeout: 30000
              },
              game: {
                defaultRounds: 15,
                maxPlayers: 4,
                turnTimeoutSeconds: 60,
                gameStateDirectory: './game_states',
                maxNovelSizeMB: 50
              },
              testing: {
                outputDirectory: './test_outputs',
                cohesionAnalysisModel: 'gpt-4',
                testIterations: 6
              },
              assistantAPI: {
                enabled: initialState,
                model: 'gpt-4',
                maxFileSize: 100,
                vectorStoreExpiration: 7,
                autoCleanup: true,
                usageThreshold: 1000
              },
              fallback: {
                enableFallback: true,
                chunkSize: 4000,
                maxChunks: 10,
                truncationLimit: 40000,
                retryAttempts: 3
              },
              resourceManagement: {
                cleanupInterval: 60,
                maxOrphanedResources: 50,
                costAlertThreshold: 100,
                monitoringEnabled: true
              }
            };
            
            fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
            ConfigManager.resetInstance();
            let configManager = ConfigManager.getInstance();
            
            // Verify initial state
            expect(configManager.isAssistantAPIEnabled()).toBe(initialState);
            
            // Change configuration
            const newConfig = { ...initialConfig };
            newConfig.assistantAPI.enabled = newState;
            
            fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
            ConfigManager.resetInstance();
            configManager = ConfigManager.getInstance();
            
            // Verify new state
            expect(configManager.isAssistantAPIEnabled()).toBe(newState);
            
            // Verify configuration consistency
            const config = configManager.getConfig();
            expect(config.assistantAPI.enabled).toBe(newState);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});