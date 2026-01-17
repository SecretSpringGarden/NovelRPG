# Test Suite Overview

## Full Game Tests

### 1. **run-ending-variation-test.ts** ⭐ PRIMARY TEST
**Purpose**: Comprehensive ending variation testing  
**What it does**:
- Analyzes novel once (reused for all games)
- Runs 3 complete games with different endings:
  - Original ending (matches book's conclusion)
  - Opposite ending (inverts book's conclusion)
  - Random ending (creative alternative)
- Analyzes cohesion for each game
- Generates comparative reports (JSON, CSV, TXT)

**Usage**:
```bash
npx ts-node run-ending-variation-test.ts <novel-file> [rounds] [quote-percentage] [output-dir]

# Examples:
npx ts-node run-ending-variation-test.ts TestNovels/pride-prejudice.txt
npx ts-node run-ending-variation-test.ts TestNovels/pride-prejudice.txt 10 60
npx ts-node run-ending-variation-test.ts TestNovels/pride-prejudice.txt 5 0 my_results
```

**Output**:
- 3 game state files (one per ending)
- `ending-variation-test-<novel>-<timestamp>.json` (complete data)
- `ending-variation-test-<novel>-<timestamp>.csv` (tabular data)
- `ending-variation-test-<novel>-<timestamp>.txt` (human-readable report)

**Time**: 10-20 minutes (3 games + analysis)

---

### 2. **test-single-rag-game.ts** ⭐ QUICK RAG TEST
**Purpose**: Quick test of RAG-based quote extraction  
**What it does**:
- Runs ONE game with original ending
- Tests RAG quote extraction with 60% target
- Shows example quotes extracted
- Verifies Assistant API integration

**Usage**:
```bash
npx ts-node test-single-rag-game.ts
```

**Output**:
- Quote usage statistics
- Example quotes extracted
- Game state JSON file
- Success/failure indication

**Time**: 3-5 minutes (1 game, 3 rounds)

---

### 3. **test-rag-quotes.ts**
**Purpose**: Test RAG quotes across all 3 ending types  
**What it does**:
- Runs 3 games (original, opposite, random)
- Tests RAG quote extraction for each
- Compares quote usage across endings
- Overall assessment of RAG system

**Usage**:
```bash
npx ts-node test-rag-quotes.ts
```

**Output**:
- Quote statistics for each ending type
- Overall quote usage percentage
- Game state files for all 3 games

**Time**: 5-10 minutes (3 games, 3 rounds each)

---

### 4. **test-single-game.ts**
**Purpose**: Simple single-game test for debugging  
**What it does**:
- Runs ONE game with original ending
- Basic quote extraction testing
- Minimal output for quick debugging

**Usage**:
```bash
npx ts-node test-single-game.ts
```

**Output**:
- Basic game statistics
- Game state file

**Time**: 3-5 minutes

---

### 5. **run-conclusion-test.ts**
**Purpose**: Test conclusion generation and cohesion  
**What it does**:
- Runs games and tests conclusion generation
- Analyzes story cohesion
- Tests ending alignment

**Usage**:
```bash
npx ts-node run-conclusion-test.ts <novel-file> [rounds] [output-dir]
```

**Time**: 5-10 minutes

---

## Verification Tests (No API Calls)

### 6. **verify-ending-variation-test.ts**
**Purpose**: Verify test framework setup without running full tests  
**What it does**:
- Validates test framework configuration
- Checks file paths and dependencies
- No API calls or game execution

**Usage**:
```bash
npx ts-node verify-ending-variation-test.ts
```

**Time**: < 1 minute

---

### 7. **verify-core-features.ts**
**Purpose**: Verify core game features are working  
**What it does**:
- Checks core functionality
- Validates configurations
- No full game execution

**Usage**:
```bash
npx ts-node verify-core-features.ts
```

**Time**: < 1 minute

---

### 8. **verify-ending-variation-reports.ts**
**Purpose**: Verify report generation from existing game states  
**What it does**:
- Reads existing game state files
- Generates reports without running new games
- Tests report formatting

**Usage**:
```bash
npx ts-node verify-ending-variation-reports.ts
```

**Time**: < 1 minute

---

### 9. **verify-game-state-files.ts**
**Purpose**: Verify game state file integrity  
**What it does**:
- Validates game state JSON files
- Checks data completeness
- Reports any issues

**Usage**:
```bash
npx ts-node verify-game-state-files.ts
```

**Time**: < 1 minute

---

## Unit/Component Tests

### 10. **test-quote-extraction.ts**
**Purpose**: Test quote extraction in isolation  
**What it does**:
- Tests BookQuoteExtractor directly
- No full game execution
- Focused on quote extraction logic

**Usage**:
```bash
npx ts-node test-quote-extraction.ts
```

**Time**: 1-2 minutes

---

### 11. **test-regex-simple.ts**
**Purpose**: Debug regex patterns for quote extraction  
**What it does**:
- Tests regex patterns in isolation
- Debugging tool for pattern matching

**Usage**:
```bash
npx ts-node test-regex-simple.ts
```

**Time**: < 1 minute

---

### 12. **test-report-generation.ts**
**Purpose**: Test report generation in isolation  
**What it does**:
- Tests report formatting
- Validates report structure

**Usage**:
```bash
npx ts-node test-report-generation.ts
```

**Time**: < 1 minute

---

### 13. **test-turn-display.ts**
**Purpose**: Test turn display formatting  
**What it does**:
- Tests UI/display logic
- Validates turn formatting

**Usage**:
```bash
npx ts-node test-turn-display.ts
```

**Time**: < 1 minute

---

## Empty/Placeholder Tests

### 14. **test-character-extraction.ts**
**Status**: Empty file (0 lines)

### 15. **test-contextual-dialogue.ts**
**Status**: Empty file (0 lines)

---

## Recommended Test Workflow

### Quick Smoke Test (5 minutes)
```bash
# Test RAG quote extraction
npx ts-node test-single-rag-game.ts
```

### Full Feature Test (15-20 minutes)
```bash
# Run comprehensive ending variation test
npx ts-node run-ending-variation-test.ts TestNovels/pride-prejudice.txt 5 60
```

### Verification Only (< 5 minutes)
```bash
# Verify setup without API calls
npx ts-node verify-ending-variation-test.ts
npx ts-node verify-core-features.ts
npx ts-node verify-game-state-files.ts
```

---

## Test Categories Summary

| Category | Tests | Purpose | Time |
|----------|-------|---------|------|
| **Full Game Tests** | 5 | Complete game execution with API calls | 3-20 min each |
| **Verification Tests** | 4 | Validate setup without API calls | < 1 min each |
| **Unit Tests** | 4 | Test individual components | 1-2 min each |
| **Placeholder** | 2 | Empty files for future tests | N/A |

---

## Most Important Tests

1. **test-single-rag-game.ts** - Quick RAG verification ⚡
2. **run-ending-variation-test.ts** - Comprehensive testing 🎯
3. **verify-ending-variation-test.ts** - Setup validation ✅

---

**Last Updated**: January 16, 2026
