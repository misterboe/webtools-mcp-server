import { logInfo, logError } from "../utils/logging.js";
import { BROWSER_HEADERS } from "../config/constants.js";
import { checkSiteAvailability } from "../utils/html.js";
import { fetchWithRetry } from "../utils/fetch.js";

/**
 * Take a screenshot of a webpage or specific element
 * @param {Object} args - The tool arguments
 * @returns {Object} The tool response
 */
export async function screenshot(args) {
  const { url, selector, useProxy = false, deviceConfig } = args;
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
                error: "Screenshot functionality not available",
                details: "Puppeteer is not installed",
                recommendation: "Please install Puppeteer to use screenshot functionality",
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

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", useProxy ? `--proxy-server=${process.env.PROXY_URL || ""}` : "", "--ignore-certificate-errors"].filter(Boolean),
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
      url,
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
}
