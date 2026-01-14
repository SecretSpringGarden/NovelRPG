import { AssistantService } from '../AssistantService';
import { LLMConfig } from '../../config/types';
import { ProgressCallback } from '../ProgressTracker';

/**
 * Mock implementation of AssistantService for testing
 * Simulates OpenAI Assistants API behavior without making real API calls
 */
export class MockAssistantService implements AssistantService {
  private initialized = false;
  private config: LLMConfig | null = null;
  private mockFileId = 'mock-file-id-12345';
  private mockAssistantId = 'mock-assistant-id-67890';
  private mockVectorStoreId = 'mock-vector-store-id-abcde';
  private uploadedFiles: Map<string, { id: string; size: number }> = new Map();
  private createdAssistants: Set<string> = new Set();
  private queryCount = 0;

  async initialize(config: LLMConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.config = { ...config };
    this.initialized = true;
  }

  async uploadNovelFile(filePath: string, progressCallback?: ProgressCallback): Promise<string> {
    this.ensureInitialized();
    
    // Simulate file validation
    if (!filePath || filePath.includes('nonexistent')) {
      throw new Error(`Novel file not found: ${filePath}`);
    }

    // Simulate upload delay
    await this.delay(100);

    const fileId = `mock-file-${Date.now()}`;
    this.uploadedFiles.set(fileId, { id: fileId, size: 100000 });
    
    return fileId;
  }

  async createNovelAnalysisAssistant(fileId: string, progressCallback?: ProgressCallback): Promise<string> {
    this.ensureInitialized();

    if (!this.uploadedFiles.has(fileId) && !fileId.startsWith('mock-file')) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Simulate assistant creation delay
    await this.delay(200);

    const assistantId = `mock-assistant-${Date.now()}`;
    this.createdAssistants.add(assistantId);
    
    return assistantId;
  }

  async queryAssistant(assistantId: string, query: string, progressCallback?: ProgressCallback): Promise<string> {
    this.ensureInitialized();

    if (!this.createdAssistants.has(assistantId) && !assistantId.startsWith('mock-assistant')) {
      throw new Error(`Assistant not found: ${assistantId}`);
    }

    // Simulate query processing delay
    await this.delay(300);

    this.queryCount++;

    // Return mock responses based on query content
    // Check for narrative structure first (most specific)
    if (query.toLowerCase().includes('narrative structure') || 
        query.toLowerCase().includes('introduction') && query.toLowerCase().includes('climax') && query.toLowerCase().includes('conclusion')) {
      return this.getMockNarrativeResponse(query);
    } else if (query.toLowerCase().includes('character')) {
      return this.getMockCharacterResponse();
    } else if (query.toLowerCase().includes('plot')) {
      return this.getMockPlotResponse();
    } else {
      return this.getMockGenericResponse();
    }
  }

  async cleanup(assistantId?: string, fileId?: string): Promise<void> {
    this.ensureInitialized();

    // Simulate cleanup delay
    await this.delay(50);

    if (assistantId) {
      this.createdAssistants.delete(assistantId);
    }

    if (fileId) {
      this.uploadedFiles.delete(fileId);
    }
  }

  async getUsageMetrics(): Promise<any> {
    return {
      filesUploaded: this.uploadedFiles.size,
      totalStorageUsed: Array.from(this.uploadedFiles.values()).reduce((sum, f) => sum + f.size, 0),
      queriesExecuted: this.queryCount,
      estimatedCost: this.queryCount * 0.01
    };
  }

  async runDiagnostics(): Promise<any[]> {
    return [
      {
        name: 'API Connectivity',
        status: 'passed',
        message: 'Mock API is always available'
      },
      {
        name: 'Configuration',
        status: 'passed',
        message: 'Mock configuration is valid'
      }
    ];
  }

  async getPerformanceReport(timeRange?: { start: Date; end: Date }): Promise<any> {
    return {
      totalOperations: this.queryCount,
      averageResponseTime: 300,
      successRate: 100,
      recommendations: []
    };
  }

  async getCostAnalysis(timeRange?: { start: Date; end: Date }): Promise<any> {
    return {
      totalCost: this.queryCount * 0.01,
      costByOperation: {
        upload: 0.001,
        query: 0.01,
        assistant_creation: 0.001
      }
    };
  }

  async getOptimizationRecommendations(): Promise<any[]> {
    return [];
  }

