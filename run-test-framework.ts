import { TestFramework } from './src/testing/TestFramework';
import * as path from 'path';

/**
 * Script to run the TestFramework with a specific novel
 * Usage: ts-node run-test-framework.ts
 */
async function main() {
  console.log('🎮 Starting TestFramework with Pride and Prejudice');
  console.log('='.repeat(60));
  console.log('');
  console.log('This will:');
  console.log('1. Analyze Pride and Prejudice ONCE (using gpt-4o-mini)');
  console.log('2. Run 6 games with different round counts (10, 12, 14, 16, 18, 20)');
  console.log('3. Analyze cohesion across all games');
  console.log('4. Generate reports (CSV, JSON, TXT)');
  console.log('');
  console.log('Expected duration: ~15-20 minutes');
  console.log('Expected cost: ~$0.10-0.20 (with gpt-4o-mini)');
  console.log('');
  console.log('='.repeat(60));
  console.log('');

  const novelPath = path.join(__dirname, 'TestNovels', 't5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt');
  
  try {
    const testFramework = new TestFramework();
    const report = await testFramework.runAutomatedTests(novelPath);
    
    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 TEST FRAMEWORK COMPLETE!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📊 Results Summary:');
    console.log(`   Total Games: ${report.statistics.totalGames}`);
    console.log(`   Average Cohesion: ${report.statistics.averageCohesion}/10`);
    console.log(`   Highest Cohesion: ${report.statistics.highestCohesion}/10`);
    console.log(`   Lowest Cohesion: ${report.statistics.lowestCohesion}/10`);
    console.log('');
    console.log('📁 Reports saved to: ./test_outputs/');
    console.log('');
    console.log('🏆 Best Game:');
    if (report.sortedByCohesion.length > 0) {
      const best = report.sortedByCohesion[0];
      console.log(`   Rounds: ${best.rounds}`);
      console.log(`   Cohesion: ${best.cohesionRank}/10`);
      console.log(`   Ending: ${best.endingAchieved.substring(0, 100)}...`);
    }
    console.log('');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ TEST FRAMEWORK FAILED');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('');
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
