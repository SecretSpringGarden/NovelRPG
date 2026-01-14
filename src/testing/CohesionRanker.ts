import { LLMService } from '../services/LLMService';
import { GameState } from '../models/GameState';

/**
 * Game result interface for cohesion analysis
 */
export interface GameResult {
  rounds: number;
  endingAchieved: string;
  cohesionRank: number; // 1-10
  filename: string;
  gameState: GameState;
}

/**
 * Cohesion analysis criteria interface
 */
export interface CohesionCriteria {
  characterConsistency: number; // 1-10
  plotProgression: number; // 1-10
  thematicCoherence: number; // 1-10
  resolutionSatisfaction: number; // 1-10
  narrativeUnity: number; // 1-10
}

/**
 * Detailed cohesion analysis result
 */
export interface CohesionAnalysis {
  overallRank: number; // 1-10
  criteria: CohesionCriteria;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

/**
 * Report format options for cohesion analysis output
 */
export interface ReportFormat {
  format: 'csv' | 'table' | 'json';
  includeHeaders: boolean;
  sortOrder: 'desc' | 'asc';
}

/**
 * Formatted report output interface
 */
export interface FormattedReport {
  content: string;
  format: 'csv' | 'table' | 'json';
  filename: string;
}

/**
 * CohesionRanker class for analyzing story quality and coherence
 * Uses LLM analysis to evaluate narrative cohesion across multiple criteria
 */
export class CohesionRanker {
  private llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * Analyzes story cohesion for a single game with detailed breakdown
   */
  async analyzeDetailedCohesion(gameState: GameState): Promise<CohesionAnalysis> {
    const completeStory = this.compileStoryForAnalysis(gameState);
    
    const prompt = `
Analyze the following story for narrative cohesion across multiple criteria. 
Rate each criterion on a scale of 1-10 and provide an overall assessment.

CRITERIA TO EVALUATE:
1. Character Consistency (1-10): Are characters portrayed consistently throughout?
2. Plot Progression (1-10): Does the story flow logically from beginning to end?
3. Thematic Coherence (1-10): Are themes consistent and well-developed?
4. Resolution Satisfaction (1-10): Is the ending satisfying and well-connected to the story?
5. Narrative Unity (1-10): Do all story elements work together as a cohesive whole?

Please respond in the following JSON format:
{
  "characterConsistency": <number 1-10>,
  "plotProgression": <number 1-10>,
  "thematicCoherence": <number 1-10>,
  "resolutionSatisfaction": <number 1-10>,
  "narrativeUnity": <number 1-10>,
  "overallRank": <number 1-10>,
  "feedback": "<detailed analysis>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...]
}

Story to analyze:
${completeStory}
`;

    const response = await this.llmService.generateContent(prompt, {});
    
    try {
      const analysis = JSON.parse(response);
      return this.validateAndNormalizeCohesionAnalysis(analysis);
    } catch (error) {
      console.warn('Failed to parse detailed cohesion analysis, falling back to simple analysis');
      const simpleRank = await this.analyzeSimpleCohesion(gameState);
      return this.createFallbackAnalysis(simpleRank);
    }
  }

  /**
   * Analyzes story cohesion with a simple numeric rank
   */
  async analyzeSimpleCohesion(gameState: GameState): Promise<number> {
    const completeStory = this.compileStoryForAnalysis(gameState);
    
    const prompt = `
Analyze the following story for overall narrative cohesion and rate it on a scale of 1-10, where:
- 10 = Perfectly cohesive, all elements work together seamlessly
- 8-9 = Highly cohesive with minor inconsistencies
- 6-7 = Generally cohesive with some noticeable gaps
- 4-5 = Moderately cohesive but with significant issues
- 2-3 = Poor cohesion with major inconsistencies
- 1 = Completely incoherent

Please respond with only a single number from 1-10.

Story to analyze:
${completeStory}
`;

    const response = await this.llmService.generateContent(prompt, {});
    return this.parseNumericResponse(response);
  }

