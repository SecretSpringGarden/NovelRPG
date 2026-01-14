import * as fs from 'fs';
import { LLMConfig } from '../config/types';

export interface VectorStoreStatus {
  id: string;
  status: 'in_progress' | 'completed' | 'failed';
  fileCount: number;
  sizeBytes: number;
  lastActivity: Date;
}

export interface VectorStoreManager {
  initialize(config: LLMConfig): Promise<void>;
  createVectorStore(name: string, expirationDays?: number): Promise<string>;
  uploadFileToVectorStore(vectorStoreId: string, filePath: string): Promise<string>;
  attachVectorStoreToAssistant(assistantId: string, vectorStoreId: string): Promise<void>;
  deleteVectorStore(vectorStoreId: string): Promise<void>;
  getVectorStoreStatus(vectorStoreId: string): Promise<VectorStoreStatus>;
}

interface OpenAIVectorStore {
  id: string;
  object: string;
  created_at: number;
  name: string;
  usage_bytes: number;
  file_counts: {
    in_progress: number;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
  };
  status: 'expired' | 'in_progress' | 'completed';
  expires_after?: {
    anchor: string;
    days: number;
  };
  expires_at?: number;
  last_active_at: number;
}

interface OpenAIVectorStoreFile {
  id: string;
  object: string;
  usage_bytes: number;
  created_at: number;
  vector_store_id: string;
  status: 'in_progress' | 'completed' | 'cancelled' | 'failed';
  last_error?: {
    code: string;
    message: string;
  };
}

interface OpenAIFile {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

export class OpenAIVectorStoreManager implements VectorStoreManager {
  private config: LLMConfig | null = null;
  private initialized = false;

  async initialize(config: LLMConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.config = { ...config };
    this.initialized = true;
  }

  async createVectorStore(name: string, expirationDays?: number): Promise<string> {
    this.ensureInitialized();
    
    console.log(`📚 Creating vector store: ${name}`);
    
    const requestBody: any = {
      name: name
    };

    // Add expiration if specified
    if (expirationDays && expirationDays > 0) {
      requestBody.expires_after = {
        anchor: 'last_active_at',
        days: expirationDays
      };
    }

    const response = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to create vector store: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const vectorStore = await response.json() as OpenAIVectorStore;
    console.log(`✅ Vector store created successfully: ${vectorStore.id}`);
    
    return vectorStore.id;
  }

  async uploadFileToVectorStore(vectorStoreId: string, filePath: string): Promise<string> {
    this.ensureInitialized();
    
    console.log(`📤 Uploading file to vector store ${vectorStoreId}: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = filePath.split(/[/\\]/).pop() || 'file.txt';
    
    // First, upload the file to OpenAI
    const formData = new FormData();
    formData.append('file', new Blob([fs.readFileSync(filePath)]), fileName);
    formData.append('purpose', 'assistants');

    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config!.apiKey}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText} - ${JSON.stringify(errorData)}`);
    }

    const fileData = await uploadResponse.json() as OpenAIFile;
    console.log(`✅ File uploaded: ${fileData.id}`);

    // Then, add the file to the vector store
    const addFileResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        file_id: fileData.id
      })
    });

    if (!addFileResponse.ok) {
      const errorData = await addFileResponse.json().catch(() => ({}));
      // Try to cleanup the uploaded file if adding to vector store fails
      try {
        await fetch(`https://api.openai.com/v1/files/${fileData.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`
          }
        });
      } catch (cleanupError) {
        console.warn(`Failed to cleanup file after vector store error: ${cleanupError}`);
      }
      throw new Error(`Failed to add file to vector store: ${addFileResponse.status} ${addFileResponse.statusText} - ${JSON.stringify(errorData)}`);
    }

    const vectorStoreFile = await addFileResponse.json() as OpenAIVectorStoreFile;
    console.log(`✅ File added to vector store successfully: ${vectorStoreFile.id}`);
    
    return fileData.id;
  }

  async attachVectorStoreToAssistant(assistantId: string, vectorStoreId: string): Promise<void> {
    this.ensureInitialized();
    
    console.log(`🔗 Attaching vector store ${vectorStoreId} to assistant ${assistantId}`);

    const response = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreId]
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to attach vector store to assistant: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    console.log(`✅ Vector store attached to assistant successfully`);
  }

  async deleteVectorStore(vectorStoreId: string): Promise<void> {
    this.ensureInitialized();
    
    console.log(`🗑️ Deleting vector store: ${vectorStoreId}`);

    const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to delete vector store: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    console.log(`✅ Vector store deleted successfully: ${vectorStoreId}`);
  }

  async getVectorStoreStatus(vectorStoreId: string): Promise<VectorStoreStatus> {
    this.ensureInitialized();
    
    const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
      headers: {
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get vector store status: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const vectorStore = await response.json() as OpenAIVectorStore;
    
    return {
      id: vectorStore.id,
      status: vectorStore.status === 'expired' ? 'failed' : vectorStore.status,
      fileCount: vectorStore.file_counts.total,
      sizeBytes: vectorStore.usage_bytes,
      lastActivity: new Date(vectorStore.last_active_at * 1000)
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new Error('VectorStoreManager must be initialized before use');
    }
  }
}

export function createVectorStoreManager(): VectorStoreManager {
  return new OpenAIVectorStoreManager();
}