import * as fs from 'fs';
import * as path from 'path';
import { AssistantService, createAssistantService } from './AssistantService';
import { NetworkIsolationValidator, createNetworkIsolationValidator, NetworkIsolationResult } from './NetworkIsolationValidator';
import { ProgressTracker, createProgressTracker, ProgressCallback } from './ProgressTracker';
import { 
  Character, 
  PlotPoint, 
  NovelAnalysis, 
  NarrativeStructure,
  validateCharacter,
  validatePlotPoint,
  validateNovelAnalysis
} from '../models';

export interface NovelAnalyzer {
  analyzeNovel(novelText: string, progressCallback?: ProgressCallback): Promise<NovelAnalysis>;
  validateFileSize(filePath: string, maxSizeMB: number): boolean;
  validateAnalysisCompleteness(analysis: NovelAnalysis): boolean;
  validateNetworkIsolation(novelText: string): Promise<NetworkIsolationResult>;
  // Assistant API methods
  analyzeNovelWithAssistant(novelPath: string, progressCallback?: ProgressCallback): Promise<NovelAnalysis>;
  extractCharactersWithAssistant(assistantId: string): Promise<Character[]>;
  extractPlotPointsWithAssistant(assistantId: string): Promise<PlotPoint[]>;
  identifyNarrativeStructureWithAssistant(assistantId: string): Promise<NarrativeStructure>;
}

export class DefaultNovelAnalyzer implements NovelAnalyzer {
  private assistantService: AssistantService;
  private networkValidator: NetworkIsolationValidator;
  private progressTracker: ProgressTracker;
  private currentAssistantId?: string;
  private currentFileId?: string;

  constructor() {
    this.assistantService = createAssistantService();
    this.networkValidator = createNetworkIsolationValidator();
    this.progressTracker = createProgressTracker();
  }

