#!/usr/bin/env ts-node
/**
 * Quick test script for book quote extraction
 * Tests quote extraction without running full game simulation
 */

import * as fs from 'fs';
import { Character } from './src/models/Character';
import { NovelAnalysis } from './src/models/GameState';
import { StoryEnding } from './src/models/StoryEnding';
import { createBookQuoteExtractor } from './src/services/BookQuoteExtractor';
import { createLLMService } from './src/services/LLMService';
import { ConfigManager } from './src/config/ConfigManager';

async function testQuoteExtraction() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           QUICK QUOTE EXTRACTION TEST                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Load the novel text
    const novelPath = 'TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt';
    console.log(`📖 Loading novel: ${novelPath}`);
    const novelText = fs.readFileSync(novelPath, 'utf-8');
    console.log(`✅ Novel loaded: ${novelText.length} characters\n`);

    // Create mock novel analysis with REAL Pride and Prejudice characters
    const mockAnalysis: NovelAnalysis = {
      mainCharacters: [
        {
          id: 'elizabeth',
          name: 'Elizabeth',
          description: 'The intelligent and spirited second eldest Bennet daughter, known for her wit and independence.',
          importance: 10
        },
        {
          id: 'darcy',
          name: 'Darcy',
          description: 'A wealthy and proud gentleman who initially appears aloof but proves to be honorable and caring.',
          importance: 9
        },
        {
          id: 'jane',
          name: 'Jane',
          description: 'The eldest and most beautiful Bennet sister, known for her sweet and gentle nature.',
          importance: 8
        },
        {
          id: 'bingley',
          name: 'Bingley',
          description: 'A wealthy, good-natured gentleman who falls in love with Jane Bennet.',
          importance: 7
        }
      ],
      plotPoints: [],
      introduction: 'Mock introduction',
      climax: 'Mock climax',
      conclusion: 'Mock conclusion',
      isComplete: true,
      validationErrors: []
    };

    console.log('👥 Test characters:');
    mockAnalysis.mainCharacters.forEach(char => {
      console.log(`   - ${char.name} (importance: ${char.importance})`);
    });
    console.log();

    // Initialize LLM service
    const configManager = ConfigManager.getInstance();
    const llmConfig = configManager.getLLMConfig();
    const llmService = createLLMService(llmConfig);
    await llmService.initialize(llmConfig);
    console.log('✅ LLM service initialized\n');

    // Create assistant service for RAG-based quote extraction
    const { createAssistantService } = await import('./src/services/AssistantService');
    const assistantService = createAssistantService();
    await assistantService.initialize(llmConfig);
    console.log('✅ Assistant service initialized\n');

    // Create book quote extractor
    const bookQuoteExtractor = createBookQuoteExtractor(
      novelText,
      mockAnalysis,
      llmService,
      assistantService
    );
    console.log('✅ BookQuoteExtractor created\n');

    // Create a mock target ending
    const targetEnding: StoryEnding = {
      id: 'original-1',
      type: 'original',
      description: 'Elizabeth and Darcy overcome their pride and prejudice to find happiness together.',
      targetScore: 0
    };

    // Test 1: Find dialogue context
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TEST 1: Finding dialogue context for round 1 of 5');
    console.log('═══════════════════════════════════════════════════════════════');
    const context = await bookQuoteExtractor.findDialogueContext(1, 5);
    console.log(`📍 Context found:`);
    console.log(`   Position: ${context.startPosition} - ${context.endPosition}`);
    console.log(`   Length: ${context.endPosition - context.startPosition} characters`);
    console.log(`   Scene: ${context.sceneDescription}`);
    console.log(`   Chapter: ${context.chapterNumber || 'Unknown'}`);
    console.log(`   Available characters: ${context.availableCharacters.join(', ') || 'None found'}`);
    console.log();

    // Test 2: Extract dialogue for Elizabeth Bennet
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TEST 2: Extracting dialogue for Elizabeth Bennet');
    console.log('═══════════════════════════════════════════════════════════════');
    const elizabeth = mockAnalysis.mainCharacters[0];
    
    // Try searching in the full novel first to see if we can find ANY Elizabeth quotes
    console.log('   Searching in full novel...');
    const elizabethDialogueFull = await bookQuoteExtractor.extractCharacterDialogue(
      elizabeth,
      undefined, // No context = search full novel
      targetEnding
    );
    console.log(`📝 Found ${elizabethDialogueFull.length} dialogue quotes in full novel`);
    
    // Now try in the specific context
    console.log('   Searching in context section...');
    const elizabethDialogue = await bookQuoteExtractor.extractCharacterDialogue(
      elizabeth,
      context,
      targetEnding
    );
    console.log(`📝 Found ${elizabethDialogue.length} dialogue quotes in context`);
    
    if (elizabethDialogueFull.length > 0) {
      console.log(`\nFirst 3 quotes from full novel:`);
      elizabethDialogueFull.slice(0, 3).forEach((quote, i) => {
        console.log(`   ${i + 1}. "${quote.substring(0, 100)}${quote.length > 100 ? '...' : ''}"`);
      });
    } else {
      console.log('   ⚠️  No quotes found even in full novel - regex patterns may need adjustment!');
    }
    console.log();

    // Test 3: Extract actions for Mr. Darcy
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TEST 3: Extracting actions for Mr. Darcy');
    console.log('═══════════════════════════════════════════════════════════════');
    const darcy = mockAnalysis.mainCharacters[1];
    const darcyActions = await bookQuoteExtractor.extractCharacterActions(
      darcy,
      context,
      targetEnding
    );
    console.log(`📝 Found ${darcyActions.length} action quotes for ${darcy.name}`);
    if (darcyActions.length > 0) {
      console.log(`\nFirst 3 actions:`);
      darcyActions.slice(0, 3).forEach((action, i) => {
        console.log(`   ${i + 1}. ${action.substring(0, 100)}${action.length > 100 ? '...' : ''}`);
      });
    } else {
      console.log('   ⚠️  No actions found');
    }
    console.log();

    // Test 4: Test intelligent quote selection (if we have quotes)
    if (elizabethDialogueFull.length > 1) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('TEST 4: Intelligent quote selection');
      console.log('═══════════════════════════════════════════════════════════════');
      
      const gameContext = {
        recentSegments: [
          { content: 'The story begins with the arrival of Mr. Bingley to Netherfield.' }
        ],
        currentRound: 1,
        totalRounds: 5,
        novelTitle: 'Pride and Prejudice'
      };

      const selectedQuote = await bookQuoteExtractor.selectContextualQuote(
        elizabethDialogueFull.slice(0, 5), // Test with first 5 quotes from full novel
        elizabeth,
        gameContext,
        targetEnding
      );

      if (selectedQuote) {
        console.log(`✅ Selected quote: "${selectedQuote.substring(0, 150)}${selectedQuote.length > 150 ? '...' : ''}"`);
      } else {
        console.log('⚠️  No quote selected');
      }
      console.log();
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ Context extraction: Working`);
    console.log(`${elizabethDialogueFull.length > 0 ? '✅' : '❌'} Dialogue extraction: ${elizabethDialogueFull.length > 0 ? 'Working' : 'NOT WORKING'} (${elizabethDialogueFull.length} quotes found in full novel)`);
    console.log(`${darcyActions.length > 0 ? '✅' : '❌'} Action extraction: ${darcyActions.length > 0 ? 'Working' : 'NOT WORKING'} (${darcyActions.length} actions found)`);
    
    if (elizabethDialogueFull.length === 0 && darcyActions.length === 0) {
      console.log('\n⚠️  ISSUE: No quotes found for any character');
      console.log('   This suggests the regex patterns are not matching the novel text.');
      console.log('   Check the novel format and character name patterns.');
    } else {
      console.log('\n✅ Quote extraction is working!');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testQuoteExtraction().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
