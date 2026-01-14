import { LLMConfig } from '../config/types';

export interface ResourceIdentifiers {
  assistantId?: string;
  fileId?: string;
  vectorStoreId?: string;
}

export interface CleanupResult {
  success: boolean;
  resourcesDeleted: string[];
  errors: string[];
  costSavings: number;
}

export interface OrphanedResource {
  id: string;
  type: 'assistant' | 'file' | 'vector_store';
  createdAt: Date;
  estimatedCost: number;
}

export interface AssistantSession {
  sessionId: string;
  novelTitle: string;
  novelPath: string;
  assistantId: string;
  fileId: string;
  vectorStoreId: string;
  createdAt: Date;
  status: 'initializing' | 'active' | 'completed' | 'failed' | 'cleaning_up';
  queriesExecuted: number;
  totalCost: number;
  cleanupScheduled: boolean;
}

export interface ResourceCleanupManager {
  initialize(config: LLMConfig): Promise<void>;
  scheduleCleanup(assistantId: string, fileId: string, vectorStoreId: string): void;
  executeCleanup(resourceIds: ResourceIdentifiers): Promise<CleanupResult>;
  forceCleanupAll(): Promise<CleanupResult[]>;
  getOrphanedResources(): Promise<OrphanedResource[]>;
  validateCleanup(resourceIds: ResourceIdentifiers): Promise<boolean>;
  trackSession(session: AssistantSession): void;
  completeSession(sessionId: string): Promise<void>;
  failSession(sessionId: string, error: string): Promise<void>;
  getActiveSessions(): AssistantSession[];
}

interface OpenAIAssistant {
  id: string;
  object: string;
  created_at: number;
  name: string;
  description: string;
  model: string;
}

interface OpenAIFile {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

interface OpenAIVectorStore {
  id: string;
  object: string;
  created_at: number;
  name: string;
  usage_bytes: number;
  file_counts: {
    total: number;
  };
  status: string;
}

export class OpenAIResourceCleanupManager implements ResourceCleanupManager {
  private config: LLMConfig | null = null;
  private initialized = false;
  private scheduledCleanups: Map<string, ResourceIdentifiers> = new Map();
  private activeSessions: Map<string, AssistantSession> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  async initialize(config: LLMConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.config = { ...config };
    this.initialized = true;

    // Only start cleanup interval in production, not in tests
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupInterval();
    }
  }

  scheduleCleanup(assistantId: string, fileId: string, vectorStoreId: string): void {
    this.ensureInitialized();
    
    const cleanupId = `${assistantId}-${fileId}-${vectorStoreId}`;
    const resourceIds: ResourceIdentifiers = {
      assistantId,
      fileId,
      vectorStoreId
    };

    this.scheduledCleanups.set(cleanupId, resourceIds);
    console.log(`🗓️ Scheduled cleanup for resources: ${cleanupId}`);
  }

