/**
 * TestConfiguration interface for automated testing framework
 */
export interface TestConfiguration {
  roundCounts: number[]; // [10, 12, 14, 16, 18, 20]
  iterations: number;
  outputDirectory: string;
}

/**
 * GameResult interface for test result tracking
 */
export interface GameResult {
  rounds: number;
  endingAchieved: string;
  cohesionRank: number; // 1-10
  filename: string;
}

/**
 * CohesionReport interface for test analysis results
 */
export interface CohesionReport {
  games: GameResult[];
  sortedByCohesion: GameResult[];
}

/**
 * Validates a TestConfiguration object for completeness and data integrity
 */
export function validateTestConfiguration(config: any): config is TestConfiguration {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Check roundCounts is the expected array [10, 12, 14, 16, 18, 20]
  if (!Array.isArray(config.roundCounts) || config.roundCounts.length !== 6) {
    return false;
  }

  const expectedRounds = [10, 12, 14, 16, 18, 20];
  if (!config.roundCounts.every((round: any, index: number) => round === expectedRounds[index])) {
    return false;
  }

  // Check iterations is a positive integer
  if (typeof config.iterations !== 'number' || 
      config.iterations < 1 || 
      !Number.isInteger(config.iterations)) {
    return false;
  }

  // Check outputDirectory is a non-empty string
  if (typeof config.outputDirectory !== 'string' || config.outputDirectory.trim() === '') {
    return false;
  }

  return true;
}

/**
 * Validates a GameResult object for completeness and data integrity
 */
export function validateGameResult(result: any): result is GameResult {
  if (!result || typeof result !== 'object') {
    return false;
  }

  // Check rounds is between 10-20
  if (typeof result.rounds !== 'number' || 
      result.rounds < 10 || 
      result.rounds > 20 || 
      !Number.isInteger(result.rounds)) {
    return false;
  }

  // Check endingAchieved is a non-empty string
  if (typeof result.endingAchieved !== 'string' || result.endingAchieved.trim() === '') {
    return false;
  }

  // Check cohesionRank is between 1-10
  if (typeof result.cohesionRank !== 'number' || 
      result.cohesionRank < 1 || 
      result.cohesionRank > 10 || 
      !Number.isInteger(result.cohesionRank)) {
    return false;
  }

  // Check filename is a non-empty string
  if (typeof result.filename !== 'string' || result.filename.trim() === '') {
    return false;
  }

  return true;
}

/**
 * Validates a CohesionReport object for completeness and data integrity
 */
export function validateCohesionReport(report: any): report is CohesionReport {
  if (!report || typeof report !== 'object') {
    return false;
  }

  // Check games array
  if (!Array.isArray(report.games)) {
    return false;
  }

  if (!report.games.every(validateGameResult)) {
    return false;
  }

  // Check sortedByCohesion array
  if (!Array.isArray(report.sortedByCohesion)) {
    return false;
  }

  if (!report.sortedByCohesion.every(validateGameResult)) {
    return false;
  }

  // Check that sortedByCohesion is actually sorted by cohesionRank (descending)
  for (let i = 1; i < report.sortedByCohesion.length; i++) {
    if (report.sortedByCohesion[i - 1].cohesionRank < report.sortedByCohesion[i].cohesionRank) {
      return false;
    }
  }

  return true;
}