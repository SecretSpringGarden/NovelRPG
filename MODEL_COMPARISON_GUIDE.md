# Model Comparison Guide

## Overview

This guide helps you test whether the cheaper `gpt-4o-mini` model can produce quality results comparable to your current `gpt-4-turbo-preview` model for novel analysis.

## Cost Comparison

| Model | Input Cost | Output Cost | Relative Cost |
|-------|-----------|-------------|---------------|
| gpt-4-turbo-preview | $10/1M tokens | $30/1M tokens | 100% (baseline) |
| gpt-4o-mini | $0.15/1M tokens | $0.60/1M tokens | ~2% (98% cheaper!) |

**Estimated test cost:** $0.10-0.20 per comparison run

## Running the Comparison Test

### Quick Start

```bash
npm run test:models
```

This will:
1. Analyze your test novel with `gpt-4-turbo-preview` (current model)
2. Analyze the same novel with `gpt-4o-mini` (cheapest model)
3. Compare the results side-by-side
4. Provide a recommendation

### What Gets Compared

The test compares:

1. **Completeness** - Did both models complete the analysis?
2. **Character Extraction** - Did both find 4 main characters?
3. **Plot Points** - Did both identify 5 key plot points?
4. **Narrative Structure** - Quality of introduction, climax, and conclusion
5. **Validation Errors** - Any issues with the output format?
6. **Overall Quality Score** - 0-100 score based on all factors

### Understanding the Results

The test will output a detailed comparison and give you one of three recommendations:

#### ✅ Excellent (Score ≥ 80)
```
✅ Switch to gpt-4o-mini - quality is excellent and you'll save ~98% on costs!
```
**Action:** Update your config.json to use `gpt-4o-mini`

#### ⚠️ Acceptable (Score 60-79)
```
⚠️ gpt-4o-mini is acceptable but not as good - your choice on cost vs quality
```
**Action:** Decide based on your quality requirements vs cost savings

#### ❌ Poor (Score < 60)
```
❌ Stick with gpt-4-turbo-preview - quality difference is too significant
```
**Action:** Keep using `gpt-4-turbo-preview`

## Running Individual Tests

### Test Both Models (Full Comparison)
```bash
npm run test:models
```
Duration: ~2 minutes
Cost: ~$0.15

### Test Only gpt-4o-mini (Quick Test)
Edit `src/services/ModelComparison.test.ts`:
- Change the first `describe.skip` to `describe`
- Comment out the first test
- Keep only the second test enabled

Then run:
```bash
npm test -- ModelComparison.test.ts
```
Duration: ~1 minute
Cost: ~$0.05

## Switching to gpt-4o-mini

If the test shows good results, update your `config.json`:

```json
{
  "llm": {
    "model": "gpt-4o-mini"  // Changed from "gpt-4-turbo-preview"
  },
  "assistantAPI": {
    "model": "gpt-4o-mini"  // Changed from "gpt-4-turbo-preview"
  },
  "testing": {
    "cohesionAnalysisModel": "gpt-4o-mini"  // Changed from "gpt-4-turbo-preview"
  }
}
```

## Expected Savings

If you switch to `gpt-4o-mini`:

### Per Novel Analysis
- **Before:** ~$0.50-1.00 per novel
- **After:** ~$0.01-0.02 per novel
- **Savings:** ~98%

### Per Test Run (6 games)
- **Before:** ~$3-6 per test run
- **After:** ~$0.06-0.12 per test run
- **Savings:** ~98%

### Monthly (if running 100 analyses)
- **Before:** ~$50-100/month
- **After:** ~$1-2/month
- **Savings:** ~$48-98/month

## Troubleshooting

### Test Fails with API Error
- Check your OpenAI API key is set: `echo $OPENAI_API_KEY`
- Verify you have credits in your OpenAI account
- Check your rate limits haven't been exceeded

### Test Times Out
- The test has a 2-minute timeout for full comparison
- If it times out, your novel might be too large
- Try with a smaller test novel first

### Quality Score is Low
- This might be expected for very complex novels
- Try testing with different novels to see if it's consistent
- Consider the specific requirements of your use case

## Manual Testing

You can also manually test by:

1. Temporarily changing `config.json` to use `gpt-4o-mini`
2. Running your normal game workflow
3. Evaluating the quality of generated content
4. Changing back to `gpt-4-turbo-preview` if needed

## Questions?

- **Q: Will this affect my existing games?**
  - A: No, this only tests. Your config stays unchanged until you manually update it.

- **Q: Can I use different models for different parts?**
  - A: Yes! You could use `gpt-4o-mini` for novel analysis and `gpt-4-turbo-preview` for story generation.

- **Q: What about gpt-4o (not mini)?**
  - A: `gpt-4o` is middle-ground: better than mini, cheaper than turbo. You can test it by editing the test file.

## Next Steps

1. Run the comparison test: `npm run test:models`
2. Review the results and quality score
3. If satisfied, update your config.json
4. Test with a real game to verify quality
5. Enjoy your cost savings! 💰