  /**
   * Ranks multiple games by cohesion in descending order
   */
  async rankGamesByCohesion(gameResults: GameResult[]): Promise<GameResult[]> {
    const rankedResults: GameResult[] = [];
    
    for (const gameResult of gameResults) {
      try {
        const cohesionRank = await this.analyzeSimpleCohesion(gameResult.gameState);
        rankedResults.push({
          ...gameResult,
          cohesionRank
        });
      } catch (error) {
        console.error(`Failed to analyze cohesion for game ${gameResult.filename}:`, error);
        rankedResults.push({
          ...gameResult,
          cohesionRank: 5 // Default middle rank
        });
      }
    }
    
    // Sort by cohesion rank in descending order (highest first)
    return rankedResults.sort((a, b) => b.cohesionRank - a.cohesionRank);
  }

  /**
   * Compares two stories and determines which has better cohesion
   */
  async compareStoryCohesion(gameState1: GameState, gameState2: GameState): Promise<{
    winner: 1 | 2 | 'tie';
    reason: string;
    scores: { story1: number; story2: number };
  }> {
    const story1 = this.compileStoryForAnalysis(gameState1);
    const story2 = this.compileStoryForAnalysis(gameState2);
    
    const prompt = `
Compare these two stories for narrative cohesion and determine which is better.
Rate each story from 1-10 and explain your reasoning.

STORY 1:
${story1}

---

STORY 2:
${story2}

Please respond in JSON format:
{
  "story1Score": <number 1-10>,
  "story2Score": <number 1-10>,
  "winner": <1 or 2 or "tie">,
  "reason": "<explanation of why one story is better or why they're tied>"
}
`;

    const response = await this.llmService.generateContent(prompt, {});
    
    try {
      const comparison = JSON.parse(response);
      return {
        winner: comparison.winner,
        reason: comparison.reason || 'No reason provided',
        scores: {
          story1: this.normalizeScore(comparison.story1Score),
          story2: this.normalizeScore(comparison.story2Score)
        }
      };
    } catch (error) {
      console.warn('Failed to parse story comparison, using fallback analysis');
      const score1 = await this.analyzeSimpleCohesion(gameState1);
      const score2 = await this.analyzeSimpleCohesion(gameState2);
      
      return {
        winner: score1 > score2 ? 1 : score2 > score1 ? 2 : 'tie',
        reason: 'Comparison based on individual cohesion scores',
        scores: { story1: score1, story2: score2 }
      };
    }
  }

  /**
   * Compiles story content for analysis
   */
  private compileStoryForAnalysis(gameState: GameState): string {
    const storyParts: string[] = [];
    
    // Add novel context
    storyParts.push('=== ORIGINAL CONTEXT ===');
    storyParts.push(`Introduction: ${gameState.novelAnalysis.introduction}`);
    storyParts.push(`Climax: ${gameState.novelAnalysis.climax}`);
    storyParts.push(`Conclusion: ${gameState.novelAnalysis.conclusion}`);
    storyParts.push('');
    
    // Add characters
    storyParts.push('=== CHARACTERS ===');
    gameState.novelAnalysis.mainCharacters.forEach(char => {
      storyParts.push(`${char.name}: ${char.description}`);
    });
    storyParts.push('');
    
    // Add generated story
    storyParts.push('=== GENERATED STORY ===');
    gameState.storySegments.forEach((segment, index) => {
      storyParts.push(`[Segment ${index + 1} - ${segment.generatedBy.type.toUpperCase()}]`);
      storyParts.push(segment.content);
      storyParts.push('');
    });
    
    // Add ending information
    if (gameState.targetEnding) {
      storyParts.push('=== TARGET ENDING ===');
      storyParts.push(`Type: ${gameState.targetEnding.type}`);
      storyParts.push(`Description: ${gameState.targetEnding.description}`);
    }
    
    return storyParts.join('\n');
  }

