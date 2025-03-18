/**
 * Sleep for the specified number of milliseconds
 * @param {number} ms - The number of milliseconds to sleep
 * @returns {Promise<void>} A promise that resolves after the specified time
 */
export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format bytes to a human-readable string
 * @param {number} bytes - The number of bytes
 * @returns {string} A formatted string representation of the bytes
 */
export function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Check if an image is likely above the fold
 * @param {Object} dimensions - The dimensions of the image
 * @returns {boolean} True if the image is likely above the fold
 */
export function isAboveTheFold(dimensions) {
  return dimensions.displayHeight < 1000; // Assume 1000px as fold threshold
}

/**
 * Analyze CSS optimization opportunities
 * @param {string} content - The CSS content to analyze
 * @returns {string[]} An array of optimization suggestions
 */
export function analyzeCssOptimization(content) {
  const suggestions = [];

  // Check for potential optimization opportunities
  if (content.includes("!important")) {
    suggestions.push("Reduce use of !important declarations");
  }

  if ((content.match(/@import/g) || []).length > 2) {
    suggestions.push("Reduce use of @import rules");
  }

  if (content.length > 50000) {
    // 50KB
    suggestions.push("Consider splitting large CSS files");
  }

  if (!content.includes("@media")) {
    suggestions.push("Consider using media queries for responsive design");
  }

  return suggestions;
}
