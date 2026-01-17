/**
 * StoryEnding interface representing possible story conclusions
 */
export interface StoryEnding {
  id: string;
  type: 'original' | 'opposite' | 'random';
  description: string;
  targetScore: number; // How many actions should lead toward this ending
}

/**
 * Validates a StoryEnding object for completeness and data integrity
 */
export function validateStoryEnding(ending: any): ending is StoryEnding {
  if (!ending || typeof ending !== 'object') {
    return false;
  }

  // Check required string fields
  if (typeof ending.id !== 'string' || ending.id.trim() === '') {
    return false;
  }

  if (typeof ending.description !== 'string' || ending.description.trim() === '') {
    return false;
  }

  // Check type is valid enum value
  const validTypes = ['original', 'opposite', 'random'];
  if (!validTypes.includes(ending.type)) {
    return false;
  }

  // Check targetScore is a non-negative number
  if (typeof ending.targetScore !== 'number' || ending.targetScore < 0) {
    return false;
  }

  return true;
}

/**
 * Validates an array of story endings ensuring exactly 3 endings with correct distribution
 */
export function validateStoryEndingArray(endings: any[]): endings is StoryEnding[] {
  if (!Array.isArray(endings) || endings.length !== 3) {
    return false;
  }

  // Validate each ending individually
  if (!endings.every(validateStoryEnding)) {
    return false;
  }

  // Check distribution: 1 original, 1 opposite, 1 random
  const typeCounts = endings.reduce((counts, ending) => {
    counts[ending.type] = (counts[ending.type] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  return typeCounts.original === 1 &&
         typeCounts.opposite === 1 &&
         typeCounts.random === 1;
}