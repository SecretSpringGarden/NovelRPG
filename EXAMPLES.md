# Usage Examples

This document provides detailed examples of how to use the Novel RPG Game application in various scenarios.

## Basic Interactive Game

### Starting a New Game

```bash
# Start the application
npm start

# Or in development mode
npm run dev
```

**Example Session:**
```
🎮 Welcome to Novel RPG Game!
══════════════════════════════════════════════════
Transform any novel into an interactive RPG experience
Support for 1-4 human players with AI companions
══════════════════════════════════════════════════

📖 Enter path to novel file (.txt, .md): ./TestNovels/pride-prejudice.txt

👥 Number of human players (1-4): 2

🎯 Number of rounds (10-20): 15

🔧 Initializing application...
✅ Configuration validated successfully
✅ Game manager initialized
✅ Input parameters validated

🔍 Analyzing novel...
   • Extracting main characters
   • Identifying plot points
   • Analyzing narrative structure

✅ Novel analysis complete!

📚 Main Characters:
   1. Elizabeth Bennet - Intelligent and spirited young woman
   2. Mr. Darcy - Wealthy and seemingly proud gentleman
   3. Jane Bennet - Elizabeth's gentle and kind sister
   4. Mr. Bingley - Cheerful and wealthy young man

📋 Plot Points:
   1. The Bennet family's social situation and marriage prospects
   2. First impressions and misunderstandings between Elizabeth and Darcy
   3. Wickham's deception and its consequences
   4. Darcy's proposal and Elizabeth's rejection
   5. The revelation of Darcy's true character

🎭 PLAYER 1 - Character Selection
Available characters:
   1. Elizabeth Bennet - Intelligent and spirited young woman
   2. Mr. Darcy - Wealthy and seemingly proud gentleman
   3. Jane Bennet - Elizabeth's gentle and kind sister
   4. Mr. Bingley - Cheerful and wealthy young man

Enter character number (1-4): 1
✅ You selected: Elizabeth Bennet

🎭 PLAYER 2 - Character Selection
Available characters:
   1. Mr. Darcy - Wealthy and seemingly proud gentleman
   2. Jane Bennet - Elizabeth's gentle and kind sister
   3. Mr. Bingley - Cheerful and wealthy young man

Enter character number (1-3): 2
✅ You selected: Mr. Darcy

🎭 Character Assignments:
────────────────────────────────────────
   Player 1 👤: Elizabeth Bennet
   Player 2 👤: Mr. Darcy
   Player 3 🤖: Jane Bennet
   Player 4 🤖: Mr. Bingley

📝 Generating story endings...
   • Creating original ending
   • Generating similar variations
   • Creating opposite ending
   • Adding random alternatives

✅ Story endings generated

📊 Game Progress: Round 1/15
[████░░░░░░░░░░░░░░░░] 6.7%
📚 Story segments: 0

🎲 👤 Elizabeth Bennet's turn
Press SPACE BAR to roll dice (60 second timeout)...
🎲 You rolled: 4

💬 Elizabeth Bennet chose to talk (rolled 4)

📖 Story continues...
────────────────────────────────────────────────────────────
Elizabeth found herself in the drawing room at Netherfield,
the morning light casting gentle shadows across the polished
furniture. She turned to address the assembled company with
her characteristic wit and intelligence.

"I must confess," she began, her eyes sparkling with mischief,
"that I find the current conversation about the weather to be
rather... predictable. Surely we can find more stimulating
topics to discuss?"

Mr. Darcy, who had been standing by the window, turned at her
words, his expression unreadable. "And what would you suggest,
Miss Bennet?" he asked, his tone carefully neutral.

Elizabeth smiled, sensing an opportunity for intellectual
sparring. "Perhaps we might discuss the merits of different
authors, or the importance of education for young women, or
even the curious social customs that govern our daily
interactions."

The room fell silent for a moment, all eyes upon the two
protagonists as they engaged in their familiar dance of wit
and words.
────────────────────────────────────────────────────────────
Words: 156 | Target: original

🎲 👤 Mr. Darcy's turn
Press SPACE BAR to roll dice (60 second timeout)...
🎲 You rolled: 7

⏸️ Mr. Darcy chose to do nothing (rolled 7)
   ⏭️  Round count increased by 1

📊 Game Progress: Round 1/16
[██████░░░░░░░░░░░░░░] 6.2%
📚 Story segments: 2

🎲 🤖 Jane Bennet's turn
🎲 Computer rolled: 3

⚡ Jane Bennet chose to act (rolled 3)

📖 Story continues...
────────────────────────────────────────────────────────────
Jane Bennet, ever the peacemaker, gracefully moved across the
room to where her sister and Mr. Darcy stood in their moment
of tension. With her gentle nature and diplomatic skills, she
approached the window where Mr. Darcy had retreated.

"Mr. Darcy," she said softly, her voice carrying the warmth
that made her beloved by all who knew her, "I believe you
mentioned earlier that you have been reading some interesting
works lately. Perhaps you would be willing to share your
thoughts with us?"

Her intervention was perfectly timed, offering both Elizabeth
and Mr. Darcy a graceful way to continue their conversation
without the sharp edges that had begun to emerge.
────────────────────────────────────────────────────────────
Words: 98 | Target: original

[Game continues...]
```

