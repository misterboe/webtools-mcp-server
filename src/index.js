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
      {
        name: "webtool_debug",
        description: "Debug a webpage by capturing console output, network requests, and errors",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to debug",
            },
            captureConsole: {
              type: "boolean",
              description: "Capture console.log, warn, error output",
              default: true,
            },
            captureNetwork: {
              type: "boolean",
              description: "Capture network requests and responses",
              default: true,
            },
            captureErrors: {
              type: "boolean",
              description: "Capture JavaScript errors and exceptions",
              default: true,
            },
            timeoutMs: {
              type: "number",
              description: "How long to collect debug information in milliseconds",
              default: 10000,
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
        name: "webtool_performance",
        description: "Analyze webpage performance including Core Web Vitals, resource loading, and performance timeline",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to analyze",
            },
            timeoutMs: {
              type: "number",
              description: "How long to collect performance data in milliseconds",
              default: 15000,
            },
            includeCoreWebVitals: {
              type: "boolean",
              description: "Include Core Web Vitals measurements",
              default: true,
            },
            includeResourceTiming: {
              type: "boolean",
              description: "Include detailed resource timing information",
              default: true,
            },
            includeMemoryProfile: {
              type: "boolean",
              description: "Include memory usage profiling",
              default: false,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "webtool_network",
        description: "Detailed network analysis including requests, WebSocket, DNS, and caching",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to analyze",
            },
            timeoutMs: {
              type: "number",
              description: "How long to collect network data in milliseconds",
              default: 10000,
            },
            includeHeaders: {
              type: "boolean",
              description: "Include detailed header information",
              default: true,
            },
            trackWebSockets: {
              type: "boolean",
              description: "Monitor WebSocket connections",
              default: false,
            },
            analyzeCaching: {
              type: "boolean",
              description: "Analyze cache headers and policies",
              default: true,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "webtool_security",
        description: "Security analysis including headers, dependencies, and configuration",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to analyze",
            },
            checkHeaders: {
              type: "boolean",
              description: "Analyze security headers",
              default: true,
            },
            checkDependencies: {
              type: "boolean",
              description: "Check for known vulnerabilities in dependencies",
              default: true,
            },
            checkCsp: {
              type: "boolean",
              description: "Validate Content Security Policy",
              default: true,
            },
            checkCertificate: {
              type: "boolean",
              description: "Analyze SSL/TLS configuration",
              default: true,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "webtool_accessibility",
        description: "Analyze webpage accessibility including WCAG compliance and screen reader compatibility",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to analyze",
            },
            checkWcag: {
              type: "boolean",
              description: "Check WCAG 2.1 compliance",
              default: true,
            },
            level: {
              type: "string",
              description: "WCAG compliance level to check",
              enum: ["A", "AA", "AAA"],
              default: "AA",
            },
            checkContrast: {
              type: "boolean",
              description: "Check color contrast ratios",
              default: true,
            },
            checkAria: {
              type: "boolean",
              description: "Validate ARIA attributes",
              default: true,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "webtool_seo",
        description: "Analyze SEO aspects including meta tags, structured data, and mobile friendliness",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to analyze",
            },
            checkMetaTags: {
              type: "boolean",
              description: "Analyze meta tags",
              default: true,
            },
            validateStructuredData: {
              type: "boolean",
              description: "Validate structured data markup",
              default: true,
            },
            checkMobileFriendly: {
              type: "boolean",
              description: "Check mobile friendliness",
              default: true,
            },
            analyzeContent: {
              type: "boolean",
              description: "Analyze content quality and relevance",
              default: true,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "webtool_assets",
        description: "Analyze webpage assets for optimization opportunities",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to analyze",
            },
            checkImages: {
              type: "boolean",
              description: "Check for image optimization opportunities",
              default: true,
            },
            checkFonts: {
              type: "boolean",
              description: "Check for font optimization opportunities",
              default: true,
            },
            checkCss: {
              type: "boolean",
              description: "Check for CSS optimization opportunities",
              default: true,
            },
            checkJs: {
              type: "boolean",
              description: "Check for JavaScript optimization opportunities",
              default: true,
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
    } else if (name === "webtool_debug") {
      const { url, captureConsole = true, captureNetwork = true, captureErrors = true, timeoutMs = 10000, useProxy = false } = args;

      if (!puppeteer) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Debug functionality not available",
                  details: "Puppeteer is not installed",
                  recommendation: "Please install Puppeteer to use debug functionality",
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
        const debugData = {
          url,
          timestamp: new Date().toISOString(),
          console: [],
          network: [],
          errors: [],
          performance: null,
        };

        const browser = await puppeteer.launch({
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", useProxy && PROXY_CONFIG.url ? `--proxy-server=${PROXY_CONFIG.url}` : "", "--ignore-certificate-errors"].filter(Boolean),
        });

        try {
          const page = await browser.newPage();
          await page.setExtraHTTPHeaders(BROWSER_HEADERS);

          // Capture console output
          if (captureConsole) {
            page.on("console", (msg) => {
              debugData.console.push({
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date().toISOString(),
                location: msg.location(),
              });
            });
          }

          // Capture network requests
          if (captureNetwork) {
            await page.setRequestInterception(true);
            page.on("request", (request) => {
              debugData.network.push({
                type: "request",
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
                timestamp: new Date().toISOString(),
                resourceType: request.resourceType(),
              });
              request.continue();
            });

            page.on("response", (response) => {
              debugData.network.push({
                type: "response",
                url: response.url(),
                status: response.status(),
                headers: response.headers(),
                timestamp: new Date().toISOString(),
              });
            });
          }

          // Capture JavaScript errors
          if (captureErrors) {
            page.on("pageerror", (error) => {
              debugData.errors.push({
                type: "javascript",
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
              });
            });

            page.on("error", (error) => {
              debugData.errors.push({
                type: "page",
                message: error.message,
                timestamp: new Date().toISOString(),
              });
            });
          }

          // Start performance monitoring
          await page.evaluate(() => {
            try {
              // Clear any existing marks first
              performance.clearMarks();
              performance.clearMeasures();
              performance.mark("debug-start");
            } catch (e) {
              console.warn("Performance API not fully supported:", e.message);
            }
          });

          // Navigate to the page
          await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: timeoutMs,
          });

          // Wait for specified timeout
          await new Promise((resolve) => setTimeout(resolve, timeoutMs));

          // Collect performance metrics
          debugData.performance = await page.evaluate(() => {
            try {
              performance.mark("debug-end");
              performance.measure("debug-duration", "debug-start", "debug-end");
            } catch (e) {
              console.warn("Performance measurement failed:", e.message);
            }

            try {
              const navigationTiming = performance.getEntriesByType("navigation")[0] || {};
              const resourceTiming = performance.getEntriesByType("resource") || [];
              const measures = performance.getEntriesByType("measure") || [];

              return {
                navigation: {
                  domComplete: navigationTiming.domComplete || 0,
                  loadEventEnd: navigationTiming.loadEventEnd || 0,
                  domInteractive: navigationTiming.domInteractive || 0,
                  domContentLoadedEventEnd: navigationTiming.domContentLoadedEventEnd || 0,
                },
                resources: resourceTiming.map((r) => ({
                  name: r.name,
                  duration: r.duration,
                  transferSize: r.transferSize,
                  type: r.initiatorType,
                })),
                measures: measures.map((m) => ({
                  name: m.name,
                  duration: m.duration,
                })),
              };
            } catch (e) {
              return {
                error: e.message,
                navigation: {
                  domComplete: 0,
                  loadEventEnd: 0,
                  domInteractive: 0,
                  domContentLoadedEventEnd: 0,
                },
                resources: [],
                measures: [],
              };
            }
          });

          // Format the debug data into a readable markdown report
          const report = [
            `# Debug Report for ${url}`,
            `Generated at: ${debugData.timestamp}`,
            "",
            "## Console Output",
            debugData.console.length > 0 ? debugData.console.map((log) => `- [${log.timestamp}] ${log.type.toUpperCase()}: ${log.text}`).join("\n") : "- No console output captured",
            "",
            "## Network Activity",
            debugData.network.length > 0 ? debugData.network.map((n) => `- [${n.timestamp}] ${n.type.toUpperCase()} ${n.method || n.status} ${n.url}`).join("\n") : "- No network activity captured",
            "",
            "## Errors",
            debugData.errors.length > 0 ? debugData.errors.map((err) => `### ${err.type} Error at ${err.timestamp}\n\`\`\`\n${err.message}\n${err.stack || ""}\n\`\`\``).join("\n") : "- No errors captured",
            "",
            "## Performance Metrics",
            debugData.performance.error
              ? `Error collecting performance metrics: ${debugData.performance.error}`
              : [
                  "### Navigation Timing",
                  `- DOM Complete: ${debugData.performance.navigation.domComplete}ms`,
                  `- Load Event: ${debugData.performance.navigation.loadEventEnd}ms`,
                  `- DOM Interactive: ${debugData.performance.navigation.domInteractive}ms`,
                  "",
                  "### Resource Loading",
                  debugData.performance.resources.length > 0 ? debugData.performance.resources.map((r) => `- ${r.name}: ${r.duration}ms (${(r.transferSize / 1024).toFixed(2)}KB)`).join("\n") : "- No resource timing data available",
                ].join("\n"),
          ].join("\n");

          return {
            content: [
              {
                type: "text",
                text: report,
              },
            ],
          };
        } finally {
          await browser.close();
        }
      } catch (error) {
        const errorDetails = {
          error: "Debug failed",
          details: error.message,
          recommendation: error.message.includes("net::ERR_PROXY_CONNECTION_FAILED")
            ? "Proxy connection failed. Please try without proxy"
            : error.message.includes("net::ERR_CONNECTION_REFUSED")
            ? "Connection refused. The site might be blocking automated access"
            : error.message.includes("net::ERR_NAME_NOT_RESOLVED")
            ? "Could not resolve the domain name. Please check the URL"
            : "Please try again with different settings",
          retryable: true,
          url: url,
          useProxy: error.message.includes("net::ERR_PROXY_CONNECTION_FAILED") ? false : useProxy,
          suggestedSettings: {
            timeoutMs: error.message.includes("TimeoutError") ? timeoutMs * 2 : timeoutMs,
            useJavaScript: error.message.includes("JavaScript") || error.message.includes("not defined"),
            captureNetwork: error.message.includes("request interception") ? false : captureNetwork,
          },
          errorType: error.name,
          errorCategory: error.message.includes("net::") ? "network" : error.message.includes("timeout") ? "timeout" : error.message.includes("JavaScript") ? "javascript" : "unknown",
        };

        logError("debug", "Debug capture failed", error, errorDetails);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorDetails, null, 2),
            },
          ],
        };
      }
    } else if (name === "webtool_performance") {
      const { url, timeoutMs = 15000, includeCoreWebVitals = true, includeResourceTiming = true, includeMemoryProfile = false } = args;

      if (!puppeteer) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Performance analysis not available",
                  details: "Puppeteer is not installed",
                  recommendation: "Please install Puppeteer to use performance analysis",
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
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });

        try {
          const page = await browser.newPage();
          await page.setDefaultNavigationTimeout(timeoutMs);

          // Enable CDP Session for performance metrics
          const client = await page.target().createCDPSession();
          await client.send("Performance.enable");

          // Start collecting performance metrics
          const performanceMetrics = {
            coreWebVitals: null,
            resourceTiming: [],
            memoryProfile: null,
            metrics: {},
            timestamps: {
              start: Date.now(),
            },
          };

          // Setup performance observers
          await page.evaluateOnNewDocument(() => {
            window.performanceData = {
              lcpTime: 0,
              fidTime: 0,
              clsValue: 0,
              resources: [],
            };

            // LCP Observer
            new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              window.performanceData.lcpTime = lastEntry.startTime;
            }).observe({ entryTypes: ["largest-contentful-paint"] });

            // FID Observer
            new PerformanceObserver((list) => {
              const entries = list.getEntries();
              entries.forEach((entry) => {
                if (entry.name === "first-input") {
                  window.performanceData.fidTime = entry.processingStart - entry.startTime;
                }
              });
            }).observe({ entryTypes: ["first-input"] });

            // CLS Observer
            let clsValue = 0;
            new PerformanceObserver((list) => {
              const entries = list.getEntries();
              entries.forEach((entry) => {
                if (!entry.hadRecentInput) {
                  clsValue += entry.value;
                  window.performanceData.clsValue = clsValue;
                }
              });
            }).observe({ entryTypes: ["layout-shift"] });

            // Resource Timing
            new PerformanceObserver((list) => {
              const entries = list.getEntries();
              window.performanceData.resources = window.performanceData.resources.concat(
                entries.map((entry) => ({
                  name: entry.name,
                  type: entry.initiatorType,
                  duration: entry.duration,
                  transferSize: entry.transferSize,
                  startTime: entry.startTime,
                }))
              );
            }).observe({ entryTypes: ["resource"] });
          });

          // Navigate to page
          await page.goto(url, {
            waitUntil: ["load", "networkidle0"],
            timeout: timeoutMs,
          });

          // Collect metrics after page load
          if (includeCoreWebVitals) {
            performanceMetrics.coreWebVitals = await page.evaluate(() => ({
              LCP: window.performanceData.lcpTime,
              FID: window.performanceData.fidTime,
              CLS: window.performanceData.clsValue,
            }));
          }

          if (includeResourceTiming) {
            performanceMetrics.resourceTiming = await page.evaluate(() => window.performanceData.resources);
          }

          if (includeMemoryProfile) {
            performanceMetrics.memoryProfile = await page.evaluate(() =>
              performance.memory
                ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                  }
                : null
            );
          }

          // Collect general metrics
          const metrics = await client.send("Performance.getMetrics");
          performanceMetrics.metrics = metrics.metrics.reduce((acc, metric) => {
            acc[metric.name] = metric.value;
            return acc;
          }, {});

          performanceMetrics.timestamps.end = Date.now();

          // Format the performance report
          const report = [
            `# Performance Analysis for ${url}`,
            `Duration: ${performanceMetrics.timestamps.end - performanceMetrics.timestamps.start}ms`,
            "",
            "## Core Web Vitals",
            performanceMetrics.coreWebVitals
              ? [
                  `- Largest Contentful Paint (LCP): ${(performanceMetrics.coreWebVitals.LCP / 1000).toFixed(2)}s`,
                  `- First Input Delay (FID): ${performanceMetrics.coreWebVitals.FID.toFixed(2)}ms`,
                  `- Cumulative Layout Shift (CLS): ${performanceMetrics.coreWebVitals.CLS.toFixed(3)}`,
                ].join("\n")
              : "- Core Web Vitals data not collected",
            "",
            "## Resource Loading",
            performanceMetrics.resourceTiming.length > 0
              ? [
                  "### Summary",
                  `- Total Resources: ${performanceMetrics.resourceTiming.length}`,
                  `- Total Transfer Size: ${(performanceMetrics.resourceTiming.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024 / 1024).toFixed(2)}MB`,
                  "",
                  "### Details",
                  ...performanceMetrics.resourceTiming.map((r) => `- ${r.name.substring(0, 100)}${r.name.length > 100 ? "..." : ""}\n  ${r.type} | ${r.duration.toFixed(0)}ms | ${(r.transferSize / 1024).toFixed(1)}KB`),
                ].join("\n")
              : "- Resource timing data not collected",
            "",
            "## Memory Usage",
            performanceMetrics.memoryProfile
              ? [
                  `- Used JS Heap: ${(performanceMetrics.memoryProfile.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`,
                  `- Total JS Heap: ${(performanceMetrics.memoryProfile.totalJSHeapSize / 1024 / 1024).toFixed(1)}MB`,
                  `- JS Heap Limit: ${(performanceMetrics.memoryProfile.jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB`,
                ].join("\n")
              : "- Memory profile not collected",
            "",
            "## Performance Metrics",
            Object.entries(performanceMetrics.metrics)
              .filter(([key]) => key.includes("Duration") || key.includes("Timestamp"))
              .map(([key, value]) => `- ${key}: ${value.toFixed(2)}ms`)
              .join("\n"),
          ].join("\n");

          return {
            content: [
              {
                type: "text",
                text: report,
              },
            ],
          };
        } finally {
          await browser.close();
        }
      } catch (error) {
        const errorDetails = {
          error: "Performance analysis failed",
          details: error.message,
          recommendation: "Please try again with different settings",
          retryable: true,
          url: url,
          errorType: error.name,
        };

        logError("performance", "Performance analysis failed", error, errorDetails);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorDetails, null, 2),
            },
          ],
        };
      }
    } else if (name === "webtool_network") {
      const { url, timeoutMs = 10000, includeHeaders = true, trackWebSockets = false, analyzeCaching = true } = args;

      if (!puppeteer) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Network analysis not available",
                  details: "Puppeteer is not installed",
                  recommendation: "Please install Puppeteer to use network analysis",
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
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });

        try {
          const page = await browser.newPage();
          await page.setDefaultNavigationTimeout(timeoutMs);

          // Enable CDP Session for network monitoring
          const client = await page.target().createCDPSession();
          await client.send("Network.enable");

          // Initialize network data collection
          const networkData = {
            requests: [],
            websockets: [],
            timing: {},
            summary: {
              totalRequests: 0,
              byMethod: {},
              byType: {},
              byProtocol: {},
              totalBytes: 0,
              compression: {
                originalSize: 0,
                transferredSize: 0,
              },
            },
            caching: {
              cacheable: 0,
              notCacheable: 0,
              cached: 0,
            },
          };

          // Setup network request monitoring
          await page.setRequestInterception(true);

          page.on("request", (request) => {
            const requestData = {
              url: request.url(),
              method: request.method(),
              resourceType: request.resourceType(),
              headers: includeHeaders ? request.headers() : undefined,
              timestamp: Date.now(),
            };

            networkData.requests.push(requestData);
            networkData.summary.totalRequests++;
            networkData.summary.byMethod[request.method()] = (networkData.summary.byMethod[request.method()] || 0) + 1;
            networkData.summary.byType[request.resourceType()] = (networkData.summary.byType[request.resourceType()] || 0) + 1;

            request.continue();
          });

          page.on("response", async (response) => {
            try {
              const request = response.request();
              const headers = response.headers();
              const size = headers["content-length"] ? parseInt(headers["content-length"], 10) : 0;

              networkData.summary.totalBytes += size;

              // Analyze caching if enabled
              if (analyzeCaching) {
                const cacheControl = headers["cache-control"];
                const pragma = headers["pragma"];

                if (cacheControl || pragma) {
                  if (cacheControl?.includes("no-store") || pragma === "no-cache") {
                    networkData.caching.notCacheable++;
                  } else {
                    networkData.caching.cacheable++;
                  }
                }

                if (response.fromCache()) {
                  networkData.caching.cached++;
                }
              }

              // Track compression
              if (headers["content-encoding"]) {
                const originalSize = size;
                const transferredSize = (await response.buffer()).length;
                networkData.summary.compression.originalSize += originalSize;
                networkData.summary.compression.transferredSize += transferredSize;
              }

              // Track protocol
              const protocol = response.protocol() || "unknown";
              networkData.summary.byProtocol[protocol] = (networkData.summary.byProtocol[protocol] || 0) + 1;
            } catch (e) {
              console.warn("Error processing response:", e.message);
            }
          });

          // Track WebSocket connections if enabled
          if (trackWebSockets) {
            client.on("Network.webSocketCreated", ({ requestId, url }) => {
              networkData.websockets.push({
                id: requestId,
                url,
                status: "created",
                timestamp: Date.now(),
              });
            });

            client.on("Network.webSocketClosed", ({ requestId }) => {
              const ws = networkData.websockets.find((w) => w.id === requestId);
              if (ws) {
                ws.status = "closed";
                ws.closedAt = Date.now();
              }
            });
          }

          // Navigate to the page
          await page.goto(url, {
            waitUntil: ["load", "networkidle0"],
            timeout: timeoutMs,
          });

          // Wait a bit for any remaining requests
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Calculate compression ratio if any compressed responses
          const compressionRatio =
            networkData.summary.compression.transferredSize > 0 ? (((networkData.summary.compression.originalSize - networkData.summary.compression.transferredSize) / networkData.summary.compression.originalSize) * 100).toFixed(1) : 0;

          // Format the network analysis report
          const report = [
            `# Network Analysis for ${url}`,
            "",
            "## Request Summary",
            `- Total Requests: ${networkData.summary.totalRequests}`,
            `- Total Data Transferred: ${(networkData.summary.totalBytes / 1024 / 1024).toFixed(2)}MB`,
            "",
            "## Request Methods",
            ...Object.entries(networkData.summary.byMethod).map(([method, count]) => `- ${method}: ${count} requests`),
            "",
            "## Resource Types",
            ...Object.entries(networkData.summary.byType).map(([type, count]) => `- ${type}: ${count} requests`),
            "",
            "## Protocols Used",
            ...Object.entries(networkData.summary.byProtocol).map(([protocol, count]) => `- ${protocol}: ${count} requests`),
            "",
            "## Compression Analysis",
            `- Original Size: ${(networkData.summary.compression.originalSize / 1024).toFixed(2)}KB`,
            `- Transferred Size: ${(networkData.summary.compression.transferredSize / 1024).toFixed(2)}KB`,
            `- Compression Savings: ${compressionRatio}%`,
            "",
            "## Caching Analysis",
            `- Cacheable Resources: ${networkData.caching.cacheable}`,
            `- Non-cacheable Resources: ${networkData.caching.notCacheable}`,
            `- Served from Cache: ${networkData.caching.cached}`,
            "",
            trackWebSockets && networkData.websockets.length > 0 ? ["## WebSocket Connections", ...networkData.websockets.map((ws) => `- ${ws.url} (${ws.status}${ws.closedAt ? `, duration: ${ws.closedAt - ws.timestamp}ms` : ""})`)] : [],
            "",
            includeHeaders && networkData.requests.length > 0
              ? [
                  "## Detailed Request Analysis",
                  ...networkData.requests
                    .filter((r) => r.headers)
                    .map((r) => [`### ${r.method} ${r.url.substring(0, 100)}${r.url.length > 100 ? "..." : ""}`, `Type: ${r.resourceType}`, "Headers:", ...Object.entries(r.headers).map(([key, value]) => `  ${key}: ${value}`)].join("\n")),
                ]
              : [],
          ]
            .flat()
            .filter(Boolean)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: report,
              },
            ],
          };
        } finally {
          await browser.close();
        }
      } catch (error) {
        const errorDetails = {
          error: "Network analysis failed",
          details: error.message,
          recommendation: "Please try again with different settings",
          retryable: true,
          url: url,
          errorType: error.name,
          suggestedSettings: {
            timeoutMs: error.message.includes("timeout") ? timeoutMs * 1.5 : timeoutMs,
            includeHeaders: error.message.includes("headers") ? false : includeHeaders,
            trackWebSockets: error.message.includes("websocket") ? false : trackWebSockets,
          },
        };

        logError("network", "Network analysis failed", error, errorDetails);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorDetails, null, 2),
            },
          ],
        };
      }
    } else if (name === "webtool_security") {
      const { url, checkHeaders = true, checkDependencies = true, checkCsp = true, checkCertificate = true } = args;

      if (!puppeteer) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Security analysis not available",
                  details: "Puppeteer is not installed",
                  recommendation: "Please install Puppeteer to use security analysis",
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
        const securityData = {
          url,
          timestamp: new Date().toISOString(),
          headers: {},
          csp: null,
          certificate: null,
          dependencies: [],
          issues: [],
          summary: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
          },
        };

        const browser = await puppeteer.launch({
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });

        try {
          const page = await browser.newPage();
          const client = await page.target().createCDPSession();
          await client.send("Security.enable");

          // Set up security event handlers
          client.on("Security.securityStateChanged", ({ securityState, summary }) => {
            securityData.issues.push({
              type: "state_change",
              state: securityState,
              summary: summary,
              timestamp: new Date().toISOString(),
            });
          });

          // Intercept responses to analyze headers
          if (checkHeaders) {
            await page.setRequestInterception(true);
            page.on("response", (response) => {
              const headers = response.headers();
              const securityHeaders = {
                "Strict-Transport-Security": headers["strict-transport-security"],
                "X-Content-Type-Options": headers["x-content-type-options"],
                "X-Frame-Options": headers["x-frame-options"],
                "X-XSS-Protection": headers["x-xss-protection"],
                "Referrer-Policy": headers["referrer-policy"],
                "Permissions-Policy": headers["permissions-policy"],
                "Content-Security-Policy": headers["content-security-policy"],
              };

              // Analyze security headers
              Object.entries(securityHeaders).forEach(([header, value]) => {
                if (!value) {
                  securityData.issues.push({
                    type: "missing_header",
                    severity: header === "Content-Security-Policy" ? "high" : "medium",
                    header: header,
                    recommendation: `Add ${header} header to improve security`,
                  });
                  securityData.summary[header === "Content-Security-Policy" ? "high" : "medium"]++;
                }
              });

              securityData.headers = securityHeaders;
            });

            page.on("request", (request) => request.continue());
          }

          // Navigate to the page
          const response = await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: 30000,
          });

          // Analyze CSP if enabled
          if (checkCsp && response.headers()["content-security-policy"]) {
            const csp = response.headers()["content-security-policy"];
            securityData.csp = {
              raw: csp,
              directives: {},
            };

            // Parse CSP directives
            csp.split(";").forEach((directive) => {
              const [name, ...values] = directive.trim().split(/\s+/);
              if (name) {
                securityData.csp.directives[name] = values;
              }
            });

            // Check for unsafe CSP directives
            const unsafeDirectives = ["unsafe-inline", "unsafe-eval", "*"];
            Object.entries(securityData.csp.directives).forEach(([directive, values]) => {
              values.forEach((value) => {
                if (unsafeDirectives.includes(value)) {
                  securityData.issues.push({
                    type: "unsafe_csp",
                    severity: "high",
                    directive: directive,
                    value: value,
                    recommendation: `Remove unsafe ${value} from ${directive} directive`,
                  });
                  securityData.summary.high++;
                }
              });
            });
          }

          // Check certificate if enabled
          if (checkCertificate) {
            try {
              const securityState = await page.evaluate(() => {
                return {
                  protocol: window.location.protocol,
                  secure: window.location.protocol === "https:",
                  certificate: window.performance.timing.secureConnectionStart > 0,
                };
              });

              const response = await page.goto(url, { waitUntil: "networkidle0" });
              const securityDetails = response.securityDetails();

              if (securityDetails) {
                securityData.certificate = {
                  protocol: securityState.protocol,
                  issuer: securityDetails.issuer(),
                  validFrom: securityDetails.validFrom(),
                  validTo: securityDetails.validTo(),
                  subjectName: securityDetails.subjectName(),
                  protocol: securityDetails.protocol(),
                };

                // Check certificate validity
                const now = Date.now() / 1000;
                if (now > securityDetails.validTo()) {
                  securityData.issues.push({
                    type: "expired_certificate",
                    severity: "critical",
                    details: "SSL certificate has expired",
                    recommendation: "Renew SSL certificate immediately",
                  });
                  securityData.summary.critical++;
                } else if (now > securityDetails.validTo() - 30 * 24 * 60 * 60) {
                  securityData.issues.push({
                    type: "expiring_certificate",
                    severity: "high",
                    details: "SSL certificate will expire soon",
                    recommendation: "Plan to renew SSL certificate",
                  });
                  securityData.summary.high++;
                }

                if (!securityState.secure) {
                  securityData.issues.push({
                    type: "insecure_protocol",
                    severity: "critical",
                    details: "Site is not using HTTPS",
                    recommendation: "Enable HTTPS for all connections",
                  });
                  securityData.summary.critical++;
                }
              } else {
                securityData.issues.push({
                  type: "certificate_info_unavailable",
                  severity: "medium",
                  details: "Could not retrieve certificate information",
                  recommendation: "Verify SSL configuration manually",
                });
                securityData.summary.medium++;
              }
            } catch (certError) {
              console.warn("Certificate check failed:", certError.message);
              securityData.issues.push({
                type: "certificate_check_failed",
                severity: "medium",
                details: "Failed to check certificate: " + certError.message,
                recommendation: "Verify SSL configuration manually",
              });
              securityData.summary.medium++;
            }
          }

          // Check for known vulnerable dependencies
          if (checkDependencies) {
            const scripts = await page.evaluate(() => {
              return Array.from(document.getElementsByTagName("script"))
                .map((script) => script.src)
                .filter((src) => src.length > 0);
            });

            // Simple version extraction regex
            const versionRegex = /[@/]([0-9]+\.[0-9]+\.[0-9]+)/;

            scripts.forEach((script) => {
              const match = script.match(versionRegex);
              if (match) {
                securityData.dependencies.push({
                  url: script,
                  version: match[1],
                });

                // Example vulnerability check (you would want to use a real vulnerability database)
                if (script.includes("jquery") && match[1].startsWith("1.")) {
                  securityData.issues.push({
                    type: "vulnerable_dependency",
                    severity: "high",
                    dependency: "jQuery",
                    version: match[1],
                    recommendation: "Update jQuery to version 3.x or later",
                  });
                  securityData.summary.high++;
                }
              }
            });
          }

          // Format the security report
          const report = [
            `# Security Analysis for ${url}`,
            `Generated at: ${securityData.timestamp}`,
            "",
            "## Summary",
            `- Critical Issues: ${securityData.summary.critical}`,
            `- High Risk Issues: ${securityData.summary.high}`,
            `- Medium Risk Issues: ${securityData.summary.medium}`,
            `- Low Risk Issues: ${securityData.summary.low}`,
            "",
            "## Security Headers",
            Object.entries(securityData.headers)
              .map(([header, value]) => `### ${header}\n${value || "❌ Not Set"}`)
              .join("\n\n"),
            "",
            securityData.csp
              ? ["## Content Security Policy", "```", securityData.csp.raw, "```", "", "### Directives", ...Object.entries(securityData.csp.directives).map(([name, values]) => `- ${name}: ${values.join(" ")}`)].join("\n")
              : "## Content Security Policy\n❌ Not Set",
            "",
            securityData.certificate
              ? [
                  "## SSL Certificate",
                  `- Issuer: ${securityData.certificate.issuer}`,
                  `- Valid From: ${new Date(securityData.certificate.validFrom * 1000).toISOString()}`,
                  `- Valid To: ${new Date(securityData.certificate.validTo * 1000).toISOString()}`,
                  `- Protocol: ${securityData.certificate.protocol}`,
                  `- Cipher: ${securityData.certificate.cipher}`,
                ].join("\n")
              : "## SSL Certificate\nNot available",
            "",
            "## Dependencies",
            securityData.dependencies.length > 0 ? securityData.dependencies.map((dep) => `- ${dep.url} (Version: ${dep.version})`).join("\n") : "No external dependencies detected",
            "",
            "## Security Issues",
            securityData.issues.length > 0
              ? securityData.issues
                  .map((issue) =>
                    [
                      `### ${issue.type} (${issue.severity.toUpperCase()})`,
                      issue.details ? `Details: ${issue.details}` : "",
                      issue.directive ? `Directive: ${issue.directive}` : "",
                      issue.value ? `Value: ${issue.value}` : "",
                      `Recommendation: ${issue.recommendation}`,
                    ]
                      .filter(Boolean)
                      .join("\n")
                  )
                  .join("\n\n")
              : "No security issues detected",
          ].join("\n");

          return {
            content: [
              {
                type: "text",
                text: report,
              },
            ],
          };
        } finally {
          await browser.close();
        }
      } catch (error) {
        const errorDetails = {
          error: "Security analysis failed",
          details: error.message,
          recommendation: "Please try again with different settings",
          retryable: true,
          url: url,
          errorType: error.name,
          suggestedSettings: {
            checkHeaders: error.message.includes("headers") ? false : checkHeaders,
            checkCsp: error.message.includes("csp") ? false : checkCsp,
            checkCertificate: error.message.includes("certificate") ? false : checkCertificate,
          },
        };

        logError("security", "Security analysis failed", error, errorDetails);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorDetails, null, 2),
            },
          ],
        };
      }
    } else if (name === "webtool_accessibility") {
      const { url, checkWcag = true, level = "AA", checkContrast = true, checkAria = true } = args;

      if (!puppeteer) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Accessibility analysis not available",
                  details: "Puppeteer is not installed",
                  recommendation: "Please install Puppeteer to use accessibility analysis",
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
        const accessibilityData = {
          url,
          timestamp: new Date().toISOString(),
          summary: {
            critical: 0,
            serious: 0,
            moderate: 0,
            minor: 0,
          },
          wcagViolations: [],
          ariaIssues: [],
          contrastIssues: [],
          structureIssues: [],
        };

        const browser = await puppeteer.launch({
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });

        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 1024 });

          await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: 30000,
          });

          // Basic structure checks
          const structureChecks = await page.evaluate(() => {
            const issues = [];

            // Check for main landmark
            if (!document.querySelector("main")) {
              issues.push({
                type: "missing_main",
                severity: "serious",
                message: "No main landmark found",
                recommendation: "Add a <main> element to identify the main content",
              });
            }

            // Check heading hierarchy
            const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
            let previousLevel = 0;
            headings.forEach((heading) => {
              const currentLevel = parseInt(heading.tagName[1]);
              if (currentLevel - previousLevel > 1) {
                issues.push({
                  type: "skipped_heading",
                  severity: "moderate",
                  message: `Heading level skipped from h${previousLevel} to h${currentLevel}`,
                  recommendation: "Ensure heading levels are not skipped",
                  element: heading.outerHTML,
                });
              }
              previousLevel = currentLevel;
            });

            // Check for alt text on images
            const images = Array.from(document.querySelectorAll("img"));
            images.forEach((img) => {
              if (!img.hasAttribute("alt")) {
                issues.push({
                  type: "missing_alt",
                  severity: "serious",
                  message: "Image missing alt text",
                  recommendation: "Add descriptive alt text to image",
                  element: img.outerHTML,
                });
              }
            });

            // Check for form labels
            const formControls = Array.from(document.querySelectorAll("input, select, textarea"));
            formControls.forEach((control) => {
              const hasLabel = document.querySelector(`label[for="${control.id}"]`);
              const hasAriaLabel = control.getAttribute("aria-label");
              const hasAriaLabelledBy = control.getAttribute("aria-labelledby");

              if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
                issues.push({
                  type: "unlabeled_control",
                  severity: "serious",
                  message: "Form control without label",
                  recommendation: "Add a label or aria-label to the form control",
                  element: control.outerHTML,
                });
              }
            });

            return issues;
          });

          accessibilityData.structureIssues = structureChecks;
          structureChecks.forEach((issue) => {
            accessibilityData.summary[issue.severity]++;
          });

          // ARIA checks
          if (checkAria) {
            const ariaChecks = await page.evaluate(() => {
              const issues = [];

              // Check for invalid ARIA roles
              const elementsWithRoles = Array.from(document.querySelectorAll("[role]"));
              const validRoles = [
                "alert",
                "alertdialog",
                "application",
                "article",
                "banner",
                "button",
                "cell",
                "checkbox",
                "columnheader",
                "combobox",
                "complementary",
                "contentinfo",
                "definition",
                "dialog",
                "directory",
                "document",
                "feed",
                "figure",
                "form",
                "grid",
                "gridcell",
                "group",
                "heading",
                "img",
                "link",
                "list",
                "listbox",
                "listitem",
                "log",
                "main",
                "marquee",
                "math",
                "menu",
                "menubar",
                "menuitem",
                "menuitemcheckbox",
                "menuitemradio",
                "navigation",
                "none",
                "note",
                "option",
                "presentation",
                "progressbar",
                "radio",
                "radiogroup",
                "region",
                "row",
                "rowgroup",
                "rowheader",
                "scrollbar",
                "search",
                "searchbox",
                "separator",
                "slider",
                "spinbutton",
                "status",
                "switch",
                "tab",
                "table",
                "tablist",
                "tabpanel",
                "term",
                "textbox",
                "timer",
                "toolbar",
                "tooltip",
                "tree",
                "treegrid",
                "treeitem",
              ];

              elementsWithRoles.forEach((element) => {
                const role = element.getAttribute("role");
                if (!validRoles.includes(role)) {
                  issues.push({
                    type: "invalid_role",
                    severity: "serious",
                    message: `Invalid ARIA role: ${role}`,
                    recommendation: "Use a valid ARIA role",
                    element: element.outerHTML,
                  });
                }
              });

              // Check for ARIA attributes using a more reliable method
              const allElements = Array.from(document.getElementsByTagName("*"));
              allElements.forEach((element) => {
                const attributes = Array.from(element.attributes);
                const ariaAttributes = attributes.filter((attr) => attr.name.startsWith("aria-"));

                ariaAttributes.forEach((attr) => {
                  // Check for empty ARIA attributes
                  if (attr.value.trim() === "") {
                    issues.push({
                      type: "empty_aria",
                      severity: "serious",
                      message: `Empty ARIA attribute: ${attr.name}`,
                      recommendation: "Provide a value for the ARIA attribute",
                      element: element.outerHTML,
                    });
                  }

                  // Check for invalid ARIA states
                  if (["aria-checked", "aria-pressed", "aria-selected"].includes(attr.name)) {
                    const validValues = ["true", "false", "mixed", "undefined"];
                    if (!validValues.includes(attr.value)) {
                      issues.push({
                        type: "invalid_aria_state",
                        severity: "serious",
                        message: `Invalid value for ${attr.name}: ${attr.value}`,
                        recommendation: `Use one of: ${validValues.join(", ")}`,
                        element: element.outerHTML,
                      });
                    }
                  }

                  // Check for required complementary attributes
                  if (attr.name === "aria-labelledby") {
                    const referencedIds = attr.value.split(/\s+/);
                    referencedIds.forEach((id) => {
                      if (!document.getElementById(id)) {
                        issues.push({
                          type: "broken_aria_reference",
                          severity: "serious",
                          message: `aria-labelledby references non-existent ID: ${id}`,
                          recommendation: "Ensure referenced IDs exist in the document",
                          element: element.outerHTML,
                        });
                      }
                    });
                  }
                });

                // Check for required ARIA attributes
                if (element.getAttribute("role") === "combobox") {
                  if (!element.hasAttribute("aria-expanded")) {
                    issues.push({
                      type: "missing_required_aria",
                      severity: "serious",
                      message: "Combobox missing required aria-expanded attribute",
                      recommendation: "Add aria-expanded attribute to combobox",
                      element: element.outerHTML,
                    });
                  }
                }
              });

              return issues;
            });

            accessibilityData.ariaIssues = ariaChecks;
            ariaChecks.forEach((issue) => {
              accessibilityData.summary[issue.severity]++;
            });
          }

          // Contrast checks
          if (checkContrast) {
            const contrastChecks = await page.evaluate(() => {
              function getContrastRatio(color1, color2) {
                const luminance1 = getRelativeLuminance(color1);
                const luminance2 = getRelativeLuminance(color2);
                const brightest = Math.max(luminance1, luminance2);
                const darkest = Math.min(luminance1, luminance2);
                return (brightest + 0.05) / (darkest + 0.05);
              }

              function getRelativeLuminance(color) {
                const rgb = color.match(/\d+/g).map(Number);
                const [r, g, b] = rgb.map((c) => {
                  c = c / 255;
                  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
                });
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
              }

              const issues = [];
              const elements = document.querySelectorAll("*");

              elements.forEach((element) => {
                const style = window.getComputedStyle(element);
                const backgroundColor = style.backgroundColor;
                const color = style.color;

                if (backgroundColor !== "rgba(0, 0, 0, 0)" && color !== "rgba(0, 0, 0, 0)") {
                  const ratio = getContrastRatio(backgroundColor, color);
                  const fontSize = parseFloat(style.fontSize);
                  const isBold = parseInt(style.fontWeight, 10) >= 700;

                  const isLargeText = fontSize >= 18 || (fontSize >= 14 && isBold);
                  const requiredRatio = isLargeText ? 3 : 4.5;

                  if (ratio < requiredRatio) {
                    issues.push({
                      type: "insufficient_contrast",
                      severity: "serious",
                      message: `Contrast ratio ${ratio.toFixed(2)} is below the required ${requiredRatio}:1`,
                      recommendation: "Increase the contrast between text and background colors",
                      element: element.outerHTML,
                      details: {
                        backgroundColor,
                        textColor: color,
                        fontSize: `${fontSize}px`,
                        isBold,
                        actualRatio: ratio.toFixed(2),
                      },
                    });
                  }
                }
              });

              return issues;
            });

            accessibilityData.contrastIssues = contrastChecks;
            contrastChecks.forEach((issue) => {
              accessibilityData.summary[issue.severity]++;
            });
          }

          // Format the accessibility report
          const report = [
            `# Accessibility Analysis for ${url}`,
            `Generated at: ${accessibilityData.timestamp}`,
            "",
            "## Summary",
            `- Critical Issues: ${accessibilityData.summary.critical}`,
            `- Serious Issues: ${accessibilityData.summary.serious}`,
            `- Moderate Issues: ${accessibilityData.summary.moderate}`,
            `- Minor Issues: ${accessibilityData.summary.minor}`,
            "",
            "## Structure Issues",
            accessibilityData.structureIssues.length > 0
              ? accessibilityData.structureIssues.map((issue) => [`### ${issue.type} (${issue.severity.toUpperCase()})`, issue.message, `Recommendation: ${issue.recommendation}`, "```html", issue.element, "```"].join("\n")).join("\n\n")
              : "No structure issues detected",
            "",
            checkAria
              ? [
                  "## ARIA Issues",
                  accessibilityData.ariaIssues.length > 0
                    ? accessibilityData.ariaIssues.map((issue) => [`### ${issue.type} (${issue.severity.toUpperCase()})`, issue.message, `Recommendation: ${issue.recommendation}`, "```html", issue.element, "```"].join("\n")).join("\n\n")
                    : "No ARIA issues detected",
                ].join("\n")
              : "",
            "",
            checkContrast
              ? [
                  "## Contrast Issues",
                  accessibilityData.contrastIssues.length > 0
                    ? accessibilityData.contrastIssues
                        .map((issue) =>
                          [
                            `### ${issue.type} (${issue.severity.toUpperCase()})`,
                            issue.message,
                            `Recommendation: ${issue.recommendation}`,
                            "Details:",
                            `- Background Color: ${issue.details.backgroundColor}`,
                            `- Text Color: ${issue.details.textColor}`,
                            `- Font Size: ${issue.details.fontSize}`,
                            `- Bold: ${issue.details.isBold}`,
                            `- Actual Ratio: ${issue.details.actualRatio}:1`,
                            "```html",
                            issue.element,
                            "```",
                          ].join("\n")
                        )
                        .join("\n\n")
                    : "No contrast issues detected",
                ].join("\n")
              : "",
          ]
            .filter(Boolean)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: report,
              },
            ],
          };
        } finally {
          await browser.close();
        }
      } catch (error) {
        const errorDetails = {
          error: "Accessibility analysis failed",
          details: error.message,
          recommendation: "Please try again with different settings",
          retryable: true,
          url: url,
          errorType: error.name,
          suggestedSettings: {
            checkWcag: error.message.includes("wcag") ? false : checkWcag,
            checkContrast: error.message.includes("contrast") ? false : checkContrast,
            checkAria: error.message.includes("aria") ? false : checkAria,
          },
        };

        logError("accessibility", "Accessibility analysis failed", error, errorDetails);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorDetails, null, 2),
            },
          ],
        };
      }
    } else if (name === "webtool_seo") {
      const { url, checkMetaTags = true, validateStructuredData = true, checkMobileFriendly = true, analyzeContent = true } = args;

      if (!puppeteer) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "SEO analysis not available",
                  details: "Puppeteer is not installed",
                  recommendation: "Please install Puppeteer to use SEO analysis",
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
        const seoData = {
          url,
          timestamp: new Date().toISOString(),
          metaTags: [],
          structuredData: [],
          mobileFriendly: true,
          contentQuality: 0,
        };

        const browser = await puppeteer.launch({
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });

        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 1024 });

          await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: 30000,
          });

          // Collect meta tags
          const metaTags = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("meta")).map((meta) => ({
              name: meta.name,
              content: meta.content,
            }));
          });

          seoData.metaTags = metaTags;

          // Collect structured data
          const structuredData = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("[itemscope], [itemtype]")).map((element) => ({
              type: element.getAttribute("itemtype") || element.getAttribute("itemscope"),
              data: JSON.stringify(element.dataset),
            }));
          });

          seoData.structuredData = structuredData;

          // Check mobile friendliness
          const isMobileFriendly = await page.evaluate(() => {
            return window.innerWidth < 768;
          });

          seoData.mobileFriendly = isMobileFriendly;

          // Analyze content quality
          const contentQuality = await page.evaluate(() => {
            const text = document.body.textContent;
            const wordCount = text.split(/\s+/).length;
            const readability = wordCount / 100;
            return readability;
          });

          seoData.contentQuality = contentQuality;

          // Format the SEO report
          const report = [
            `# SEO Analysis for ${url}`,
            `Generated at: ${seoData.timestamp}`,
            "",
            "## Meta Tags",
            seoData.metaTags.length > 0 ? seoData.metaTags.map((tag) => `- ${tag.name}: ${tag.content}`).join("\n") : "- No meta tags found",
            "",
            "## Structured Data",
            seoData.structuredData.length > 0 ? seoData.structuredData.map((data) => `- ${data.type}: ${JSON.stringify(data.data)}`).join("\n") : "- No structured data found",
            "",
            "## Mobile Friendly",
            seoData.mobileFriendly ? "Yes" : "No",
            "",
            "## Content Quality",
            `- Readability Score: ${seoData.contentQuality.toFixed(2)}`,
          ].join("\n");

          return {
            content: [
              {
                type: "text",
                text: report,
              },
            ],
          };
        } finally {
          await browser.close();
        }
      } catch (error) {
        const errorDetails = {
          error: "SEO analysis failed",
          details: error.message,
          recommendation: "Please try again with different settings",
          retryable: true,
          url: url,
          errorType: error.name,
        };

        logError("seo", "SEO analysis failed", error, errorDetails);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(errorDetails, null, 2),
            },
          ],
        };
      }
    } else if (name === "webtool_assets") {
      const { url, checkImages = true, checkFonts = true, checkCss = true, checkJs = true } = args;

      if (!puppeteer) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Asset analysis not available",
                  details: "Puppeteer is not installed",
                  recommendation: "Please install Puppeteer to use asset analysis",
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
        const assetData = {
          url,
          timestamp: new Date().toISOString(),
          summary: {
            totalSize: 0,
            totalRequests: 0,
            potentialSavings: 0,
          },
          images: [],
          fonts: [],
          css: [],
          javascript: [],
          issues: [],
        };

        const browser = await puppeteer.launch({
          headless: "new",
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });

        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 1024 });

          // Enable request interception
          await page.setRequestInterception(true);

          // Track all resource requests
          page.on("request", (request) => {
            const resourceType = request.resourceType();
            assetData.summary.totalRequests++;
            request.continue();
          });

          // Analyze responses
          page.on("response", async (response) => {
            const request = response.request();
            const resourceType = request.resourceType();
            const url = request.url();
            const headers = response.headers();
            const size = parseInt(headers["content-length"]) || 0;
            assetData.summary.totalSize += size;

            try {
              if (checkImages && resourceType === "image") {
                const imageData = {
                  url,
                  size,
                  type: headers["content-type"],
                  dimensions: null,
                  optimization: {
                    compressed: headers["content-encoding"] === "gzip" || headers["content-encoding"] === "br",
                    format: null,
                    suggestions: [],
                  },
                };

                // Check image format and suggest optimizations
                if (headers["content-type"]) {
                  if (headers["content-type"].includes("png")) {
                    imageData.optimization.format = "PNG";
                    if (size > 100 * 1024) {
                      // 100KB
                      imageData.optimization.suggestions.push("Consider converting to WebP for better compression");
                    }
                  } else if (headers["content-type"].includes("jpeg")) {
                    imageData.optimization.format = "JPEG";
                    if (size > 200 * 1024) {
                      // 200KB
                      imageData.optimization.suggestions.push("Consider using progressive JPEG");
                      imageData.optimization.suggestions.push("Consider converting to WebP for better compression");
                    }
                  }
                }

                assetData.images.push(imageData);
              }

              if (checkFonts && resourceType === "font") {
                const fontData = {
                  url,
                  size,
                  format: headers["content-type"],
                  optimization: {
                    compressed: headers["content-encoding"] === "gzip" || headers["content-encoding"] === "br",
                    suggestions: [],
                  },
                };

                // Check font optimization opportunities
                if (!fontData.optimization.compressed) {
                  fontData.optimization.suggestions.push("Enable compression for font files");
                }
                if (headers["content-type"]?.includes("ttf")) {
                  fontData.optimization.suggestions.push("Consider using WOFF2 format for better compression");
                }

                assetData.fonts.push(fontData);
              }

              if (checkCss && resourceType === "stylesheet") {
                const cssData = {
                  url,
                  size,
                  optimization: {
                    compressed: headers["content-encoding"] === "gzip" || headers["content-encoding"] === "br",
                    suggestions: [],
                  },
                };

                // Analyze CSS content
                const content = await response.text();
                cssData.optimization.suggestions = analyzeCssOptimization(content);

                assetData.css.push(cssData);
              }

              if (checkJs && resourceType === "script") {
                const jsData = {
                  url,
                  size,
                  optimization: {
                    compressed: headers["content-encoding"] === "gzip" || headers["content-encoding"] === "br",
                    suggestions: [],
                  },
                };

                // Analyze JavaScript optimization opportunities
                if (!jsData.optimization.compressed) {
                  jsData.optimization.suggestions.push("Enable compression for JavaScript files");
                }
                if (size > 100 * 1024) {
                  // 100KB
                  jsData.optimization.suggestions.push("Consider code splitting for large JavaScript files");
                }

                assetData.javascript.push(jsData);
              }
            } catch (error) {
              console.warn(`Error analyzing ${resourceType} asset:`, error.message);
            }
          });

          // Navigate to the page
          await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: 30000,
          });

          // Analyze image dimensions and loading
          if (checkImages) {
            const imageDimensions = await page.evaluate(() => {
              return Array.from(document.images).map((img) => ({
                src: img.src,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                displayWidth: img.width,
                displayHeight: img.height,
                loading: img.loading || "eager",
                hasSize: img.hasAttribute("width") && img.hasAttribute("height"),
              }));
            });

            // Match dimensions with collected image data
            assetData.images.forEach((image) => {
              const dimensions = imageDimensions.find((dim) => dim.src === image.url);
              if (dimensions) {
                image.dimensions = dimensions;
                if (dimensions.naturalWidth > dimensions.displayWidth * 2) {
                  image.optimization.suggestions.push("Image is significantly larger than display size");
                }
                if (!dimensions.hasSize) {
                  image.optimization.suggestions.push("Add width and height attributes to prevent layout shifts");
                }
                if (dimensions.loading === "eager" && !isAboveTheFold(dimensions)) {
                  image.optimization.suggestions.push("Consider using loading='lazy' for images below the fold");
                }
              }
            });
          }

          // Analyze unused CSS
          if (checkCss) {
            const unusedCss = await page.evaluate(() => {
              const sheets = Array.from(document.styleSheets);
              const unusedRules = [];

              sheets.forEach((sheet) => {
                try {
                  const rules = Array.from(sheet.cssRules);
                  rules.forEach((rule) => {
                    if (rule.selectorText) {
                      try {
                        const elements = document.querySelectorAll(rule.selectorText);
                        if (elements.length === 0) {
                          unusedRules.push(rule.selectorText);
                        }
                      } catch (e) {
                        // Invalid selector, ignore
                      }
                    }
                  });
                } catch (e) {
                  // CORS or other error, ignore
                }
              });

              return unusedRules;
            });

            if (unusedCss.length > 0) {
              assetData.css.forEach((css) => {
                css.optimization.suggestions.push(`Found ${unusedCss.length} potentially unused CSS selectors`);
              });
            }
          }

          // Calculate potential savings
          let potentialSavings = 0;
          assetData.images.forEach((image) => {
            if (image.optimization.suggestions.length > 0) {
              potentialSavings += image.size * 0.3; // Estimate 30% savings for images
            }
          });
          assetData.css.forEach((css) => {
            if (css.optimization.suggestions.length > 0) {
              potentialSavings += css.size * 0.2; // Estimate 20% savings for CSS
            }
          });
          assetData.javascript.forEach((js) => {
            if (js.optimization.suggestions.length > 0) {
              potentialSavings += js.size * 0.25; // Estimate 25% savings for JS
            }
          });
          assetData.summary.potentialSavings = potentialSavings;

          // Format the asset optimization report
          const report = [
            `# Asset Optimization Report for ${url}`,
            `Generated at: ${assetData.timestamp}`,
            "",
            "## Summary",
            `- Total Requests: ${assetData.summary.totalRequests}`,
            `- Total Size: ${formatBytes(assetData.summary.totalSize)}`,
            `- Potential Savings: ${formatBytes(assetData.summary.potentialSavings)}`,
            "",
            "## Images",
            assetData.images.length > 0
              ? assetData.images
                  .map((image) =>
                    [
                      `### ${new URL(image.url).pathname.split("/").pop()}`,
                      `- Size: ${formatBytes(image.size)}`,
                      `- Type: ${image.type}`,
                      image.dimensions
                        ? [
                            `- Dimensions: ${image.dimensions.naturalWidth}x${image.dimensions.naturalHeight}`,
                            `- Display Size: ${image.dimensions.displayWidth}x${image.dimensions.displayHeight}`,
                            `- Loading: ${image.dimensions.loading}`,
                          ].join("\n")
                        : "",
                      "#### Optimization Suggestions",
                      image.optimization.suggestions.length > 0 ? image.optimization.suggestions.map((s) => `- ${s}`).join("\n") : "- No optimization suggestions",
                    ].join("\n")
                  )
                  .join("\n\n")
              : "No images found",
            "",
            "## Fonts",
            assetData.fonts.length > 0
              ? assetData.fonts
                  .map((font) =>
                    [
                      `### ${new URL(font.url).pathname.split("/").pop()}`,
                      `- Size: ${formatBytes(font.size)}`,
                      `- Format: ${font.format}`,
                      "#### Optimization Suggestions",
                      font.optimization.suggestions.length > 0 ? font.optimization.suggestions.map((s) => `- ${s}`).join("\n") : "- No optimization suggestions",
                    ].join("\n")
                  )
                  .join("\n\n")
              : "No fonts found",
            "",
            "## CSS",
            assetData.css.length > 0
              ? assetData.css
                  .map((css) =>
                    [
                      `### ${new URL(css.url).pathname.split("/").pop()}`,
                      `- Size: ${formatBytes(css.size)}`,
                      `- Compressed: ${css.optimization.compressed ? "Yes" : "No"}`,
                      "#### Optimization Suggestions",
                      css.optimization.suggestions.length > 0 ? css.optimization.suggestions.map((s) => `- ${s}`).join("\n") : "- No optimization suggestions",
                    ].join("\n")
                  )
                  .join("\n\n")
              : "No CSS files found",
            "",
            "## JavaScript",
            assetData.javascript.length > 0
              ? assetData.javascript
                  .map((js) =>
                    [
                      `### ${new URL(js.url).pathname.split("/").pop()}`,
                      `- Size: ${formatBytes(js.size)}`,
                      `- Compressed: ${js.optimization.compressed ? "Yes" : "No"}`,
                      "#### Optimization Suggestions",
                      js.optimization.suggestions.length > 0 ? js.optimization.suggestions.map((s) => `- ${s}`).join("\n") : "- No optimization suggestions",
                    ].join("\n")
                  )
                  .join("\n\n")
              : "No JavaScript files found",
          ].join("\n");

          return {
            content: [
              {
                type: "text",
                text: report,
              },
            ],
          };
        } finally {
          await browser.close();
        }
      } catch (error) {
        const errorDetails = {
          error: "Asset analysis failed",
          details: error.message,
          recommendation: "Please try again with different settings",
          retryable: true,
          url: url,
          errorType: error.name,
          suggestedSettings: {
            checkImages: error.message.includes("images") ? false : checkImages,
            checkFonts: error.message.includes("fonts") ? false : checkFonts,
            checkCss: error.message.includes("css") ? false : checkCss,
            checkJs: error.message.includes("javascript") ? false : checkJs,
          },
        };

        logError("assets", "Asset analysis failed", error, errorDetails);

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

// Helper function to analyze CSS optimization opportunities
function analyzeCssOptimization(content) {
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

// Helper function to check if an image is likely above the fold
function isAboveTheFold(dimensions) {
  return dimensions.displayHeight < 1000; // Assume 1000px as fold threshold
}

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
