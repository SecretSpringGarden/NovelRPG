// Quick test script to verify configuration loading
const { ConfigManager } = require('./dist/config/ConfigManager');

try {
  const configManager = ConfigManager.getInstance();
  const llmConfig = configManager.getLLMConfig();
  
  console.log('Configuration loaded successfully!');
  console.log('Provider:', llmConfig.provider);
  console.log('Model:', llmConfig.model);
  console.log('API Key present:', llmConfig.apiKey ? 'Yes (hidden)' : 'No');
  console.log('Max Tokens:', llmConfig.maxTokens);
  
  const validation = configManager.validateConfiguration();
  console.log('Configuration valid:', validation.isValid);
  if (!validation.isValid) {
    console.log('Errors:', validation.errors);
  }
} catch (error) {
  console.error('Error loading configuration:', error.message);
}