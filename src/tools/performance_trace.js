import { logInfo, logError } from "../utils/logging.js";
import { BROWSER_HEADERS } from "../config/constants.js";
import { checkSiteAvailability } from "../utils/html.js";
import { fetchWithRetry } from "../utils/fetch.js";
import { analyzeTraceData } from "./performance_analysis/index.js";
import fs from "fs";
import path from "path";

/**
 * Perform a detailed performance analysis similar to Chrome DevTools Performance panel
 * @param {Object} args - Arguments for the performance trace
 * @param {string} args.url - The URL to analyze
 * @param {number} args.timeoutMs - Timeout in milliseconds
 * @param {boolean} args.captureCPUProfile - Whether to capture CPU profile
 * @param {boolean} args.captureNetworkActivity - Whether to capture network activity
 * @param {boolean} args.captureJSProfile - Whether to capture JavaScript profile
 * @param {boolean} args.captureRenderingPerformance - Whether to capture rendering performance
 * @param {boolean} args.captureMemoryProfile - Whether to capture memory profile
 * @param {boolean} args.useProxy - Whether to use a proxy for this request
 * @param {boolean} args.ignoreSSLErrors - Whether to ignore SSL errors
 * @param {Object} args.deviceConfig - Device configuration for emulation
 * @returns {Promise<Object>} Performance analysis results
 */
