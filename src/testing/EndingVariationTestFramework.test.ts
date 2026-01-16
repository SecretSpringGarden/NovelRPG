import { EndingVariationTestFramework } from './EndingVariationTestFramework';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('../core/GameManager');
jest.mock('./CohesionRanker');
jest.mock('../services/LLMService');

describe('EndingVariationTestFramework Configuration Validation', () => {
  const testNovelFile = path.join(__dirname, '../../test_simple_novel.txt');
  
  beforeAll(() => {
    // Ensure test novel file exists
    if (!fs.existsSync(testNovelFile)) {
      fs.writeFileSync(testNovelFile, 'Test novel content for validation tests.');
    }
  });

  describe('Round count validation (Requirement 4.2)', () => {
    it('should use default round count when not specified', () => {
      const config = {
        novelFile: testNovelFile,
        rounds: undefined as any,
        outputDirectory: 'test_outputs',
        quotePercentage: 50
      };
      
      const framework = new EndingVariationTestFramework(config);
      expect((framework as any).config.rounds).toBe(5);
    });

    it('should clamp round count below 1 to 1', () => {
      const config = {
        novelFile: testNovelFile,
        rounds: 0,
        outputDirectory: 'test_outputs',
        quotePercentage: 50
      };
      
      const framework = new EndingVariationTestFramework(config);
      expect((framework as any).config.rounds).toBe(1);
    });

    it('should clamp round count above 20 to 20', () => {
      const config = {
        novelFile: testNovelFile,
        rounds: 25,
        outputDirectory: 'test_outputs',
        quotePercentage: 50
      };
      
      const framework = new EndingVariationTestFramework(config);
      expect((framework as any).config.rounds).toBe(20);
    });

    it('should accept valid round count between 1 and 20', () => {
      const config = {
        novelFile: testNovelFile,
        rounds: 10,
        outputDirectory: 'test_outputs',
        quotePercentage: 50
      };
      
      const framework = new EndingVariationTestFramework(config);
      expect((framework as any).config.rounds).toBe(10);
    });
  });

  describe('Quote percentage validation (Requirement 4.3)', () => {
    it('should use default quote percentage when not specified', () => {
      const config = {
        novelFile: testNovelFile,
        rounds: 5,
        outputDirectory: 'test_outputs',
        quotePercentage: undefined as any
      };
      
      const framework = new EndingVariationTestFramework(config);
      expect((framework as any).config.quotePercentage).toBe(0);
    });

    it('should clamp quote percentage below 0 to 0', () => {
      const config = {
        novelFile: testNovelFile,
        rounds: 5,
        outputDirectory: 'test_outputs',
        quotePercentage: -10
      };
      
      const framework = new EndingVariationTestFramework(config);
      expect((framework as any).config.quotePercentage).toBe(0);
    });

    it('should clamp quote percentage above 100 to 100', () => {
      const config = {
        novelFile: testNovelFile,
        rounds: 5,
        outputDirectory: 'test_outputs',
        quotePercentage: 150
      };
      
      const framework = new EndingVariationTestFramework(config);
      expect((framework as any).config.quotePercentage).toBe(100);
    });

    it('should accept valid quote percentage between 0 and 100', () => {
      const config = {
        novelFile: testNovelFile,
        rounds: 5,
        outputDirectory: 'test_outputs',
        quotePercentage: 60
      };
      
      const framework = new EndingVariationTestFramework(config);
      expect((framework as any).config.quotePercentage).toBe(60);
    });
  });

  describe('Output directory validation (Requirement 4.5)', () => {
    it('should use default output directory when not specified', () => {
      const config = {
        novelFile: testNovelFile,
        rounds: 5,
        outputDirectory: '',
        quotePercentage: 50
      };
      
      const framework = new EndingVariationTestFramework(config);
      expect((framework as any).config.outputDirectory).toBe('test_outputs');
    });

    it('should accept custom output directory', () => {
      const config = {
        novelFile: testNovelFile,
        rounds: 5,
        outputDirectory: 'custom_output',
        quotePercentage: 50
      };
      
      const framework = new EndingVariationTestFramework(config);
      expect((framework as any).config.outputDirectory).toBe('custom_output');
    });
  });

  describe('Novel file validation', () => {
    it('should throw error when novel file does not exist', () => {
      const config = {
        novelFile: 'nonexistent_file.txt',
        rounds: 5,
        outputDirectory: 'test_outputs',
        quotePercentage: 50
      };
      
      expect(() => {
        new EndingVariationTestFramework(config);
      }).toThrow('Novel file not found: nonexistent_file.txt');
    });
  });
});
