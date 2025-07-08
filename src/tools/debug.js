import { logInfo, logError } from "../utils/logging.js";
import { BROWSER_HEADERS } from "../config/constants.js";
import { checkSiteAvailability } from "../utils/html.js";
import { fetchWithRetry } from "../utils/fetch.js";

/**
 * Debug a webpage by capturing console output, network requests, errors, and layout thrashing with advanced response size management
 * @param {Object} args - The tool arguments
 * @param {string} args.url - The URL to debug
 * @param {boolean} [args.captureConsole=true] - Whether to capture console output
 * @param {boolean} [args.captureNetwork=true] - Whether to capture network requests
 * @param {boolean} [args.captureErrors=true] - Whether to capture JavaScript errors
 * @param {boolean} [args.captureLayoutThrashing=false] - Whether to capture layout thrashing events
 * @param {number} [args.timeoutMs=15000] - Timeout in milliseconds
 * @param {boolean} [args.useProxy=false] - Whether to use a proxy
 * @param {boolean} [args.ignoreSSLErrors=false] - Whether to ignore SSL errors
 * @param {number} [args.maxConsoleEvents=20] - Maximum number of console events to include
 * @param {number} [args.maxNetworkEvents=30] - Maximum number of network events to include
 * @param {number} [args.maxErrorEvents=10] - Maximum number of error events to include
 * @param {number} [args.maxResourceEvents=15] - Maximum number of resource timing events to include
 * @param {boolean} [args.skipStackTraces=false] - Skip stack traces in layout thrashing events
 * @param {boolean} [args.compactFormat=false] - Use compact format for all sections
 * @param {boolean} [args.summarizeOnly=false] - Include only summary without detailed event data
 * @param {number} [args.page=1] - Page number for paginated results (starts at 1)
 * @param {number} [args.pageSize=20] - Number of events per page for paginated results
 * @param {Object} [args.deviceConfig] - Device configuration for emulation
 * @param {number} [args.deviceConfig.width=1920] - Viewport width in pixels
 * @param {number} [args.deviceConfig.height=1080] - Viewport height in pixels
 * @param {number} [args.deviceConfig.deviceScaleFactor=1] - Device scale factor (e.g., 2 for retina displays)
 * @param {boolean} [args.deviceConfig.isMobile=false] - Whether to emulate a mobile device
 * @param {boolean} [args.deviceConfig.hasTouch=false] - Whether to enable touch events
 * @param {boolean} [args.deviceConfig.isLandscape=false] - Whether to use landscape orientation
 * @param {string} [args.deviceConfig.userAgent] - Custom user agent string
 * @returns {Object} The tool response with managed response size
 */
