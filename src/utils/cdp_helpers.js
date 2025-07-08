/**
 * Chrome DevTools Protocol (CDP) helper functions
 * Provides utilities for working with CDP sessions in Puppeteer
 */

import { logInfo, logError } from "./logging.js";
import { applyNetworkConditions } from "../config/network_conditions.js";

/**
 * Enable required CDP domains for performance analysis
 * @param {Object} client - CDP client session or Puppeteer page
 * @returns {Promise<void>}
 */
export async function enableRequiredDomains(client) {
  if (!client) {
    throw new Error("CDP client is required");
  }

  try {
    // Improved checking and creation of CDP session
    let cdpClient;

    // Check if we have a Page object or a CDP session
    if (client.target && typeof client.target === "function") {
      // It's a Page object, create CDP session
      try {
        cdpClient = await client.target().createCDPSession();
      } catch (e) {
        // Try fallback method if the first one fails
        try {
          cdpClient = await client._client;
        } catch (innerError) {
          logError("cdp", "Failed to create CDP session with primary and fallback methods", {
            primaryError: e.message,
            fallbackError: innerError.message,
          });
          throw new Error(`Failed to create CDP session: ${e.message}. Fallback also failed: ${innerError.message}`);
        }
      }
    } else if (client.send && typeof client.send === "function") {
      // It's already a CDP session
      cdpClient = client;
    } else {
      throw new Error("Invalid client object: neither a Page nor a CDP session");
    }

    // Ensure the send method exists
    if (!cdpClient || typeof cdpClient.send !== "function") {
      throw new Error("Invalid CDP client object - 'send' method not available");
    }

    // Enable domains with retry attempts
    const enableDomain = async (domain) => {
      let retries = 3;
      while (retries > 0) {
        try {
          await cdpClient.send(`${domain}.enable`);
          return;
        } catch (error) {
          retries--;
          if (retries === 0) {
            logError("cdp", `Failed to enable ${domain} domain after multiple attempts`, error);
            throw error;
          }
          // Short pause before next attempt
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    };

    // Enable domains with retry attempts
    await enableDomain("Network");
    await enableDomain("Page");
    await enableDomain("Runtime");
    await enableDomain("Performance");

    logInfo("cdp", "Enabled required CDP domains");
    return cdpClient; // Return valid session for chaining
  } catch (error) {
    logError("cdp", "Failed to enable required CDP domains", error);
    throw error;
  }
}

/**
 * Start performance tracing with specified categories
 * @param {Object} client - CDP client session
 * @param {Object} options - Tracing options
 * @param {boolean} options.captureCPUProfile - Whether to capture CPU profile
 * @param {boolean} options.captureNetworkActivity - Whether to capture network activity
 * @param {boolean} options.captureJSProfile - Whether to capture JavaScript profile
 * @param {boolean} options.captureRenderingPerformance - Whether to capture rendering performance
 * @param {boolean} options.captureMemoryProfile - Whether to capture memory profile
 * @returns {Promise<boolean>} Whether tracing was successfully started
 */
export async function startPerformanceTracing(client, options = {}) {
  if (!client) {
    throw new Error("CDP client is required");
  }

  const { captureCPUProfile = true, captureNetworkActivity = true, captureJSProfile = true, captureRenderingPerformance = true, captureMemoryProfile = false } = options;

  try {
    // Build categories list based on options
    const categories = [];

    if (captureCPUProfile) categories.push("v8");
    if (captureNetworkActivity) categories.push("network");
    if (captureJSProfile) categories.push("disabled-by-default-v8.cpu_profiler");
    if (captureRenderingPerformance) categories.push("disabled-by-default-devtools.timeline");
    if (captureMemoryProfile) categories.push("disabled-by-default-memory-infra");

    // Always include base categories
    categories.push("loading", "devtools.timeline");

    // Check if tracing is supported
    await client.send("Tracing.getCategories").catch(() => {
      throw new Error("Tracing API not available in this version of Puppeteer");
    });

    // Start tracing
    await client.send("Tracing.start", {
      categories: categories.join(","),
      options: "sampling-frequency=10000",
    });

    logInfo("cdp", "Performance tracing started successfully", { categories });
    return true;
  } catch (error) {
    logError("cdp", "Failed to start performance tracing", error);
    return false;
  }
}

/**
 * Stop performance tracing and get trace data
 * @param {Object} client - CDP client session
 * @returns {Promise<Object|null>} Trace data or null if tracing failed
 */
export async function stopPerformanceTracing(client) {
  if (!client) {
    throw new Error("CDP client is required");
  }

  try {
    const traceResult = await client.send("Tracing.stop");
    logInfo("cdp", "Performance tracing stopped successfully");
    return traceResult.value;
  } catch (error) {
    logError("cdp", "Failed to stop performance tracing", error);
    return null;
  }
}

/**
 * Start JavaScript profiling
 * @param {Object} client - CDP client session
 * @returns {Promise<boolean>} Whether profiling was successfully started
 */
export async function startJSProfiling(client) {
  if (!client) {
    throw new Error("CDP client is required");
  }

  try {
    await client.send("Profiler.enable");
    await client.send("Profiler.start");
    logInfo("cdp", "JavaScript profiling started successfully");
    return true;
  } catch (error) {
    logError("cdp", "Failed to start JavaScript profiling", error);
    return false;
  }
}

/**
 * Stop JavaScript profiling and get profile data
 * @param {Object} client - CDP client session
 * @returns {Promise<Object|null>} Profile data or null if profiling failed
 */
export async function stopJSProfiling(client) {
  if (!client) {
    throw new Error("CDP client is required");
  }

  try {
    const { profile } = await client.send("Profiler.stop");
    logInfo("cdp", "JavaScript profiling stopped successfully");
    return profile;
  } catch (error) {
    logError("cdp", "Failed to stop JavaScript profiling", error);
    return null;
  }
}

/**
 * Get heap usage statistics
 * @param {Object} client - CDP client session
 * @returns {Promise<Object|null>} Heap usage data or null if failed
 */
export async function getHeapUsage(client) {
  if (!client) {
    throw new Error("CDP client is required");
  }

  try {
    const { jsHeapSizeLimit, totalJSHeapSize, usedJSHeapSize } = await client.send("Runtime.getHeapUsage");
    return {
      jsHeapSizeLimit,
      totalJSHeapSize,
      usedJSHeapSize,
      usedPercentage: (usedJSHeapSize / jsHeapSizeLimit) * 100,
    };
  } catch (error) {
    logError("cdp", "Failed to get heap usage", error);
    return null;
  }
}

/**
 * Enable coverage collection for JavaScript and CSS
 * @param {Object} client - CDP client session
 * @returns {Promise<boolean>} Whether coverage collection was successfully enabled
 */
export async function startCoverageCollection(client) {
  if (!client) {
    throw new Error("CDP client is required");
  }

  try {
    // Enable Profiler and CSS domains
    await client.send("Profiler.enable");
    await client.send("CSS.enable");

    // Start JS coverage
    await client.send("Profiler.startPreciseCoverage", {
      callCount: true,
      detailed: true,
    });

    // Start CSS coverage
    await client.send("CSS.startRuleUsageTracking");

    logInfo("cdp", "Coverage collection started successfully");
    return true;
  } catch (error) {
    logError("cdp", "Failed to start coverage collection", error);
    return false;
  }
}

/**
 * Stop coverage collection and get coverage data
 * @param {Object} client - CDP client session
 * @returns {Promise<Object|null>} Coverage data or null if collection failed
 */
export async function stopCoverageCollection(client) {
  if (!client) {
    throw new Error("CDP client is required");
  }

  try {
    // Get JS coverage
    const jsCoverage = await client.send("Profiler.takePreciseCoverage");
    await client.send("Profiler.stopPreciseCoverage");

    // Get CSS coverage
    const cssCoverage = await client.send("CSS.stopRuleUsageTracking");

    logInfo("cdp", "Coverage collection stopped successfully");

    return {
      jsCoverage: jsCoverage.result,
      cssCoverage: cssCoverage.ruleUsage,
    };
  } catch (error) {
    logError("cdp", "Failed to stop coverage collection", error);
    return null;
  }
}

/**
 * Set up performance observer to capture web vitals
 * @param {Object} page - Puppeteer page
 * @returns {Promise<boolean>} Whether setup was successful
 */
export async function setupPerformanceObserver(page) {
  if (!page) {
    throw new Error("Puppeteer page is required");
  }

  try {
    // Inject performance observer script
    await page.evaluate(() => {
      window.__webVitals = {
        lcp: null,
        cls: 0,
        fid: null,
        inp: null,
        ttfb: null,
        elements: {
          lcp: null,
          cls: [],
          inp: null,
        },
      };

      // LCP observer
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        window.__webVitals.lcp = lastEntry.startTime;

        // Try to get the element
        if (lastEntry.element) {
          window.__webVitals.elements.lcp = {
            tagName: lastEntry.element.tagName,
            id: lastEntry.element.id,
            className: lastEntry.element.className,
            path: getElementPath(lastEntry.element),
            src: lastEntry.element.src || lastEntry.element.currentSrc || null,
          };
        }
      });

      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

      // CLS observer
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__webVitals.cls += entry.value;

            // Record elements that shifted
            if (entry.sources) {
              for (const source of entry.sources) {
                if (source.node) {
                  window.__webVitals.elements.cls.push({
                    tagName: source.node.tagName,
                    id: source.node.id,
                    className: source.node.className,
                    path: getElementPath(source.node),
                    currentRect: source.currentRect,
                    previousRect: source.previousRect,
                  });
                }
              }
            }
          }
        }
      });

      clsObserver.observe({ type: "layout-shift", buffered: true });

      // FID observer
      const fidObserver = new PerformanceObserver((entryList) => {
        const entry = entryList.getEntries()[0];
        window.__webVitals.fid = entry.processingStart - entry.startTime;

        // Try to get the element
        if (entry.target) {
          window.__webVitals.elements.inp = {
            tagName: entry.target.tagName,
            id: entry.target.id,
            className: entry.target.className,
            path: getElementPath(entry.target),
            type: entry.name,
          };
        }
      });

      fidObserver.observe({ type: "first-input", buffered: true });

      // INP observer
      const inpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        let maxDuration = 0;

        for (const entry of entries) {
          const duration = entry.processingStart - entry.startTime;
          if (duration > maxDuration) {
            maxDuration = duration;
            window.__webVitals.inp = duration;

            // Try to get the element
            if (entry.target) {
              window.__webVitals.elements.inp = {
                tagName: entry.target.tagName,
                id: entry.target.id,
                className: entry.target.className,
                path: getElementPath(entry.target),
                type: entry.name,
              };
            }
          }
        }
      });

      inpObserver.observe({ type: "event", durationThreshold: 16, buffered: true });

      // TTFB
      const navigationEntries = performance.getEntriesByType("navigation");
      if (navigationEntries.length > 0) {
        window.__webVitals.ttfb = navigationEntries[0].responseStart;
      }

      // Helper function to get element path
      function getElementPath(element) {
        if (!element) return null;

        const path = [];
        let currentElement = element;

        while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
          let selector = currentElement.nodeName.toLowerCase();

          if (currentElement.id) {
            selector += "#" + currentElement.id;
            path.unshift(selector);
            break;
          } else {
            let sibling = currentElement;
            let siblingIndex = 1;

            while ((sibling = sibling.previousElementSibling)) {
              if (sibling.nodeName.toLowerCase() === selector) {
                siblingIndex++;
              }
            }

            if (siblingIndex > 1) {
              selector += ":nth-of-type(" + siblingIndex + ")";
            }
          }

          path.unshift(selector);
          currentElement = currentElement.parentNode;
        }

        return path.join(" > ");
      }
    });

    logInfo("cdp", "Performance observer setup successfully");
    return true;
  } catch (error) {
    logError("cdp", "Failed to set up performance observer", error);
    return false;
  }
}