## Testing Mode Examples

### Running Automated Tests

```bash
# Run tests with a specific novel
npm start -- --test --file ./TestNovels/pride-prejudice.txt

# Or in development mode
npm run dev -- --test --file ./TestNovels/pride-prejudice.txt
```

**Example Output:**
```
🧪 Running in testing mode...
📖 Using novel file: ./TestNovels/pride-prejudice.txt

🚀 Starting automated test suite...
Starting automated testing framework...
Generating game with 10 rounds...
Game completed: 10 rounds, ending: Elizabeth and Darcy overcome their pride and prejudice
Generating game with 12 rounds...
Game completed: 12 rounds, ending: A tragic misunderstanding leads to permanent separation
Generating game with 14 rounds...
Game completed: 14 rounds, ending: Elizabeth and Darcy find happiness together
Generating game with 16 rounds...
Game completed: 16 rounds, ending: The Bennet family faces financial ruin
Generating game with 18 rounds...
Game completed: 18 rounds, ending: Elizabeth marries Wickham in a shocking twist
Generating game with 20 rounds...
Game completed: 20 rounds, ending: All characters find their perfect matches

Analyzing story cohesion...
Cohesion reports saved:
  CSV: ./test_outputs/cohesion-report-2024-01-15T10-30-45-123Z.csv
  Table: ./test_outputs/cohesion-report-2024-01-15T10-30-45-123Z.txt
  JSON: ./test_outputs/cohesion-report-2024-01-15T10-30-45-123Z.json

📊 Test Results Summary:
════════════════════════════════════════════════════════════
Total games tested: 6
Average cohesion: 7.33
Best cohesion: 9
Worst cohesion: 5
════════════════════════════════════════════════════════════

🏆 Top 3 Most Cohesive Games:
1. 14 rounds - Cohesion: 9/10
   Ending: Elizabeth and Darcy find happiness together
2. 10 rounds - Cohesion: 8/10
   Ending: Elizabeth and Darcy overcome their pride and prejudice
3. 20 rounds - Cohesion: 7/10
   Ending: All characters find their perfect matches

✅ Testing mode completed successfully
```

### Sample Test Report (CSV Format)

```csv
Rounds,Ending,Cohesion Rank,Filename
14,"Elizabeth and Darcy find happiness together",9,test-game-14rounds-2024-01-15T10-30-45-123Z.txt
10,"Elizabeth and Darcy overcome their pride and prejudice",8,test-game-10rounds-2024-01-15T10-30-45-456Z.txt
20,"All characters find their perfect matches",7,test-game-20rounds-2024-01-15T10-30-45-789Z.txt
12,"Elizabeth and Darcy find happiness together",6,test-game-12rounds-2024-01-15T10-30-45-012Z.txt
18,"Elizabeth marries Wickham in a shocking twist",6,test-game-18rounds-2024-01-15T10-30-45-345Z.txt
16,"The Bennet family faces financial ruin",5,test-game-16rounds-2024-01-15T10-30-45-678Z.txt
```

