/**
 * Web Vitals Analyzer Tool
 * Uses Performance Observer API to analyze Core Web Vitals metrics
 */

import { logInfo, logError } from "../../../utils/logging.js";
import { BROWSER_HEADERS } from "../../../config/constants.js";
import { checkSiteAvailability } from "../../../utils/html.js";
import { fetchWithRetry } from "../../../utils/fetch.js";
import { getDeviceConfig } from "../../../config/devices.js";
import { getNetworkCondition } from "../../../config/network_conditions.js";
import { enableRequiredDomains, setupPerformanceObserver, getWebVitals, configureCdpSession } from "../../../utils/cdp_helpers.js";
import { analyzeWebVitalsData } from "./core_vitals.js";
import { identifyProblematicElements } from "./elements.js";

/**
 * Run Web Vitals analysis on a webpage
 * @param {Object} args - The tool arguments
 * @returns {Promise<Object>} Web Vitals analysis results
 */
export async function runWebVitalsAnalysis(args) {
  const {
    url,
    timeoutMs = 15000,
    waitAfterLoadMs = 3000,
    interactWithPage = true,
    useProxy = false,
    ignoreSSLErrors = false,
    networkConditionName,
    networkCondition,
    deviceName,
    deviceConfig: deviceConfigArg,
    runMultipleTimes = false,
    numberOfRuns = 3,
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
                error: "Web Vitals analysis functionality not available",
                details: "Puppeteer is not installed",
                recommendation: "Please install Puppeteer to use Web Vitals analysis functionality",
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

    logInfo("web_vitals", "Starting Web Vitals analysis", {
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

    // If running multiple times, collect multiple samples
    const samples = [];
    const runsCount = runMultipleTimes ? numberOfRuns : 1;

    for (let run = 0; run < runsCount; run++) {
      if (runMultipleTimes) {
        logInfo("web_vitals", `Starting run ${run + 1} of ${runsCount}`, { url });
      }

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

      // Set up performance observer to capture web vitals
      await setupPerformanceObserver(page);

      // Navigate to the page with timeout
      try {
        await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: timeoutMs,
        });
      } catch (navError) {
        // Handle navigation timeout or other navigation errors
        logError("web_vitals", "Navigation failed", navError, { url });
        await page.close();
        continue; // Try next run if multiple runs
      }

      // Interact with the page if requested to trigger more events
      if (interactWithPage) {
        await autoInteractWithPage(page);
      }

      // Wait for a moment to capture post-load activity
      await new Promise((resolve) => setTimeout(resolve, waitAfterLoadMs));

      // Get web vitals data
      const webVitalsData = await getWebVitals(page);

      if (webVitalsData) {
        samples.push(webVitalsData);
      }

      // Close the page
      await page.close();
    }

    // If no samples were collected, return an error
    if (samples.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Web Vitals analysis failed",
                details: "No Web Vitals data could be collected",
                recommendation: "Try increasing the timeout or check if the site supports Performance Observer API",
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

    // Analyze the collected web vitals data
    const webVitalsAnalysis = analyzeWebVitalsData(samples);

    // Identify problematic elements
    const problematicElements = identifyProblematicElements(samples);

    // Prepare the final results
    const results = {
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
      webVitals: webVitalsAnalysis,
      problematicElements,
      samples: runMultipleTimes ? samples : undefined, // Include raw samples only if multiple runs
      recommendations: generateRecommendations(webVitalsAnalysis, problematicElements),
    };

    logInfo("web_vitals", "Web Vitals analysis completed successfully", { url });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  } catch (error) {
    logError("web_vitals", "Web Vitals analysis failed", error, { url });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Web Vitals analysis failed",
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
        logError("web_vitals", "Failed to close browser", closeError, { url });
      }
    }
  }
}

/**
 * Automatically interact with the page to trigger more events
 * @param {Object} page - Puppeteer page
 * @returns {Promise<void>}
 */
async function autoInteractWithPage(page) {
  try {
    // Scroll down the page in increments
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const scrollSteps = Math.ceil(pageHeight / viewportHeight);

    for (let i = 1; i <= scrollSteps; i++) {
      await page.evaluate(
        (step, vh) => {
          window.scrollTo(0, step * vh);
        },
        i,
        viewportHeight
      );
      await page.waitForTimeout(100);
    }

    // Scroll back to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    // Try to click on some interactive elements
    const clickableElements = await page.$$('button, a, [role="button"], .btn, input[type="submit"]');

    // Limit to first 3 elements to avoid too much interaction
    const elementsToClick = clickableElements.slice(0, 3);

    for (const element of elementsToClick) {
      try {
        // Check if element is visible
        const isVisible = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
        }, element);

        if (isVisible) {
          await element.click({ delay: 100 }).catch(() => {});
          await page.waitForTimeout(300);
        }
      } catch (error) {
        // Ignore errors from clicking
      }
    }

    // Wait a bit for any triggered events to complete
    await page.waitForTimeout(500);
  } catch (error) {
    // Ignore errors from auto-interaction
    logInfo("web_vitals", "Auto-interaction with page completed with some errors", { error: error.message });
  }
}