export async function performanceTrace(args) {
  const {
    url,
    timeoutMs = 15000,
    captureCPUProfile = true,
    captureNetworkActivity = true,
    captureJSProfile = true,
    captureRenderingPerformance = true,
    captureMemoryProfile = false,
    useProxy = false,
    ignoreSSLErrors = false,
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
  let browser;

  try {
    // Dynamically import puppeteer
    try {
      puppeteer = await import("puppeteer");
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Performance trace functionality not available",
                details: "Puppeteer is not installed",
                recommendation: "Please install Puppeteer to use performance trace functionality",
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

    logInfo("performance_trace", "Starting performance trace", { url, deviceConfig });

    // Launch browser with appropriate settings
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", useProxy ? `--proxy-server=${process.env.PROXY_URL || ""}` : "", "--ignore-certificate-errors"].filter(Boolean),
      ignoreHTTPSErrors: ignoreSSLErrors,
    });

    const page = await browser.newPage();

    // Set HTTP headers
    await page.setExtraHTTPHeaders(BROWSER_HEADERS);

    // Set viewport based on device config
    await page.setViewport({
      width: deviceConfig.width,
      height: deviceConfig.height,
      deviceScaleFactor: deviceConfig.deviceScaleFactor,
      isMobile: deviceConfig.isMobile,
      hasTouch: deviceConfig.hasTouch,
      isLandscape: deviceConfig.isLandscape,
    });

    // Set custom user agent if provided
    if (deviceConfig.userAgent) {
      await page.setUserAgent(deviceConfig.userAgent);
    }

    // Enable CDP domains
    const client = await page.target().createCDPSession();
    await client.send("Network.enable");
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Performance.enable");

    // Start tracing with specific categories
    let tracingEnabled = false;
    try {
      const categories = [];
      if (captureCPUProfile) categories.push("v8");
      if (captureNetworkActivity) categories.push("network");
      if (captureJSProfile) categories.push("disabled-by-default-v8.cpu_profiler");
      if (captureRenderingPerformance) categories.push("disabled-by-default-devtools.timeline");
      if (captureMemoryProfile) categories.push("disabled-by-default-memory-infra");

      // Always include base categories
      categories.push("loading", "devtools.timeline");

      // Check if tracing is supported in this version of Puppeteer
      await client.send("Tracing.getCategories").catch(() => {
        throw new Error("Tracing API not available in this version of Puppeteer");
      });

      await client.send("Tracing.start", {
        categories: categories.join(","),
        options: "sampling-frequency=10000",
      });
      tracingEnabled = true;
      logInfo("performance_trace", "Tracing started successfully", { url });
    } catch (tracingError) {
      logError("performance_trace", "Failed to start tracing", tracingError, { url });
      // Continue without tracing - we'll still collect other performance metrics
    }

    // Navigate to the page with timeout
    try {
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: timeoutMs,
      });
    } catch (navError) {
      // Handle navigation timeout or other navigation errors
      logError("performance_trace", "Navigation failed", navError, { url });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Navigation failed",
                details: navError.message,
                recommendation: "Try increasing the timeout or check if the site is responsive",
                retryable: true,
                url,
                errorType: navError.name,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Wait for a moment to capture post-load activity using standard setTimeout
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Stop tracing if it was successfully started
    let traceData = null;
    if (tracingEnabled) {
      try {
        const traceResult = await client.send("Tracing.stop");
        traceData = traceResult.value;
        logInfo("performance_trace", "Tracing stopped successfully", { url });
      } catch (traceError) {
        logError("performance_trace", "Failed to stop tracing", traceError, { url });
        // Continue without trace data - we'll still return other performance metrics
      }
    }

    // Get performance metrics with error handling
    let performanceMetrics;
    try {
      const metrics = await page.metrics();
      performanceMetrics = await page.evaluate(() => {
        try {
          const timing = performance.timing || {};
          return {
            loadTime: timing.loadEventEnd - timing.navigationStart,
            domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
            firstPaint: performance.getEntriesByType ? performance.getEntriesByType("paint")[0]?.startTime : null,
            firstContentfulPaint: performance.getEntriesByType ? performance.getEntriesByType("paint")[1]?.startTime : null,
            largestContentfulPaint: performance.getEntriesByType ? performance.getEntriesByType("largest-contentful-paint")[0]?.startTime : null,
            firstInputDelay: performance.getEntriesByType ? performance.getEntriesByType("first-input")[0]?.duration : null,
            cumulativeLayoutShift: performance.getEntriesByType ? performance.getEntriesByType("layout-shift").reduce((sum, entry) => sum + entry.value, 0) : null,
          };
        } catch (e) {
          return {
            error: e.message,
            loadTime: null,
            domContentLoaded: null,
            firstPaint: null,
            firstContentfulPaint: null,
            largestContentfulPaint: null,
            firstInputDelay: null,
            cumulativeLayoutShift: null,
          };
        }
      });
    } catch (metricsError) {
      logError("performance_trace", "Failed to collect performance metrics", metricsError, { url });
      performanceMetrics = { error: metricsError.message };
    }

    // Get network information with error handling
    let networkInfo;
    try {
      networkInfo = await page.evaluate(() => {
        try {
          const resources = performance.getEntriesByType ? performance.getEntriesByType("resource") : [];
          return resources.map((resource) => ({
            name: resource.name,
            type: resource.initiatorType,
            duration: resource.duration,
            size: resource.transferSize,
            startTime: resource.startTime,
          }));
        } catch (e) {
          return { error: e.message };
        }
      });
    } catch (networkError) {
      logError("performance_trace", "Failed to collect network information", networkError, { url });
      networkInfo = { error: networkError.message };
    }

    // Get JavaScript profile if enabled
    let jsProfile = null;
    if (captureJSProfile) {
      try {
        await client.send("Profiler.enable");
        await client.send("Profiler.start");
        await new Promise((resolve) => setTimeout(resolve, 500));
        const { profile } = await client.send("Profiler.stop");
        jsProfile = profile;
      } catch (profileError) {
        logError("performance_trace", "Failed to collect JS profile", profileError, { url });
        jsProfile = { error: profileError.message };
      }
    }

    // Get memory usage if enabled
    let memoryUsage = null;
    if (captureMemoryProfile) {
      try {
        const { jsHeapSizeLimit, totalJSHeapSize, usedJSHeapSize } = await client.send("Runtime.getHeapUsage");
        memoryUsage = {
          jsHeapSizeLimit,
          totalJSHeapSize,
          usedJSHeapSize,
        };
      } catch (memoryError) {
        logError("performance_trace", "Failed to collect memory usage", memoryError, { url });
        memoryUsage = { error: memoryError.message };
      }
    }

    // Analyze trace data for bottlenecks if available
    const bottlenecks = traceData
      ? analyzeTraceData(traceData, {
          // Analysis module controls
          analyzeLayoutThrashing: args.analyzeLayoutThrashing !== false,
          analyzeCssVariables: args.analyzeCssVariables !== false,
          analyzeJsExecution: args.analyzeJsExecution !== false,
          analyzeLongTasks: args.analyzeLongTasks !== false,
          analyzeMemoryAndDom: args.analyzeMemoryAndDom !== false,
          analyzeResourceLoading: args.analyzeResourceLoading !== false,

          // Threshold controls
          longTaskThresholdMs: args.longTaskThresholdMs || 50,
          layoutThrashingThreshold: args.layoutThrashingThreshold || 10,
          memoryLeakThresholdKb: args.memoryLeakThresholdKb || 10,

          // Output controls
          detailLevel: args.detailLevel || "detailed",
          includeRecommendations: args.includeRecommendations !== false,

          // Focus controls
          focusSelector: args.focusSelector,
          focusTimeRangeMs: args.focusTimeRangeMs,
        })
      : [];

    // If tracing failed but we have other metrics, add a note about it
    if (!traceData && (performanceMetrics || networkInfo)) {
      bottlenecks.push({
        type: "tracing_unavailable",
        description: "Performance tracing was not available or failed",
        details: "Using alternative performance metrics instead",
      });
    }

    logInfo("performance_trace", "Performance trace completed successfully", { url });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              performanceMetrics,
              networkInfo,
              jsProfile,
              memoryUsage,
              bottlenecks,
              deviceConfig: {
                ...deviceConfig,
                userAgent: await page.evaluate(() => navigator.userAgent).catch(() => deviceConfig.userAgent),
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    logError("performance_trace", "Performance trace failed", error, { url });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Performance trace failed",
              details: error.message,
              recommendation: error.message.includes("net::ERR_PROXY_CONNECTION_FAILED") ? "Proxy connection failed. Please try without proxy" : "Please try again with different settings",
              retryable: true,
              url,
              useProxy: error.message.includes("net::ERR_PROXY_CONNECTION_FAILED") ? false : useProxy,
              errorType: error.name,
            },
            null,
            2
          ),
        },
      ],
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        logError("performance_trace", "Failed to close browser", closeError, { url });
      }
    }
  }
}
