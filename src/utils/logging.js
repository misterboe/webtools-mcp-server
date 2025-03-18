/**
 * Log an informational message with optional data
 * @param {string} category - The category of the log
 * @param {string} message - The message to log
 * @param {Object} data - Optional data to include in the log
 */
export function logInfo(category, message, data = {}) {
  console.error(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        level: "info",
        category,
        message,
        ...data,
      },
      null,
      2
    )
  );
}

/**
 * Log an error message with optional error object and data
 * @param {string} category - The category of the log
 * @param {string} message - The message to log
 * @param {Error|null} error - Optional error object
 * @param {Object} data - Optional data to include in the log
 */
export function logError(category, message, error = null, data = {}) {
  console.error(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        level: "error",
        category,
        message,
        error: error?.message || error,
        stack: error?.stack,
        ...data,
      },
      null,
      2
    )
  );
}
