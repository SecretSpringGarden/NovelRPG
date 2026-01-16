# Task List - Game Improvements

## Overview
This document outlines three major improvements to the game system:
1. Enhanced game state logging with character names
2. Book conclusion identification test framework
3. Multiple ending variations test framework

---

## Task 1: Add Character Names to Game State Logging

### Objective
Modify the game state output to display character names alongside player numbers, making it easier to understand who is acting or talking during gameplay.

### Current Behavior
- Game state shows player IDs (e.g., "Player 1", "Player 2")
- Character information is stored but not prominently displayed in logs

### Desired Behavior
- Display format: "Player 1 (Elizabeth Bennet)" or "Elizabeth Bennet (Player 1)"
- Show character names in:
  - Story segments
  - Player action logs
  - Game state files
  - Console output during gameplay

### Files to Modify
1. **src/core/GameManager.ts**
   - Update `processPlayerTurn()` to include character name in story segments
   - Modify helper methods `getPlayerName()` to return character name
   - Update console logging to show character names

2. **src/models/GameState.ts**
   - Consider adding a `characterName` field to `StorySegment` interface
   - Update validation functions if needed

3. **src/services/GameStateManager.ts** (if exists)
   - Update game state file formatting to include character names
   - Modify event logging to include character information

4. **src/testing/TestFramework.ts**
   - Update `extractEndingDescription()` to include character context
   - Modify game result output formatting

### Implementation Steps
1. Add character name extraction helper method
2. Update StorySegment interface to include character name
3. Modify processPlayerTurn to populate character name
4. Update all console.log statements to show character names
5. Update game state file output format
6. Test with existing game states to verify backward compatibility

### Testing
- Run a test game and verify character names appear in:
  - Console output
  - Game state files
  - Story segments
  - Test framework reports

---

## Task 2: Book Conclusion Identification Test Framework

### Objective
Create a test framework that validates the assistant's ability to correctly identify and understand the conclusion of a book.

### Purpose
- Ensure the LLM accurately extracts the book's conclusion
- Validate that the conclusion analysis is coherent and accurate
- Measure consistency across multiple analysis attempts

### Test Framework Design

#### Test Configuration
```typescript
interface ConclusionTestConfig {
  novelFile: string;
  iterations: number; // Number of times to analyze the same book
  outputDirectory: string;
}
```

#### Test Process
1. Analyze the same novel multiple times (e.g., 3-5 iterations)
2. Extract the conclusion from each analysis
3. Compare conclusions for consistency
4. Score each conclusion for:
   - Accuracy (matches actual book ending)
   - Completeness (includes key ending elements)
   - Coherence (makes logical sense)
   - Consistency (similar across iterations)

#### Output Format
- CSV report with columns:
  - Iteration number
  - Conclusion text (truncated)
  - Accuracy score (1-10)
  - Completeness score (1-10)
  - Coherence score (1-10)
  - Word count
  - Key elements identified
- Text report with full conclusions and analysis
- JSON report with complete data

### Files to Create
1. **src/testing/ConclusionTestFramework.ts**
   - Main test framework class
   - Conclusion extraction logic
   - Scoring algorithms
   - Report generation

2. **src/testing/ConclusionValidator.ts**
   - Validates conclusion accuracy
   - Compares conclusions for consistency
   - Generates coherence scores

3. **run-conclusion-test.ts**
   - CLI script to run conclusion tests
   - Similar to existing test scripts

### Implementation Steps
1. Create ConclusionTestFramework class
2. Implement multiple analysis iterations
3. Create conclusion comparison logic
4. Implement scoring system using LLM
5. Generate reports in multiple formats
6. Add CLI script for easy execution
7. Document usage in README or separate guide

### Testing
- Test with Pride and Prejudice (known ending)
- Test with 2-3 other novels
- Verify consistency scores are reasonable
- Validate report generation

---

## Task 3: Multiple Ending Variations Test Framework

### Objective
Create a test framework that generates three types of endings (original, opposite, random) and plays three separate games with each ending type using a short number of rounds (5 rounds).