  async optimizeRateLimiting(): Promise<any> {
    return { status: 'optimized', message: 'Mock rate limiting is optimal' };
  }

  async optimizeConcurrentProcessing(): Promise<any> {
    return { status: 'optimized', message: 'Mock concurrent processing is optimal' };
  }

  async optimizeCohesionAnalysis(): Promise<any> {
    return { status: 'optimized', message: 'Mock cohesion analysis is optimal' };
  }

  async getPerformanceInsights(): Promise<any> {
    return {
      insights: ['Mock service is performing optimally'],
      metrics: {
        avgResponseTime: 300,
        successRate: 100
      }
    };
  }

  // Helper methods

  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new Error('AssistantService must be initialized before use');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getMockCharacterResponse(): string {
    return JSON.stringify({
      characters: [
        {
          id: "char-1",
          name: "Elizabeth Bennet",
          description: "The intelligent and spirited protagonist who values independence and wit.",
          importance: 10
        },
        {
          id: "char-2",
          name: "Mr. Fitzwilliam Darcy",
          description: "A wealthy and proud gentleman who initially appears aloof but proves to be honorable.",
          importance: 10
        },
        {
          id: "char-3",
          name: "Jane Bennet",
          description: "Elizabeth's elder sister, known for her beauty and gentle nature.",
          importance: 8
        },
        {
          id: "char-4",
          name: "Mr. Charles Bingley",
          description: "Darcy's friend, a cheerful and amiable gentleman who falls in love with Jane.",
          importance: 7
        }
      ]
    });
  }

  private getMockPlotResponse(): string {
    return JSON.stringify({
      plotPoints: [
        {
          id: "plot-1",
          sequence: 1,
          description: "The Bennet family learns that a wealthy bachelor, Mr. Bingley, has rented Netherfield Park.",
          importance: "major"
        },
        {
          id: "plot-2",
          sequence: 2,
          description: "At a ball, Elizabeth meets Mr. Darcy, who initially snubs her, creating a negative first impression.",
          importance: "major"
        },
        {
          id: "plot-3",
          sequence: 3,
          description: "Mr. Darcy proposes to Elizabeth, but she rejects him due to his pride and interference in Jane's relationship.",
          importance: "major"
        },
        {
          id: "plot-4",
          sequence: 4,
          description: "Elizabeth reads Darcy's letter explaining his actions and begins to reconsider her judgment of him.",
          importance: "major"
        },
        {
          id: "plot-5",
          sequence: 5,
          description: "After various misunderstandings are resolved, Darcy proposes again, and Elizabeth accepts.",
          importance: "major"
        }
      ]
    });
  }

  private getMockNarrativeResponse(query: string): string {
    // Return JSON format for narrative structure
    return JSON.stringify({
      introduction: "The novel opens with the famous line: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.' The story introduces the Bennet family, particularly focusing on Elizabeth Bennet, the second eldest of five daughters. The arrival of Mr. Bingley at Netherfield Park sets the social dynamics in motion, establishing the central themes of marriage, social class, and first impressions.",
      climax: "The climax occurs when Elizabeth visits Pemberley, Darcy's estate, and encounters him unexpectedly. This meeting, combined with Darcy's assistance in resolving Lydia's scandalous elopement with Wickham, marks the turning point in their relationship. Elizabeth realizes her true feelings for Darcy and recognizes how much he has changed, while Darcy demonstrates his genuine love through his actions.",
      conclusion: "The novel concludes with the marriages of both Elizabeth to Darcy and Jane to Bingley. The couples find happiness, and the narrative reflects on how pride and prejudice were overcome through understanding and personal growth. The Bennet family's fortunes improve, and the story ends on a note of domestic harmony and social satisfaction, with the main characters having learned valuable lessons about judgment and love."
    });
  }

  private getMockGenericResponse(): string {
    return "This is a mock response from the Assistant API. The actual implementation would provide detailed analysis based on the novel content.";
  }

  // Test helper methods (not part of the interface but useful for testing)
  
  public resetMockState(): void {
    this.uploadedFiles.clear();
    this.createdAssistants.clear();
    this.queryCount = 0;
  }

  public getUploadedFileCount(): number {
    return this.uploadedFiles.size;
  }

  public getCreatedAssistantCount(): number {
    return this.createdAssistants.size;
  }

  public getQueryCount(): number {
    return this.queryCount;
  }
}

export function createAssistantService(): AssistantService {
  return new MockAssistantService();
}
