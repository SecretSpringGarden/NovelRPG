/**
 * Verification script for task 9.8: Individual game state file creation
 * This script verifies that separate game state files are created for each ending variation
 * with the ending type included in the filename.
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 Verifying game state file creation for ending variations...\n');

// Check if test_outputs directory exists
const outputDir = 'test_outputs';
if (!fs.existsSync(outputDir)) {
  console.log(`❌ Output directory '${outputDir}' does not exist`);
  console.log('   Run an ending variation test first to generate files');
  process.exit(1);
}

// Read all files in the output directory
const files = fs.readdirSync(outputDir);

// Filter for game state JSON files with ending types
const gameStateFiles = files.filter(file => 
  file.endsWith('.json') && 
  (file.includes('-original-') || file.includes('-opposite-') || file.includes('-random-'))
);

console.log(`📁 Found ${gameStateFiles.length} game state files with ending types\n`);

if (gameStateFiles.length === 0) {
  console.log('⚠️  No game state files found with ending types in filename');
  console.log('   Expected format: YYYY-MM-DDTHH-MM-SS-novelTitle-{original|opposite|random}-Nrounds.json');
  console.log('\n   Run an ending variation test to generate files:');
  console.log('   npm run test:ending-variation -- TestNovels/test_simple_novel.txt 5');
  process.exit(0);
}

// Group files by test run (based on timestamp prefix)
const filesByRun = new Map<string, string[]>();

for (const file of gameStateFiles) {
  // Extract timestamp (first part before novel title)
  const timestampMatch = file.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
  if (timestampMatch) {
    const timestamp = timestampMatch[1];
    if (!filesByRun.has(timestamp)) {
      filesByRun.set(timestamp, []);
    }
    filesByRun.get(timestamp)!.push(file);
  }
}

console.log(`📊 Found ${filesByRun.size} test run(s)\n`);

// Verify each test run has all three ending types
let allValid = true;

for (const [timestamp, files] of filesByRun.entries()) {
  console.log(`Test Run: ${timestamp}`);
  
  const hasOriginal = files.some(f => f.includes('-original-'));
  const hasOpposite = files.some(f => f.includes('-opposite-'));
  const hasRandom = files.some(f => f.includes('-random-'));
  
  console.log(`  ✅ Original ending: ${hasOriginal ? 'Found' : '❌ Missing'}`);
  console.log(`  ✅ Opposite ending: ${hasOpposite ? 'Found' : '❌ Missing'}`);
  console.log(`  ✅ Random ending:   ${hasRandom ? 'Found' : '❌ Missing'}`);
  
  if (hasOriginal && hasOpposite && hasRandom) {
    console.log(`  ✅ All three ending variations present\n`);
    
    // Verify file contents
    for (const file of files) {
      const filepath = path.join(outputDir, file);
      const content = fs.readFileSync(filepath, 'utf-8');
      const gameState = JSON.parse(content);
      
      // Extract ending type from filename
      let expectedEndingType = '';
      if (file.includes('-original-')) expectedEndingType = 'original';
      else if (file.includes('-opposite-')) expectedEndingType = 'opposite';
      else if (file.includes('-random-')) expectedEndingType = 'random';
      
      console.log(`  📄 ${file}`);
      console.log(`     Ending type in filename: ${expectedEndingType}`);
      console.log(`     Target ending ID: ${gameState.targetEnding?.id || 'N/A'}`);
      console.log(`     Story segments: ${gameState.storySegments?.length || 0}`);
      console.log(`     Current round: ${gameState.currentRound}/${gameState.totalRounds}`);
      console.log();
    }
  } else {
    console.log(`  ❌ Incomplete test run - missing ending variations\n`);
    allValid = false;
  }
}

if (allValid && filesByRun.size > 0) {
  console.log('✅ VERIFICATION PASSED');
  console.log('   All test runs have separate game state files for each ending variation');
  console.log('   Ending types are correctly included in filenames');
} else if (filesByRun.size === 0) {
  console.log('⚠️  No complete test runs found');
  console.log('   Run an ending variation test to generate files');
} else {
  console.log('❌ VERIFICATION FAILED');
  console.log('   Some test runs are missing ending variations');
}