  async executeCleanup(resourceIds: ResourceIdentifiers): Promise<CleanupResult> {
    this.ensureInitialized();
    
    const result: CleanupResult = {
      success: true,
      resourcesDeleted: [],
      errors: [],
      costSavings: 0
    };

    console.log(`🧹 Executing cleanup for resources:`, resourceIds);

    // Clean up assistant
    if (resourceIds.assistantId) {
      try {
        const response = await fetch(`https://api.openai.com/v1/assistants/${resourceIds.assistantId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });

        if (response.ok) {
          result.resourcesDeleted.push(`assistant:${resourceIds.assistantId}`);
          console.log(`✅ Assistant deleted: ${resourceIds.assistantId}`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          result.errors.push(`Failed to delete assistant ${resourceIds.assistantId}: ${response.status} - ${JSON.stringify(errorData)}`);
          result.success = false;
        }
      } catch (error) {
        result.errors.push(`Error deleting assistant ${resourceIds.assistantId}: ${error}`);
        result.success = false;
      }
    }

    // Clean up vector store
    if (resourceIds.vectorStoreId) {
      try {
        const response = await fetch(`https://api.openai.com/v1/vector_stores/${resourceIds.vectorStoreId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });

        if (response.ok) {
          result.resourcesDeleted.push(`vector_store:${resourceIds.vectorStoreId}`);
          result.costSavings += 0.10; // Estimate $0.10/day savings
          console.log(`✅ Vector store deleted: ${resourceIds.vectorStoreId}`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          result.errors.push(`Failed to delete vector store ${resourceIds.vectorStoreId}: ${response.status} - ${JSON.stringify(errorData)}`);
          result.success = false;
        }
      } catch (error) {
        result.errors.push(`Error deleting vector store ${resourceIds.vectorStoreId}: ${error}`);
        result.success = false;
      }
    }

    // Clean up file
    if (resourceIds.fileId) {
      try {
        const response = await fetch(`https://api.openai.com/v1/files/${resourceIds.fileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`
          }
        });

        if (response.ok) {
          result.resourcesDeleted.push(`file:${resourceIds.fileId}`);
          console.log(`✅ File deleted: ${resourceIds.fileId}`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          result.errors.push(`Failed to delete file ${resourceIds.fileId}: ${response.status} - ${JSON.stringify(errorData)}`);
          result.success = false;
        }
      } catch (error) {
        result.errors.push(`Error deleting file ${resourceIds.fileId}: ${error}`);
        result.success = false;
      }
    }

    return result;
  }

  async forceCleanupAll(): Promise<CleanupResult[]> {
    this.ensureInitialized();
    
    console.log(`🧹 Force cleanup of all scheduled resources`);
    const results: CleanupResult[] = [];

    // Execute all scheduled cleanups
    for (const [cleanupId, resourceIds] of this.scheduledCleanups.entries()) {
      try {
        const result = await this.executeCleanup(resourceIds);
        results.push(result);
        this.scheduledCleanups.delete(cleanupId);
      } catch (error) {
        results.push({
          success: false,
          resourcesDeleted: [],
          errors: [`Failed to cleanup ${cleanupId}: ${error}`],
          costSavings: 0
        });
      }
    }

    // Also cleanup orphaned resources
    try {
      const orphanedResources = await this.getOrphanedResources();
      for (const resource of orphanedResources) {
        const resourceIds: ResourceIdentifiers = {};
        
        if (resource.type === 'assistant') {
          resourceIds.assistantId = resource.id;
        } else if (resource.type === 'file') {
          resourceIds.fileId = resource.id;
        } else if (resource.type === 'vector_store') {
          resourceIds.vectorStoreId = resource.id;
        }

        const result = await this.executeCleanup(resourceIds);
        results.push(result);
      }
    } catch (error) {
      results.push({
        success: false,
        resourcesDeleted: [],
        errors: [`Failed to cleanup orphaned resources: ${error}`],
        costSavings: 0
      });
    }

    return results;
  }

  async getOrphanedResources(): Promise<OrphanedResource[]> {
    this.ensureInitialized();
    
    const orphanedResources: OrphanedResource[] = [];

    try {
      // Get all assistants
      const assistantsResponse = await fetch('https://api.openai.com/v1/assistants', {
        headers: {
          'Authorization': `Bearer ${this.config!.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (assistantsResponse.ok) {
        const assistantsData = await assistantsResponse.json() as { data: OpenAIAssistant[] };
        const trackedAssistantIds = new Set(Array.from(this.activeSessions.values()).map(s => s.assistantId));
        
        for (const assistant of assistantsData.data) {
          if (!trackedAssistantIds.has(assistant.id)) {
            orphanedResources.push({
              id: assistant.id,
              type: 'assistant',
              createdAt: new Date(assistant.created_at * 1000),
              estimatedCost: 0.01 // Minimal cost for assistant
            });
          }
        }
      }

      // Get all files
      const filesResponse = await fetch('https://api.openai.com/v1/files', {
        headers: {
          'Authorization': `Bearer ${this.config!.apiKey}`
        }
      });

      if (filesResponse.ok) {
        const filesData = await filesResponse.json() as { data: OpenAIFile[] };
        const trackedFileIds = new Set(Array.from(this.activeSessions.values()).map(s => s.fileId));
        
        for (const file of filesData.data) {
          if (file.purpose === 'assistants' && !trackedFileIds.has(file.id)) {
            orphanedResources.push({
              id: file.id,
              type: 'file',
              createdAt: new Date(file.created_at * 1000),
              estimatedCost: (file.bytes / (1024 * 1024 * 1024)) * 0.10 // $0.10/GB/day
            });
          }
        }
      }

      // Get all vector stores
      const vectorStoresResponse = await fetch('https://api.openai.com/v1/vector_stores', {
        headers: {
          'Authorization': `Bearer ${this.config!.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (vectorStoresResponse.ok) {
        const vectorStoresData = await vectorStoresResponse.json() as { data: OpenAIVectorStore[] };
        const trackedVectorStoreIds = new Set(Array.from(this.activeSessions.values()).map(s => s.vectorStoreId));
        
        for (const vectorStore of vectorStoresData.data) {
          if (!trackedVectorStoreIds.has(vectorStore.id)) {
            orphanedResources.push({
              id: vectorStore.id,
              type: 'vector_store',
              createdAt: new Date(vectorStore.created_at * 1000),
              estimatedCost: (vectorStore.usage_bytes / (1024 * 1024 * 1024)) * 0.10 // $0.10/GB/day
            });
          }
        }
      }

    } catch (error) {
      console.warn(`Failed to get orphaned resources: ${error}`);
    }

    return orphanedResources;
  }

  async validateCleanup(resourceIds: ResourceIdentifiers): Promise<boolean> {
    this.ensureInitialized();
    
    let allDeleted = true;

    // Check if assistant still exists
    if (resourceIds.assistantId) {
      try {
        const response = await fetch(`https://api.openai.com/v1/assistants/${resourceIds.assistantId}`, {
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        if (response.ok) {
          allDeleted = false; // Assistant still exists
        }
      } catch (error) {
        // 404 error means resource is deleted, other errors mean we can't validate
        if (error instanceof Error || (typeof error === 'object' && error !== null && 'status' in error)) {
          // For test purposes, assume 404 means deleted, anything else means not deleted
          allDeleted = false;
        }
      }
    }

    // Check if file still exists
    if (resourceIds.fileId) {
      try {
        const response = await fetch(`https://api.openai.com/v1/files/${resourceIds.fileId}`, {
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`
          }
        });
        
        if (response.ok) {
          allDeleted = false; // File still exists
        }
      } catch (error) {
        // 404 error means resource is deleted, other errors mean we can't validate
        if (error instanceof Error || (typeof error === 'object' && error !== null && 'status' in error)) {
          // For test purposes, assume 404 means deleted, anything else means not deleted
          allDeleted = false;
        }
      }
    }

    // Check if vector store still exists
    if (resourceIds.vectorStoreId) {
      try {
        const response = await fetch(`https://api.openai.com/v1/vector_stores/${resourceIds.vectorStoreId}`, {
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        if (response.ok) {
          allDeleted = false; // Vector store still exists
        }
      } catch (error) {
        // 404 error means resource is deleted, other errors mean we can't validate
        if (error instanceof Error || (typeof error === 'object' && error !== null && 'status' in error)) {
          // For test purposes, assume 404 means deleted, anything else means not deleted
          allDeleted = false;
        }
      }
    }

    return allDeleted;
  }

  trackSession(session: AssistantSession): void {
    this.ensureInitialized();
    
    this.activeSessions.set(session.sessionId, { ...session });
    console.log(`📊 Tracking session: ${session.sessionId}`);
  }

  async completeSession(sessionId: string): Promise<void> {
    this.ensureInitialized();
    
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found for completion: ${sessionId}`);
      return;
    }

    // Update session status
    session.status = 'completed';
    session.cleanupScheduled = true;

    // Schedule cleanup
    this.scheduleCleanup(session.assistantId, session.fileId, session.vectorStoreId);

    console.log(`✅ Session completed and cleanup scheduled: ${sessionId}`);
  }

  async failSession(sessionId: string, error: string): Promise<void> {
    this.ensureInitialized();
    
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found for failure: ${sessionId}`);
      return;
    }

    // Update session status
    session.status = 'failed';
    session.cleanupScheduled = true;

    // Schedule cleanup even for failed sessions to prevent resource leaks
    this.scheduleCleanup(session.assistantId, session.fileId, session.vectorStoreId);

    console.log(`❌ Session failed and cleanup scheduled: ${sessionId} - Error: ${error}`);
  }

  getActiveSessions(): AssistantSession[] {
    this.ensureInitialized();
    
    return Array.from(this.activeSessions.values()).filter(
      session => session.status === 'active' || session.status === 'initializing'
    );
  }

  private startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.processScheduledCleanups();
      } catch (error) {
        console.error(`Error in scheduled cleanup: ${error}`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  private async processScheduledCleanups(): Promise<void> {
    if (this.scheduledCleanups.size === 0) {
      return;
    }

    console.log(`🧹 Processing ${this.scheduledCleanups.size} scheduled cleanups`);

    const cleanupPromises: Promise<void>[] = [];

    for (const [cleanupId, resourceIds] of this.scheduledCleanups.entries()) {
      cleanupPromises.push(
        this.executeCleanup(resourceIds)
          .then((result) => {
            if (result.success) {
              this.scheduledCleanups.delete(cleanupId);
              console.log(`✅ Scheduled cleanup completed: ${cleanupId}`);
            } else {
              console.warn(`⚠️ Scheduled cleanup had errors: ${cleanupId}`, result.errors);
            }
          })
          .catch((error) => {
            console.error(`❌ Scheduled cleanup failed: ${cleanupId}`, error);
          })
      );
    }

    await Promise.allSettled(cleanupPromises);
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new Error('ResourceCleanupManager must be initialized before use');
    }
  }

  // Cleanup method to stop intervals when service is destroyed
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export function createResourceCleanupManager(): ResourceCleanupManager {
  return new OpenAIResourceCleanupManager();
}