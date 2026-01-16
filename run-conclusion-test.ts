#!/usr/bin/env ts-node

/**
 * CLI script for running conclusion tests
 * Requirement 9.1, 9.3: Accept command-line arguments and display usage
 */

import { ConclusionTestFramework, ConclusionTestConfig } from './src/testing/ConclusionTestFramework';
import * as path from 'path';

/**
 * Displays usage instructions
 */
function displayUsage(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                      CONCLUSION TEST FRAMEWORK                             ║
╚════════════════════════════════════════════════════════════════════════════╝

Tests the LLM's ability to correctly identify book conclusions by running
multiple analyses and comparing consistency.

USAGE:
  ts-node run-conclusion-test.ts <novel-file> [iterations] [output-dir]

ARGUMENTS:
  novel-file    Path to the novel text file (required)
  iterations    Number of test iterations (1-10, default: 5)
  output-dir    Output directory for reports (default: test_outputs)

EXAMPLES:
  # Run 5 iterations on Pride and Prejudice
  ts-node run-conclusion-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt

  # Run 3 iterations with custom output directory
  ts-node run-conclusion-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt 3 my_results

  # Run 10 iterations (maximum)
  ts-node run-conclusion-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt 10

OUTPUT:
  The test will generate three report files:
  - conclusion-test-<novel>-<timestamp>.json  (Complete data in JSON format)
  - conclusion-test-<novel>-<timestamp>.csv   (Tabular data for spreadsheets)
  - conclusion-test-<novel>-<timestamp>.txt   (Human-readable text report)

METRICS:
  - Accuracy Score:     How well the conclusion captures key events (1-10)
  - Completeness Score: How complete the conclusion is (1-10)
  - Coherence Score:    How well-structured the conclusion is (1-10)
  - Consistency Score:  How similar conclusions are across iterations (0-10)

NOTE:
  This test makes multiple API calls and may take several minutes to complete.
  Rate limiting delays are automatically added between operations.
`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Check for help flag
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    displayUsage();
    process.exit(0);
  }
  
  // Parse arguments
  const novelFile = args[0];
  const iterations = args[1] ? parseInt(args[1], 10) : 5;
  const outputDirectory = args[2] || 'test_outputs';
  
  // Validate novel file argument
  if (!novelFile) {
    console.error('❌ Error: Novel file path is required\n');
    displayUsage();
    process.exit(1);
  }
  
  // Validate iterations argument
  if (isNaN(iterations) || iterations < 1 || iterations > 10) {
    console.error(`❌ Error: Iterations must be a number between 1 and 10 (got: ${args[1]})\n`);
    displayUsage();
    process.exit(1);
  }
  
  // Create configuration
  const config: ConclusionTestConfig = {
    novelFile: path.resolve(novelFile),
    iterations,
    outputDirectory
  };
  
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      CONCLUSION TEST FRAMEWORK                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📖 Novel:      ${path.basename(novelFile)}`);
  console.log(`🔄 Iterations: ${iterations}`);
  console.log(`📁 Output:     ${outputDirectory}`);
  console.log('');
  
  try {
    // Create and run test framework
    const framework = new ConclusionTestFramework(config);
    const report = await framework.runConclusionTest();
    
    // Display summary
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                           TEST COMPLETE                                    ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📊 RESULTS SUMMARY:');
    console.log(`   Average Accuracy:     ${report.averageAccuracy.toFixed(2)}/10`);
    console.log(`   Average Completeness: ${report.averageCompleteness.toFixed(2)}/10`);
    console.log(`   Average Coherence:    ${report.averageCoherence.toFixed(2)}/10`);
    console.log(`   Consistency Score:    ${report.consistencyScore.score.toFixed(2)}/10`);
    
    if (report.consistencyScore.outliers.length > 0) {
      console.log(`   ⚠️  Outliers:          Iterations ${report.consistencyScore.outliers.join(', ')}`);
    } else {
      console.log(`   ✅ Outliers:          None detected`);
    }
    
    console.log('');
    console.log(`📁 Reports saved to: ${outputDirectory}`);
    console.log('');
    
    // Exit with success
    process.exit(0);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════════════════════╗');
    console.error('║                              ERROR                                         ║');
    console.error('╚════════════════════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error(`❌ Test failed: ${errorMessage}`);
    console.error('');
    
    // Exit with error code
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
