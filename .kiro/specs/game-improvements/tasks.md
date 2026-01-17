# Implementation Plan: Game Improvements

## Overview

This implementation plan breaks down the game improvements into discrete, manageable tasks. The plan follows a phased approach, building foundational components first, then integrating them, and finally adding comprehensive testing.

## Tasks

- [ ] 1. Phase 1: Character Name Display Enhancement
  - [x] 1.1 Update StorySegment interface to include character name and player ID
    - Modify `src/models/GameState.ts` to add `characterName` and `playerId` fields to `StorySegment`
    - Update `validateStorySegment()` function to validate new fields
    - _Requirements: 1.1_
  
  - [x] 1.2 Implement getPlayerDisplayName() helper method
    - Add method to `GameManager` class that returns "Character Name (Player X)" format
    - Handle case where character is not assigned (return "Player X" only)
    - _Requirements: 1.2, 1.5_
  
  - [x] 1.3 Update processPlayerTurn() to populate character information
    - Modify `GameManager.processPlayerTurn()` to include character name in story segments
    - Update story segment creation to use `getPlayerDisplayName()`
    - _Requirements: 1.1, 1.3_
  
  - [x] 1.4 Update all console logging to display character names
    - Find all `console.log` statements related to player actions
    - Replace with calls to `getPlayerDisplayName()`
    - _Requirements: 1.4_
  
  - [x] 1.5 Update game state file formatting
    - Modify `GameStateManager` to include character names in saved files
    - Update file output format to show character names for all actions
    - _Requirements: 1.3_
  
  - [ ]* 1.6 Write property test for character name inclusion
    - **Property 1: Character Name Inclusion**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Test that character names appear in outputs when assigned
    - Test that only player ID appears when no character assigned

- [x] 2. Phase 2: Book Quote Extraction System
  - [x] 2.1 Create BookQuoteExtractor component
    - Create `src/services/BookQuoteExtractor.ts` with interface
    - Implement basic structure and constructor
    - _Requirements: 12.4_
  
  - [x] 2.2 Implement character dialogue extraction
    - Add `extractCharacterDialogue()` method
    - Use regex and text processing to find character dialogue
    - Cache extracted quotes for performance
    - _Requirements: 12.2, 12.4_
  
  - [x] 2.3 Implement character action extraction
    - Add `extractCharacterActions()` method
    - Extract narrative descriptions of character actions
    - _Requirements: 12.3, 12.4_
  
  - [x] 2.4 Implement dialogue context identification
    - Add `findDialogueContext()` method
    - Identify book sections based on round progression
    - Return context with chapter/scene information
    - _Requirements: 13.1, 13.5_
  
  - [x] 2.5 Implement quote validation
    - Add `validateQuoteForCharacter()` method
    - Verify quote appears in source novel
    - Verify quote is associated with correct character
    - _Requirements: 12.4_
  
  - [x] 2.6 Implement ending compatibility checking
    - Add `checkEndingCompatibility()` method using LLM
    - Score how well quote supports target ending (0-10)
    - Return compatibility score with reasoning
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [x] 2.7 Implement intelligent quote selection logic
    - Add `shouldUseBookQuote()` method
    - Implement decision tree based on ending type
    - Handle original vs opposite vs random endings differently
    - _Requirements: 12.2, 12.3, 12.5, 12.6_
  
  - [ ]* 2.8 Write property test for quote character matching
    - **Property 18: Quote Character Matching**
    - **Validates: Requirements 12.4**
    - Test that extracted quotes appear in source novel
    - Test that quotes are associated with correct character
  
  - [ ]* 2.9 Write property test for quote fallback behavior
    - **Property 19: Quote Fallback Behavior**
    - **Validates: Requirements 12.7**
    - Test that system falls back to LLM when no quotes found
    - Test that fallback doesn't cause errors

