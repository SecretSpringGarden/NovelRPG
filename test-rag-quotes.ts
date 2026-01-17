#!/usr/bin/env ts-node
/**
 * Simple test to verify RAG-based quote extraction is working
 * Runs a single game with original ending and 60% quote usage
 */

import { EndingVariationTestFramework, EndingVariationTestConfig } from './src/testing/EndingVariationTestFramework';
import * as path from 'path';

async function testRAGQuotes() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         RAG-BASED QUOTE EXTRACTION TEST                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const novelPath = 'TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt';
  const rounds = 3; // Just 3 rounds for quick testing
  const quotePercentage = 60;

  console.log(`📖 Novel: Pride and Prejudice`);
  console.log(`🎲 Rounds: ${rounds}`);
  console.log(`📊 Quote percentage: ${quotePercentage}%`);
  console.log(`🎯 Testing: RAG-based quote extraction\n`);
  console.log(`⏱️  Estimated time: 5-10 minutes\n`);

  try {
    // Create configuration
    const config: EndingVariationTestConfig = {
      novelFile: path.resolve(novelPath),
      rounds,
      quotePercentage,
      outputDirectory: 'test_outputs'
    };

    // Create and run test framework
    console.log('🚀 Starting test...\n');
    const framework = new EndingVariationTestFramework(config);
    const report = await framework.runEndingVariationTest();

    // Display results
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                         RESULTS                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📊 QUOTE USAGE STATISTICS:\n');
    
    const games = [
      { name: 'Original', stats: report.comparison.quoteUsageStats.original },
      { name: 'Opposite', stats: report.comparison.quoteUsageStats.opposite },
      { name: 'Random', stats: report.comparison.quoteUsageStats.random }
    ];

    for (const game of games) {
      const { stats } = game;
      console.log(`${game.name} Ending:`);
      console.log(`   Total actions: ${stats.totalActions}`);
      console.log(`   Book quotes used: ${stats.bookQuotesUsed}`);
      console.log(`   LLM generated: ${stats.llmGeneratedUsed}`);
      console.log(`   Actual quote %: ${stats.actualPercentage.toFixed(1)}%`);
      console.log(`   Target quote %: ${quotePercentage}%`);
      
      if (stats.bookQuotesUsed > 0) {
        console.log(`   ✅ SUCCESS: RAG-based quotes are working!`);
      } else {
        console.log(`   ❌ ISSUE: No quotes used (RAG may not be working)`);
      }
      console.log('');
    }

    // Overall assessment
    const totalQuotesUsed = games.reduce((sum, g) => sum + g.stats.bookQuotesUsed, 0);
    const totalActions = games.reduce((sum, g) => sum + g.stats.totalActions, 0);
    const overallPercentage = (totalQuotesUsed / totalActions) * 100;

    console.log('📈 OVERALL ASSESSMENT:\n');
    console.log(`   Total quotes used: ${totalQuotesUsed}/${totalActions} actions`);
    console.log(`   Overall percentage: ${overallPercentage.toFixed(1)}%`);
    console.log(`   Target percentage: ${quotePercentage}%`);
    
    if (totalQuotesUsed > 0) {
      console.log(`\n   ✅ RAG-BASED QUOTE EXTRACTION IS WORKING!`);
      console.log(`   The system successfully extracted quotes using the Assistant API.`);
    } else {
      console.log(`\n   ❌ RAG-BASED QUOTE EXTRACTION IS NOT WORKING`);
      console.log(`   No quotes were extracted. Check the logs for errors.`);
    }

    console.log(`\n📁 Game state files saved to: test_outputs/`);
    console.log(`📄 Report files: ${report.testConfiguration.outputDirectory}\n`);

    process.exit(totalQuotesUsed > 0 ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testRAGQuotes().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
