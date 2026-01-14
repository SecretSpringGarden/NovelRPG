export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

export interface GameConfig {
  defaultRounds: number;
  maxPlayers: number;
  turnTimeoutSeconds: number;
  gameStateDirectory: string;
  maxNovelSizeMB: number;
}

export interface TestConfig {
  outputDirectory: string;
  cohesionAnalysisModel: string;
  testIterations: number;
}

export interface AssistantAPIConfig {
  enabled: boolean;
  model: string;
  maxFileSize: number; // in MB
  vectorStoreExpiration: number; // in days
  autoCleanup: boolean;
  usageThreshold: number; // monitoring threshold for usage tracking
}

/**
 * @deprecated FallbackConfig is no longer used in RAG-only architecture
 * This interface is kept for backward compatibility but has no effect
 * The system now uses Assistant API exclusively without fallback
 */
export interface FallbackConfig {
  enableFallback: boolean;
  chunkSize: number;
  maxChunks: number;
  truncationLimit: number;
  retryAttempts: number;
}

export interface ResourceManagementConfig {
  cleanupInterval: number; // in minutes
  maxOrphanedResources: number;
  costAlertThreshold: number;
  monitoringEnabled: boolean;
}

export interface SystemConfig {
  llm: LLMConfig;
  game: GameConfig;
  testing: TestConfig;
  assistantAPI: AssistantAPIConfig;
  fallback: FallbackConfig;
  resourceManagement: ResourceManagementConfig;
}