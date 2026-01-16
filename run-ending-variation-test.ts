#!/usr/bin/env ts-node

/**
 * CLI script for running ending variation tests
 * Requirement 9.2, 9.3: Accept command-line arguments and display usage
 */

import { EndingVariationTestFramework, EndingVariationTestConfig } from './src/testing/EndingVariationTestFramework';
import * as path from 'path';

/**
 * Displays usage instructions
 */
function displayUsage(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                   ENDING VARIATION TEST FRAMEWORK                          ║
╚════════════════════════════════════════════════════════════════════════════╝

Tests how different ending types affect story cohesion by running three games
with original, opposite, and random endings.

USAGE:
  ts-node run-ending-variation-test.ts <novel-file> [rounds] [quote-percentage] [output-dir]

ARGUMENTS:
  novel-file        Path to the novel text file (required)
  rounds            Number of rounds per game (1-20, default: 5)
  quote-percentage  Percentage of book quotes to use (0-100, default: 0)
  output-dir        Output directory for reports (default: test_outputs)

EXAMPLES:
  # Run with default settings (5 rounds, 0% quotes)
  ts-node run-ending-variation-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt

  # Run with 10 rounds and 60% book quotes
  ts-node run-ending-variation-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt 10 60

  # Run with custom output directory
  ts-node run-ending-variation-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt 5 0 my_results

  # Run maximum rounds with high quote usage
  ts-node run-ending-variation-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt 20 80

OUTPUT:
  The test will generate:
  - Three game state files (one per ending type)
  - ending-variation-test-<novel>-<timestamp>.json  (Complete data in JSON format)
  - ending-variation-test-<novel>-<timestamp>.csv   (Tabular data for spreadsheets)
  - ending-variation-test-<novel>-<timestamp>.txt   (Human-readable comparative report)

ENDING TYPES:
  - Original:  Matches the book's actual conclusion
  - Opposite:  Inverts the book's conclusion (happy → tragic, success → failure)
  - Random:    Creative alternative unrelated to the book's conclusion

METRICS:
  - Cohesion Score:     How well the story aligns with the source novel (1-10)
  - Word Count:         Total words generated in the story
  - Quote Usage:        Percentage of actions using actual book quotes
  - Segments Count:     Number of story segments generated

NOTE:
  This test makes multiple API calls and may take 10-20 minutes to complete.
  The novel is analyzed once and reused for all three games.
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
  const rounds = args[1] ? parseInt(args[1], 10) : 5;
  const quotePercentage = args[2] ? parseInt(args[2], 10) : 0;
  const outputDirectory = args[3] || 'test_outputs';
  
  // Validate novel file argument
  if (!novelFile) {
    console.error('❌ Error: Novel file path is required\n');
    displayUsage();
    process.exit(1);
  }
  
  // Validate rounds argument
  if (isNaN(rounds) || rounds < 1 || rounds > 20) {
    console.error(`❌ Error: Rounds must be a number between 1 and 20 (got: ${args[1]})\n`);
    displayUsage();
    process.exit(1);
  }
  
  // Validate quote percentage argument
  if (isNaN(quotePercentage) || quotePercentage < 0 || quotePercentage > 100) {
    console.error(`❌ Error: Quote percentage must be a number between 0 and 100 (got: ${args[2]})\n`);
    displayUsage();
    process.exit(1);
  }
  
  // Create configuration
  const config: EndingVariationTestConfig = {
    novelFile: path.resolve(novelFile),
    rounds,
    quotePercentage,
    outputDirectory
  };
  
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   ENDING VARIATION TEST FRAMEWORK                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📖 Novel:            ${path.basename(novelFile)}`);
  console.log(`🎲 Rounds per game:  ${rounds}`);
  console.log(`📊 Quote percentage: ${quotePercentage}%`);
  console.log(`📁 Output:           ${outputDirectory}`);
  console.log('');
  console.log('This test will:');
  console.log('  1. Analyze the novel once (reused for all games)');
  console.log('  2. Generate three different endings (original, opposite, random)');
  console.log('  3. Run three games with different endings');
  console.log('  4. Analyze cohesion for each game');
  console.log('  5. Generate comparative reports');
  console.log('');
  console.log('⏱️  Estimated time: 10-20 minutes');
  console.log('');
  
  try {
    // Create and run test framework
    const framework = new EndingVariationTestFramework(config);
    const report = await framework.runEndingVariationTest();
    
    // Display summary
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                           TEST COMPLETE                                    ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📊 RESULTS SUMMARY:');
    console.log('');
    console.log('Cohesion Scores:');
    console.log(`   Original Ending:  ${report.comparison.cohesionScores.original.toFixed(2)}/10`);
    console.log(`   Opposite Ending:  ${report.comparison.cohesionScores.opposite.toFixed(2)}/10`);
    console.log(`   Random Ending:    ${report.comparison.cohesionScores.random.toFixed(2)}/10`);
    console.log('');
    console.log(`🏆 Highest Cohesion: ${report.comparison.highestCohesion.toUpperCase()} ending`);
    console.log('');
    console.log('Word Counts:');
    console.log(`   Original: ${report.comparison.averageWordCount.original} words`);
    console.log(`   Opposite: ${report.comparison.averageWordCount.opposite} words`);
    console.log(`   Random:   ${report.comparison.averageWordCount.random} words`);
    console.log('');
    console.log('Quote Usage:');
    console.log(`   Original: ${report.comparison.quoteUsageStats.original.actualPercentage.toFixed(1)}% (${report.comparison.quoteUsageStats.original.bookQuotesUsed}/${report.comparison.quoteUsageStats.original.totalActions} actions)`);
    console.log(`   Opposite: ${report.comparison.quoteUsageStats.opposite.actualPercentage.toFixed(1)}% (${report.comparison.quoteUsageStats.opposite.bookQuotesUsed}/${report.comparison.quoteUsageStats.opposite.totalActions} actions)`);
    console.log(`   Random:   ${report.comparison.quoteUsageStats.random.actualPercentage.toFixed(1)}% (${report.comparison.quoteUsageStats.random.bookQuotesUsed}/${report.comparison.quoteUsageStats.random.totalActions} actions)`);
    console.log('');
    console.log('Game State Files:');
    console.log(`   📄 ${report.originalEndingGame.gameStateFile}`);
    console.log(`   📄 ${report.oppositeEndingGame.gameStateFile}`);
    console.log(`   📄 ${report.randomEndingGame.gameStateFile}`);
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
    
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    // Exit with error code
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
