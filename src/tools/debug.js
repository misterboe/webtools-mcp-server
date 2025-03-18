import { logInfo, logError } from "../utils/logging.js";
import { BROWSER_HEADERS } from "../config/constants.js";
import { checkSiteAvailability } from "../utils/html.js";
import { fetchWithRetry } from "../utils/fetch.js";

/**
 * Debug a webpage by capturing console output, network requests, and errors
 * @param {Object} args - The tool arguments
 * @returns {Object} The tool response
 */
export async function debug(args) {
  const { url, captureConsole = true, captureNetwork = true, captureErrors = true, timeoutMs = 10000, useProxy = false, ignoreSSLErrors = false } = args;
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
      console: [],
      network: [],
      errors: [],
      performance: null,
    };

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", useProxy ? `--proxy-server=${process.env.PROXY_URL || ""}` : "", "--ignore-certificate-errors"].filter(Boolean),
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
      url,
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
}