- [x] 3. Phase 3: Enhanced Game State Data Models
  - [x] 3.1 Update StorySegment with content source tracking
    - Change `isBookQuote` to `contentSource: 'book_quote' | 'llm_generated'`
    - Add `bookQuoteMetadata` field with chapter/page info
    - Update validation functions
    - _Requirements: 12.2, 12.3, 12.4_
  
  - [x] 3.2 Create BookQuoteMetadata interface
    - Define interface in `src/models/GameState.ts`
    - Include originalText, chapterNumber, pageNumber, contextDescription, endingCompatibilityScore
    - _Requirements: 12.4_
  
  - [x] 3.3 Update GameState with quote tracking
    - Add `quotePercentage` configuration field
    - Add `effectiveQuotePercentage` tracking field
    - Add `quoteUsageStats` with detailed statistics
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [x] 3.4 Update PlayerAction with content source
    - Add `contentSource` field
    - Add `bookQuoteMetadata` field
    - Update validation
    - _Requirements: 12.2, 12.3_
  
  - [ ]* 3.5 Write property test for quote percentage configuration
    - **Property 16: Quote Percentage Configuration**
    - **Validates: Requirements 12.1**
    - Test that game state includes quote percentage 0-100
  
  - [ ]* 3.6 Write property test for content source transparency
    - **Property 25: Content Source Transparency**
    - **Validates: Requirements 12.2, 12.3, 12.4**
    - Test that all content is marked as book_quote or llm_generated
    - Test that book quotes include metadata

- [x] 4. Phase 4: Action Choice System
  - [x] 4.1 Create ActionChoiceManager component
    - Create `src/services/ActionChoiceManager.ts` with interface
    - Define ActionOptions and PlayerChoice interfaces
    - _Requirements: 11.1_
  
  - [x] 4.2 Implement action option generation
    - Add `generateActionOptions()` method
    - Generate both talk and act options using LLM
    - Apply book quote percentage and ending compatibility
    - Mark content source clearly
    - _Requirements: 11.1, 11.3, 12.2, 12.3_
  
  - [x] 4.3 Implement player selection flow
    - Add `presentOptionsToPlayer()` method
    - For human players: display options and wait for input
    - For computer players: randomly select from three options
    - _Requirements: 11.2, 11.3, 11.5_
  
  - [x] 4.4 Implement choice application
    - Add `applyPlayerChoice()` method
    - Record selected action with content source
    - Generate story segment with proper metadata
    - _Requirements: 11.4_
  
  - [x] 4.5 Integrate with GameManager
    - Add `processPlayerTurnWithChoice()` method to GameManager
    - Replace old dice-roll logic with action choice system
    - Maintain backward compatibility
    - _Requirements: 11.1, 11.4_
  
  - [x] 4.6 Update TestFramework for random selection
    - Modify `createPlayerAction()` to randomly select from options
    - Ensure computer players use new action choice system
    - _Requirements: 11.5_
  
  - [ ]* 4.7 Write property test for action option generation
    - **Property 12: Action Option Generation**
    - **Validates: Requirements 11.1, 11.3**
    - Test that both talk and act options are generated
  
  - [ ]* 4.8 Write property test for action choice recording
    - **Property 13: Action Choice Recording**
    - **Validates: Requirements 11.4**
    - Test that selected action is recorded correctly
  
  - [ ]* 4.9 Write property test for random action selection
    - **Property 14: Random Action Selection in Tests**
    - **Validates: Requirements 11.5**
    - Test that computer players select valid actions randomly
  
  - [ ]* 4.10 Write property test for do nothing round increment
    - **Property 15: Do Nothing Round Increment**
    - **Validates: Requirements 11.6**
    - Test that "do nothing" increases round count by 1

- [x] 5. Checkpoint - Core Features Complete
  - Ensure all tests pass
  - Verify character names display correctly
  - Verify book quotes are extracted and used
  - Verify action choice system works
  - Ask the user if questions arise

