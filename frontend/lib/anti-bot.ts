/**
 * Generates a normally distributed random number using the Box-Muller transform.
 * Anti-bot systems look for uniform distributions. Gaussian distributions simulate human latency.
 */
function randomGaussian(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

/**
 * Returns a randomized delay in milliseconds bounded between minSec and maxSec,
 * clustering around the average.
 */
export function randomGaussianDelayMs(minSec: number, maxSec: number): number {
  const mean = (minSec + maxSec) / 2;
  const stdDev = (maxSec - minSec) / 6; // 99.7% of values fall within 3 std devs
  
  let delay = randomGaussian(mean, stdDev);
  // Cap at boundaries to prevent extreme outliers
  if (delay < minSec) delay = minSec;
  if (delay > maxSec) delay = maxSec;
  
  return Math.floor(delay * 1000);
}

/**
 * Parses spintax strings like: "{Hi|Hello|Hey} there! Check out {this|my} link."
 * Randomly selects one variation from each bracketed group to create unique combinations.
 */
export function parseSpintax(text: string): string {
  const spintaxRegex = /{([^{}]+)}/g;
  return text.replace(spintaxRegex, (match, contents) => {
    const options = contents.split('|');
    const randomIndex = Math.floor(Math.random() * options.length);
    return options[randomIndex];
  });
}