## Configuration Examples

### Basic Configuration (config.json)

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-3.5-turbo",
    "apiKey": "${OPENAI_API_KEY}",
    "maxTokens": 1500,
    "temperature": 0.8,
    "timeout": 25000
  },
  "game": {
    "defaultRounds": 12,
    "maxPlayers": 4,
    "turnTimeoutSeconds": 45,
    "gameStateDirectory": "./my_games",
    "maxNovelSizeMB": 25
  },
  "testing": {
    "outputDirectory": "./my_test_results",
    "cohesionAnalysisModel": "gpt-4",
    "testIterations": 6
  }
}
```

### Advanced Configuration with Multiple LLM Providers

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-3-sonnet-20240229",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "baseUrl": "https://api.anthropic.com",
    "maxTokens": 2500,
    "temperature": 0.7,
    "timeout": 35000
  },
  "game": {
    "defaultRounds": 18,
    "maxPlayers": 4,
    "turnTimeoutSeconds": 90,
    "gameStateDirectory": "./game_sessions",
    "maxNovelSizeMB": 75
  },
  "testing": {
    "outputDirectory": "./cohesion_analysis",
    "cohesionAnalysisModel": "claude-3-opus-20240229",
    "testIterations": 10
  }
}
```

## Environment Variable Examples

### Basic .env File

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional: Enable debug logging
DEBUG=1

# Optional: Custom configuration file path
CONFIG_FILE=./custom-config.json
```

### Multi-Provider .env File

```env
# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here

# Anthropic
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Local LLM (if using local models)
LOCAL_LLM_URL=http://localhost:8080

# Application Settings
DEBUG=1
LOG_LEVEL=info
NODE_ENV=production
```

## Error Handling Examples

### Configuration Errors

```bash
npm start
```

**Output:**
```
🔧 Initializing application...
❌ Configuration validation failed:
   • LLM API key is required but not provided
   • Invalid model name specified
   • Game state directory does not exist and cannot be created

💡 Please check your config.json and .env files
❌ Application terminated due to configuration error
```

### Novel Analysis Errors

```bash
npm start
```

**Input:** Large novel file (60MB)

**Output:**
```
📖 Enter path to novel file (.txt, .md): ./large-novel.txt
👥 Number of human players (1-4): 2
🎯 Number of rounds (10-20): 15

❌ Input validation failed:
   • Novel file exceeds 50MB size limit (current: 60.2MB)

💡 Please check your input parameters and try again
❌ Application terminated due to invalid input
```

### Runtime Errors

```bash
npm start
```

**During gameplay with network issues:**

**Output:**
```
🎲 👤 Elizabeth Bennet's turn
Press SPACE BAR to roll dice (60 second timeout)...
🎲 You rolled: 2

💬 Elizabeth Bennet chose to talk (rolled 2)

❌ Game runtime error: LLM service timeout after 30 seconds

💡 This could be due to:
   • Network connectivity issues
   • LLM service rate limiting
   • API key problems

⚠️  Game Terminated Early
══════════════════════════════════════════════════
Reason: LLM service timeout after 30 seconds
══════════════════════════════════════════════════

❌ Application terminated due to game runtime error
```

## Sample Game State File

**Filename:** `2024-01-15T14-30-22-456Z-2-pride-prejudice-15.txt`

```
=== NOVEL RPG GAME SESSION ===
Started: 2024-01-15T14:30:22.456Z
Novel: pride-prejudice
Human Players: 2
Total Rounds: 15
Game State File: 2024-01-15T14-30-22-456Z-2-pride-prejudice-15.txt

=== NOVEL ANALYSIS ===
Main Characters:
1. Elizabeth Bennet - Intelligent and spirited young woman
2. Mr. Darcy - Wealthy and seemingly proud gentleman
3. Jane Bennet - Elizabeth's gentle and kind sister
4. Mr. Bingley - Cheerful and wealthy young man

