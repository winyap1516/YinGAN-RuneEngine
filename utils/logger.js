/**
 * Simple logging helper to keep console output consistent across modules.
 * Usage example: logger.info('AI', 'Loading window bindings');
 */
export const logger = {
  /**
   * Output an informational message with a standardized prefix.
   * @param {string} tag - Short label identifying the source module.
   * @param {string} message - Message to display in the console.
   */
  info(tag, message) {
    console.log(`[${tag}] ${message}`);
  },

  /**
   * Output an error message while preserving original stack traces.
   * @param {string} tag - Short label identifying the source module.
   * @param {unknown} error - Error instance or descriptive message.
   */
  error(tag, error) {
    if (error instanceof Error) {
      console.error(`[${tag}] ${error.message}`, error);
    } else {
      console.error(`[${tag}]`, error);
    }
  }
};

export const { info, error } = logger;

// Provide a minimal global fallback for non-module consumers.
if (typeof window !== 'undefined') {
  window.Logger = window.Logger || logger;
}
