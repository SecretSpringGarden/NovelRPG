#!/usr/bin/env ts-node
/**
 * Simple single-game test for debugging quote extraction
 * Runs one game with original ending to test quote extraction quickly
 */

import { GameManager } from './src/core/GameManager';
import { ConfigManager } from './src/config/ConfigManager';
import * as fs from 'fs';

async function testSingleGame() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              SINGLE GAME TEST (ORIGINAL ENDING)                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const novelPath = 'TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt';
  const rounds = 3; // Just 3 rounds for quick testing
  const quotePercentage = 60;

  console.log(`📖 Novel: ${novelPath}`);
  console.log(`🎲 Rounds: ${rounds}`);
  console.log(`📊 Quote percentage: ${quotePercentage}%`);
  console.log(`🎯 Ending type: original\n`);

  try {
    // Initialize config and game manager
    const configManager = ConfigManager.getInstance();
    const llmConfig = configManager.getLLMConfig();
    
    const gameManager = new GameManager();
    await gameManager.initializeLLMService();
    console.log('✅ GameManager initialized\n');

    // Start the game
    console.log('🎮 Starting game...\n');
    const gameSession = await gameManager.startGame(
      novelPath,
      0, // Zero human players (all computer)
      rounds,
      true, // Allow zero human players
      undefined, // No pre-analyzed novel (will analyze fresh)
      true // Allow custom rounds
    );

    console.log('\n✅ Game started successfully!');
    console.log(`   Players: ${gameSession.gameState.players.length}`);
    console.log(`   Target ending: ${gameSession.gameState.targetEnding?.type || 'none'}`);

    // Simulate the game
    console.log('\n🎲 Simulating game turns...\n');
    
    for (let round = 1; round <= rounds; round++) {
      console.log(`\n═══ ROUND ${round}/${rounds} ═══`);
      
      for (const player of gameSession.gameState.players) {
        if (gameSession.gameState.currentRound > rounds) {
          break;
        }
        
        console.log(`\n👤 ${player.character?.name || 'Unknown'} (Player ${player.id})`);
        
        // Use processPlayerTurnWithChoice to trigger ActionChoiceManager
        await gameManager.processPlayerTurnWithChoice(player.id);
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      gameSession.gameState.currentRound++;
    }

    // Get final stats
    const stats = gameSession.gameState.quoteUsageStats;
    const effectivePercentage = gameSession.gameState.effectiveQuotePercentage;

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                         RESULTS                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    console.log(`📊 Quote Usage Statistics:`);
    console.log(`   Total actions: ${stats.totalActions}`);
    console.log(`   Book quotes used: ${stats.bookQuotesUsed}`);
    console.log(`   LLM generated: ${stats.llmGeneratedUsed}`);
    console.log(`   Effective quote %: ${effectivePercentage.toFixed(1)}%`);
    console.log(`   Target quote %: ${quotePercentage}%`);
    
    if (stats.bookQuotesUsed > 0) {
      console.log(`\n✅ SUCCESS: Book quotes are being used!`);
      
      // Show some example quotes
      const bookQuoteSegments = gameSession.gameState.storySegments.filter(
        seg => seg.contentSource === 'book_quote'
      );
      
      if (bookQuoteSegments.length > 0) {
        console.log(`\n📖 Example book quotes used:`);
        bookQuoteSegments.slice(0, 3).forEach((seg, idx) => {
          const preview = seg.content.substring(0, 100).replace(/\n/g, ' ');
          console.log(`   ${idx + 1}. ${seg.characterName}: "${preview}..."`);
        });
      }
    } else {
      console.log(`\n❌ ISSUE: No book quotes used (0/${stats.totalActions})`);
      console.log(`   This means quote extraction is not working.`);
    }

    console.log(`\n📝 Story segments: ${gameSession.gameState.storySegments.length}`);
    console.log(`📖 Total words: ${gameSession.gameState.storySegments.reduce((sum, seg) => sum + seg.wordCount, 0)}`);

    // Save game state
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test_outputs/single-game-test-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(gameSession.gameState, null, 2));
    console.log(`\n💾 Game state saved: ${filename}`);

    // Cleanup assistant resources
    console.log(`\n🗑️  Cleaning up assistant resources...`);
    await gameManager.cleanupAssistantResources();
    console.log(`✅ Cleanup complete`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testSingleGame().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