### Purpose
- Test the story generator's ability to create different ending types
- Validate that games can successfully reach different endings
- Compare cohesion across different ending types
- Reduce test time with shorter games (5 rounds instead of 10-20)

### Test Framework Design

#### Test Configuration
```typescript
interface EndingVariationTestConfig {
  novelFile: string;
  rounds: number; // Fixed at 5 for quick testing
  endingTypes: ['original', 'opposite', 'random'];
  outputDirectory: string;
}
```

#### Ending Types
1. **Original Ending**: Matches the book's actual conclusion
2. **Opposite Ending**: Inverts the book's conclusion (e.g., happy → tragic)
3. **Random Ending**: Completely different, creative ending

#### Test Process
1. Analyze novel once (reuse analysis)
2. Generate 3 ending variations:
   - Original (from book)
   - Opposite (inverted outcome)
   - Random (creative alternative)
3. Play 3 separate games (5 rounds each):
   - Game 1: Target original ending
   - Game 2: Target opposite ending
   - Game 3: Target random ending
4. Analyze cohesion for each game
5. Compare results across ending types

#### Output Format
- CSV report with columns:
  - Ending type
  - Ending description
  - Rounds played
  - Cohesion score
  - Story segments count
  - Ending achieved (yes/no)
- Comparison table showing:
  - Which ending type had highest cohesion
  - Average word count per ending type
  - Success rate for reaching target ending
- Individual game state files for each variation

### Files to Create/Modify
1. **src/testing/EndingVariationTestFramework.ts**
   - Main test framework class
   - Ending variation generation logic
   - Game execution for each ending type
   - Comparative analysis

2. **src/services/StoryGenerator.ts** (modify)
   - Add `generateOppositeEnding()` method
   - Add `generateRandomEnding()` method
   - Ensure ending generation supports variation types

3. **run-ending-variation-test.ts**
   - CLI script to run ending variation tests
   - Configuration for 5-round games

### Implementation Steps
1. Create EndingVariationTestFramework class
2. Implement opposite ending generation logic
3. Implement random ending generation logic
4. Modify game setup to accept specific ending targets
5. Run 3 games with different endings (5 rounds each)
6. Collect and compare results
7. Generate comparative reports
8. Add CLI script for execution
9. Document usage and interpretation of results

### Testing
- Test with Pride and Prejudice
- Verify all 3 ending types are generated correctly
- Confirm games complete in 5 rounds
- Validate cohesion scoring works for all ending types
- Check comparative analysis is meaningful

---

## Priority and Dependencies

### Priority Order
1. **Task 1** (Character Names) - Quick win, improves readability immediately
2. **Task 2** (Conclusion Test) - Foundation for understanding LLM accuracy
3. **Task 3** (Ending Variations) - Most complex, builds on Task 2

### Dependencies
- Task 3 may benefit from insights gained in Task 2
- Task 1 is independent and can be done first
- All tasks require existing TestFramework as reference

### Estimated Effort
- Task 1: 2-3 hours (straightforward modifications)
- Task 2: 4-6 hours (new framework, scoring logic)
- Task 3: 6-8 hours (complex, multiple components)

---

## Success Criteria

### Task 1
- ✅ Character names appear in all game logs
- ✅ Format is consistent and readable
- ✅ Backward compatible with existing game states

### Task 2
- ✅ Can analyze same book multiple times
- ✅ Generates meaningful consistency scores
- ✅ Reports are clear and actionable
- ✅ Identifies when conclusions are inaccurate

### Task 3
- ✅ Successfully generates 3 distinct ending types
- ✅ All 3 games complete in 5 rounds
- ✅ Cohesion scores are comparable across ending types
- ✅ Reports clearly show differences between ending types
- ✅ Can identify which ending type produces best cohesion

---

## Notes
- All test frameworks should follow the pattern established in `TestFramework.ts`
- Consider rate limiting for API calls (already implemented in TestFramework)
- Ensure all outputs are saved to `test_outputs/` directory
- Add appropriate logging for debugging and monitoring
- Consider adding these tests to CI/CD pipeline in the future
