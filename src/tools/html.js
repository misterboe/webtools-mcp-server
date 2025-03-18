import { fetchWithRetry } from "../utils/fetch.js";
import { cleanupHTML, extractTitle, checkSiteAvailability } from "../utils/html.js";
import { logInfo, logError } from "../utils/logging.js";
import { createTurndownService } from "../services/turndown.js";
import { BROWSER_HEADERS } from "../config/constants.js";

/**
 * Get the HTML content of a webpage
 * @param {Object} args - The tool arguments
 * @returns {Object} The tool response
 */
export async function getHtml(args) {
  const { url, useJavaScript = false, useProxy = false } = args;
  let puppeteer;

  try {
    // Check if puppeteer is available
    if (useJavaScript) {
      try {
        puppeteer = await import("puppeteer");
      } catch (e) {
        throw new Error("JavaScript execution requested but Puppeteer is not available");
      }
    }

    // Check site availability first
    const availability = await checkSiteAvailability(url, {}, fetchWithRetry);
    if (!availability.available) {
      logError("tool", "Site unavailable", null, {
        tool: "webtool_gethtml",
        url,
        availability,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Site unavailable",
                details: availability.error,
                recommendation: availability.recommendation,
                retryable: true,
                url,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    let content;
    if (useJavaScript && puppeteer) {
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", useProxy ? `--proxy-server=${process.env.PROXY_URL || ""}` : ""].filter(Boolean),
      });
      try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders(BROWSER_HEADERS);
        await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: 30000,
        });
        content = await page.content();
      } finally {
        await browser.close();
      }
    } else {
      const response = await fetchWithRetry(url, {
        timeout: 30000,
        useProxy,
      });
      content = await response.text();
    }

    return {
      content: [
        {
          type: "text",
          text: content,
        },
      ],
    };
  } catch (error) {
    logError("html", "Get HTML failed", error, { url });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Failed to get HTML",
              details: error.message,
              recommendation: "Please try again or check the URL",
              retryable: true,
              url,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

/**
 * Get the webpage content in Markdown format
 * @param {Object} args - The tool arguments
 * @returns {Object} The tool response
 */
export async function readPage(args) {
  const { url, useJavaScript = false, useProxy = false, selector = "body" } = args;
  let puppeteer;

  try {
    // Check if puppeteer is available
    if (useJavaScript) {
      try {
        puppeteer = await import("puppeteer");
      } catch (e) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "JavaScript execution not available",
                  details: "Puppeteer is not installed",
                  recommendation: "Try without JavaScript or install Puppeteer",
                  retryable: false,
                  url,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }

    // Check site availability first
    const availability = await checkSiteAvailability(url, {}, fetchWithRetry);
    if (!availability.available) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Site unavailable",
                details: availability.error,
                recommendation: availability.recommendation,
                retryable: true,
                url,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    let html, title;
    if (useJavaScript && puppeteer) {
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", useProxy ? `--proxy-server=${process.env.PROXY_URL || ""}` : ""].filter(Boolean),
      });
      try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders(BROWSER_HEADERS);

        // Set a longer timeout for JS-heavy pages
        await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: 45000,
        });

        // Wait for the selector if specified
        if (selector !== "body") {
          await page.waitForSelector(selector, { timeout: 10000 }).catch(() => console.error(`Selector "${selector}" not found`));
        }

        html = await page.content();
        title = await page.title();
      } finally {
        await browser.close();
      }
    } else {
      const response = await fetchWithRetry(url, {
        timeout: 30000,
        useProxy,
      });
      html = await response.text();
      title = extractTitle(html);
    }

    // Clean up the HTML
    html = cleanupHTML(html);

    // Check if content was actually retrieved
    if (!html.trim()) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "No content retrieved",
                details: "The page was reached but no content was found",
                recommendation: "Try with JavaScript enabled or check if the site requires authentication",
                retryable: true,
                url,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Convert to Markdown
    const turndownService = createTurndownService();
    const markdown = turndownService
      .turndown(html)
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s*[-*]\s*/gm, "- ");

    const formattedContent = `# ${title}\n\nSource: ${url}\n\n${markdown}`;

    return {
      content: [
        {
          type: "text",
          text: formattedContent,
        },
      ],
    };
  } catch (error) {
    logError("html", "Read page failed", error, { url });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Content retrieval failed",
              details: error.message,
              recommendation: "Please try again. If the error persists, try enabling JavaScript or using a proxy",
              retryable: true,
              url,
              useProxy: !useProxy,
              useJavaScript: !useJavaScript,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