/**
 * Generate recommendations based on Web Vitals analysis
 * @param {Object} webVitalsAnalysis - Web Vitals analysis data
 * @param {Object} problematicElements - Problematic elements data
 * @returns {Array} Recommendations
 */
function generateRecommendations(webVitalsAnalysis, problematicElements) {
  const recommendations = [];

  // LCP recommendations
  if (webVitalsAnalysis.lcp && webVitalsAnalysis.lcp.value > 2500) {
    recommendations.push({
      type: "lcp_optimization",
      title: "Optimize Largest Contentful Paint",
      description: `LCP is ${webVitalsAnalysis.lcp.value.toFixed(0)}ms, which is ${webVitalsAnalysis.lcp.rating}. Consider optimizing the largest element on your page.`,
      impact: "high",
      element: problematicElements.lcp,
      suggestions: [
        "Optimize and preload critical resources",
        "Implement server-side rendering or static generation",
        "Use a content delivery network (CDN)",
        "Optimize images with WebP format and proper sizing",
        "Minimize render-blocking resources",
      ],
    });
  }

  // CLS recommendations
  if (webVitalsAnalysis.cls && webVitalsAnalysis.cls.value > 0.1) {
    recommendations.push({
      type: "cls_optimization",
      title: "Reduce Cumulative Layout Shift",
      description: `CLS is ${webVitalsAnalysis.cls.value.toFixed(3)}, which is ${webVitalsAnalysis.cls.rating}. Address layout shifts to improve user experience.`,
      impact: "high",
      elements: problematicElements.cls.slice(0, 3), // Top 3 shifting elements
      suggestions: [
        "Set explicit width and height for images and videos",
        "Avoid inserting content above existing content",
        "Use transform animations instead of animations that trigger layout changes",
        "Reserve space for dynamic content like ads",
        "Precompute sufficient space for web fonts",
      ],
    });
  }

  // FID/INP recommendations
  if ((webVitalsAnalysis.fid && webVitalsAnalysis.fid.value > 100) || (webVitalsAnalysis.inp && webVitalsAnalysis.inp.value > 200)) {
    recommendations.push({
      type: "interactivity_optimization",
      title: "Improve Interactivity",
      description: `${webVitalsAnalysis.inp ? "INP" : "FID"} is ${(webVitalsAnalysis.inp || webVitalsAnalysis.fid).value.toFixed(0)}ms, which is ${
        (webVitalsAnalysis.inp || webVitalsAnalysis.fid).rating
      }. Optimize JavaScript execution to improve interactivity.`,
      impact: "high",
      element: problematicElements.inp,
      suggestions: [
        "Break up long tasks into smaller, asynchronous tasks",
        "Optimize event handlers and reduce their complexity",
        "Defer non-critical JavaScript",
        "Use a web worker for heavy computations",
        "Implement code-splitting and lazy loading",
      ],
    });
  }

  // TTFB recommendations
  if (webVitalsAnalysis.ttfb && webVitalsAnalysis.ttfb.value > 800) {
    recommendations.push({
      type: "ttfb_optimization",
      title: "Improve Time to First Byte",
      description: `TTFB is ${webVitalsAnalysis.ttfb.value.toFixed(0)}ms, which is ${webVitalsAnalysis.ttfb.rating}. Optimize server response time.`,
      impact: "high",
      suggestions: ["Optimize server processing time", "Implement caching strategies", "Use a CDN to reduce network latency", "Optimize database queries", "Consider serverless architectures for faster cold starts"],
    });
  }

  // General recommendations if no specific issues found
  if (recommendations.length === 0) {
    recommendations.push({
      type: "general_optimization",
      title: "Maintain Good Performance",
      description: "Your page has good Core Web Vitals scores. Continue monitoring and optimizing as your site evolves.",
      impact: "low",
      suggestions: ["Implement performance budgets", "Set up continuous performance monitoring", "Optimize images and fonts", "Minimize third-party impact", "Keep dependencies updated"],
    });
  }

  return recommendations;
}