  /**
   * Validates and normalizes cohesion analysis from LLM
   */
  private validateAndNormalizeCohesionAnalysis(analysis: any): CohesionAnalysis {
    const normalized: CohesionAnalysis = {
      overallRank: this.normalizeScore(analysis.overallRank),
      criteria: {
        characterConsistency: this.normalizeScore(analysis.characterConsistency),
        plotProgression: this.normalizeScore(analysis.plotProgression),
        thematicCoherence: this.normalizeScore(analysis.thematicCoherence),
        resolutionSatisfaction: this.normalizeScore(analysis.resolutionSatisfaction),
        narrativeUnity: this.normalizeScore(analysis.narrativeUnity)
      },
      feedback: typeof analysis.feedback === 'string' ? analysis.feedback : 'No feedback provided',
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
      weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : []
    };
    
    // Calculate overall rank as average if not provided or invalid
    if (normalized.overallRank < 1 || normalized.overallRank > 10) {
      const criteriaValues = Object.values(normalized.criteria);
      normalized.overallRank = Math.round(
        criteriaValues.reduce((sum, val) => sum + val, 0) / criteriaValues.length
      );
    }
    
    return normalized;
  }

  /**
   * Creates fallback analysis when detailed analysis fails
   */
  private createFallbackAnalysis(simpleRank: number): CohesionAnalysis {
    const normalizedRank = this.normalizeScore(simpleRank);
    
    return {
      overallRank: normalizedRank,
      criteria: {
        characterConsistency: normalizedRank,
        plotProgression: normalizedRank,
        thematicCoherence: normalizedRank,
        resolutionSatisfaction: normalizedRank,
        narrativeUnity: normalizedRank
      },
      feedback: 'Analysis completed with simplified ranking due to parsing error',
      strengths: [],
      weaknesses: []
    };
  }

  /**
   * Normalizes score to 1-10 range
   */
  private normalizeScore(score: any): number {
    const numScore = typeof score === 'number' ? score : parseInt(String(score), 10);
    
    if (isNaN(numScore)) {
      return 5; // Default middle value
    }
    
    return Math.max(1, Math.min(10, Math.round(numScore)));
  }

  /**
   * Generates formatted cohesion report with specified format and sorting
   * Implements Requirements 7.5 and 7.6 for report generation and sorting
   */
  generateCohesionReport(
    gameResults: GameResult[], 
    format: ReportFormat = { format: 'table', includeHeaders: true, sortOrder: 'desc' }
  ): FormattedReport {
    // Sort by cohesion rank according to requirements (desc = most cohesive first)
    const sortedResults = this.sortGameResultsByCohesion(gameResults, format.sortOrder);
    
    // Generate content based on format
    let content: string;
    let filename: string;
    
    switch (format.format) {
      case 'csv':
        content = this.generateCSVReport(sortedResults, format.includeHeaders);
        filename = `cohesion-report-${this.getTimestamp()}.csv`;
        break;
      case 'table':
        content = this.generateTableReport(sortedResults, format.includeHeaders);
        filename = `cohesion-report-${this.getTimestamp()}.txt`;
        break;
      case 'json':
        content = this.generateJSONReport(sortedResults);
        filename = `cohesion-report-${this.getTimestamp()}.json`;
        break;
      default:
        throw new Error(`Unsupported report format: ${format.format}`);
    }
    
    return {
      content,
      format: format.format,
      filename
    };
  }

