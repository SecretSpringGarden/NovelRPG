/**
 * PlotPoint interface representing key story elements from the novel
 */
export interface PlotPoint {
  id: string;
  description: string;
  sequence: number;
  importance: 'major' | 'minor';
}

/**
 * Validates a PlotPoint object for completeness and data integrity
 */
export function validatePlotPoint(plotPoint: any): plotPoint is PlotPoint {
  if (!plotPoint || typeof plotPoint !== 'object') {
    return false;
  }

  // Check required string fields
  if (typeof plotPoint.id !== 'string' || plotPoint.id.trim() === '') {
    return false;
  }

  if (typeof plotPoint.description !== 'string' || plotPoint.description.trim() === '') {
    return false;
  }

  // Check sequence is a positive integer
  if (typeof plotPoint.sequence !== 'number' || 
      plotPoint.sequence < 1 || 
      !Number.isInteger(plotPoint.sequence)) {
    return false;
  }

  // Check importance is valid enum value
  if (plotPoint.importance !== 'major' && plotPoint.importance !== 'minor') {
    return false;
  }

  return true;
}

/**
 * Validates an array of plot points ensuring exactly 5 plot points are provided
 */
export function validatePlotPointArray(plotPoints: any[]): plotPoints is PlotPoint[] {
  if (!Array.isArray(plotPoints) || plotPoints.length !== 5) {
    return false;
  }

  return plotPoints.every(validatePlotPoint);
}