Plot Points:
1. The Bennet family's social situation and marriage prospects
2. First impressions and misunderstandings between Elizabeth and Darcy
3. Wickham's deception and its consequences
4. Darcy's proposal and Elizabeth's rejection
5. The revelation of Darcy's true character

Introduction: The story opens with the famous line about single men in possession of good fortunes...
Climax: Darcy's second proposal and Elizabeth's acceptance...
Conclusion: The marriages of Elizabeth to Darcy and Jane to Bingley...

=== PLAYER ASSIGNMENTS ===
Player 1 (Human): Elizabeth Bennet
Player 2 (Human): Mr. Darcy  
Player 3 (Computer): Jane Bennet
Player 4 (Computer): Mr. Bingley

=== STORY ENDINGS GENERATED ===
1. Original: Elizabeth and Darcy overcome their initial prejudices...
2. Similar: Elizabeth and Darcy find love after misunderstandings...
3. Similar: The Bennet sisters both find happiness in marriage...
4. Similar: Pride and prejudice are conquered by true love...
5. Opposite: Elizabeth rejects Darcy permanently and remains single...
6. Random: Elizabeth becomes a successful novelist...
7. Random: The characters travel to America for new adventures...
8. Random: A mysterious inheritance changes everyone's fate...

=== GAME LOG ===

Round 1/15:
[2024-01-15T14:32:15.123Z] Player 1 (Elizabeth Bennet) rolled 4 -> TALK
Generated Content (156 words): Elizabeth found herself in the drawing room at Netherfield...
Target Ending: original

[2024-01-15T14:33:22.456Z] Player 2 (Mr. Darcy) rolled 7 -> DO NOTHING
Round count increased to 16

[2024-01-15T14:33:45.789Z] Player 3 (Jane Bennet) rolled 3 -> ACT
Generated Content (98 words): Jane Bennet, ever the peacemaker, gracefully moved across the room...
Target Ending: original

[Continue for all rounds...]

=== FINAL RESULT ===
Game completed after 16 rounds
Final ending achieved: Elizabeth and Darcy overcome their initial prejudices and find true love
Total story segments: 45
Total words generated: 6,847
Session duration: 47 minutes, 23 seconds
```

## Advanced Usage Patterns

### Batch Testing Multiple Novels

```bash
#!/bin/bash
# Script to test multiple novels

novels=(
  "./TestNovels/pride-prejudice.txt"
  "./TestNovels/jane-eyre.txt"
  "./TestNovels/emma.txt"
)

for novel in "${novels[@]}"; do
  echo "Testing: $novel"
  npm start -- --test --file "$novel"
  echo "Completed: $novel"
  echo "---"
done
```

### Custom Configuration for Different Scenarios

**Fast Testing Configuration:**
```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-3.5-turbo",
    "maxTokens": 1000,
    "temperature": 0.5
  },
  "testing": {
    "testIterations": 3
  }
}
```

**High-Quality Analysis Configuration:**
```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "maxTokens": 3000,
    "temperature": 0.8
  },
  "testing": {
    "cohesionAnalysisModel": "gpt-4",
    "testIterations": 10
  }
}
```

## Integration Examples

### Using as a Library

```typescript
import { GameManager, TestFramework, GameUI } from 'novel-rpg-game';

// Start a programmatic game session
async function runCustomGame() {
  const gameManager = new GameManager();
  const gameUI = new GameUI();
  
  try {
    const session = await gameManager.startGame(
      './my-novel.txt',
      2, // human players
      15 // rounds
    );
    
    console.log('Game started successfully');
    // Handle game logic...
    
  } catch (error) {
    console.error('Game failed:', error);
  } finally {
    gameUI.cleanup();
  }
}

// Run automated analysis
async function analyzeNovel() {
  const testFramework = new TestFramework();
  
  const report = await testFramework.runAutomatedTests('./novel.txt');
  console.log(`Average cohesion: ${report.games.reduce((sum, g) => sum + g.cohesionRank, 0) / report.games.length}`);
}
```

This comprehensive examples file demonstrates the various ways to use the Novel RPG Game application, from basic interactive sessions to advanced testing and integration scenarios.