- [x] 6. Phase 5: Contextual Dialogue Grouping
  - [x] 6.1 Implement dialogue context identification
    - Enhance `findDialogueContext()` to identify coherent scenes
    - Map rounds to book sections progressively
    - _Requirements: 13.1_
  
  - [x] 6.2 Implement contextual quote grouping
    - Modify quote extraction to prefer same context for all characters in a round
    - Extract quotes from same chapter/scene when possible
    - _Requirements: 13.2, 13.3_
  
  - [x] 6.3 Implement context expansion fallback
    - When context doesn't have quotes for all characters, expand search
    - Fall back to LLM generation if expansion fails
    - _Requirements: 13.4_
  
  - [x] 6.4 Add context logging
    - Log which book section is used for each round
    - Include in game state files
    - _Requirements: 13.5_
  
  - [ ]* 6.5 Write property test for dialogue context identification
    - **Property 20: Dialogue Context Identification**
    - **Validates: Requirements 13.1**
    - Test that context is identified for each round
  
  - [ ]* 6.6 Write property test for contextual quote grouping
    - **Property 21: Contextual Quote Grouping**
    - **Validates: Requirements 13.2, 13.3**
    - Test that quotes from same round come from nearby sections
  
  - [ ]* 6.7 Write property test for context expansion fallback
    - **Property 22: Context Expansion Fallback**
    - **Validates: Requirements 13.4**
    - Test that system handles missing quotes gracefully

- [x] 7. Phase 6: Enhanced Turn Display
  - [x] 7.1 Update turn selection display format
    - Modify display to show "Character_Name (Player X) chose: [action]"
    - Handle case where no character assigned
    - _Requirements: 14.1, 14.4_
  
  - [x] 7.2 Update turn logging to game state files
    - Include both character name and player number in logs
    - _Requirements: 14.2_
  
  - [x] 7.3 Update turn history display
    - Show character names and player numbers for all past turns
    - _Requirements: 14.3_
  
  - [ ]* 7.4 Write property test for turn display format
    - **Property 23: Turn Display Format Consistency**
    - **Validates: Requirements 14.1, 14.2, 14.3**
    - Test format with and without character assignment

- [x] 8. Phase 7: Conclusion Test Framework
  - [x] 8.1 Create ConclusionTestFramework class
    - Create `src/testing/ConclusionTestFramework.ts`
    - Define ConclusionTestConfig and ConclusionTestReport interfaces
    - _Requirements: 2.1_
  
  - [x] 8.2 Implement multiple iteration execution
    - Add `runConclusionTest()` method
    - Execute novel analysis N times (configurable)
    - Extract conclusion from each analysis
    - _Requirements: 2.1, 2.2_
  
  - [x] 8.3 Implement conclusion consistency scoring
    - Add `analyzeConclusionConsistency()` method
    - Calculate pairwise similarity between conclusions
    - Use LLM or cosine similarity for comparison
    - Identify outliers
    - _Requirements: 2.3, 2.6, 2.7_
  
  - [x] 8.4 Implement conclusion quality scoring
    - Add `scoreConclusionQuality()` method using LLM
    - Score accuracy, completeness, coherence (1-10 each)
    - Provide reasoning for scores
    - _Requirements: 2.4_
  
  - [x] 8.5 Implement multi-format report generation
    - Generate CSV report with all metrics
    - Generate JSON report with complete data
    - Generate text table report for readability
    - _Requirements: 2.5_
  
  - [x] 8.6 Add configuration validation
    - Validate iteration count is 1-10
    - Validate output directory exists or create it
    - Use defaults when not specified
    - _Requirements: 4.1, 4.4, 4.5_
  
  - [x] 8.7 Create CLI script for conclusion tests
    - Create `run-conclusion-test.ts` in project root
    - Accept command-line arguments for novel file and iterations
    - Display usage instructions
    - _Requirements: 9.1, 9.3_
  
  - [ ]* 8.8 Write property test for conclusion iteration count
    - **Property 2: Conclusion Test Iteration Count**
    - **Validates: Requirements 2.1, 2.2**
    - Test that exactly N analyses are performed
  
  - [ ]* 8.9 Write property test for consistency scoring
    - **Property 3: Conclusion Consistency Scoring**
    - **Validates: Requirements 2.3, 2.6**
    - Test that consistency score is 0-10
  
  - [ ]* 8.10 Write property test for quality scoring range
    - **Property 4: Conclusion Quality Scoring Range**
    - **Validates: Requirements 2.4**
    - Test that all scores are 1-10
  
  - [ ]* 8.11 Write property test for multi-format reports
    - **Property 5: Multi-Format Report Generation**
    - **Validates: Requirements 2.5**
    - Test that CSV, JSON, and text reports are generated

