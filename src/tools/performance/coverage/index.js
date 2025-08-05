/**
 * Coverage Analysis Tool
 * Uses Chrome DevTools Protocol Coverage API to analyze unused JavaScript and CSS
 */

import { logInfo, logError } from "../../../utils/logging.js";
import { BROWSER_HEADERS } from "../../../config/constants.js";
import { checkSiteAvailability } from "../../../utils/html.js";
import { fetchWithRetry } from "../../../utils/fetch.js";
import { getDeviceConfig } from "../../../config/devices.js";
import { getNetworkCondition, applyNetworkConditions } from "../../../config/network_conditions.js";
import { enableRequiredDomains, startCoverageCollection, stopCoverageCollection, configureCdpSession } from "../../../utils/cdp_helpers.js";
import { analyzeJSCoverage } from "./js_analyzer.js";
import { analyzeCSSCoverage } from "./css_analyzer.js";

/**
 * Run coverage analysis on a webpage
 * @param {Object} args - The tool arguments
 * @returns {Promise<Object>} Coverage analysis results
 */
export async function runCoverageAnalysis(args) {
  const { url, timeoutMs = 15000, waitAfterLoadMs = 2000, includeThirdParty = true, useProxy = false, ignoreSSLErrors = false, disableCache = true, networkConditionName, networkCondition, deviceName, deviceConfig: deviceConfigArg } = args;

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
                error: "Coverage analysis functionality not available",
                details: "Puppeteer is not installed",
                recommendation: "Please install Puppeteer to use coverage analysis functionality",
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

    logInfo("coverage_analysis", "Starting coverage analysis", {
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
      disableCache,
    });

    // Start coverage collection
    const coverageStarted = await startCoverageCollection(client);
    if (!coverageStarted) {
      throw new Error("Failed to start coverage collection");
    }

    // Navigate to the page with timeout
    try {
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: timeoutMs,
      });
    } catch (navError) {
      // Handle navigation timeout or other navigation errors
      logError("coverage_analysis", "Navigation failed", navError, { url });
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

    // Interact with the page to trigger more JavaScript execution
    await autoInteractWithPage(page);

    // Stop coverage collection
    const coverageData = await stopCoverageCollection(client);
    if (!coverageData) {
      throw new Error("Failed to collect coverage data");
    }

    // Analyze JavaScript coverage
    const jsAnalysis = await analyzeJSCoverage(coverageData.jsCoverage, {
      url,
      includeThirdParty,
    });

    // Analyze CSS coverage
    const cssAnalysis = await analyzeCSSCoverage(coverageData.cssCoverage, {
      url,
      includeThirdParty,
    });

    // Get page resources for reference
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType("resource").map((resource) => ({
        name: resource.name,
        type: resource.initiatorType,
        size: resource.transferSize,
        duration: resource.duration,
      }));
    });

    // Prepare the final results
    const results = {
      url,
      deviceConfig: {
        name: deviceConfig.name,
        width: deviceConfig.width,
        height: deviceConfig.height,
        userAgent: await page.evaluate(() => navigator.userAgent),
      },
      networkCondition: {
        name: networkConditionConfig.name,
        description: networkConditionConfig.description,
      },
      summary: {
        totalJsBytes: jsAnalysis.totalBytes,
        unusedJsBytes: jsAnalysis.unusedBytes,
        unusedJsPercentage: jsAnalysis.unusedPercentage,
        totalCssBytes: cssAnalysis.totalBytes,
        unusedCssBytes: cssAnalysis.unusedBytes,
        unusedCssPercentage: cssAnalysis.unusedPercentage,
        potentialSavings: jsAnalysis.unusedBytes + cssAnalysis.unusedBytes,
      },
      javascript: {
        files: jsAnalysis.files,
        unusedByFile: jsAnalysis.unusedByFile,
        thirdPartyAnalysis: jsAnalysis.thirdPartyAnalysis,
        recommendations: jsAnalysis.recommendations,
      },
      css: {
        files: cssAnalysis.files,
        unusedByFile: cssAnalysis.unusedByFile,
        thirdPartyAnalysis: cssAnalysis.thirdPartyAnalysis,
        recommendations: cssAnalysis.recommendations,
      },
      resources,
    };

    logInfo("coverage_analysis", "Coverage analysis completed successfully", { url });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  } catch (error) {
    logError("coverage_analysis", "Coverage analysis failed", error, { url });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Coverage analysis failed",
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
        logError("coverage_analysis", "Failed to close browser", closeError, { url });
      }
    }
  }
}

/**
 * Automatically interact with the page to trigger more JavaScript execution
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

    // Limit to first 5 elements to avoid too much interaction
    const elementsToClick = clickableElements.slice(0, 5);

    for (const element of elementsToClick) {
      try {
        // Check if element is visible
        const isVisible = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
        }, element);

        if (isVisible) {
          await element.click({ delay: 100 }).catch(() => {});
          await page.waitForTimeout(200);
        }
      } catch (error) {
        // Ignore errors from clicking
      }
    }

    // Wait a bit for any triggered JavaScript to execute
    await page.waitForTimeout(500);
  } catch (error) {
    // Ignore errors from auto-interaction
    logInfo("coverage_analysis", "Auto-interaction with page completed with some errors", { error: error.message });
  }
}
