#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import TurndownService from "turndown";
import { HttpsProxyAgent } from "https-proxy-agent";

// Optional Puppeteer import for JavaScript-heavy pages
let puppeteer;
try {
  puppeteer = await import("puppeteer");
} catch (e) {
  console.error("Puppeteer not available, will use basic fetch for all requests");
}

// Common browser headers to avoid detection
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
};

// Proxy configuration (can be overridden by environment variables)
const PROXY_CONFIG = {
  enabled: process.env.USE_PROXY === "true",
  url: process.env.PROXY_URL || "http://localhost:8888",
  timeout: parseInt(process.env.PROXY_TIMEOUT, 10) || 30000,
};

// Create server instance
const server = new Server(
  {
    name: "webtools-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Configure Turndown to handle images better
turndownService.addRule("images", {
  filter: ["img"],
  replacement: function (content, node) {
    const alt = node.getAttribute("alt") || "";
    const src = node.getAttribute("src") || "";
    const title = node.getAttribute("title") || "";
    return src ? `![${alt}](${src}${title ? ` "${title}"` : ""})` : "";
  },
});

// Add rules for cleaning up navigation and footer elements
turndownService.remove(["nav", "footer", "script", "style", ".navigation", "#navigation", ".footer", "#footer"]);

// Helper function for exponential backoff
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Add logging utility
function logInfo(category, message, data = {}) {
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

function logError(category, message, error = null, data = {}) {
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

// Helper function to fetch content with retry and proxy support
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  let proxyAttempted = false;

  logInfo("fetch", "Starting fetch request", { url, options, maxRetries });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

      const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers: {
          ...BROWSER_HEADERS,
          ...options.headers,
        },
      };

      if (PROXY_CONFIG.enabled && (attempt > 0 || proxyAttempted)) {
        logInfo("fetch", `Using proxy on attempt ${attempt + 1}`, {
          proxy: PROXY_CONFIG.url,
          attempt: attempt + 1,
        });
        fetchOptions.agent = new HttpsProxyAgent(PROXY_CONFIG.url);
        fetchOptions.timeout = PROXY_CONFIG.timeout;
        proxyAttempted = true;
      }

      logInfo("fetch", `Attempt ${attempt + 1} started`, {
        url,
        attempt: attempt + 1,
        options: fetchOptions,
      });

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      logInfo("fetch", `Attempt ${attempt + 1} completed`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
      });

      if (response.status === 403 || response.status === 429) {
        throw new Error(`Access blocked (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      logError("fetch", `Attempt ${attempt + 1} failed`, error, {
        url,
        attempt: attempt + 1,
        willRetry: attempt < maxRetries - 1,
      });

      if (error.name === "AbortError" || error.message.includes("ECONNREFUSED") || error.message.includes("certificate")) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        logInfo("fetch", `Scheduling retry`, {
          attempt: attempt + 1,
          nextAttemptIn: Math.round(delay / 1000),
        });
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// Helper function to clean up HTML content
function cleanupHTML(html) {
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

// Helper function to extract title from HTML
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : "Untitled Page";
}

// Helper function to check site availability
async function checkSiteAvailability(url, options = {}) {
  logInfo("availability", "Checking site availability", { url, options });

  try {
    const response = await fetchWithRetry(
      url,
      {
        ...options,
        method: "HEAD",
        timeout: 10000,
      },
      2
    );

    const result = {
      available: true,
      status: response.status,
      statusText: response.statusText,
    };

    logInfo("availability", "Site availability check completed", result);
    return result;
  } catch (error) {
    const result = {
      available: false,
      error: error.message,
      recommendation: "Please try again later or check if the URL is correct.",
    };

    logError("availability", "Site availability check failed", error, result);
    return result;
  }
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "webtool_gethtml",
        description: "Get the HTML content of a webpage. Automatically handles retries and proxy if needed.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to fetch",
            },
            useJavaScript: {
              type: "boolean",
              description: "Whether to execute JavaScript (requires Puppeteer)",
              default: false,
            },
            useProxy: {
              type: "boolean",
              description: "Whether to use a proxy for this request",
              default: false,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "webtool_readpage",
        description: "Get the webpage content in Markdown format, including links and images. Handles blocked access automatically.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to fetch",
            },
            useJavaScript: {
              type: "boolean",
              description: "Whether to execute JavaScript (requires Puppeteer)",
              default: false,
            },
            useProxy: {
              type: "boolean",
              description: "Whether to use a proxy for this request",
              default: false,
            },
            selector: {
              type: "string",
              description: "Optional CSS selector to extract specific content (e.g., 'main', 'article')",
              default: "body",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "webtool_screenshot",
        description: "Take a screenshot of a webpage or specific element on the page with custom device emulation",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to screenshot",
            },
            selector: {
              type: "string",
              description: "Optional CSS selector to screenshot a specific element",
            },
            useProxy: {
              type: "boolean",
              description: "Whether to use a proxy for this request",
              default: false,
            },
            deviceConfig: {
              type: "object",
              description: "Custom device configuration for emulation",
              properties: {
                name: {
                  type: "string",
                  description: "Device name for identification",
                },
                userAgent: {
                  type: "string",
                  description: "Custom user agent string",
                },
                width: {
                  type: "number",
                  description: "Viewport width",
                },
                height: {
                  type: "number",
                  description: "Viewport height",
                },
                deviceScaleFactor: {
                  type: "number",
                  description: "Device scale factor for high DPI displays",
                  default: 1,
                },
                isMobile: {
                  type: "boolean",
                  description: "Whether to emulate a mobile device",
                  default: false,
                },
                hasTouch: {
                  type: "boolean",
                  description: "Whether the device has touch capabilities",
                  default: false,
                },
                isLandscape: {
                  type: "boolean",
                  description: "Whether to use landscape orientation",
                  default: false,
                },
              },
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  logInfo("tool", "Tool execution started", {
    tool: name,
    arguments: args,
  });

  try {
    // Check site availability first
    const availability = await checkSiteAvailability(args.url);
    if (!availability.available) {
      const response = {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Site unavailable",
                details: availability.error,
                recommendation: availability.recommendation,
                retryable: true,
                url: args.url,
              },
              null,
              2
            ),
          },
        ],
      };

      logError("tool", "Site unavailable", null, {
        tool: name,
        url: args.url,
        availability,
      });

      return response;
    }

    if (name === "webtool_gethtml") {
      const { url, useJavaScript = false, useProxy = false } = args;

      if (useJavaScript && !puppeteer) {
        throw new Error("JavaScript execution requested but Puppeteer is not available");
      }

      let content;
      if (useJavaScript) {
        const browser = await puppeteer.launch({
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox", useProxy && PROXY_CONFIG.url ? `--proxy-server=${PROXY_CONFIG.url}` : ""].filter(Boolean),
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
          useProxy: useProxy || PROXY_CONFIG.enabled,
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
    } else if (name === "webtool_readpage") {
      const { url, useJavaScript = false, useProxy = false, selector = "body" } = args;

      if (useJavaScript && !puppeteer) {
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
                  url: url,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      let html, title;
      try {
        if (useJavaScript) {
          const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox", useProxy && PROXY_CONFIG.url ? `--proxy-server=${PROXY_CONFIG.url}` : ""].filter(Boolean),
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
            useProxy: useProxy || PROXY_CONFIG.enabled,
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
                    url: url,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Convert to Markdown
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
                  url: url,
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
    } else if (name === "webtool_screenshot") {
      const { url, selector, useProxy = false, deviceConfig } = args;

      if (!puppeteer) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Screenshot functionality not available",
                  details: "Puppeteer is not installed",
                  recommendation: "Please install Puppeteer to use screenshot functionality",
                  retryable: false,
                  url: url,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        const browser = await puppeteer.launch({
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", useProxy && PROXY_CONFIG.url ? `--proxy-server=${PROXY_CONFIG.url}` : "", "--ignore-certificate-errors"].filter(Boolean),
        });

        try {
          const page = await browser.newPage();
          await page.setExtraHTTPHeaders(BROWSER_HEADERS);

          if (deviceConfig) {
            // Set viewport with device configuration
            await page.setViewport({
              width: deviceConfig.width || 1280,
              height: deviceConfig.height || 800,
              deviceScaleFactor: deviceConfig.deviceScaleFactor || 1,
              isMobile: deviceConfig.isMobile || false,
              hasTouch: deviceConfig.hasTouch || false,
              isLandscape: deviceConfig.isLandscape || false,
            });

            // Set custom user agent if provided
            if (deviceConfig.userAgent) {
              await page.setUserAgent(deviceConfig.userAgent);
            }
          } else {
            // Default desktop viewport
            await page.setViewport({
              width: 1280,
              height: 800,
              deviceScaleFactor: 1,
              isMobile: false,
              hasTouch: false,
              isLandscape: false,
            });
          }

          await page.setDefaultNavigationTimeout(45000);

          // Navigate and wait for network to be idle
          await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: 45000,
          });

          let screenshotBuffer;
          if (selector) {
            const element = await page.waitForSelector(selector, {
              timeout: 10000,
              visible: true,
            });
            if (!element) {
              throw new Error(`Element with selector "${selector}" not found`);
            }
            screenshotBuffer = await element.screenshot({
              type: "png",
            });
          } else {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            screenshotBuffer = await page.screenshot({
              type: "png",
              fullPage: true,
            });
          }

          const base64Data = screenshotBuffer.toString("base64");

          return {
            content: [
              {
                type: "image",
                data: base64Data,
                mimeType: "image/png",
              },
            ],
          };
        } finally {
          await browser.close();
        }
      } catch (error) {
        const errorDetails = {
          error: "Screenshot failed",
          details: error.message,
          recommendation: error.message.includes("net::ERR_PROXY_CONNECTION_FAILED") ? "Proxy connection failed. Please try without proxy" : "Please try again with different settings",
          retryable: true,
          url: url,
          useProxy: error.message.includes("net::ERR_PROXY_CONNECTION_FAILED") ? false : !useProxy,
          errorType: error.name,
        };

        logError("screenshot", "Screenshot capture failed", error, errorDetails);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorDetails, null, 2),
            },
          ],
        };
      }
    } else {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Unknown tool",
                details: `Tool "${name}" is not supported`,
                recommendation: "Use webtool_gethtml or webtool_readpage",
                retryable: false,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    logInfo("tool", "Tool execution completed successfully", {
      tool: name,
      url: args.url,
    });

    return result;
  } catch (error) {
    logError("tool", "Tool execution failed", error, {
      tool: name,
      arguments: args,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Operation failed",
              details: error.message,
              recommendation: "Please try again later or with different parameters",
              retryable: true,
              url: args.url,
            },
            null,
            2
          ),
        },
      ],
    };
  }
});

// Initialize and start the server
async function main() {
  logInfo("server", "Starting Webtools MCP Server");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logInfo("server", "Server running", {
    transport: "stdio",
    proxy: PROXY_CONFIG.enabled ? PROXY_CONFIG.url : "disabled",
  });

  process.on("SIGINT", () => {
    logInfo("server", "Shutting down gracefully");
    process.exit();
  });
}

main().catch((error) => {
  logError("server", "Fatal error in main()", error);
  process.exit(1);
});