export async function debug(args) {
  const {
    url,
    captureConsole = true,
    captureNetwork = true,
    captureErrors = true,
    captureLayoutThrashing = false,
    timeoutMs = 15000,
    useProxy = false,
    ignoreSSLErrors = false,
    // Output control parameters
    maxConsoleEvents = 20,
    maxNetworkEvents = 30,
    maxErrorEvents = 10,
    maxResourceEvents = 15,
    skipStackTraces = false,
    compactFormat = false,
    summarizeOnly = false,
    // Pagination parameters
    page: pageNumber = 1,
    pageSize = 20,
    deviceConfig = {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: false,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  } = args;
  let puppeteer;

  try {
    // Check if puppeteer is available
    try {
      puppeteer = await import("puppeteer");
    } catch (e) {
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
                url,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Check site availability first
    const availability = await checkSiteAvailability(url, { ignoreSSLErrors }, fetchWithRetry);
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

    const debugData = {
      url,
      timestamp: new Date().toISOString(),
      device: {
        config: deviceConfig,
      },
      console: [],
      network: [],
      errors: [],
      layoutThrashing: [],
      performance: null,
    };

    // Launch browser with increased timeout and better error handling
    const browser = await puppeteer
      .launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", useProxy ? `--proxy-server=${process.env.PROXY_URL || ""}` : "", ignoreSSLErrors ? "--ignore-certificate-errors" : ""].filter(Boolean),
        timeout: timeoutMs * 1.5, // Increase browser launch timeout
      })
      .catch((error) => {
        logError("debug", "Browser launch failed", error);
        throw new Error(`Browser launch failed: ${error.message}`);
      });

    try {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders(BROWSER_HEADERS);

      // Set device configuration
      await page.setViewport({
        width: deviceConfig.width,
        height: deviceConfig.height,
        deviceScaleFactor: deviceConfig.deviceScaleFactor,
        isMobile: deviceConfig.isMobile,
        hasTouch: deviceConfig.hasTouch,
        isLandscape: deviceConfig.isLandscape,
      });
      await page.setUserAgent(deviceConfig.userAgent);

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
          performance.clearMarks();
          performance.clearMeasures();
          performance.mark("debug-start");
        } catch (e) {
          console.warn("Performance API not fully supported:", e.message);
        }
      });

      // Enable CDP session for layout thrashing detection if requested
      let client;
      if (captureLayoutThrashing) {
        const target = page.target();
        client = await target.createCDPSession();
        await client.send("DOM.enable");
        await client.send("CSS.enable");

        // Track layout operations that might cause thrashing
        client.on("DOM.documentUpdated", () => {
          debugData.layoutThrashing.push({
            type: "DOM.documentUpdated",
            timestamp: new Date().toISOString(),
            message: "Document was updated, potentially forcing layout recalculation",
          });
        });

        client.on("CSS.styleSheetAdded", () => {
          debugData.layoutThrashing.push({
            type: "CSS.styleSheetAdded",
            timestamp: new Date().toISOString(),
            message: "Style sheet was added, potentially forcing layout recalculation",
          });
        });
      }

      // Inject layout thrashing detection script if requested
      if (captureLayoutThrashing) {
        await page.evaluateOnNewDocument(() => {
          // Override methods that force layout/reflow
          const forcedLayoutMethods = ["offsetTop", "offsetLeft", "offsetWidth", "offsetHeight", "clientTop", "clientLeft", "clientWidth", "clientHeight", "getComputedStyle", "getBoundingClientRect", "scrollTop", "scrollLeft"];

          // Track layout thrashing events
          window.__layoutThrashingEvents = [];

          // Create proxies for Element prototype methods that force layout
          forcedLayoutMethods.forEach((method) => {
            if (method === "getComputedStyle") {
              const original = window.getComputedStyle;
              window.getComputedStyle = function () {
                window.__layoutThrashingEvents.push({
                  method: "getComputedStyle",
                  timestamp: new Date().toISOString(),
                  trace: new Error().stack,
                });
                return original.apply(this, arguments);
              };
            } else if (Element.prototype[method] !== undefined) {
              const originalGetter = Object.getOwnPropertyDescriptor(Element.prototype, method).get;
              if (originalGetter) {
                Object.defineProperty(Element.prototype, method, {
                  get: function () {
                    window.__layoutThrashingEvents.push({
                      method: method,
                      timestamp: new Date().toISOString(),
                      trace: new Error().stack,
                    });
                    return originalGetter.apply(this);
                  },
                });
              }
            }
          });
        });
      }

      // Navigate to the page with improved error handling
      try {
        await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: timeoutMs,
        });
      } catch (navigationError) {
        // If navigation timeout occurs, continue with partial data
        debugData.errors.push({
          type: "navigation",
          message: navigationError.message,
          timestamp: new Date().toISOString(),
        });

        logError("debug", "Navigation error but continuing with partial data", navigationError);
        // Don't throw here, continue with partial data collection
      }

      // Wait for specified timeout with progress logging
      const waitStartTime = Date.now();
      logInfo("debug", "Starting data collection wait period", { timeoutMs });

      // Use a more robust wait mechanism with periodic checks
      await new Promise((resolve) => {
        const checkInterval = Math.min(2000, timeoutMs / 5); // Check at most every 2 seconds
        const intervalId = setInterval(() => {
          const elapsedTime = Date.now() - waitStartTime;
          if (elapsedTime >= timeoutMs) {
            clearInterval(intervalId);
            resolve();
          } else {
            logInfo("debug", "Data collection in progress", {
              elapsedMs: elapsedTime,
              remainingMs: timeoutMs - elapsedTime,
            });
          }
        }, checkInterval);

        // Also set a timeout as a fallback
        setTimeout(() => {
          clearInterval(intervalId);
          resolve();
        }, timeoutMs);
      });

      // Collect layout thrashing data if requested
      if (captureLayoutThrashing) {
        const layoutThrashingEvents = await page
          .evaluate(() => {
            return window.__layoutThrashingEvents || [];
          })
          .catch((error) => {
            logError("debug", "Failed to collect layout thrashing data", error);
            return [];
          });

        debugData.layoutThrashing = [...debugData.layoutThrashing, ...layoutThrashingEvents];
      }

      // Collect performance metrics with better error handling
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

      // Helper function to paginate data
      function paginateData(data, currentPage, currentPageSize) {
        const totalPages = Math.ceil(data.length / currentPageSize);
        const validPage = Math.min(Math.max(1, currentPage), totalPages);
        const startIndex = (validPage - 1) * currentPageSize;
        const endIndex = Math.min(startIndex + currentPageSize, data.length);
        
        return {
          data: data.slice(startIndex, endIndex),
          pagination: {
            totalItems: data.length,
            itemsPerPage: currentPageSize,
            currentPage: validPage,
            totalPages: totalPages,
            hasNextPage: validPage < totalPages,
            hasPreviousPage: validPage > 1,
          }
        };
      }

      // Apply pagination or limits based on parameters
      const usePagination = pageNumber > 1 || pageSize !== 20; // Use pagination if non-default values
      
      let consoleData, networkData, errorData, resourceData;
      let consolePagination, networkPagination, errorPagination, resourcePagination;

      if (usePagination) {
        // Use pagination for all sections
        const consolePaginated = paginateData(debugData.console, pageNumber, pageSize);
        const networkPaginated = paginateData(debugData.network, pageNumber, pageSize);
        const errorPaginated = paginateData(debugData.errors, pageNumber, pageSize);
        const resourcePaginated = paginateData(debugData.performance.resources || [], pageNumber, pageSize);
        
        consoleData = consolePaginated.data;
        networkData = networkPaginated.data;
        errorData = errorPaginated.data;
        resourceData = resourcePaginated.data;
        
        consolePagination = consolePaginated.pagination;
        networkPagination = networkPaginated.pagination;
        errorPagination = errorPaginated.pagination;
        resourcePagination = resourcePaginated.pagination;
      } else {
        // Use max limits (existing behavior)
        consoleData = debugData.console.slice(0, maxConsoleEvents);
        networkData = debugData.network.slice(0, maxNetworkEvents);
        errorData = debugData.errors.slice(0, maxErrorEvents);
        resourceData = (debugData.performance.resources || []).slice(0, maxResourceEvents);
      }

      // Format the debug data into a readable markdown report
      const report = summarizeOnly ? [
        `# Debug Summary for ${url}`,
        `Generated at: ${debugData.timestamp}`,
        "",
        "## Summary",
        `- Console Events: ${debugData.console.length}`,
        `- Network Events: ${debugData.network.length}`,
        `- Error Events: ${debugData.errors.length}`,
        `- Layout Thrashing Events: ${debugData.layoutThrashing.length}`,
        `- Resource Events: ${debugData.performance.resources ? debugData.performance.resources.length : 0}`,
        "",
        "## Quick Stats",
        `- Page Load Time: ${debugData.performance.navigation ? debugData.performance.navigation.loadEventEnd : 'N/A'}ms`,
        `- DOM Interactive: ${debugData.performance.navigation ? debugData.performance.navigation.domInteractive : 'N/A'}ms`,
        "",
        "**Note**: Use summarizeOnly=false to see detailed event data.",
      ] : [
        `# Debug Report for ${url}`,
        `Generated at: ${debugData.timestamp}`,
        "",
        "## Device Configuration",
        `- Profile: ${JSON.stringify(deviceConfig)}`,
        "",
        "## Console Output",
        consoleData.length > 0 ? [
          consoleData.map((log) => {
            const logText = compactFormat ? 
              `${log.type.toUpperCase()}: ${log.text}` : 
              `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.text}`;
            return `- ${logText}`;
          }).join("\n"),
          usePagination && consolePagination ? 
            `\n**Console Pagination**: Page ${consolePagination.currentPage} of ${consolePagination.totalPages} (${consolePagination.totalItems} total events)` :
            (debugData.console.length > maxConsoleEvents ? 
              `\n... and ${debugData.console.length - maxConsoleEvents} more console events (use maxConsoleEvents parameter to show more)` : "")
        ].filter(Boolean).join("") : "- No console output captured",
        "",
        "## Network Activity",
        networkData.length > 0 ? [
          networkData.map((n) => {
            const networkText = compactFormat ? 
              `${n.method || n.status} ${n.url.split('/').pop() || n.url}` : 
              `[${n.timestamp}] ${n.type.toUpperCase()} ${n.method || n.status} ${n.url}`;
            return `- ${networkText}`;
          }).join("\n"),
          usePagination && networkPagination ? 
            `\n**Network Pagination**: Page ${networkPagination.currentPage} of ${networkPagination.totalPages} (${networkPagination.totalItems} total events)` :
            (debugData.network.length > maxNetworkEvents ? 
              `\n... and ${debugData.network.length - maxNetworkEvents} more network events (use maxNetworkEvents parameter to show more)` : "")
        ].filter(Boolean).join("") : "- No network activity captured",
        "",
        "## Errors",
        errorData.length > 0 ? [
          errorData.map((err) => {
            const errorText = compactFormat ? 
              `### ${err.type} Error\n\`\`\`\n${err.message}\n\`\`\`` : 
              `### ${err.type} Error at ${err.timestamp}\n\`\`\`\n${err.message}\n${err.stack || ""}\n\`\`\``;
            return errorText;
          }).join("\n"),
          usePagination && errorPagination ? 
            `\n**Error Pagination**: Page ${errorPagination.currentPage} of ${errorPagination.totalPages} (${errorPagination.totalItems} total events)` :
            (debugData.errors.length > maxErrorEvents ? 
              `\n... and ${debugData.errors.length - maxErrorEvents} more error events (use maxErrorEvents parameter to show more)` : "")
        ].filter(Boolean).join("") : "- No errors captured",
        "",
        captureLayoutThrashing
          ? [
              "## Layout Thrashing Detection",
              debugData.layoutThrashing.length > 0
                ? [
                    `Detected ${debugData.layoutThrashing.length} potential layout thrashing events:`,
                    "",
                    debugData.layoutThrashing
                      .map((event, index) => {
                        if (index < 20) {
                          // Limit to first 20 events to avoid overwhelming output
                          return `### Event ${index + 1}: ${event.method || event.type}\n- Time: ${event.timestamp}\n${event.trace && !skipStackTraces ? `- Stack Trace:\n\`\`\`\n${event.trace}\n\`\`\`` : ""}${
                            event.message ? `\n- Message: ${event.message}` : ""
                          }`;
                        } else if (index === 20) {
                          return `\n... and ${debugData.layoutThrashing.length - 20} more events (omitted for brevity)`;
                        }
                        return "";
                      })
                      .filter(Boolean)
                      .join("\n\n"),
                    "",
                    "### Layout Thrashing Recommendations",
                    "- Batch DOM reads and writes to avoid forcing layout recalculation",
                    "- Use requestAnimationFrame for DOM manipulations",
                    "- Consider using CSS transforms instead of properties that trigger layout",
                    "- Cache layout values instead of repeatedly querying them",
                  ].join("\n")
                : "No layout thrashing events detected",
              "",
            ].join("\n")
          : "",
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
              resourceData.length > 0 ? [
                resourceData.map((r) => {
                  const resourceText = compactFormat ? 
                    `- ${r.name.split('/').pop()}: ${r.duration}ms` : 
                    `- ${r.name}: ${r.duration}ms (${(r.transferSize / 1024).toFixed(2)}KB)`;
                  return resourceText;
                }).join("\n"),
                usePagination && resourcePagination ? 
                  `\n**Resource Pagination**: Page ${resourcePagination.currentPage} of ${resourcePagination.totalPages} (${resourcePagination.totalItems} total resources)` :
                  ((debugData.performance.resources || []).length > maxResourceEvents ? 
                    `\n... and ${(debugData.performance.resources || []).length - maxResourceEvents} more resources (use maxResourceEvents parameter to show more)` : "")
              ].filter(Boolean).join("") : "- No resource timing data available",
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
      recommendation: error.message.includes("net::ERR_PROXY_CONNECTION_FAILED") ? "Proxy connection failed. Please try without proxy" : "Please try again with different settings",
      retryable: true,
      url,
      useProxy: error.message.includes("net::ERR_PROXY_CONNECTION_FAILED") ? false : !useProxy,
      errorType: error.name,
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
}
