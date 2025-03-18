/**
 * Clean up HTML content by removing scripts, styles, and navigation elements
 * @param {string} html - The HTML content to clean up
 * @returns {string} The cleaned HTML content
 */
export function cleanupHTML(html) {
  // Remove scripts and styles
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Remove navigation and footer elements
  html = html.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "");
  html = html.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "");

  // Clean up whitespace
  html = html.replace(/\s+/g, " ").trim();

  return html;
}

/**
 * Extract title from HTML content
 * @param {string} html - The HTML content to extract the title from
 * @returns {string} The extracted title or "Untitled Page" if no title is found
 */
export function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : "Untitled Page";
}

/**
 * Check if a site is available
 * @param {string} url - The URL to check
 * @param {Object} options - Options for the fetch request
 * @param {Function} fetchWithRetry - The fetch function to use
 * @returns {Promise<Object>} An object with availability information
 */
export async function checkSiteAvailability(url, options = {}, fetchWithRetry) {
  try {
    const response = await fetchWithRetry(
      url,
      {
        ...options,
        method: "HEAD",
        timeout: 10000,
        // Pass through ignoreSSLErrors if provided
        ignoreSSLErrors: options.ignoreSSLErrors,
      },
      2
    );

    return {
      available: true,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (error) {
    return {
      available: false,
      error: error.message,
      recommendation: "Please try again later or check if the URL is correct.",
    };
  }
}
