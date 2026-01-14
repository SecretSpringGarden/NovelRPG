/**
 * Character interface representing main characters from the novel
 */
export interface Character {
  id: string;
  name: string;
  description: string;
  importance: number; // 1-10 ranking from novel analysis
}

/**
 * Validates a Character object for completeness and data integrity
 */
export function validateCharacter(character: any): character is Character {
  if (!character || typeof character !== 'object') {
    return false;
  }

  // Check required string fields
  if (typeof character.id !== 'string' || character.id.trim() === '') {
    return false;
  }

  if (typeof character.name !== 'string' || character.name.trim() === '') {
    return false;
  }

  if (typeof character.description !== 'string' || character.description.trim() === '') {
    return false;
  }

  // Check importance is a number between 1-10
  if (typeof character.importance !== 'number' || 
      character.importance < 1 || 
      character.importance > 10 || 
      !Number.isInteger(character.importance)) {
    return false;
  }

  return true;
}

/**
 * Validates an array of characters ensuring exactly 4 characters are provided
 */
export function validateCharacterArray(characters: any[]): characters is Character[] {
  if (!Array.isArray(characters) || characters.length !== 4) {
    return false;
  }

  return characters.every(validateCharacter);
}