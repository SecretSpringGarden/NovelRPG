# OpenAI Assistants API Usage Guide

## Overview

The Novel RPG Game system uses OpenAI's Assistants API with RAG (Retrieval Augmented Generation) to analyze large novels without token limit constraints. This guide explains how to use the Assistant API features effectively.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Configuration](#configuration)
4. [Features](#features)
5. [Best Practices](#best-practices)
6. [Cost Optimization](#cost-optimization)

## Getting Started

### Prerequisites

- Node.js 14 or higher
- OpenAI API key with access to Assistants API
- Sufficient OpenAI API credits

### Installation

```bash
npm install
```

### Configuration

Set your OpenAI API key in the `.env` file:

```env
OPENAI_API_KEY=your-api-key-here
```

Or configure it in `config.json`:

```json
{
  "llm": {
    "provider": "openai",
    "apiKey": "your-api-key-here",
    "model": "gpt-4",
    "timeout": 30000
  }
}
```

## Basic Usage

### Analyzing a Novel

The system automatically uses the Assistant API for large novels (>100k characters):

```bash
npm start -- --novel "path/to/novel.txt" --rounds 10
```

### Manual Assistant API Usage

```typescript
import { createAssistantService } from './services/AssistantService';

// Initialize the service
const assistantService = createAssistantService();
await assistantService.initialize({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});

// Upload a novel file
const fileId = await assistantService.uploadNovelFile('path/to/novel.txt');

// Create an assistant for novel analysis
const assistantId = await assistantService.createNovelAnalysisAssistant(fileId);

// Query the assistant
const response = await assistantService.queryAssistant(
  assistantId,
  'Extract the main characters from this novel'
);

// Clean up resources
await assistantService.cleanup(assistantId, fileId);
```

## Configuration

### System Configuration

The Assistant API can be configured through `config.json`:

```json
{
  "llm": {
    "provider": "openai",
    "apiKey": "your-api-key-here",
    "model": "gpt-4",
    "timeout": 30000
  },
  "assistantAPI": {
    "enabled": true,
    "novelSizeThreshold": 100000,
    "vectorStoreTimeout": 180000,
    "maxRetries": 3
  }
}
```

### Configuration Options

- `enabled`: Enable/disable Assistant API (default: true)
- `novelSizeThreshold`: Minimum novel size to use Assistant API (default: 100,000 characters)
- `vectorStoreTimeout`: Maximum time to wait for vector store processing (default: 180 seconds)
- `maxRetries`: Maximum retry attempts for failed operations (default: 3)

## Features

### 1. Automatic Novel Processing

The system automatically:
- Uploads novels to OpenAI storage
- Creates assistants with file search capabilities
- Processes queries using RAG
- Cleans up resources after analysis

### 2. Character Extraction

Extract main characters with descriptions and importance rankings:

```typescript
const characters = await assistantService.queryAssistant(
  assistantId,
  'Extract all main characters with their names, descriptions, and importance (1-10)'
);
```

### 3. Plot Point Analysis

Extract key plot points in chronological order:

```typescript
const plotPoints = await assistantService.queryAssistant(
  assistantId,
  'Extract the major plot points in chronological order'
);
```

### 4. Narrative Structure

Identify introduction, climax, and conclusion:

```typescript
const structure = await assistantService.queryAssistant(
  assistantId,
  'Identify the introduction, climax, and conclusion of the narrative'
);
```

### 5. Progress Tracking

Monitor long-running operations with progress callbacks:

```typescript
const fileId = await assistantService.uploadNovelFile(
  'novel.txt',
  (progress) => {
    console.log(`Upload progress: ${progress.percentage}%`);
  }
);
```

### 6. Error Handling

Comprehensive error handling with specific guidance:

```typescript
try {
  await assistantService.uploadNovelFile('novel.txt');
} catch (error) {
  if (error.code === 'FILE_TOO_LARGE') {
    console.error('File exceeds 100MB limit');
    console.error('Guidance:', error.guidance);
  }
}
```

### 7. Usage Monitoring

Track API usage and costs:

```typescript
const metrics = await assistantService.getUsageMetrics();
console.log('Files uploaded:', metrics.filesUploaded);
console.log('Queries executed:', metrics.queriesExecuted);
console.log('Estimated cost:', metrics.estimatedCost);
```

### 8. Diagnostics

Test API connectivity and configuration:

```typescript
const diagnostics = await assistantService.runDiagnostics();
diagnostics.forEach(result => {
  console.log(`${result.test}: ${result.status}`);
});
```

## Best Practices

### 1. Resource Cleanup

Always clean up resources to avoid unnecessary costs:

```typescript
try {
  // Use assistant
  const response = await assistantService.queryAssistant(assistantId, query);
} finally {
  // Always cleanup, even if errors occur
  await assistantService.cleanup(assistantId, fileId);
}
```

### 2. Reuse Assistants

For multiple queries on the same novel, reuse the assistant:

```typescript
const assistantId = await assistantService.createNovelAnalysisAssistant(fileId);

// Multiple queries using the same assistant
const characters = await assistantService.queryAssistant(assistantId, 'Extract characters');
const plot = await assistantService.queryAssistant(assistantId, 'Extract plot points');
const structure = await assistantService.queryAssistant(assistantId, 'Identify structure');

// Cleanup once at the end
await assistantService.cleanup(assistantId, fileId);
```

### 3. Handle Rate Limits

The system automatically handles rate limits with exponential backoff, but you can optimize by:

- Spacing out requests
- Using batch processing
- Implementing request queuing

### 4. Monitor Costs

Regularly check usage metrics:

```typescript
const metrics = await assistantService.getUsageMetrics();
if (metrics.estimatedCost > 10) {
  console.warn('High API usage detected');
}
```

### 5. Validate Configuration

Run diagnostics before processing:

```typescript
const diagnostics = await assistantService.runDiagnostics();
const allPassed = diagnostics.every(d => d.status === 'pass');
if (!allPassed) {
  console.error('Configuration issues detected');
}
```

## Cost Optimization

### Understanding Costs

OpenAI charges for:
- File storage: $0.10/GB/day
- API calls: Based on model and tokens used
- Vector store operations: Included in file storage

### Optimization Strategies

1. **Clean up promptly**: Delete assistants and files immediately after use
2. **Reuse assistants**: Process multiple queries with one assistant
3. **Use appropriate models**: GPT-3.5-turbo is cheaper than GPT-4
4. **Monitor usage**: Track costs with usage metrics
5. **Set quota limits**: Configure warning thresholds

### Cost Tracking

```typescript
// Get cost analysis
const costAnalysis = await assistantService.getCostAnalysis({
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31')
});

console.log('Total cost:', costAnalysis.totalCost);
console.log('Cost by operation:', costAnalysis.costByOperation);
```

### Performance Optimization

```typescript
// Get optimization recommendations
const recommendations = await assistantService.getOptimizationRecommendations();
recommendations.forEach(rec => {
  console.log(`${rec.category}: ${rec.recommendation}`);
});
```

## Advanced Features

### Performance Monitoring

```typescript
const report = await assistantService.getPerformanceReport({
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31')
});

console.log('Average response time:', report.averageResponseTime);
console.log('Success rate:', report.successRate);
```

### Concurrent Processing

Process multiple novels concurrently:

```typescript
const novels = ['novel1.txt', 'novel2.txt', 'novel3.txt'];

const results = await Promise.all(
  novels.map(async (novel) => {
    const fileId = await assistantService.uploadNovelFile(novel);
    const assistantId = await assistantService.createNovelAnalysisAssistant(fileId);
    const analysis = await assistantService.queryAssistant(assistantId, 'Analyze this novel');
    await assistantService.cleanup(assistantId, fileId);
    return analysis;
  })
);
```

### Custom Queries

Create custom analysis queries:

```typescript
const customQuery = `
Analyze this novel and provide:
1. Main themes
2. Character relationships
3. Narrative techniques used
4. Historical context
Format the response as JSON.
`;

const analysis = await assistantService.queryAssistant(assistantId, customQuery);
```

## Troubleshooting

For common issues and solutions, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Support

For additional help:
- Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Review error messages and guidance
- Run diagnostics: `assistantService.runDiagnostics()`
- Check OpenAI API status: https://status.openai.com/
