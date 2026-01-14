# Novel RPG Game

Transform any novel into an interactive role-playing game experience using AI-powered storytelling.

## Overview

The Novel RPG Game is an innovative application that analyzes text novels and creates dynamic, turn-based RPG experiences. Using Large Language Models (LLMs), the system extracts key story elements and generates multiple possible endings, allowing 1-4 human players (with AI companions) to influence the narrative through dice-based choices.

## Features

- **Novel Analysis**: Automatically extracts main characters, plot points, and narrative structure
- **Dynamic Storytelling**: AI-generated content that adapts to player choices
- **Multiple Endings**: 8 different story conclusions including original, similar, opposite, and random variants
- **Turn-Based Gameplay**: Dice-rolling mechanics determine player actions (talk, act, or do nothing)
- **Automated Testing**: Built-in framework for analyzing story cohesion across different configurations
- **Persistent Game State**: All game sessions are saved with complete story logs

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd novel-rpg-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your LLM API keys
   ```

4. **Configure the application**
   ```bash
   # Edit config.json with your preferred settings
   ```

5. **Build the application**
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables (.env)
```env
OPENAI_API_KEY=your_openai_api_key_here
# Add other LLM provider keys as needed
```

### Application Configuration (config.json)
```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "apiKey": "${OPENAI_API_KEY}",
    "maxTokens": 2000,
    "temperature": 0.7,
    "timeout": 30000
  },
  "game": {
    "defaultRounds": 15,
    "maxPlayers": 4,
    "turnTimeoutSeconds": 60,
    "gameStateDirectory": "./game_states",
    "maxNovelSizeMB": 50
  },
  "testing": {
    "outputDirectory": "./test_outputs",
    "cohesionAnalysisModel": "gpt-4",
    "testIterations": 6
  }
}
```

## Usage

### Interactive Game Mode

Start a new interactive game:
```bash
npm start
```

Or using development mode:
```bash
npm run dev
```

The application will guide you through:
1. **Novel Selection**: Choose a text file (.txt, .md) up to 50MB
2. **Player Setup**: Specify 1-4 human players (AI fills remaining slots)
3. **Game Configuration**: Set rounds (10-20)
4. **Character Selection**: Players choose from extracted main characters
5. **Gameplay**: Turn-based dice rolling and story generation

### Testing Mode

Run automated cohesion analysis:
```bash
npm start -- --test --file path/to/novel.txt
```

Or:
```bash
npm run dev -- --test --file path/to/novel.txt
```

This will:
- Generate games with 10, 12, 14, 16, 18, and 20 rounds
- Use only computer players for consistency
- Analyze story cohesion using AI
- Generate comprehensive reports in multiple formats

### Command Line Options

- `--test` or `-t`: Run in testing mode
- `--file <path>` or `-f <path>`: Specify novel file for testing mode

## Game Mechanics

### Dice Rolling System
- **Range**: 1-10
- **Action Mapping**:
  - Even numbers (2,4,6,8,10) → **Talk** (~200 words of dialogue)
  - Odd numbers (1,3,5) → **Act** (~100 words of narrative)
  - Numbers (7,9) → **Do Nothing** (adds 1 round to game)

### Story Generation
- Each action generates content targeting one of 8 possible endings
- Content adapts to player choices and character selections
- All generated content is immediately saved to game state files

### Ending Types
1. **Original** (1): Matches the source novel's conclusion
2. **Similar** (3): 80% similar to original ending
3. **Opposite** (1): Direct opposite of original ending
4. **Random** (3): Completely alternative conclusions

## File Structure

```
novel-rpg-game/
├── src/
│   ├── config/          # Configuration management
│   ├── core/            # Game managers and flow control
│   ├── models/          # Data models and interfaces
│   ├── services/        # LLM, analysis, and game services
│   ├── testing/         # Automated testing framework
│   ├── ui/              # Command-line interface
│   └── index.ts         # Main application entry point
├── game_states/         # Saved game sessions
├── test_outputs/        # Testing mode results
├── TestNovels/          # Sample novels for testing
├── config.json          # Application configuration
├── .env                 # Environment variables
└── package.json         # Project dependencies
```

## Output Files

### Game State Files
Format: `DateTime-numberOfPlayers-novelTitle-rounds.txt`
Contains:
- Novel analysis results
- Player selections and character assignments
- Complete turn-by-turn game log
- Generated story content
- Final ending achieved

### Test Reports
Generated in multiple formats:
- **CSV**: `cohesion-report-timestamp.csv`
- **Table**: `cohesion-report-timestamp.txt`
- **JSON**: `cohesion-report-timestamp.json`

## API Reference

### Main Classes

#### GameManager
Central orchestrator for game sessions
```typescript
const gameManager = new GameManager();
const session = await gameManager.startGame(novelFile, humanPlayers, rounds);
```

#### TestFramework
Automated testing and cohesion analysis
```typescript
const testFramework = new TestFramework();
const report = await testFramework.runAutomatedTests(novelFile);
```

#### GameUI
Command-line interface management
```typescript
const gameUI = new GameUI();
const params = await gameUI.setupGame();
```

## Error Handling

The application provides comprehensive error handling with specific exit codes:

- **0**: Success
- **1**: Configuration error
- **2**: Input validation error
- **3**: Novel analysis error
- **4**: Game runtime error
- **5**: Unexpected error
- **6**: User interruption

## Troubleshooting

### Common Issues

1. **"Configuration validation failed"**
   - Check your `config.json` file format
   - Verify environment variables in `.env`
   - Ensure API keys are valid

2. **"Novel analysis failed"**
   - Verify novel file exists and is readable
   - Check file size (must be under 50MB)
   - Ensure LLM service is accessible

3. **"Story ending generation failed"**
   - Usually indicates LLM service issues
   - Check API key validity and rate limits
   - Verify network connectivity

### Debug Mode

For detailed logging, set environment variable:
```bash
DEBUG=1 npm start
```

## Development

### Running Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Building
```bash
npm run build
```

### Cleaning
```bash
npm run clean
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review error messages and exit codes
3. Examine log files in game_states/ directory
4. Create an issue with detailed error information