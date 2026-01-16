import { CohesionRanker, GameResult } from './src/testing/CohesionRanker';
import { LLMService, createLLMService } from './src/services/LLMService';
import { ConfigManager } from './src/config/ConfigManager';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to analyze cohesion of existing game states
 * Usage: ts-node analyze-existing-games.ts
 */
async function main() {
  console.log('📊 Analyzing Existing Game States');
  console.log('='.repeat(60));
  console.log('');

  const gameFiles = [
    'test_outputs/game-t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen-10rounds-2026-01-14T22-22-56-260Z.txt',
    'test_outputs/game-t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen-12rounds-2026-01-14T22-28-32-973Z.txt'
  ];

  console.log('Found game states:');
  gameFiles.forEach((file, i) => {
    console.log(`  ${i + 1}. ${path.basename(file)}`);
  });
  console.log('');

  // Initialize LLM service for cohesion analysis
  const configManager = ConfigManager.getInstance();
  const llmConfig = configManager.getLLMConfig();
  const llmService = createLLMService(llmConfig);
  await llmService.initialize(llmConfig);
  console.log('✅ LLM service initialized');
  console.log('');

  // Create cohesion ranker
  const cohesionRanker = new CohesionRanker(llmService);

  // Load game results from files
  const gameResults: GameResult[] = [];
  
  for (const gameFile of gameFiles) {
    console.log(`📖 Loading ${path.basename(gameFile)}...`);
    
    try {
      const content = fs.readFileSync(gameFile, 'utf8');
      
      // Parse the file to extract game state
      const lines = content.split('\n');
      let gameStateJson = '';
      let inGameState = false;
      
      for (const line of lines) {
        if (line.includes('=== GAME STATE ===')) {
          inGameState = true;
          continue;
        }
        if (inGameState) {
          gameStateJson += line + '\n';
        }
      }
      
      const gameState = JSON.parse(gameStateJson);
      
      // Extract rounds from filename
      const roundsMatch = gameFile.match(/(\d+)rounds/);
      const rounds = roundsMatch ? parseInt(roundsMatch[1]) : 0;
      
      // Extract ending
      const endingMatch = content.match(/Ending: (.+)/);
      const ending = endingMatch ? endingMatch[1] : 'Unknown ending';
      
      const gameResult: GameResult = {
        rounds,
        endingAchieved: ending,
        cohesionRank: 0, // Will be filled by cohesion analysis
        filename: path.basename(gameFile),
        gameState
      };
      
      gameResults.push(gameResult);
      console.log(`  ✅ Loaded (${rounds} rounds)`);
      
    } catch (error) {
      console.error(`  ❌ Failed to load: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log('');
  console.log(`📊 Loaded ${gameResults.length} game states`);
  console.log('');

  if (gameResults.length === 0) {
    console.error('❌ No game states loaded. Exiting.');
    process.exit(1);
  }

  // Analyze cohesion
  console.log('🔍 Analyzing cohesion...');
  console.log('This may take a few minutes...');
  console.log('');
  
  try {
    const rankedResults = await cohesionRanker.rankGamesByCohesion(gameResults);
    
    console.log('');
    console.log('='.repeat(60));
    console.log('📊 COHESION ANALYSIS RESULTS');
    console.log('='.repeat(60));
    console.log('');
    
    // Display results
    rankedResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.rounds} rounds - Cohesion: ${result.cohesionRank}/10`);
      console.log(`   Ending: ${result.endingAchieved.substring(0, 80)}...`);
      console.log('');
    });
    
    // Calculate statistics
    const cohesionRanks = rankedResults.map(r => r.cohesionRank);
    const avgCohesion = cohesionRanks.reduce((sum, rank) => sum + rank, 0) / cohesionRanks.length;
    const maxCohesion = Math.max(...cohesionRanks);
    const minCohesion = Math.min(...cohesionRanks);
    
    console.log('📈 Statistics:');
    console.log(`   Average Cohesion: ${avgCohesion.toFixed(2)}/10`);
    console.log(`   Highest Cohesion: ${maxCohesion}/10`);
    console.log(`   Lowest Cohesion: ${minCohesion}/10`);
    console.log('');
    
    // Generate reports
    console.log('📄 Generating reports...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = 'test_outputs';
    
    // CSV report
    const csvReport = cohesionRanker.generateCohesionReport(rankedResults, {
      format: 'csv',
      includeHeaders: true,
      sortOrder: 'desc'
    });
    const csvPath = path.join(outputDir, `cohesion-report-pride-prejudice-${timestamp}.csv`);
    fs.writeFileSync(csvPath, csvReport.content, 'utf8');
    console.log(`  ✅ CSV: ${csvPath}`);
    
    // Table report
    const tableReport = cohesionRanker.generateCohesionReport(rankedResults, {
      format: 'table',
      includeHeaders: true,
      sortOrder: 'desc'
    });
    const tablePath = path.join(outputDir, `cohesion-report-pride-prejudice-${timestamp}.txt`);
    fs.writeFileSync(tablePath, tableReport.content, 'utf8');
    console.log(`  ✅ TXT: ${tablePath}`);
    
    // JSON report
    const jsonReport = {
      games: rankedResults,
      sortedByCohesion: rankedResults,
      generatedAt: new Date(),
      statistics: {
        totalGames: rankedResults.length,
        averageCohesion: parseFloat(avgCohesion.toFixed(2)),
        highestCohesion: maxCohesion,
        lowestCohesion: minCohesion
      }
    };
    const jsonPath = path.join(outputDir, `cohesion-report-pride-prejudice-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf8');
    console.log(`  ✅ JSON: ${jsonPath}`);
    
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ ANALYSIS COMPLETE!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ COHESION ANALYSIS FAILED');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
