/**
 * Network Monitor Tool
 * Analyzes network activity and resource loading performance
 */

import { logInfo, logError } from "../../../utils/logging.js";
import { BROWSER_HEADERS } from "../../../config/constants.js";
import { checkSiteAvailability } from "../../../utils/html.js";
import { fetchWithRetry } from "../../../utils/fetch.js";
import { getDeviceConfig } from "../../../config/devices.js";
import { getNetworkCondition } from "../../../config/network_conditions.js";
import { configureCdpSession } from "../../../utils/cdp_helpers.js";

/**
 * Run network monitor analysis on a webpage
 * @param {Object} args - The tool arguments
 * @returns {Promise<Object>} Network analysis results
 */
export async function runNetworkMonitor(args) {
  const {
    url,
    timeoutMs = 15000,
    waitAfterLoadMs = 2000,
    useProxy = false,
    ignoreSSLErrors = false,
    networkConditionName,
    networkCondition,
    deviceName,
    deviceConfig: deviceConfigArg,
    includeThirdParty = true,
    disableCache = true,
    captureHeaders = true,
    captureContent = false,
    captureTimings = true,
    filterByType,
    filterByDomain,
    sortBy = "startTime",
    // New parameters for optimization
    maxRequests = 100,
    summarizeOnly = false,
    page = 1,
    pageSize = 20,
    includeRecommendations = true,
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
                error: "Network monitor functionality not available",
                details: "Puppeteer is not installed",
                recommendation: "Please install Puppeteer to use network monitor functionality",
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

    // Get device configuration
    const deviceConfig = getDeviceConfig({ deviceName, deviceConfig: deviceConfigArg });

    // Get network condition if specified
    const networkConditionConfig = getNetworkCondition({ networkConditionName, networkCondition });

    logInfo("network_monitor", "Starting network monitor", {
      url,
      deviceConfig: deviceConfig.name,
      networkCondition: networkConditionConfig.name,
    });

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

    // Create CDP session
    const client = await page.target().createCDPSession();

    // Configure CDP session with network conditions and other settings
    await configureCdpSession(client, {
      networkCondition: networkConditionConfig,
    });

    // Enable network monitoring
    await client.send("Network.enable");

    // Disable cache if requested
    if (disableCache) {
      await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    }

    // Collect network requests
    const requests = new Map();
    const responses = new Map();
    const timings = new Map();
    const errors = new Map();

    // Listen for request events
    client.on("Network.requestWillBeSent", (event) => {
      const { requestId, request, timestamp, wallTime, initiator, redirectResponse } = event;

      // Handle redirects
      if (redirectResponse) {
        const redirectResponseObj = {
          url: redirectResponse.url,
          status: redirectResponse.status,
          statusText: redirectResponse.statusText,
          headers: redirectResponse.headers,
          fromCache: redirectResponse.fromCache,
          timing: redirectResponse.timing,
        };

        responses.set(requestId + ":redirect", redirectResponseObj);
      }

      requests.set(requestId, {
        url: request.url,
        method: request.method,
        headers: captureHeaders ? request.headers : undefined,
        postData: request.postData,
        timestamp,
        wallTime,
        initiator,
      });

      // Initialize timing data
      timings.set(requestId, {
        startTime: timestamp,
        endTime: null,
        dnsStart: null,
        dnsEnd: null,
        connectStart: null,
        connectEnd: null,
        sslStart: null,
        sslEnd: null,
        sendStart: null,
        sendEnd: null,
        receiveStart: null,
        receiveEnd: null,
      });
    });

    // Listen for response events
    client.on("Network.responseReceived", (event) => {
      const { requestId, response, timestamp } = event;

      responses.set(requestId, {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        headers: captureHeaders ? response.headers : undefined,
        mimeType: response.mimeType,
        fromCache: response.fromCache,
        fromServiceWorker: response.fromServiceWorker,
        timing: response.timing,
        timestamp,
      });

      // Update timing data
      if (response.timing && captureTimings) {
        const timing = timings.get(requestId);
        if (timing) {
          timing.dnsStart = response.timing.dnsStart;
          timing.dnsEnd = response.timing.dnsEnd;
          timing.connectStart = response.timing.connectStart;
          timing.connectEnd = response.timing.connectEnd;
          timing.sslStart = response.timing.sslStart;
          timing.sslEnd = response.timing.sslEnd;
          timing.sendStart = response.timing.sendStart;
          timing.sendEnd = response.timing.sendEnd;
          timing.receiveStart = response.timing.receiveHeadersEnd;
        }
      }
    });

    // Listen for data received events
    client.on("Network.dataReceived", (event) => {
      const { requestId, timestamp, dataLength, encodedDataLength } = event;

      const response = responses.get(requestId);
      if (response) {
        response.dataLength = (response.dataLength || 0) + dataLength;
        response.encodedDataLength = (response.encodedDataLength || 0) + encodedDataLength;
      }

      // Update timing data
      const timing = timings.get(requestId);
      if (timing && captureTimings) {
        timing.receiveEnd = timestamp;
      }
    });

    // Listen for loading finished events
    client.on("Network.loadingFinished", (event) => {
      const { requestId, timestamp, encodedDataLength } = event;

      const response = responses.get(requestId);
      if (response) {
        response.encodedDataLength = encodedDataLength;
      }

      // Update timing data
      const timing = timings.get(requestId);
      if (timing && captureTimings) {
        timing.endTime = timestamp;
      }
    });

    // Listen for loading failed events
    client.on("Network.loadingFailed", (event) => {
      const { requestId, timestamp, errorText, canceled, blockedReason } = event;

      errors.set(requestId, {
        errorText,
        canceled,
        blockedReason,
        timestamp,
      });

      // Update timing data
      const timing = timings.get(requestId);
      if (timing && captureTimings) {
        timing.endTime = timestamp;
      }
    });

    // Navigate to the page with timeout
    try {
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: timeoutMs,
      });
    } catch (navError) {
      // Handle navigation timeout or other navigation errors
      logError("network_monitor", "Navigation failed", navError, { url });
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

    // Wait for a moment to capture post-load activity
    await new Promise((resolve) => setTimeout(resolve, waitAfterLoadMs));

    // Process collected data
    const networkData = [];

    for (const [requestId, request] of requests.entries()) {
      const response = responses.get(requestId);
      const timing = timings.get(requestId);
      const error = errors.get(requestId);

      // Skip third-party requests if not included
      if (!includeThirdParty) {
        const requestUrl = new URL(request.url);
        const pageUrl = new URL(url);

        if (requestUrl.hostname !== pageUrl.hostname) {
          continue;
        }
      }

      // Apply domain filter if specified
      if (filterByDomain) {
        const requestUrl = new URL(request.url);

        if (!requestUrl.hostname.includes(filterByDomain)) {
          continue;
        }
      }

      // Determine resource type
      let resourceType = "other";

      if (response) {
        const mimeType = response.mimeType || "";

        if (mimeType.includes("text/html")) {
          resourceType = "document";
        } else if (mimeType.includes("text/css")) {
          resourceType = "stylesheet";
        } else if (mimeType.includes("application/javascript") || mimeType.includes("text/javascript")) {
          resourceType = "script";
        } else if (mimeType.includes("image/")) {
          resourceType = "image";
        } else if (mimeType.includes("font/") || mimeType.includes("application/font")) {
          resourceType = "font";
        } else if (mimeType.includes("audio/") || mimeType.includes("video/")) {
          resourceType = "media";
        } else if (mimeType.includes("application/json")) {
          resourceType = "json";
        } else if (mimeType.includes("text/plain")) {
          resourceType = "text";
        }
      }

      // Apply type filter if specified
      if (filterByType && resourceType !== filterByType) {
        continue;
      }

      // Calculate timing metrics
      let duration = 0;
      let ttfb = 0;
      let dnsTime = 0;
      let connectTime = 0;
      let sslTime = 0;
      let sendTime = 0;
      let waitTime = 0;
      let receiveTime = 0;

      if (timing) {
        if (timing.endTime && timing.startTime) {
          duration = (timing.endTime - timing.startTime) * 1000; // Convert to ms
        }

        if (response && response.timing) {
          ttfb = response.timing.receiveHeadersEnd;

          if (response.timing.dnsEnd > 0 && response.timing.dnsStart >= 0) {
            dnsTime = response.timing.dnsEnd - response.timing.dnsStart;
          }

          if (response.timing.connectEnd > 0 && response.timing.connectStart >= 0) {
            connectTime = response.timing.connectEnd - response.timing.connectStart;
          }

          if (response.timing.sslEnd > 0 && response.timing.sslStart >= 0) {
            sslTime = response.timing.sslEnd - response.timing.sslStart;
          }

          if (response.timing.sendEnd > 0 && response.timing.sendStart >= 0) {
            sendTime = response.timing.sendEnd - response.timing.sendStart;
          }

          waitTime = response.timing.receiveHeadersEnd - response.timing.sendEnd;

          if (timing.receiveEnd && response.timing.receiveHeadersEnd) {
            receiveTime = (timing.receiveEnd - timing.startTime) * 1000 - response.timing.receiveHeadersEnd;
          }
        }
      }

      // Create network entry
      const entry = {
        url: request.url,
        method: request.method,
        resourceType,
        status: response ? response.status : 0,
        statusText: response ? response.statusText : "",
        mimeType: response ? response.mimeType : "",
        size: response ? response.encodedDataLength || 0 : 0,
        transferSize: response ? response.encodedDataLength || 0 : 0,
        uncompressedSize: response ? response.dataLength || 0 : 0,
        timing: {
          startTime: timing ? timing.startTime : 0,
          endTime: timing ? timing.endTime : 0,
          duration,
          ttfb,
          dns: dnsTime,
          connect: connectTime,
          ssl: sslTime,
          send: sendTime,
          wait: waitTime,
          receive: receiveTime,
        },
        fromCache: response ? response.fromCache : false,
        fromServiceWorker: response ? response.fromServiceWorker : false,
        initiator: request.initiator,
        error: error
          ? {
              text: error.errorText,
              canceled: error.canceled,
              blockedReason: error.blockedReason,
            }
          : null,
      };

      // Add headers if requested
      if (captureHeaders) {
        entry.requestHeaders = request.headers;
        entry.responseHeaders = response ? response.headers : null;
      }

      networkData.push(entry);
    }

    // Sort network data
    networkData.sort((a, b) => {
      switch (sortBy) {
        case "startTime":
          return a.timing.startTime - b.timing.startTime;
        case "duration":
          return b.timing.duration - a.timing.duration;
        case "size":
          return b.size - a.size;
        case "type":
          return a.resourceType.localeCompare(b.resourceType);
        default:
          return a.timing.startTime - b.timing.startTime;
      }
    });

    // Calculate summary statistics
    const summary = {
      totalRequests: networkData.length,
      totalSize: networkData.reduce((sum, entry) => sum + entry.size, 0),
      totalDuration: Math.max(...networkData.map((entry) => entry.timing.endTime || 0)) - Math.min(...networkData.map((entry) => entry.timing.startTime || 0)),
      resourceCounts: {},
      statusCounts: {},
      slowestRequests: [...networkData]
        .sort((a, b) => b.timing.duration - a.timing.duration)
        .slice(0, 5)
        .map(simplifyRequestEntry),
      largestRequests: [...networkData]
        .sort((a, b) => b.size - a.size)
        .slice(0, 5)
        .map(simplifyRequestEntry),
      domainStats: {},
    };

    // Count resources by type
    for (const entry of networkData) {
      summary.resourceCounts[entry.resourceType] = (summary.resourceCounts[entry.resourceType] || 0) + 1;
      summary.statusCounts[entry.status] = (summary.statusCounts[entry.status] || 0) + 1;

      // Calculate domain stats
      try {
        const domain = new URL(entry.url).hostname;

        if (!summary.domainStats[domain]) {
          summary.domainStats[domain] = {
            requests: 0,
            size: 0,
          };
        }

        summary.domainStats[domain].requests++;
        summary.domainStats[domain].size += entry.size;
      } catch (e) {
        // Skip invalid URLs
      }
    }

    // Generate optimization recommendations if requested
    const recommendations = includeRecommendations ? generateOptimizationRecommendations(networkData, summary) : [];

    // Calculate pagination
    const totalPages = Math.ceil(networkData.length / pageSize);
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, networkData.length);

    // Get paginated requests or limit by maxRequests
    let paginatedRequests = [];
    if (!summarizeOnly) {
      if (page && pageSize) {
        paginatedRequests = networkData.slice(startIndex, endIndex).map(simplifyRequestEntry);
      } else {
        paginatedRequests = networkData.slice(0, maxRequests).map(simplifyRequestEntry);
      }
    }

    // Create pagination metadata
    const pagination = {
      totalItems: networkData.length,
      itemsPerPage: pageSize,
      currentPage,
      totalPages,
    };

    logInfo("network_monitor", "Network monitor completed successfully", { url });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              url,
              deviceConfig: {
                name: deviceConfig.name,
                width: deviceConfig.width,
                height: deviceConfig.height,
                userAgent: deviceConfig.userAgent,
              },
              networkCondition: {
                name: networkConditionConfig.name,
                description: networkConditionConfig.description,
              },
              summary,
              recommendations,
              pagination,
              requests: paginatedRequests,
              // Include a note about data optimization
              note: summarizeOnly
                ? "Detailed request data was omitted to optimize response size. Use summarizeOnly=false to include request data."
                : paginatedRequests.length < networkData.length
                ? `Showing ${paginatedRequests.length} of ${networkData.length} requests. Use page and pageSize parameters to navigate through all requests.`
                : undefined,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    logError("network_monitor", "Network monitor failed", error, { url });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Network monitor failed",
              details: error.message,
              recommendation: "Please try again with different settings",
              retryable: true,
              url,
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
        logError("network_monitor", "Failed to close browser", closeError, { url });
      }
    }
  }
}

