#!/usr/bin/env ts-node
/**
 * Simple test to verify RAG-based quote extraction with ONE game only
 * Tests original ending with 60% quote usage
 */

import { GameManager } from './src/core/GameManager';
import { ConfigManager } from './src/config/ConfigManager';
import * as fs from 'fs';
import * as path from 'path';

async function testSingleRAGGame() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         SINGLE GAME RAG QUOTE EXTRACTION TEST                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const novelPath = 'TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt';
  const rounds = 3;
  const quotePercentage = 60;

  console.log(`📖 Novel: Pride and Prejudice`);
  console.log(`🎲 Rounds: ${rounds}`);
  console.log(`📊 Quote percentage: ${quotePercentage}%`);
  console.log(`🎯 Ending: Original only`);
  console.log(`⏱️  Estimated time: 3-5 minutes\n`);

  let gameManager: GameManager | null = null;

  try {
    // Initialize GameManager
    console.log('🚀 Initializing GameManager...\n');
    gameManager = new GameManager();
    await gameManager.initializeLLMService();
    console.log('✅ GameManager initialized\n');

    // Start the game
    console.log('🎮 Starting game with original ending...\n');
    const gameSession = await gameManager.startGame(
      novelPath,
      0, // Zero human players
      rounds,
      true, // Allow zero humans
      undefined, // No pre-analyzed novel
      true, // Allow custom rounds
      quotePercentage // Quote percentage
    );

    console.log('✅ Game started successfully!\n');
    console.log(`   Players: ${gameSession.gameState.players.length}`);
    console.log(`   Target ending: ${gameSession.gameState.targetEnding?.type || 'none'}`);
    console.log(`   Quote percentage: ${gameSession.gameState.quotePercentage}%\n`);

    // Simulate the game
    console.log('🎲 Simulating game turns...\n');
    
    let turnCount = 0;
    while (gameSession.gameState.currentRound <= rounds) {
      console.log(`\n═══ ROUND ${gameSession.gameState.currentRound}/${rounds} ═══`);
      
      for (const player of gameSession.gameState.players) {
        if (gameSession.gameState.currentRound > rounds) {
          break;
        }
        
        console.log(`\n👤 ${player.character?.name || 'Unknown'}`);
        
        // Use processPlayerTurnWithChoice to trigger ActionChoiceManager
        await gameManager.processPlayerTurnWithChoice(player.id);
        turnCount++;
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      gameSession.gameState.currentRound++;
    }

    console.log(`\n✅ Game simulation complete: ${turnCount} turns processed\n`);

    // Get final stats
    const stats = gameSession.gameState.quoteUsageStats;

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                         RESULTS                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    console.log(`📊 Quote Usage Statistics:`);
    console.log(`   Total actions: ${stats.totalActions}`);
    console.log(`   Book quotes used: ${stats.bookQuotesUsed}`);
    console.log(`   LLM generated: ${stats.llmGeneratedUsed}`);
    console.log(`   Actual quote %: ${stats.actualPercentage.toFixed(1)}%`);
    console.log(`   Target quote %: ${quotePercentage}%`);
    
    if (stats.bookQuotesUsed > 0) {
      console.log(`\n✅ SUCCESS: RAG-based quote extraction is WORKING!`);
      console.log(`   ${stats.bookQuotesUsed} quotes were extracted using the Assistant API.\n`);
      
      // Show some example quotes
      const bookQuoteSegments = gameSession.gameState.storySegments.filter(
        seg => seg.contentSource === 'book_quote'
      );
      
      if (bookQuoteSegments.length > 0) {
        console.log(`📖 Example book quotes used:\n`);
        bookQuoteSegments.slice(0, 3).forEach((seg, idx) => {
          const preview = seg.content.substring(0, 100).replace(/\n/g, ' ');
          console.log(`   ${idx + 1}. ${seg.characterName}:`);
          console.log(`      "${preview}${seg.content.length > 100 ? '...' : ''}"\n`);
        });
      }
    } else {
      console.log(`\n❌ ISSUE: No book quotes used (0/${stats.totalActions})`);
      console.log(`   RAG-based quote extraction may not be working.`);
      console.log(`   Check the logs above for errors.\n`);
    }

    console.log(`📝 Story segments: ${gameSession.gameState.storySegments.length}`);
    console.log(`📖 Total words: ${gameSession.gameState.storySegments.reduce((sum, seg) => sum + seg.wordCount, 0)}`);

    // Save game state
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join('test_outputs', `single-rag-test-${timestamp}.json`);
    
    // Ensure directory exists
    if (!fs.existsSync('test_outputs')) {
      fs.mkdirSync('test_outputs', { recursive: true });
    }
    
    fs.writeFileSync(filename, JSON.stringify(gameSession.gameState, null, 2));
    console.log(`\n💾 Game state saved: ${filename}`);

    // Cleanup assistant resources
    console.log(`\n🗑️  Cleaning up assistant resources...`);
    await gameManager.cleanupAssistantResources();
    console.log(`✅ Cleanup complete\n`);

    // Exit with appropriate code
    process.exit(stats.bookQuotesUsed > 0 ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('\nStack trace:', error.stack);
    }
    
    // Try to cleanup even on error
    if (gameManager) {
      try {
        console.log('\n🗑️  Attempting cleanup after error...');
        await gameManager.cleanupAssistantResources();
        console.log('✅ Cleanup complete');
      } catch (cleanupError) {
        console.error('⚠️  Cleanup failed:', cleanupError);
      }
    }
    
    process.exit(1);
  }
}

// Run the test
testSingleRAGGame().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
