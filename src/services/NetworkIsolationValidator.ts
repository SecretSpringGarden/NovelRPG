/**
 * Network Isolation Validator
 * 
 * Validates that the LLM does not access external internet resources during novel analysis.
 * Implements requirement 2.3: "THE Game_Master SHALL NOT use any internet resources during analysis"
 * 
 * This ensures the LLM only processes the provided novel text without fetching additional
 * information from external sources, while still allowing the necessary API calls to the LLM service.
 */

export interface LLMPromptValidation {
  prompt: string;
  containsInternetInstructions: boolean;
  violations: string[];
  timestamp: Date;
}

export interface NetworkIsolationResult {
  isIsolated: boolean;
  promptValidations: LLMPromptValidation[];
  violationCount: number;
  errors: string[];
}

export interface NetworkIsolationValidator {
  validatePrompt(prompt: string): LLMPromptValidation;
  validateAnalysisIsolation(prompts: string[]): NetworkIsolationResult;
  validateOfflineInstructions(prompt: string): boolean;
}

/**
 * Implementation of network isolation validation by analyzing LLM prompts
 * to ensure they don't instruct the LLM to access external resources
 */
export class DefaultNetworkIsolationValidator implements NetworkIsolationValidator {
  private readonly internetKeywords = [
    'search the internet',
    'look up online',
    'browse the web',
    'search for information',
    'find additional information',
    'research online',
    'check external sources',
    'access external data',
    'fetch from the internet',
    'query external apis',
    'search external databases',
    'look up current information',
    'find recent information',
    'search for updates',
    'access web resources'
  ];

  private readonly allowedInstructions = [
    'analyze the following text',
    'extract from the provided text',
    'identify in the given text',
    'based on the text provided',
    'from the novel text',
    'using only the provided content'
  ];

  /**
   * Validates that a prompt doesn't contain instructions for the LLM to access external resources
   */
  validatePrompt(prompt: string): LLMPromptValidation {
    const violations: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Check for internet access keywords
    for (const keyword of this.internetKeywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        violations.push(`Prompt contains internet access instruction: "${keyword}"`);
      }
    }

    // Check for URLs in the prompt (which might indicate external resource access)
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = prompt.match(urlPattern);
    if (urls && urls.length > 0) {
      violations.push(`Prompt contains URLs that might indicate external resource access: ${urls.join(', ')}`);
    }

    // Check for instructions that might lead to external searches
    // But exclude negative instructions (do not search, don't search, etc.)
    const searchPatterns = [
      { pattern: /search\s+for/gi, negativeContext: /do not search|don't search|never search|avoid search|without search/gi },
      { pattern: /look\s+up/gi, negativeContext: /do not look|don't look|never look|avoid look|without look/gi },
      { pattern: /find\s+information\s+about/gi, negativeContext: /do not find|don't find|never find|avoid find|without find/gi },
      { pattern: /research\s+the/gi, negativeContext: /do not research|don't research|never research|avoid research|without research/gi },
      { pattern: /get\s+current\s+information/gi, negativeContext: /do not get|don't get|never get|avoid get|without get/gi }
    ];

    for (const { pattern, negativeContext } of searchPatterns) {
      const matches = prompt.match(pattern);
      if (matches) {
        // Check if this is in a negative context
        const isNegativeContext = negativeContext.test(prompt);
        if (!isNegativeContext) {
          violations.push(`Prompt contains potential search instruction: "${matches[0]}"`);
        }
      }
    }

    return {
      prompt,
      containsInternetInstructions: violations.length > 0,
      violations,
      timestamp: new Date()
    };
  }

  /**
   * Validates that all prompts used in analysis maintain network isolation
   */
  validateAnalysisIsolation(prompts: string[]): NetworkIsolationResult {
    const promptValidations: LLMPromptValidation[] = [];
    const errors: string[] = [];
    let totalViolations = 0;

    for (const prompt of prompts) {
      const validation = this.validatePrompt(prompt);
      promptValidations.push(validation);
      
      if (validation.containsInternetInstructions) {
        totalViolations += validation.violations.length;
        errors.push(`Prompt validation failed: ${validation.violations.join(', ')}`);
      }
    }

    return {
      isIsolated: totalViolations === 0,
      promptValidations,
      violationCount: totalViolations,
      errors
    };
  }

  /**
   * Validates that a prompt contains explicit offline instructions
   */
  validateOfflineInstructions(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    
    // Check if prompt explicitly instructs to work only with provided content
    const offlineInstructions = [
      'analyze only the provided text',
      'use only the given text',
      'based solely on the provided content',
      'without accessing external sources',
      'using only the text provided',
      'from the novel text only',
      'work solely with the text provided',
      'do not search for external information',
      'do not access any internet resources'
    ];

    return offlineInstructions.some(instruction => 
      lowerPrompt.includes(instruction.toLowerCase())
    );
  }
}

/**
 * Factory function to create a NetworkIsolationValidator instance
 */
export function createNetworkIsolationValidator(): NetworkIsolationValidator {
  return new DefaultNetworkIsolationValidator();
}