  /**
   * Performs complete novel analysis using Assistant API as the only processing method
   * Uses Assistant API for all novels to eliminate token limits through RAG capabilities
   * Requirement 2.1: Assistant API as primary processing method
   * Requirement 2.6: Maintain same output format regardless of processing method
   * Requirement 8.2: Focus on Assistant API reliability
   */
  async analyzeNovel(novelText: string, progressCallback?: ProgressCallback): Promise<NovelAnalysis> {
    // Always use Assistant API as the only processing method
    try {
      // Create a temporary file for the novel
      const tempFilePath = await this.createTempNovelFile(novelText);
      
      try {
        return await this.analyzeNovelWithAssistant(tempFilePath, progressCallback);
      } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    } catch (error) {
      console.error(`Assistant API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error; // Re-throw the error - no fallback in RAG-only mode
    }
  }

  /**
   * Analyzes a novel using Assistant API (primary processing method)
   * This method handles the complete workflow: upload, create assistant, analyze, cleanup
   * Requirement 8.2: Focus on Assistant API reliability
   */
  async analyzeNovelWithAssistant(novelPath: string, progressCallback?: ProgressCallback): Promise<NovelAnalysis> {
    const operationId = `analyze_novel_${Date.now()}`;
    
    return this.progressTracker.withProgress(
      operationId,
      [
        { id: 'setup', name: 'Setting up analysis', weight: 1 },
        { id: 'upload', name: 'Uploading novel', weight: 2 },
        { id: 'assistant', name: 'Creating assistant', weight: 2 },
        { id: 'characters', name: 'Extracting characters', weight: 3 },
        { id: 'plot', name: 'Extracting plot points', weight: 3 },
        { id: 'structure', name: 'Analyzing narrative structure', weight: 3 },
        { id: 'validation', name: 'Validating results', weight: 1 }
      ],
      async (tracker) => {
        const validationErrors: string[] = [];

        try {
          // Step 1: Setup
          tracker.startStep(operationId, 'setup');
          const novelText = await fs.promises.readFile(novelPath, 'utf8');
          console.log(`📊 Novel text length: ${novelText.length} chars`);
          console.log('🤖 Using OpenAI Assistants API with file search for full novel context');

          const llmConfig = require('../config/ConfigManager').ConfigManager.getInstance().getLLMConfig();
          await this.assistantService.initialize(llmConfig);
          tracker.completeStep(operationId, 'setup');

          // Step 2: Upload novel file
          tracker.startStep(operationId, 'upload');
          console.log('📤 Uploading novel to OpenAI...');
          this.currentFileId = await this.assistantService.uploadNovelFile(novelPath);
          tracker.completeStep(operationId, 'upload');
          
          // Step 3: Create assistant
          tracker.startStep(operationId, 'assistant');
          console.log('🤖 Creating specialized novel analysis assistant...');
          this.currentAssistantId = await this.assistantService.createNovelAnalysisAssistant(this.currentFileId);
          tracker.completeStep(operationId, 'assistant');

          // Step 4: Extract characters
          tracker.startStep(operationId, 'characters');
          console.log('📚 Extracting characters using assistant...');
          const characters = await this.extractCharactersWithAssistant(this.currentAssistantId);
          tracker.completeStep(operationId, 'characters');

          // Step 5: Extract plot points
          tracker.startStep(operationId, 'plot');
          console.log('📖 Extracting plot points using assistant...');
          const plotPoints = await this.extractPlotPointsWithAssistant(this.currentAssistantId);
          tracker.completeStep(operationId, 'plot');

          // Step 6: Analyze narrative structure
          tracker.startStep(operationId, 'structure');
          console.log('🏗️ Identifying narrative structure using assistant...');
          const narrativeStructure = await this.identifyNarrativeStructureWithAssistant(this.currentAssistantId);
          tracker.completeStep(operationId, 'structure');

          // Step 7: Validation
          tracker.startStep(operationId, 'validation');
          if (characters.length !== 4) {
            validationErrors.push(`Expected 4 characters, got ${characters.length}`);
          }

          if (plotPoints.length !== 5) {
            validationErrors.push(`Expected 5 plot points, got ${plotPoints.length}`);
          }

          if (!narrativeStructure.introduction.trim()) {
            validationErrors.push('Introduction extraction failed or empty');
          }

          if (!narrativeStructure.climax.trim()) {
            validationErrors.push('Climax extraction failed or empty');
          }

          if (!narrativeStructure.conclusion.trim()) {
            validationErrors.push('Conclusion extraction failed or empty');
          }
          tracker.completeStep(operationId, 'validation');

          const analysis: NovelAnalysis = {
            mainCharacters: characters,
            plotPoints: plotPoints,
            introduction: narrativeStructure.introduction,
            climax: narrativeStructure.climax,
            conclusion: narrativeStructure.conclusion,
            isComplete: validationErrors.length === 0,
            validationErrors: validationErrors
          };

          console.log(`✅ Novel analysis complete using Assistant API`);
          return analysis;

        } catch (error) {
          // Clean up resources on error
          if (this.currentAssistantId || this.currentFileId) {
            try {
              await this.cleanup();
            } catch (cleanupError) {
              console.warn('Failed to cleanup resources after error:', cleanupError);
            }
          }
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          validationErrors.push(`Novel analysis failed: ${errorMessage}`);
          
          throw new Error(`Assistant API analysis failed: ${errorMessage}`);
        }
      },
      progressCallback
    );
  }

  /**
   * Creates a temporary file for the novel text
   */
  private async createTempNovelFile(novelText: string): Promise<string> {
    const tempDir = require('os').tmpdir();
    const tempFilePath = require('path').join(tempDir, `novel-${Date.now()}.txt`);
    
    await fs.promises.writeFile(tempFilePath, novelText, 'utf8');
    return tempFilePath;
  }

  /**
   * Validates that a file exists and is within the size limit
   */
  validateFileSize(filePath: string, maxSizeMB: number): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      return fileSizeInMB <= maxSizeMB;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates that the analysis contains all required components
   */
  validateAnalysisCompleteness(analysis: NovelAnalysis): boolean {
    return validateNovelAnalysis(analysis);
  }

  /**
   * Validates that the novel analysis prompts don't contain external references
   */
  async validateNetworkIsolation(novelText: string): Promise<NetworkIsolationResult> {
    // Collect all prompts that would be used in analysis
    const prompts = [
      this.getCharacterExtractionPrompt(),
      this.getPlotPointExtractionPrompt(),
      this.getNarrativeStructurePrompt()
    ];

    return this.networkValidator.validateAnalysisIsolation(prompts);
  }

  /**
   * Gets the prompt used for character extraction (for validation purposes)
   */
  protected getCharacterExtractionPrompt(): string {
    return `Analyze ONLY the provided novel text and identify the top 4 main characters. Do not search for external information or access any internet resources. Work solely with the text provided below.

For each character, provide:
1. A unique ID (use character name in lowercase with underscores)
2. The character's full name
3. A brief description (2-3 sentences) based only on the provided text
4. An importance ranking from 1-10 (10 being most important)

Return the response in the following JSON format:
[
  {
    "id": "character_name",
    "name": "Character Full Name",
    "description": "Brief character description",
    "importance": 8
  }
]

Focus on characters who drive the plot and appear throughout the story. Ensure exactly 4 characters are returned. Use only the information contained in the provided novel text.`;
  }

  /**
   * Gets the prompt used for plot point extraction (for validation purposes)
   */
  protected getPlotPointExtractionPrompt(): string {
    return `Analyze ONLY the provided novel text and identify 5 high-level plot points that represent the key story progression. Do not search for external information or access any internet resources. Work solely with the text provided below.

For each plot point, provide:
1. A unique ID (use descriptive name in lowercase with underscores)
2. A description of the plot point (1-2 sentences) based only on the provided text
3. A sequence number (1-5, representing chronological order)

Return the response in the following JSON format:
[
  {
    "id": "plot_point_id",
    "description": "Description of the plot point",
    "sequence": 1
  }
]

Focus on the most significant events that drive the story forward. Ensure exactly 5 plot points are returned in chronological order. Use only the information contained in the provided novel text.`;
  }

  /**
   * Gets the prompt used for narrative structure extraction (for validation purposes)
   */
  protected getNarrativeStructurePrompt(): string {
    return `Analyze ONLY the provided novel text and identify the three key structural elements. Do not search for external information or access any internet resources. Work solely with the text provided below.

Provide detailed summaries for each structural element:
1. Introduction: The opening section that establishes characters, setting, and initial situation
2. Climax: The story's turning point and most intense moment  
3. Conclusion: The resolution and ending of the story

Return the response in the following JSON format:
{
  "introduction": "Detailed summary of the story's introduction and setup", 
  "climax": "Detailed summary of the story's climax and turning point", 
  "conclusion": "Detailed summary of the story's conclusion and resolution"
}

Focus on the most significant moments that define each structural element. Use only the information contained in the provided novel text.`;
  }

  /**
   * Extracts characters using the Assistant API
   * Requirement 2.3: Assistant API methods for character extraction
   */
  async extractCharactersWithAssistant(assistantId: string): Promise<Character[]> {
    if (!assistantId) {
      throw new Error('Assistant ID is required');
    }

    const prompt = `Analyze the novel and identify the top 4 main characters.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any explanatory text, markdown formatting, or code blocks. Your entire response must be parseable as JSON.

Return EXACTLY this JSON structure with 4 characters:
[
  {
    "id": "character_name_lowercase_with_underscores",
    "name": "Character Full Name",
    "description": "Brief 2-3 sentence character description based on the novel",
    "importance": 8
  },
  {
    "id": "another_character",
    "name": "Another Character Name",
    "description": "Brief 2-3 sentence character description",
    "importance": 7
  },
  {
    "id": "third_character",
    "name": "Third Character Name",
    "description": "Brief 2-3 sentence character description",
    "importance": 6
  },
  {
    "id": "fourth_character",
    "name": "Fourth Character Name",
    "description": "Brief 2-3 sentence character description",
    "importance": 5
  }
]

Requirements:
- Return EXACTLY 4 characters
- Each character must have: id (string), name (string), description (string), importance (number 1-10)
- Focus on characters who drive the plot and appear throughout the story
- Your response must start with [ and end with ]
- Do not wrap the JSON in markdown code blocks or add any other text`;

    const response = await this.assistantService.queryAssistant(assistantId, prompt);
    
    try {
      // Clean up response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Remove any leading/trailing whitespace again
      cleanedResponse = cleanedResponse.trim();
      
      // Try to find JSON array in the response if it's embedded in text
      const jsonArrayMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (jsonArrayMatch && !cleanedResponse.startsWith('[')) {
        cleanedResponse = jsonArrayMatch[0];
      }
      
      const characters = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(characters) || characters.length !== 4) {
        throw new Error(`Expected 4 characters, received ${Array.isArray(characters) ? characters.length : 'invalid format'}`);
      }

      // Validate each character
      const validatedCharacters: Character[] = [];
      for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        if (!validateCharacter(char)) {
          throw new Error(`Invalid character data at index ${i}: missing or invalid fields`);
        }
        validatedCharacters.push(char);
      }

      return validatedCharacters;
    } catch (parseError) {
      console.error('Character extraction failed. Raw response:', response);
      console.error('Parse error:', parseError);
      throw new Error('Invalid JSON response from Assistant for character extraction');
    }
  }

  /**
   * Extracts plot points using the Assistant API
   * Requirement 2.4: Assistant API methods for plot analysis
   */
  async extractPlotPointsWithAssistant(assistantId: string): Promise<PlotPoint[]> {
    if (!assistantId) {
      throw new Error('Assistant ID is required');
    }

    const prompt = `Analyze the novel and identify 5 high-level plot points that represent the key story progression.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any explanatory text, markdown formatting, or code blocks. Your entire response must be parseable as JSON.

Return EXACTLY this JSON structure with 5 plot points:
[
  {
    "id": "opening_situation",
    "description": "Brief 1-2 sentence description of the opening situation",
    "sequence": 1,
    "importance": "major"
  },
  {
    "id": "rising_action",
    "description": "Brief 1-2 sentence description of the rising action",
    "sequence": 2,
    "importance": "major"
  },
  {
    "id": "turning_point",
    "description": "Brief 1-2 sentence description of the turning point",
    "sequence": 3,
    "importance": "major"
  },
  {
    "id": "falling_action",
    "description": "Brief 1-2 sentence description of the falling action",
    "sequence": 4,
    "importance": "major"
  },
  {
    "id": "resolution",
    "description": "Brief 1-2 sentence description of the resolution",
    "sequence": 5,
    "importance": "major"
  }
]

Requirements:
- Return EXACTLY 5 plot points in chronological order
- Each plot point must have: id (string), description (string), sequence (number 1-5), importance ("major" or "minor")
- All 5 plot points should typically be "major" since they represent key story progression
- Focus on the most significant events that drive the story forward
- Your response must start with [ and end with ]
- Do not wrap the JSON in markdown code blocks or add any other text`;

    const response = await this.assistantService.queryAssistant(assistantId, prompt);
    
    try {
      // Clean up response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Remove any leading/trailing whitespace again
      cleanedResponse = cleanedResponse.trim();
      
      // Try to find JSON array in the response if it's embedded in text
      const jsonArrayMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (jsonArrayMatch && !cleanedResponse.startsWith('[')) {
        cleanedResponse = jsonArrayMatch[0];
      }
      
      const plotPoints = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(plotPoints) || plotPoints.length !== 5) {
        throw new Error(`Expected 5 plot points, received ${Array.isArray(plotPoints) ? plotPoints.length : 'invalid format'}`);
      }

      // Validate each plot point
      const validatedPlotPoints: PlotPoint[] = [];
      for (let i = 0; i < plotPoints.length; i++) {
        const pp = plotPoints[i];
        if (!validatePlotPoint(pp)) {
          throw new Error(`Invalid plot point data at index ${i}: missing or invalid fields`);
        }
        validatedPlotPoints.push(pp);
      }

      return validatedPlotPoints;
    } catch (parseError) {
      console.error('Plot point extraction failed. Raw response:', response);
      console.error('Parse error:', parseError);
      throw new Error('Invalid JSON response from Assistant for plot point extraction');
    }
  }

  /**
   * Identifies narrative structure using the Assistant API
   * Requirement 2.5: Assistant API methods for narrative structure
   */
  async identifyNarrativeStructureWithAssistant(assistantId: string): Promise<NarrativeStructure> {
    if (!assistantId) {
      throw new Error('Assistant ID is required');
    }

    const prompt = `Analyze the novel's narrative structure and identify the three key structural elements.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any explanatory text, markdown formatting, or code blocks. Your entire response must be parseable as JSON.

Return EXACTLY this JSON structure:
{
  "introduction": "Detailed 3-5 sentence summary of the story's introduction, opening, and setup. Describe the initial situation, main characters introduced, and the setting established.",
  "climax": "Detailed 3-5 sentence summary of the story's climax and turning point. Describe the most intense moment, the peak of conflict, and the critical decision or event that changes everything.",
  "conclusion": "Detailed 3-5 sentence summary of the story's conclusion and resolution. Describe how conflicts are resolved, what happens to the main characters, and how the story ends."
}

Requirements:
- Each field must contain a detailed summary (at least 3-5 sentences)
- Focus on the most significant moments that define each structural element
- Base your analysis entirely on the novel's content
- Your response must start with { and end with }
- Do not wrap the JSON in markdown code blocks or add any other text`;

    const response = await this.assistantService.queryAssistant(assistantId, prompt);
    
    try {
      // Clean up response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Remove any leading/trailing whitespace again
      cleanedResponse = cleanedResponse.trim();
      
      // Try to find JSON object in the response if it's embedded in text
      const jsonObjectMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch && !cleanedResponse.startsWith('{')) {
        cleanedResponse = jsonObjectMatch[0];
      }
      
      const structure = JSON.parse(cleanedResponse);
      
      if (!structure.introduction || !structure.climax || !structure.conclusion) {
        throw new Error('Invalid narrative structure response: missing required fields');
      }

      return {
        introduction: structure.introduction,
        climax: structure.climax,
        conclusion: structure.conclusion
      };
    } catch (parseError) {
      console.error('Narrative structure extraction failed. Raw response:', response);
      console.error('Parse error:', parseError);
      throw new Error('Invalid JSON response from Assistant for narrative structure extraction');
    }
  }

  /**
   * Cleanup method to remove assistant and file resources
   */
  async cleanup(): Promise<void> {
    if (this.currentAssistantId || this.currentFileId) {
      console.log('🧹 Cleaning up Assistant API resources...');
      await this.assistantService.cleanup(this.currentAssistantId, this.currentFileId);
      this.currentAssistantId = undefined;
      this.currentFileId = undefined;
    }
  }

}

/**
 * Factory function to create a NovelAnalyzer instance
 */
export function createNovelAnalyzer(): NovelAnalyzer {
  return new DefaultNovelAnalyzer();
}