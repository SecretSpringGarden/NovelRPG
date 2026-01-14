import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { SystemConfig, LLMConfig, GameConfig, TestConfig, AssistantAPIConfig, FallbackConfig, ResourceManagementConfig } from './types';

export class ConfigManager {
  private static instance: ConfigManager;
  private systemConfig: SystemConfig;
  private static forceReload = false;

  private constructor() {
    // Load environment variables
    config();
    
    // Load configuration from file
    this.systemConfig = this.loadConfiguration();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance || ConfigManager.forceReload) {
      ConfigManager.instance = new ConfigManager();
      ConfigManager.forceReload = false;
    }
    return ConfigManager.instance;
  }

  public static resetInstance(): void {
    ConfigManager.instance = null as any;
    ConfigManager.forceReload = true;
  }

  private loadConfiguration(): SystemConfig {
    const configPath = path.join(process.cwd(), 'config.json');
    
    let fileConfig: Partial<SystemConfig> = {};
    
    // Try to load config file if it exists
    if (fs.existsSync(configPath)) {
      try {
        const configData = fs.readFileSync(configPath, 'utf-8');
        fileConfig = JSON.parse(configData);
      } catch (error) {
        console.warn('Warning: Could not parse config.json, using defaults');
      }
    }

    // Merge with defaults and environment variables
    return {
      llm: {
        provider: (fileConfig.llm?.provider as any) || 'openai',
        model: fileConfig.llm?.model !== undefined ? fileConfig.llm.model : 'gpt-4',
        apiKey: this.resolveEnvironmentVariable(fileConfig.llm?.apiKey) || process.env.OPENAI_API_KEY,
        baseUrl: fileConfig.llm?.baseUrl,
        maxTokens: fileConfig.llm?.maxTokens || 2000,
        temperature: fileConfig.llm?.temperature !== undefined ? fileConfig.llm.temperature : 0.7,
        timeout: fileConfig.llm?.timeout || 30000
      },
      game: {
        defaultRounds: fileConfig.game?.defaultRounds || 15,
        maxPlayers: fileConfig.game?.maxPlayers || 4,
        turnTimeoutSeconds: fileConfig.game?.turnTimeoutSeconds || 60,
        gameStateDirectory: fileConfig.game?.gameStateDirectory || './game_states',
        maxNovelSizeMB: fileConfig.game?.maxNovelSizeMB || 50
      },
      testing: {
        outputDirectory: fileConfig.testing?.outputDirectory || './test_outputs',
        cohesionAnalysisModel: fileConfig.testing?.cohesionAnalysisModel || 'gpt-4',
        testIterations: fileConfig.testing?.testIterations || 6
      },
      assistantAPI: {
        enabled: fileConfig.assistantAPI?.enabled !== undefined ? fileConfig.assistantAPI.enabled : false,
        model: fileConfig.assistantAPI?.model !== undefined ? fileConfig.assistantAPI.model : 'gpt-4',
        maxFileSize: fileConfig.assistantAPI?.maxFileSize !== undefined ? fileConfig.assistantAPI.maxFileSize : 100,
        vectorStoreExpiration: fileConfig.assistantAPI?.vectorStoreExpiration !== undefined ? fileConfig.assistantAPI.vectorStoreExpiration : 7,
        autoCleanup: fileConfig.assistantAPI?.autoCleanup !== undefined ? fileConfig.assistantAPI.autoCleanup : true,
        usageThreshold: fileConfig.assistantAPI?.usageThreshold !== undefined ? fileConfig.assistantAPI.usageThreshold : 1000
      },
      fallback: {
        enableFallback: fileConfig.fallback?.enableFallback !== undefined ? fileConfig.fallback.enableFallback : true,
        chunkSize: fileConfig.fallback?.chunkSize !== undefined ? fileConfig.fallback.chunkSize : 4000,
        maxChunks: fileConfig.fallback?.maxChunks !== undefined ? fileConfig.fallback.maxChunks : 10,
        truncationLimit: fileConfig.fallback?.truncationLimit !== undefined ? fileConfig.fallback.truncationLimit : 40000,
        retryAttempts: fileConfig.fallback?.retryAttempts !== undefined ? fileConfig.fallback.retryAttempts : 3
      },
      resourceManagement: {
        cleanupInterval: fileConfig.resourceManagement?.cleanupInterval !== undefined ? fileConfig.resourceManagement.cleanupInterval : 60,
        maxOrphanedResources: fileConfig.resourceManagement?.maxOrphanedResources !== undefined ? fileConfig.resourceManagement.maxOrphanedResources : 50,
        costAlertThreshold: fileConfig.resourceManagement?.costAlertThreshold !== undefined ? fileConfig.resourceManagement.costAlertThreshold : 100,
        monitoringEnabled: fileConfig.resourceManagement?.monitoringEnabled !== undefined ? fileConfig.resourceManagement.monitoringEnabled : true
      }
    };
  }

  private resolveEnvironmentVariable(value?: string): string | undefined {
    if (!value) return undefined;
    
    // Check if value is an environment variable reference like ${VAR_NAME}
    const envVarMatch = value.match(/^\$\{(.+)\}$/);
    if (envVarMatch) {
      return process.env[envVarMatch[1]];
    }
    
    return value;
  }

  public getConfig(): SystemConfig {
    return { ...this.systemConfig };
  }

  public getLLMConfig(): LLMConfig {
    return { ...this.systemConfig.llm };
  }

  public getGameConfig(): GameConfig {
    return { ...this.systemConfig.game };
  }

  public getTestConfig(): TestConfig {
    return { ...this.systemConfig.testing };
  }

  public getAssistantAPIConfig(): AssistantAPIConfig {
    return { ...this.systemConfig.assistantAPI };
  }

  public getFallbackConfig(): FallbackConfig {
    return { ...this.systemConfig.fallback };
  }

  public getResourceManagementConfig(): ResourceManagementConfig {
    return { ...this.systemConfig.resourceManagement };
  }

  public isAssistantAPIEnabled(): boolean {
    return this.systemConfig.assistantAPI.enabled;
  }

  public shouldUseFallback(): boolean {
    return this.systemConfig.fallback.enableFallback;
  }

  public validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate LLM configuration
    if (!this.systemConfig.llm.model || this.systemConfig.llm.model.trim() === '') {
      errors.push('LLM model is required');
    }

    if (this.systemConfig.llm.provider === 'openai' && !this.systemConfig.llm.apiKey) {
      errors.push('OpenAI API key is required when using OpenAI provider');
    }

    if (this.systemConfig.llm.maxTokens <= 0 || !Number.isFinite(this.systemConfig.llm.maxTokens)) {
      errors.push('LLM maxTokens must be greater than 0');
    }

    if (this.systemConfig.llm.temperature < 0 || this.systemConfig.llm.temperature > 2 || !Number.isFinite(this.systemConfig.llm.temperature)) {
      errors.push('LLM temperature must be between 0 and 2');
    }

    if (this.systemConfig.llm.timeout <= 0 || !Number.isFinite(this.systemConfig.llm.timeout)) {
      errors.push('LLM timeout must be greater than 0');
    }

    // Validate game configuration
    if (this.systemConfig.game.maxPlayers !== 4) {
      errors.push('Game maxPlayers must be exactly 4');
    }

    if (this.systemConfig.game.defaultRounds < 10 || this.systemConfig.game.defaultRounds > 20 || !Number.isFinite(this.systemConfig.game.defaultRounds)) {
      errors.push('Game defaultRounds must be between 10 and 20');
    }

    if (this.systemConfig.game.maxNovelSizeMB <= 0 || !Number.isFinite(this.systemConfig.game.maxNovelSizeMB)) {
      errors.push('Game maxNovelSizeMB must be greater than 0');
    }

    // Validate testing configuration
    if (this.systemConfig.testing.testIterations <= 0 || !Number.isFinite(this.systemConfig.testing.testIterations)) {
      errors.push('Testing testIterations must be greater than 0');
    }

    // Validate Assistant API configuration
    if (this.systemConfig.assistantAPI.enabled) {
      if (!this.systemConfig.assistantAPI.model || this.systemConfig.assistantAPI.model.trim() === '') {
        errors.push('Assistant API model is required when Assistant API is enabled');
      }

    if (this.systemConfig.assistantAPI.maxFileSize <= 0 || !Number.isFinite(this.systemConfig.assistantAPI.maxFileSize)) {
        errors.push('Assistant API maxFileSize must be greater than 0');
      }

      if (this.systemConfig.assistantAPI.vectorStoreExpiration <= 0 || !Number.isFinite(this.systemConfig.assistantAPI.vectorStoreExpiration)) {
        errors.push('Assistant API vectorStoreExpiration must be greater than 0');
      }

      if (this.systemConfig.assistantAPI.usageThreshold <= 0 || !Number.isFinite(this.systemConfig.assistantAPI.usageThreshold)) {
        errors.push('Assistant API usageThreshold must be greater than 0');
      }

      // Validate that OpenAI API key is available when Assistant API is enabled
      if (!this.systemConfig.llm.apiKey) {
        errors.push('OpenAI API key is required when Assistant API is enabled');
      }
    }

    // Validate Fallback configuration
    if (this.systemConfig.fallback.chunkSize <= 0 || !Number.isFinite(this.systemConfig.fallback.chunkSize)) {
      errors.push('Fallback chunkSize must be greater than 0');
    }

    if (this.systemConfig.fallback.maxChunks <= 0 || !Number.isFinite(this.systemConfig.fallback.maxChunks)) {
      errors.push('Fallback maxChunks must be greater than 0');
    }

    if (this.systemConfig.fallback.truncationLimit <= 0 || !Number.isFinite(this.systemConfig.fallback.truncationLimit)) {
      errors.push('Fallback truncationLimit must be greater than 0');
    }

    if (this.systemConfig.fallback.retryAttempts < 0 || !Number.isFinite(this.systemConfig.fallback.retryAttempts)) {
      errors.push('Fallback retryAttempts must be 0 or greater');
    }

    // Validate Resource Management configuration
    if (this.systemConfig.resourceManagement.cleanupInterval <= 0 || !Number.isFinite(this.systemConfig.resourceManagement.cleanupInterval)) {
      errors.push('Resource Management cleanupInterval must be greater than 0');
    }

    if (this.systemConfig.resourceManagement.maxOrphanedResources < 0 || !Number.isFinite(this.systemConfig.resourceManagement.maxOrphanedResources)) {
      errors.push('Resource Management maxOrphanedResources must be 0 or greater');
    }

    if (this.systemConfig.resourceManagement.costAlertThreshold < 0 || !Number.isFinite(this.systemConfig.resourceManagement.costAlertThreshold)) {
      errors.push('Resource Management costAlertThreshold must be 0 or greater');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public createDefaultConfigFile(): void {
    const defaultConfig: SystemConfig = {
      llm: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: '${OPENAI_API_KEY}',
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
        enabled: false,
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

    const configPath = path.join(process.cwd(), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  }
}