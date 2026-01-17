#!/usr/bin/env ts-node
/**
 * Simple regex test to debug quote extraction
 */

const testText = `"But you forget, mama," said Elizabeth, "that we shall meet him at the assemblies, and that Mrs. Long has promised to introduce him."`;

const characterName = 'Elizabeth';

// Escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Pattern 2: "'dialogue,' said Character"  
const pattern2 = new RegExp(
  `["']([^"']{10,200})["'][^.]*?(?:said|replied|asked|exclaimed|whispered|shouted|murmured|answered|continued|added|remarked|observed|declared|stated|announced|cried|muttered|responded)\\s+${escapeRegex(characterName)}`,
  'gi'
);

console.log('Test text:', testText);
console.log('\nPattern:', pattern2.source);
console.log('\nTesting pattern2...');

const matches = [];
let match;
while ((match = pattern2.exec(testText)) !== null) {
  console.log('✅ Match found:', match[1]);
  matches.push(match[1]);
}

if (matches.length === 0) {
  console.log('❌ No matches found');
  
  // Try even simpler pattern
  console.log('\nTrying simpler pattern without [^.]*?...');
  const simplePattern = /"([^"]{10,100})",?\s*said Elizabeth/gi;
  console.log('Simple pattern:', simplePattern.source);
  
  let simpleMatch;
  while ((simpleMatch = simplePattern.exec(testText)) !== null) {
    console.log('✅ Simple match found:', simpleMatch[1]);
  }
} else {
  console.log(`✅ Found ${matches.length} matches`);
}