- [x] 9. Phase 8: Ending Variation Test Framework
  - [x] 9.1 Create EndingVariationTestFramework class
    - Create `src/testing/EndingVariationTestFramework.ts`
    - Define EndingVariationTestConfig and EndingVariationReport interfaces
    - _Requirements: 3.1_
  
  - [x] 9.2 Implement original ending generation
    - Add `generateOriginalEnding()` method
    - Extract and use book's actual conclusion
    - _Requirements: 3.2_
  
  - [x] 9.3 Implement opposite ending generation
    - Add `generateOppositeEnding()` method using LLM
    - Invert the book's conclusion outcome
    - Ensure semantic opposition (happy → tragic, success → failure)
    - _Requirements: 3.3_
  
  - [x] 9.4 Implement random ending generation
    - Add `generateRandomEnding()` method using LLM
    - Create creative alternative unrelated to book's conclusion
    - Ensure distinctness from original and opposite
    - _Requirements: 3.4_
  
  - [x] 9.5 Implement three-game execution
    - Add `runEndingVariationTest()` method
    - Analyze novel once, reuse for all games
    - Run three games with 5 rounds each
    - One game per ending type
    - _Requirements: 3.5, 6.1_
  
  - [x] 9.6 Implement cohesion analysis for each game
    - Use existing CohesionRanker for each game
    - Store cohesion scores in results
    - _Requirements: 3.6_
  
  - [x] 9.7 Implement comparative report generation
    - Generate report comparing all three ending types
    - Include cohesion scores, word counts, quote usage stats
    - Identify which ending type achieved highest cohesion
    - Generate CSV, JSON, and text formats
    - _Requirements: 3.7, 3.8_
  
  - [x] 9.8 Implement individual game state file creation
    - Save separate game state file for each ending variation
    - Include ending type in filename
    - _Requirements: 3.9_
  
  - [x] 9.9 Add configuration validation
    - Validate round count is 1-20
    - Validate quote percentage is 0-100
    - Use defaults when not specified
    - _Requirements: 4.2, 4.3, 4.5_
  
  - [x] 9.10 Create CLI script for ending variation tests
    - Create `run-ending-variation-test.ts` in project root
    - Accept command-line arguments for novel file and rounds
    - Display usage instructions
    - _Requirements: 9.2, 9.3_
  
  - [ ]* 9.11 Write property test for ending type distinctness
    - **Property 6: Ending Type Distinctness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Test that three endings are semantically distinct
  
  - [ ]* 9.12 Write property test for fixed round count
    - **Property 7: Fixed Round Count for Variation Tests**
    - **Validates: Requirements 3.5**
    - Test that exactly 3 games with 5 rounds each are executed
  
  - [ ]* 9.13 Write property test for cohesion score calculation
    - **Property 8: Cohesion Score Calculation**
    - **Validates: Requirements 3.6**
    - Test that cohesion scores are 1-10
  
  - [ ]* 9.14 Write property test for comparative statistics
    - **Property 9: Comparative Statistics Accuracy**
    - **Validates: Requirements 3.8**
    - Test that highest cohesion is correctly identified
  
  - [ ]* 9.15 Write property test for game state files
    - **Property 10: Individual Game State Files**
    - **Validates: Requirements 3.9**
    - Test that exactly 3 files are created
  
  - [ ]* 9.16 Write property test for ending compatibility adjustment
    - **Property 26: Ending Compatibility Adjustment**
    - **Validates: Requirements 3.2, 3.3, 3.4, 12.2, 12.3**
    - Test that effective quote percentage is lower for non-original endings
    - Test that adjustments are tracked

