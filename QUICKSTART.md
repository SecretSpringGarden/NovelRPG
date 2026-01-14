# Quick Start Guide

## Prerequisites

1. **Node.js 18+** installed
2. **OpenAI API key** (or compatible LLM provider)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your API key:
   # OPENAI_API_KEY=your_api_key_here
   ```

3. **Build the application**
   ```bash
   npm run build
   ```

## Running the Game

### Interactive Mode
```bash
npm start
```

Follow the prompts to:
1. Select a novel file (try files in `TestNovels/` directory)
2. Choose number of human players (1-4)
3. Set number of rounds (10-20)
4. Select characters and play!

### Testing Mode (Simplified)
```bash
npm start -- --test
```

Note: Full automated testing framework is temporarily disabled. This will run a single test game with computer players.

## Sample Commands

```bash
# Start interactive game
npm start

# Development mode
npm run dev

# Run tests
npm test

# Clean build
npm run clean && npm run build
```

## Troubleshooting

- **"Configuration validation failed"**: Check your `.env` file and `config.json`
- **"Novel analysis failed"**: Ensure your API key is valid and the novel file is under 50MB
- **Build errors**: Run `npm run clean` then `npm run build`

## Sample Novel Files

The `TestNovels/` directory contains sample novels you can use:
- `pride-prejudice.txt`
- `jane-eyre.txt` 
- `emma.txt`
- And more...

## Next Steps

1. Try the interactive game mode with a sample novel
2. Experiment with different player counts and round settings
3. Check the generated game state files in `game_states/`
4. Review the comprehensive documentation in `README.md`

Happy gaming! 🎮