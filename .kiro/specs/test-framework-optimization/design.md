# Design Document: TestFramework RAG Optimization

## Overview

This design optimizes the TestFramework to reuse the RAG assistant across multiple game rounds, reducing costs and improving performance. The optimization moves novel analysis outside the game loop, reuses the assistant for all games, and ensures proper cleanup.

## Architecture

### Current Architecture (Inefficient)
```
TestFramework.runAutomatedTests()
  ├─ For each round count (10, 12, 14, 16, 18, 20):
  │   ├─ GameManager.startGame()
  │   │   ├─ NovelAnalyzer.analyzeNovel()
  │   │   │   ├─ Upload novel to OpenAI ❌ (6 times)
  │   │   │   ├─ Create assistant ❌ (6 times)
  │   │   │   ├─ Extract characters, plot, structure
  │   │   │   └─ NO CLEANUP ❌
  │   │   └─ Initialize game with analysis
  │   └─ Run game simulation
  └─ Analyze cohesion
```

### Optimized Architecture
```
TestFramework.runAutomatedTests()
  ├─ NovelAnalyzer.analyzeNovel() ✅ (once)
  │   ├─ Upload novel to OpenAI ✅ (1 time)
  │   ├─ Create assistant ✅ (1 time)
  │   └─ Extract characters, plot, structure
  ├─ For each round count (10, 12, 14, 16, 18, 20):
  │   ├─ GameManager.startGame(preAnalyzedData) ✅
  │   │   └─ Skip analysis, use provided data ✅
  │   └─ Run game simulation
  ├─ Analyze cohesion
  └─ NovelAnalyzer.cleanup() ✅ (once, in finally block)
```

## Components and Interfaces

### 1. TestFramework Modifications

**File:** `src/testing/TestFramework.ts`

**New Method:**
```typescript
async runAutomatedTests(novelFile: string): Promise<TestReport> {
  let novelAnalyzer: NovelAnalyzer | undefined;
  
  try {
    // Step 1: Analyze novel ONCE before all games
    novelAnalyzer = createNovelAnalyzer();
    const novelText = fs.readFileSync(novelFile, 'utf8');
    const novelAnalysis = await novelAnalyzer.analyzeNovel(novelText);
    
    // Step 2: Run all games with pre-analyzed data
    for (const roundCount of this.testConfiguration.roundCounts) {
      const gameSession = await this.gameManager.startGame(
        novelFile,
        0,
        roundCount,
        true,
        novelAnalysis // Pass pre-analyzed data
      );
      // ... rest of game logic
    }
    
    // Step 3: Analyze cohesion
    // ... cohesion logic
    
  } finally {
    // Step 4: Cleanup resources
    if (novelAnalyzer) {
      await novelAnalyzer.cleanup();
    }
  }
}
```

**Changes:**
- Create NovelAnalyzer instance at start
- Analyze novel once before game loop
- Pass `novelAnalysis` to each `startGame()` call
- Cleanup in finally block

### 2. GameManager API Extension

**File:** `src/core/GameManager.ts`

**Modified Method Signature:**
```typescript
async startGame(
  novelFile: string,
  humanPlayers: number,
  rounds: number,
  allowZeroHumans: boolean = false,
  preAnalyzedNovel?: NovelAnalysis // NEW: Optional pre-analyzed data
): Promise<GameSession>
```

**Implementation:**
```typescript
async startGame(
  novelFile: string,
  humanPlayers: number,
  rounds: number,
  allowZeroHumans: boolean = false,
  preAnalyzedNovel?: NovelAnalysis
): Promise<GameSession> {
  try {
    // Phase 1: Input validation
    // ... validation logic
    
    // Phase 2: Novel analysis (skip if pre-analyzed data provided)
    let novelAnalysis: NovelAnalysis;
    
    if (preAnalyzedNovel) {
      console.log('📚 Using pre-analyzed novel data (skipping analysis)');
      novelAnalysis = preAnalyzedNovel;
      
      // Validate pre-analyzed data
      if (!this.validateNovelAnalysis(novelAnalysis)) {
        throw new Error('Pre-analyzed novel data is invalid');
      }
    } else {
      console.log('📖 Analyzing novel...');
      this.currentPhase = GamePhase.NOVEL_ANALYSIS;
      const novelText = fs.readFileSync(novelFile, 'utf-8');
      novelAnalysis = await this.novelAnalyzer.analyzeNovel(novelText);
      
      if (!this.validateNovelAnalysis(novelAnalysis)) {
        throw new Error('Novel analysis incomplete');
      }
    }
    
    // Phase 3-4: Continue with character selection and ending generation
    // ... rest of logic
  }
}
```

**Changes:**
- Add optional `preAnalyzedNovel` parameter
- Skip analysis if pre-analyzed data provided
- Validate pre-analyzed data
- Maintain backward compatibility (parameter is optional)

### 3. NovelAnalyzer Cleanup Exposure

**File:** `src/services/NovelAnalyzer.ts`

**Current State:**
- `cleanup()` method exists but is private/internal
- Only called on error
- Never called after successful analysis

**Changes:**
- Ensure `cleanup()` is public (it already is)
- Make cleanup idempotent (safe to call multiple times)
- Add logging for cleanup operations

