#!/usr/bin/env node

/**
 * Script to run model comparison test
 * This temporarily enables the skipped test and runs it
 */

const fs = require('fs');
const { execSync } = require('child_process');

const testFile = 'src/services/ModelComparison.test.ts';
const backupFile = 'src/services/ModelComparison.test.ts.backup';

console.log('🔬 Model Comparison Test Runner');
console.log('='.repeat(60));
console.log('This will test gpt-4-turbo-preview vs gpt-4o-mini');
console.log('Cost: ~$0.10-0.20 per test run');
console.log('='.repeat(60));
console.log('');

try {
  // Backup original file
  const content = fs.readFileSync(testFile, 'utf8');
  fs.writeFileSync(backupFile, content);
  
  // Enable the test by replacing describe.skip with describe
  const enabledContent = content.replace(/describe\.skip\(/g, 'describe(');
  fs.writeFileSync(testFile, enabledContent);
  
  console.log('✅ Test enabled');
  console.log('🏃 Running comparison...\n');
  
  // Run the test
  execSync('npm test -- ModelComparison.test.ts', { 
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  
} catch (error) {
  console.error('\n❌ Test failed or was interrupted');
  console.error(error.message);
} finally {
  // Restore original file
  if (fs.existsSync(backupFile)) {
    fs.copyFileSync(backupFile, testFile);
    fs.unlinkSync(backupFile);
    console.log('\n✅ Test file restored to original state');
  }
}
