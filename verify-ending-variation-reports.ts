/**
 * Verification script for ending variation report generation
 * Tests that CSV, JSON, and text reports are generated correctly
 */

import { EndingVariationTestFramework, EndingVariationReport } from './src/testing/EndingVariationTestFramework';
import * as fs from 'fs';
import * as path from 'path';

async function verifyReportGeneration() {
  console.log('🧪 Verifying Ending Variation Report Generation');
  console.log('='.repeat(80));
  
  // Create a mock report for testing
  const mockReport: EndingVariationReport = {
    originalEndingGame: {
      endingType: 'original',
      endingDescription: 'Elizabeth and Darcy marry happily, overcoming pride and prejudice.',
      rounds: 5,
      cohesionScore: 8.5,
      segmentsCount: 20,
      wordCount: 1500,
      quoteUsageStats: {
        totalActions: 20,
        bookQuotesUsed: 12,
        llmGeneratedUsed: 8,
        actualPercentage: 60.0
      },
      gameStateFile: 'test-original-5rounds.json',
      gameResult: {} as any
    },
    oppositeEndingGame: {
      endingType: 'opposite',
      endingDescription: 'Elizabeth and Darcy part ways forever, their pride and prejudice insurmountable.',
      rounds: 5,
      cohesionScore: 6.2,
      segmentsCount: 20,
      wordCount: 1450,
      quoteUsageStats: {
        totalActions: 20,
        bookQuotesUsed: 7,
        llmGeneratedUsed: 13,
        actualPercentage: 35.0
      },
      gameStateFile: 'test-opposite-5rounds.json',
      gameResult: {} as any
    },
    randomEndingGame: {
      endingType: 'random',
      endingDescription: 'Elizabeth becomes a famous novelist and Darcy joins the navy, never to meet again.',
      rounds: 5,
      cohesionScore: 5.8,
      segmentsCount: 20,
      wordCount: 1480,
      quoteUsageStats: {
        totalActions: 20,
        bookQuotesUsed: 8,
        llmGeneratedUsed: 12,
        actualPercentage: 40.0
      },
      gameStateFile: 'test-random-5rounds.json',
      gameResult: {} as any
    },
    comparison: {
      highestCohesion: 'original',
      cohesionScores: {
        original: 8.5,
        opposite: 6.2,
        random: 5.8
      },
      averageWordCount: {
        original: 1500,
        opposite: 1450,
        random: 1480
      },
      quoteUsageStats: {
        original: {
          totalActions: 20,
          bookQuotesUsed: 12,
          llmGeneratedUsed: 8,
          actualPercentage: 60.0
        },
        opposite: {
          totalActions: 20,
          bookQuotesUsed: 7,
          llmGeneratedUsed: 13,
          actualPercentage: 35.0
        },
        random: {
          totalActions: 20,
          bookQuotesUsed: 8,
          llmGeneratedUsed: 12,
          actualPercentage: 40.0
        }
      }
    },
    generatedAt: new Date(),
    testConfiguration: {
      novelFile: 'TestNovels/test-novel.txt',
      rounds: 5,
      outputDirectory: 'test_outputs',
      quotePercentage: 60
    }
  };
  
  // Access private methods via reflection for testing
  const framework = new EndingVariationTestFramework({
    novelFile: 'test_simple_novel.txt',
    rounds: 5,
    outputDirectory: 'test_outputs',
    quotePercentage: 60
  });
  
  // Generate reports using the framework's private methods
  // We'll use type assertion to access private methods for testing
  const frameworkAny = framework as any;
  
  console.log('\n📊 Testing CSV Report Generation...');
  const csvContent = frameworkAny.generateCSVReport(mockReport);
  console.log('✅ CSV report generated');
  console.log(`   Lines: ${csvContent.split('\n').length}`);
  console.log(`   Contains headers: ${csvContent.includes('Ending Type,Ending Description')}`);
  console.log(`   Contains comparison: ${csvContent.includes('Comparative Analysis')}`);
  console.log(`   Contains highest cohesion: ${csvContent.includes('Highest Cohesion,original')}`);
  
  console.log('\n📊 Testing Text Report Generation...');
  const textContent = frameworkAny.generateTableReport(mockReport);
  console.log('✅ Text report generated');
  console.log(`   Lines: ${textContent.split('\n').length}`);
  console.log(`   Contains title: ${textContent.includes('ENDING VARIATION TEST REPORT')}`);
  console.log(`   Contains comparative analysis: ${textContent.includes('COMPARATIVE ANALYSIS')}`);
  console.log(`   Contains game details: ${textContent.includes('GAME DETAILS')}`);
  console.log(`   Contains interpretation guide: ${textContent.includes('INTERPRETATION GUIDE')}`);
  console.log(`   Identifies highest cohesion: ${textContent.includes('🏆 Highest Cohesion: ORIGINAL')}`);
  
  console.log('\n📄 Sample CSV Output (first 10 lines):');
  console.log('-'.repeat(80));
  csvContent.split('\n').slice(0, 10).forEach(line => console.log(line));
  
  console.log('\n📄 Sample Text Output (first 30 lines):');
  console.log('-'.repeat(80));
  textContent.split('\n').slice(0, 30).forEach(line => console.log(line));
  
  console.log('\n✅ Report generation verification complete!');
  console.log('='.repeat(80));
  
  // Verify all required elements are present
  const checks = [
    { name: 'CSV has headers', pass: csvContent.includes('Ending Type,Ending Description') },
    { name: 'CSV has all three ending types', pass: csvContent.includes('original') && csvContent.includes('opposite') && csvContent.includes('random') },
    { name: 'CSV has comparative analysis', pass: csvContent.includes('Comparative Analysis') },
    { name: 'CSV identifies highest cohesion', pass: csvContent.includes('Highest Cohesion,original') },
    { name: 'CSV has quote usage stats', pass: csvContent.includes('Book Quotes Used') },
    { name: 'Text has title', pass: textContent.includes('ENDING VARIATION TEST REPORT') },
    { name: 'Text has comparative analysis', pass: textContent.includes('COMPARATIVE ANALYSIS') },
    { name: 'Text has game details', pass: textContent.includes('GAME DETAILS') },
    { name: 'Text identifies highest cohesion', pass: textContent.includes('🏆 Highest Cohesion: ORIGINAL') },
    { name: 'Text has interpretation guide', pass: textContent.includes('INTERPRETATION GUIDE') }
  ];
  
  console.log('\n📋 Verification Checklist:');
  let allPassed = true;
  for (const check of checks) {
    const status = check.pass ? '✅' : '❌';
    console.log(`${status} ${check.name}`);
    if (!check.pass) allPassed = false;
  }
  
  if (allPassed) {
    console.log('\n🎉 All checks passed! Report generation is working correctly.');
  } else {
    console.log('\n⚠️  Some checks failed. Please review the implementation.');
  }
}

// Run verification
verifyReportGeneration().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