**Enhanced Cleanup Method:**
```typescript
async cleanup(): Promise<void> {
  if (this.currentAssistantId || this.currentFileId) {
    console.log('🧹 Cleaning up Assistant API resources...');
    console.log(`   Assistant ID: ${this.currentAssistantId || 'none'}`);
    console.log(`   File ID: ${this.currentFileId || 'none'}`);
    
    try {
      await this.assistantService.cleanup(this.currentAssistantId, this.currentFileId);
      console.log('✅ Resources cleaned up successfully');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error);
      // Don't throw - cleanup errors shouldn't fail the test run
    } finally {
      this.currentAssistantId = undefined;
      this.currentFileId = undefined;
    }
  } else {
    console.log('ℹ️  No resources to cleanup');
  }
}
```

## Data Models

### NovelAnalysis Interface
```typescript
interface NovelAnalysis {
  mainCharacters: Character[];
  plotPoints: PlotPoint[];
  introduction: string;
  climax: string;
  conclusion: string;
  isComplete: boolean;
  validationErrors: string[];
}
```

This interface is already defined and doesn't need changes. It will be passed between TestFramework and GameManager.

## Correctness Properties

### Property 1: Single Novel Upload
*For any* test run with N games, the novel should be uploaded to OpenAI exactly 1 time, not N times.

**Validates: Requirements 2.1, 2.4, 2.5**

### Property 2: Single Assistant Creation
*For any* test run with N games, exactly 1 assistant should be created, not N assistants.

**Validates: Requirements 2.2, 2.4**

### Property 3: Assistant Reuse
*For any* test run with N games, all N games should use the same assistant ID.

**Validates: Requirements 2.3**

### Property 4: Cleanup Guarantee
*For any* test run (successful or failed), cleanup should be called exactly once at the end.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 5: Analysis Reuse
*For any* test run with N games, novel analysis should be performed exactly 1 time, not N times.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 6: Backward Compatibility
*For any* existing code calling GameManager.startGame() without pre-analyzed data, the behavior should be unchanged.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 7: Error Isolation
*For any* game that fails during a test run, other games should continue and cleanup should still occur.

**Validates: Requirements 6.1, 6.2, 6.4**

### Property 8: Cleanup Idempotence
*For any* NovelAnalyzer instance, calling cleanup() multiple times should be safe and not cause errors.

**Validates: Requirements 7.4**

## Error Handling

### Novel Analysis Failure
- If novel analysis fails, fail fast before starting any games
- Log the error clearly
- Don't attempt to run games without valid analysis
- Cleanup any resources that were created

### Game Failure
- If a game fails, log the error
- Continue to next game
- Still cleanup resources at the end
- Include failure in test report

### Cleanup Failure
- Log cleanup errors as warnings
- Don't fail the test run due to cleanup errors
- Ensure cleanup is attempted even if it fails
- Clear internal state regardless of cleanup success

### Interruption (Ctrl+C)
- Use finally blocks to ensure cleanup
- Log interruption
- Attempt cleanup before exit
- Provide summary of completed games

## Testing Strategy

### Unit Tests

**TestFramework Tests:**
- Test that novel analysis is called once
- Test that cleanup is called in finally block
- Test that pre-analyzed data is passed to games
- Test error handling when analysis fails

**GameManager Tests:**
- Test startGame() with pre-analyzed data
- Test startGame() without pre-analyzed data (backward compatibility)
- Test validation of pre-analyzed data
- Test that analysis is skipped when pre-analyzed data provided

**NovelAnalyzer Tests:**
- Test cleanup() is idempotent
- Test cleanup() clears internal state
- Test cleanup() handles errors gracefully

### Integration Tests

**Full Test Run:**
- Run TestFramework with a small novel
- Verify novel uploaded once
- Verify assistant created once
- Verify all games complete
- Verify cleanup called once
- Verify resources deleted from OpenAI

**Cost Verification:**
- Track API calls before optimization
- Track API calls after optimization
- Verify 6x reduction in uploads
- Verify 6x reduction in assistant creations

## Performance Considerations

### Time Savings
- **Before:** 6 novel uploads + 6 assistant creations = ~6-12 minutes overhead
- **After:** 1 novel upload + 1 assistant creation = ~1-2 minutes overhead
- **Savings:** ~5-10 minutes per test run

### Cost Savings
- **Before:** 6 file uploads + 6 assistants + 6 vector stores
- **After:** 1 file upload + 1 assistant + 1 vector store
- **Savings:** ~83% reduction in RAG infrastructure costs

### API Rate Limits
- Fewer API calls means less risk of hitting rate limits
- More headroom for actual game operations
- Better overall reliability

## Implementation Sequence

### Phase 1: Prepare NovelAnalyzer
1. Verify cleanup() method is public
2. Make cleanup() idempotent
3. Add logging to cleanup()
4. Test cleanup() behavior

### Phase 2: Extend GameManager
1. Add optional `preAnalyzedNovel` parameter to startGame()
2. Add logic to skip analysis if pre-analyzed data provided
3. Add validation for pre-analyzed data
4. Test backward compatibility

### Phase 3: Optimize TestFramework
1. Create NovelAnalyzer instance at start
2. Analyze novel once before game loop
3. Pass pre-analyzed data to each game
4. Add cleanup in finally block
5. Add logging for resource reuse

### Phase 4: Testing and Validation
1. Run unit tests
2. Run integration tests
3. Verify cost savings
4. Verify time savings
5. Test error scenarios

## Deployment Considerations

- This is a backward-compatible change
- Existing code continues to work
- TestFramework gets automatic optimization
- No configuration changes needed
- Can be deployed incrementally

## Future Enhancements

- Cache novel analysis results to disk for even faster reruns
- Support multiple novels in one test run with shared assistant pool
- Add metrics dashboard for cost tracking
- Implement assistant pooling for parallel test runs