/**
 * Get web vitals data from the page
 * @param {Object} page - Puppeteer page
 * @returns {Promise<Object|null>} Web vitals data or null if collection failed
 */
export async function getWebVitals(page) {
  if (!page) {
    throw new Error("Puppeteer page is required");
  }

  try {
    const webVitals = await page.evaluate(() => window.__webVitals);
    return webVitals || null;
  } catch (error) {
    logError("cdp", "Failed to get web vitals", error);
    return null;
  }
}

/**
 * Configure a CDP session with network conditions and other settings
 * @param {Object} client - CDP client session or Puppeteer page
 * @param {Object} options - Configuration options
 * @param {Object} options.networkCondition - Network condition to apply
 * @param {boolean} options.disableCache - Whether to disable browser cache
 * @param {boolean} options.blockImages - Whether to block image loading
 * @returns {Promise<Object>} - The CDP client used
 */
export async function configureCdpSession(client, options = {}) {
  if (!client) {
    throw new Error("CDP client is required");
  }

  try {
    // Use our improved enableRequiredDomains function to get a valid CDP client
    const cdpClient = await enableRequiredDomains(client);

    // Apply network conditions if provided
    if (options.networkCondition) {
      // Add retry logic for applying network conditions
      let retries = 3;
      while (retries > 0) {
        try {
          await applyNetworkConditions(cdpClient, options.networkCondition);
          logInfo("cdp", "Applied network conditions", { networkCondition: options.networkCondition.name });
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            logError("cdp", "Failed to apply network conditions after multiple attempts", error);
            // Continue without network conditions rather than failing completely
          }
          // Short pause before next attempt
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }

    // Disable cache if requested
    if (options.disableCache) {
      try {
        await cdpClient.send("Network.setCacheDisabled", { cacheDisabled: true });
        logInfo("cdp", "Browser cache disabled");
      } catch (error) {
        logError("cdp", "Failed to disable browser cache", error);
        // Continue without disabling cache rather than failing completely
      }
    }

    // Block images if requested
    if (options.blockImages) {
      try {
        await cdpClient.send("Network.setBlockedURLs", { urls: ["*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.svg"] });
        logInfo("cdp", "Image loading blocked");
      } catch (error) {
        logError("cdp", "Failed to block images", error);
        // Continue without blocking images rather than failing completely
      }
    }

    return cdpClient;
  } catch (error) {
    logError("cdp", "Failed to configure CDP session", error);
    throw error;
  }
}

/**
 * Parse trace events into a more usable format
 * @param {Array} events - Raw trace events
 * @returns {Object} Parsed trace data
 */
export function parseTraceEvents(events) {
  if (!events || !Array.isArray(events)) {
    return { error: "Invalid trace events" };
  }

  try {
    // Group events by categories
    const navigationEvents = events.filter((e) => e.name === "navigationStart" || e.name === "commitNavigationStart");
    const networkEvents = events.filter((e) => e.cat === "devtools.timeline" && e.name.startsWith("Resource"));
    const scriptEvents = events.filter((e) => e.cat === "devtools.timeline" && (e.name.includes("Script") || e.name.includes("Evaluate")));
    const layoutEvents = events.filter((e) => e.cat === "devtools.timeline" && (e.name.includes("Layout") || e.name.includes("Recalculate") || e.name.includes("Paint")));
    const gcEvents = events.filter((e) => e.name.includes("GC"));

    // Extract main thread events
    const mainThreadEvents = events.filter((e) => e.tid === events.find((e) => e.name === "navigationStart")?.tid);

    // Find long tasks (tasks that take more than 50ms)
    const longTasks = mainThreadEvents.filter(
      (e) =>
        e.dur &&
        e.dur > 50000 && // 50ms in microseconds
        (e.name.includes("Task") || e.name.includes("Function") || e.name.includes("Compile") || e.name.includes("Parse"))
    );

    return {
      navigationEvents,
      networkEvents,
      scriptEvents,
      layoutEvents,
      gcEvents,
      mainThreadEvents,
      longTasks,
      allEvents: events,
    };
  } catch (error) {
    logError("cdp", "Failed to parse trace events", error);
    return { error: error.message };
  }
}