- [x] 10. Checkpoint - Test Frameworks Complete
  - Ensure all tests pass
  - Run conclusion test on small novel
  - Run ending variation test on small novel
  - Verify reports are generated correctly
  - Ask the user if questions arise

- [x] 11. Phase 9: Configuration and Error Handling
  - [x] 11.1 Add comprehensive input validation
    - Validate all configuration parameters
    - Provide clear error messages
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 11.2 Implement error handling for book quote extraction
    - Handle no quotes found gracefully
    - Handle extraction timeouts
    - Handle invalid quote formats
    - _Requirements: 12.7_
  
  - [x] 11.3 Implement error handling for action choice system
    - Handle LLM failures in option generation
    - Handle player timeouts
    - Handle invalid selections
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [x] 11.4 Implement error handling for test frameworks
    - Handle analysis failures in iterations
    - Handle scoring failures
    - Handle report generation failures
    - Continue with remaining tests on error
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 11.5 Add comprehensive logging
    - Log test configuration at start
    - Log progress for each iteration/game
    - Log detailed error information
    - Log summary statistics at completion
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ]* 11.6 Write property test for configuration validation
    - **Property 11: Configuration Parameter Validation**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Test that invalid configurations are rejected

- [x] 12. Phase 10: Code Cleanup and Refactoring
  - [x] 12.1 Remove old dice-roll-based action determination
    - Identify and remove obsolete code in GameManager
    - Identify and remove obsolete code in GameFlowManager
    - _Requirements: 15.1_
  
  - [x] 12.2 Remove obsolete test code
    - Identify tests that test removed functionality
    - Remove or update obsolete tests
    - _Requirements: 15.2_
  
  - [x] 12.3 Update documentation
    - Update README with new features
    - Update API documentation
    - Update usage examples
    - _Requirements: 15.3_
  
  - [x] 12.4 Verify all tests pass after cleanup
    - Run complete test suite
    - Fix any broken tests
    - _Requirements: 15.4_
  
  - [x] 12.5 Verify API compatibility
    - Check that public APIs remain unchanged
    - Test backward compatibility
    - _Requirements: 15.5_
  
  - [ ]* 12.6 Write property test for API compatibility
    - **Property 24: API Compatibility Preservation**
    - **Validates: Requirements 15.5**
    - Test that public API signatures are unchanged

- [x] 13. Checkpoint - Cleanup Complete
  - Ensure all tests pass
  - Verify no breaking changes
  - Verify documentation is updated
  - Ask the user if questions arise

- [x] 14. Phase 11: Comprehensive Pride and Prejudice Testing
  - [x] 14.1 Run ending variation test on Pride and Prejudice
    - Use full novel file
    - Configure quote percentage (e.g., 60%)
    - Run with 5 rounds per game
    - _Requirements: 16.1, 16.2, 16.3_
  
  - [x] 14.2 Verify all features work together
    - Verify action choice system is used
    - Verify book quotes are extracted and used
    - Verify dialogue grouping works
    - Verify character names display correctly
    - _Requirements: 16.2, 16.3, 16.4_
  
  - [x] 14.3 Analyze and validate results
    - Review generated endings for quality
    - Review cohesion scores
    - Review quote usage statistics
    - Review dialogue context grouping effectiveness
    - _Requirements: 16.5, 16.6_
  
  - [x] 14.4 Generate comprehensive reports
    - Generate all report formats
    - Include all metrics
    - Document findings
    - _Requirements: 16.5, 16.6_

- [ ] 15. Final Checkpoint - Complete System Validation
  - Ensure all tests pass
  - Verify Pride and Prejudice test completed successfully
  - Review all generated reports
  - Verify all requirements are met
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional test tasks that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a logical progression from core features to testing
- API rate limiting is handled throughout (delays between operations)
- All new features are backward compatible
- Configuration is flexible and validated
