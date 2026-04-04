export function calculateHandicap(differentials: number[]): number {
  const count = differentials.length;
  if (count === 0) return 0;
  
  // 1. Sort lowest to highest
  const sorted = [...differentials].sort((a, b) => a - b);
  
  // 2. Determine how many rounds to count based on WHS table
  let numToUse = 1;
  if (count >= 20) numToUse = 8;
  else if (count >= 15) numToUse = 6;
  else if (count >= 12) numToUse = 4;
  else if (count >= 9) numToUse = 3;  // This is your current bracket
  else if (count >= 6) numToUse = 2;
  else numToUse = 1;

  // 3. Slice the best scores and calculate average
  const bestScores = sorted.slice(0, numToUse);
  const average = bestScores.reduce((a, b) => a + b, 0) / bestScores.length;
  
  // 4. Round to one decimal place
  return Math.round(average * 10) / 10;
}