  /**
   * Sorts game results by cohesion rank
   * Requirements 7.6: Sort by most cohesive stories first, least cohesive last
   */
  private sortGameResultsByCohesion(gameResults: GameResult[], sortOrder: 'desc' | 'asc' = 'desc'): GameResult[] {
    return [...gameResults].sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.cohesionRank - a.cohesionRank; // Most cohesive first
      } else {
        return a.cohesionRank - b.cohesionRank; // Least cohesive first
      }
    });
  }

  /**
   * Generates CSV format report
   * Requirements 7.5: Report table with columns: rounds played, ending achieved, cohesion rank
   */
  private generateCSVReport(gameResults: GameResult[], includeHeaders: boolean): string {
    const lines: string[] = [];
    
    if (includeHeaders) {
      lines.push('Rounds,Ending,Cohesion Rank,Filename');
    }
    
    gameResults.forEach(game => {
      // Escape commas and quotes in ending description for CSV
      const escapedEnding = this.escapeCSVField(game.endingAchieved);
      const escapedFilename = this.escapeCSVField(game.filename);
      
      lines.push(`${game.rounds},${escapedEnding},${game.cohesionRank},${escapedFilename}`);
    });
    
    return lines.join('\n');
  }

  /**
   * Generates table format report
   * Requirements 7.5: Report table with columns: rounds played, ending achieved, cohesion rank
   */
  private generateTableReport(gameResults: GameResult[], includeHeaders: boolean): string {
    const lines: string[] = [];
    
    if (includeHeaders) {
      lines.push('=== COHESION ANALYSIS REPORT ===');
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push(`Total Games: ${gameResults.length}`);
      lines.push('');
      lines.push('Rounds | Ending                         | Cohesion Rank | Filename');
      lines.push('-------|--------------------------------|---------------|----------');
    }
    
    gameResults.forEach(game => {
      // Truncate ending description for table display
      const endingDisplay = game.endingAchieved.length > 30 
        ? game.endingAchieved.substring(0, 27) + '...'
        : game.endingAchieved;
      
      const roundsStr = game.rounds.toString().padStart(6);
      const endingStr = endingDisplay.padEnd(30);
      const cohesionStr = game.cohesionRank.toString().padStart(13);
      
      lines.push(`${roundsStr} | ${endingStr} | ${cohesionStr} | ${game.filename}`);
    });
    
    // Add statistics section
    if (gameResults.length > 0) {
      lines.push('');
      lines.push('=== STATISTICS ===');
      const cohesionRanks = gameResults.map(g => g.cohesionRank);
      const avgCohesion = cohesionRanks.reduce((sum, rank) => sum + rank, 0) / cohesionRanks.length;
      const maxCohesion = Math.max(...cohesionRanks);
      const minCohesion = Math.min(...cohesionRanks);
      
      lines.push(`Average Cohesion: ${avgCohesion.toFixed(2)}`);
      lines.push(`Highest Cohesion: ${maxCohesion}`);
      lines.push(`Lowest Cohesion: ${minCohesion}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Generates JSON format report
   */
  private generateJSONReport(gameResults: GameResult[]): string {
    const report = {
      generatedAt: new Date().toISOString(),
      totalGames: gameResults.length,
      games: gameResults.map(game => ({
        rounds: game.rounds,
        endingAchieved: game.endingAchieved,
        cohesionRank: game.cohesionRank,
        filename: game.filename
      })),
      statistics: this.calculateStatistics(gameResults)
    };
    
    return JSON.stringify(report, null, 2);
  }

  /**
   * Calculates statistics for the report
   */
  private calculateStatistics(gameResults: GameResult[]): any {
    if (gameResults.length === 0) {
      return { averageCohesion: 0, highestCohesion: 0, lowestCohesion: 0 };
    }
    
    const cohesionRanks = gameResults.map(g => g.cohesionRank);
    const avgCohesion = cohesionRanks.reduce((sum, rank) => sum + rank, 0) / cohesionRanks.length;
    const maxCohesion = Math.max(...cohesionRanks);
    const minCohesion = Math.min(...cohesionRanks);
    
    return {
      averageCohesion: parseFloat(avgCohesion.toFixed(2)),
      highestCohesion: maxCohesion,
      lowestCohesion: minCohesion
    };
  }

  /**
   * Escapes CSV field content to handle commas and quotes
   */
  private escapeCSVField(field: string): string {
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Parses numeric response from LLM
   */
  private parseNumericResponse(response: string): number {
    const match = response.match(/\b(\d+)\b/);
    if (match) {
      return this.normalizeScore(parseInt(match[1], 10));
    }
    return 5; // Default middle value
  }

  /**
   * Gets timestamp string for filename generation
   */
  private getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }
}