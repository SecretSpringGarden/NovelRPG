# Ending Variation Test Framework - Usage Guide

## Overview

The Ending Variation Test Framework tests how different ending types affect story cohesion by running three games with original, opposite, and random endings.

## Quick Start

### Basic Usage

Run with default settings (5 rounds, 0% book quotes):

```bash
npx ts-node run-ending-variation-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt
```

### With Custom Parameters

Run with 10 rounds and 60% book quotes:

```bash
npx ts-node run-ending-variation-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt 10 60
```

### With Custom Output Directory

```bash
npx ts-node run-ending-variation-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt 5 0 my_results
```

## Command-Line Arguments

```
ts-node run-ending-variation-test.ts <novel-file> [rounds] [quote-percentage] [output-dir]
```

### Arguments

1. **novel-file** (required)
   - Path to the novel text file
   - Example: `TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt`

2. **rounds** (optional, default: 5)
   - Number of rounds per game
   - Valid range: 1-20
   - Example: `10`

3. **quote-percentage** (optional, default: 0)
   - Percentage of book quotes to use (vs LLM-generated content)
   - Valid range: 0-100
   - Example: `60`

4. **output-dir** (optional, default: test_outputs)
   - Output directory for reports and game state files
   - Example: `my_results`

## What the Test Does

1. **Analyzes the novel once** - The novel is analyzed once and reused for all three games (optimization)
2. **Generates three different endings**:
   - **Original**: Matches the book's actual conclusion
   - **Opposite**: Inverts the book's conclusion (happy → tragic, success → failure)
   - **Random**: Creative alternative unrelated to the book's conclusion
3. **Runs three games** - One game for each ending type
4. **Analyzes cohesion** - Measures how well each story aligns with the source novel
5. **Generates comparative reports** - Creates reports comparing all three ending types

## Output Files

The test generates the following files in the output directory:

### Game State Files (3 files)
- `<timestamp>-<novel>-original-<rounds>rounds.json`
- `<timestamp>-<novel>-opposite-<rounds>rounds.json`
- `<timestamp>-<novel>-random-<rounds>rounds.json`

### Report Files (3 formats)
- `ending-variation-test-<novel>-<timestamp>.json` - Complete data in JSON format
- `ending-variation-test-<novel>-<timestamp>.csv` - Tabular data for spreadsheets
- `ending-variation-test-<novel>-<timestamp>.txt` - Human-readable comparative report

## Metrics Explained

### Cohesion Score (1-10)
Measures how well the generated story aligns with the source novel's style, characters, and themes. Higher scores indicate better alignment.

### Word Count
Total number of words generated in the story across all segments.

### Quote Usage
Percentage of actions that used actual book quotes vs LLM-generated content. This may vary from the configured percentage due to ending compatibility filtering.

### Segments Count
Number of story segments generated during the game.

## Expected Results

- **Original ending** typically has the highest cohesion (follows book's actual conclusion)
- **Opposite/Random endings** may have lower cohesion due to diverging from source material
- **Quote usage** may be lower for opposite/random endings due to ending compatibility filtering

## Execution Time

- **Estimated time**: 10-20 minutes
- **API calls**: Multiple calls to LLM service
- **Rate limiting**: Automatic delays added between operations

## Examples

### Test with Simple Novel
```bash
npx ts-node run-ending-variation-test.ts test_simple_novel.txt
```

### Test with Pride and Prejudice (10 rounds, 60% quotes)
```bash
npx ts-node run-ending-variation-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt 10 60
```

### Maximum Rounds with High Quote Usage
```bash
npx ts-node run-ending-variation-test.ts TestNovels/t5n1n7qn1r662izg5nijj2m7-0002-pride-prejudice-jane-austen.txt 20 80
```

## Help

Display usage instructions:

```bash
npx ts-node run-ending-variation-test.ts --help
```

## Error Handling

The script validates all inputs and provides clear error messages:

- Invalid rounds (not 1-20): Shows error and displays usage
- Invalid quote percentage (not 0-100): Shows error and displays usage
- Missing novel file: Shows error and displays usage
- Novel file not found: Shows error during execution

## Requirements Validated

This CLI script implements:
- **Requirement 9.2**: Accept command-line arguments for novel file and rounds
- **Requirement 9.3**: Display usage instructions
- **Requirement 3.1-3.9**: Full ending variation test functionality
- **Requirement 4.2, 4.3, 4.5**: Configuration validation

## Related Files

- `src/testing/EndingVariationTestFramework.ts` - Core framework implementation
- `run-conclusion-test.ts` - Similar CLI for conclusion tests
- `.kiro/specs/game-improvements/` - Full specification documents