/**
 * Simplify a request entry to reduce response size
 * @param {Object} entry - The request entry
 * @returns {Object} Simplified request entry
 */
function simplifyRequestEntry(entry) {
  // Create a simplified version of the entry with only essential information
  return {
    url: entry.url,
    method: entry.method,
    resourceType: entry.resourceType,
    status: entry.status,
    size: entry.size,
    timing: {
      duration: entry.timing.duration,
      ttfb: entry.timing.ttfb,
    },
    fromCache: entry.fromCache,
  };
}

/**
 * Generate optimization recommendations based on network data
 * @param {Array} networkData - Network request data
 * @param {Object} summary - Summary statistics
 * @returns {Array} Optimization recommendations
 */
function generateOptimizationRecommendations(networkData, summary) {
  const recommendations = [];

  // Check for large images
  const largeImages = networkData.filter((entry) => entry.resourceType === "image" && entry.size > 100000);

  if (largeImages.length > 0) {
    recommendations.push({
      type: "large_images",
      title: "Optimize large images",
      description: `Found ${largeImages.length} large images (>100KB) that could be optimized`,
      impact: "high",
      items: largeImages.slice(0, 5).map((img) => ({
        url: img.url,
        size: img.size,
        transferSize: img.transferSize,
      })),
      suggestions: ["Use WebP or AVIF formats for better compression", "Resize images to appropriate dimensions", "Implement lazy loading for images below the fold", "Consider using responsive images with srcset"],
    });
  }

  // Check for render-blocking resources
  const renderBlockingResources = networkData.filter((entry) => (entry.resourceType === "stylesheet" || entry.resourceType === "script") && entry.timing.startTime < 1 && entry.timing.duration > 200);

  if (renderBlockingResources.length > 0) {
    recommendations.push({
      type: "render_blocking",
      title: "Minimize render-blocking resources",
      description: `Found ${renderBlockingResources.length} render-blocking resources that delay page rendering`,
      impact: "high",
      items: renderBlockingResources.slice(0, 5).map((res) => ({
        url: res.url,
        type: res.resourceType,
        duration: res.timing.duration,
      })),
      suggestions: ["Use async or defer attributes for non-critical scripts", "Inline critical CSS and defer non-critical CSS", "Prioritize loading of critical resources", "Consider using resource hints like preload, preconnect"],
    });
  }

  // Check for slow TTFB
  const slowTtfbRequests = networkData.filter((entry) => entry.timing.ttfb > 600);

  if (slowTtfbRequests.length > 0) {
    recommendations.push({
      type: "slow_ttfb",
      title: "Improve Time to First Byte",
      description: `Found ${slowTtfbRequests.length} requests with slow TTFB (>600ms)`,
      impact: "medium",
      items: slowTtfbRequests.slice(0, 5).map((req) => ({
        url: req.url,
        ttfb: req.timing.ttfb,
      })),
      suggestions: ["Optimize server response time", "Implement caching strategies", "Use a CDN to reduce network latency", "Optimize database queries"],
    });
  }

  // Check for uncompressed resources
  const uncompressedResources = networkData.filter((entry) => (entry.resourceType === "stylesheet" || entry.resourceType === "script" || entry.resourceType === "document") && entry.size > 10000 && entry.size === entry.uncompressedSize);

  if (uncompressedResources.length > 0) {
    recommendations.push({
      type: "uncompressed_resources",
      title: "Enable compression for resources",
      description: `Found ${uncompressedResources.length} uncompressed resources that could benefit from compression`,
      impact: "medium",
      items: uncompressedResources.slice(0, 5).map((res) => ({
        url: res.url,
        type: res.resourceType,
        size: res.size,
      })),
      suggestions: ["Enable Gzip or Brotli compression on the server", "Verify that compression is correctly configured for all content types", "Check for proper Content-Encoding headers"],
    });
  }

  // Check for excessive third-party requests
  const domains = Object.keys(summary.domainStats);
  const thirdPartyDomains = domains.filter((domain) => {
    try {
      const requestUrl = new URL(networkData[0].url);
      return domain !== requestUrl.hostname;
    } catch (e) {
      return true;
    }
  });

  if (thirdPartyDomains.length > 5) {
    const thirdPartyStats = thirdPartyDomains
      .map((domain) => ({
        domain,
        requests: summary.domainStats[domain].requests,
        size: summary.domainStats[domain].size,
      }))
      .sort((a, b) => b.requests - a.requests);

    recommendations.push({
      type: "third_party",
      title: "Reduce third-party impact",
      description: `Found ${thirdPartyDomains.length} third-party domains with ${thirdPartyDomains.reduce((sum, domain) => sum + summary.domainStats[domain].requests, 0)} requests`,
      impact: "medium",
      items: thirdPartyStats.slice(0, 5),
      suggestions: ["Audit and remove unnecessary third-party scripts", "Load third-party resources asynchronously", "Use resource hints like dns-prefetch and preconnect", "Consider self-hosting critical third-party resources"],
    });
  }

  // Check for HTTP/1.1 vs HTTP/2
  const http1Requests = networkData.filter((entry) => entry.responseHeaders && entry.responseHeaders["version"] === "HTTP/1.1");

  if (http1Requests.length > 10) {
    recommendations.push({
      type: "http_version",
      title: "Upgrade to HTTP/2",
      description: `Found ${http1Requests.length} requests using HTTP/1.1 instead of HTTP/2`,
      impact: "medium",
      suggestions: ["Upgrade your server to support HTTP/2", "Ensure proper SSL/TLS configuration", "Consider HTTP/2 Server Push for critical resources"],
    });
  }

  // Check for cache optimization
  const uncachedResources = networkData.filter(
    (entry) =>
      !entry.fromCache &&
      (entry.resourceType === "stylesheet" || entry.resourceType === "script" || entry.resourceType === "image" || entry.resourceType === "font") &&
      (!entry.responseHeaders || (!entry.responseHeaders["cache-control"] && !entry.responseHeaders["Cache-Control"]))
  );

  if (uncachedResources.length > 0) {
    recommendations.push({
      type: "caching",
      title: "Implement proper caching",
      description: `Found ${uncachedResources.length} resources without proper cache headers`,
      impact: "medium",
      items: uncachedResources.slice(0, 5).map((res) => ({
        url: res.url,
        type: res.resourceType,
      })),
      suggestions: ["Set appropriate Cache-Control headers", "Use versioned URLs for cache busting", "Implement an efficient cache strategy", "Consider using a service worker for offline caching"],
    });
  }

  return recommendations;
}
