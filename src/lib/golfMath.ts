export function calculateHandicap(differentials: number[]): number {
  if (differentials.length === 0) return 0;
  
  // Sort and pick the best (lowest) differentials
  const sorted = [...differentials].sort((a, b) => a - b);
  const numToUse = Math.ceil(differentials.length * 0.4); // Simplified logic
  const bestScores = sorted.slice(0, Math.min(numToUse, 8));
  
  const average = bestScores.reduce((a, b) => a + b, 0) / bestScores.length;
  return Math.round(average * 10) / 10;
}