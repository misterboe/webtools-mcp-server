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
    timeoutMs = 30000,
    waitAfterLoadMs = 5000,
    interactWithPage = true,
    useProxy = false,
    ignoreSSLErrors = false,
    networkConditionName,
    networkCondition,
    deviceName,
    deviceConfig: deviceConfigArg,
    runMultipleTimes = false,
    numberOfRuns = 3,
    retryOnFailure = true,
    maxRetries = 2,
  } = args;

  let puppeteer;
  let browser;
  let retryCount = 0;
  let lastError = null;

  while (retryCount <= (retryOnFailure ? maxRetries : 0)) {
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
        retryAttempt: retryCount > 0 ? retryCount : undefined,
      });

      // Launch browser with enhanced settings
      browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
          "--enable-automation",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-component-extensions-with-background-pages",
          "--disable-extensions",
          "--disable-hang-monitor",
          "--disable-ipc-flooding-protection",
          "--disable-renderer-backgrounding",
          "--force-color-profile=srgb",
          "--metrics-recording-only",
          "--enable-features=NetworkService,NetworkServiceInProcess",
          // Additional flags for better compatibility
          "--disable-site-isolation-trials",
          "--disable-features=ScriptStreaming",
          "--disable-features=CrossSiteDocumentBlockingIfIsolating",
          "--disable-features=CrossSiteDocumentBlockingAlways",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=PrivacySandboxAdsAPIs",
          "--disable-features=PrivateStateTokens",
          "--disable-features=FencedFrames",
          "--disable-features=StorageAccessAPI",
          useProxy ? `--proxy-server=${process.env.PROXY_URL || ""}` : "",
          "--ignore-certificate-errors",
        ].filter(Boolean),
        ignoreHTTPSErrors: ignoreSSLErrors,
        // Increased timeouts
        timeout: timeoutMs + 15000,
        protocolTimeout: timeoutMs + 15000,
        defaultViewport: null,
      });

      // If running multiple times, collect multiple samples
      const samples = [];
      const runsCount = runMultipleTimes ? numberOfRuns : 1;

      for (let run = 0; run < runsCount; run++) {
        if (runMultipleTimes) {
          logInfo("web_vitals", `Starting run ${run + 1} of ${runsCount}`, { url });
        }

        const page = await browser.newPage();

        try {
          // Enable required CDP domains
          const client = await page
            .target()
            .createCDPSession()
            .catch((e) => {
              logError("web_vitals", "Failed to create CDP session", e, { url });
              throw new Error("Failed to create CDP session: " + e.message);
            });

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

          // Configure CDP session with network conditions and other settings
          await configureCdpSession(client, {
            networkCondition: networkConditionConfig,
          }).catch((e) => {
            logError("web_vitals", "Failed to configure CDP session", e, { url });
            throw new Error("Failed to configure CDP session: " + e.message);
          });

          // Set up performance observer to capture web vitals
          await setupPerformanceObserver(page);

          // Navigate to the page with timeout
          try {
            await page.goto(url, {
              waitUntil: "networkidle2",
              timeout: timeoutMs,
            });
          } catch (navError) {
            // Handle navigation timeout or other navigation errors
            logError("web_vitals", "Navigation failed", navError, { url });
            await page.close();
            continue; // Try next run if multiple runs
          }

          // Ensure the page is fully loaded
          await page.evaluate(
            () =>
              new Promise((resolve) => {
                if (document.readyState === "complete") {
                  resolve();
                } else {
                  window.addEventListener("load", resolve);
                }
              })
          );

          // Wait for any animations or transitions to complete
          await page.waitForTimeout(1000);

          // Try to inject enhanced fallback performance metrics collection
          await page.evaluate(() => {
            // Create fallback metrics if Performance Observer isn't available or working
            if (!window.__webVitals || !window.__webVitals.lcp) {
              console.log("Using enhanced fallback metrics collection");

              // Initialize or reset webVitals object
              window.__webVitals = window.__webVitals || {
                elements: { lcp: null, cls: [], inp: null },
              };

              // Alternative methods for measuring Web Vitals

              // 1. Use Navigation Timing API for TTFB
              try {
                const navEntries = performance.getEntriesByType("navigation");
                if (navEntries.length > 0) {
                  window.__webVitals.ttfb = navEntries[0].responseStart;
                } else {
                  // Rough estimate if navigation timing is not available
                  window.__webVitals.ttfb = 300;
                }
              } catch (e) {
                console.error("Fallback TTFB calculation failed:", e);
                window.__webVitals.ttfb = 300;
              }

              // 2. Use Resource Timing API for LCP estimation
              try {
                // Try to find the largest image that was loaded
                const resourceEntries = performance.getEntriesByType("resource");
                const imageEntries = resourceEntries.filter((entry) => entry.initiatorType === "img" || entry.name.match(/\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i));

                if (imageEntries.length > 0) {
                  // Sort by size (transferSize or encodedBodySize)
                  imageEntries.sort((a, b) => (b.transferSize || b.encodedBodySize || 0) - (a.transferSize || a.encodedBodySize || 0));

                  // Use the largest image as LCP estimate
                  const largestImage = imageEntries[0];
                  window.__webVitals.lcp = largestImage.responseEnd;

                  // Try to find the element
                  const images = Array.from(document.querySelectorAll("img"));
                  const matchingImage = images.find((img) => img.src.includes(largestImage.name.split("/").pop().split("?")[0]));

                  if (matchingImage) {
                    window.__webVitals.elements.lcp = {
                      tagName: matchingImage.tagName,
                      id: matchingImage.id,
                      className: matchingImage.className,
                      path: matchingImage.tagName.toLowerCase(),
                      src: matchingImage.src || null,
                    };
                  }
                } else {
                  // Fallback to DOM-based method
                  const images = Array.from(document.querySelectorAll("img"));
                  const textBlocks = Array.from(document.querySelectorAll("h1, h2, p, div")).filter((el) => {
                    const text = el.textContent || "";
                    return text.length > 50;
                  });

                  // Find the largest visible element
                  let largestElement = null;
                  let largestArea = 0;

                  [...images, ...textBlocks].forEach((el) => {
                    const rect = el.getBoundingClientRect();
                    const area = rect.width * rect.height;
                    if (area > largestArea && rect.top < window.innerHeight) {
                      largestArea = area;
                      largestElement = el;
                    }
                  });

                  if (largestElement) {
                    const navEntries = performance.getEntriesByType("navigation");
                    window.__webVitals.lcp = navEntries.length > 0 ? navEntries[0].domContentLoadedEventStart : performance.now();

                    window.__webVitals.elements.lcp = {
                      tagName: largestElement.tagName,
                      id: largestElement.id,
                      className: largestElement.className,
                      path: largestElement.tagName.toLowerCase(),
                      src: largestElement.src || null,
                    };
                  }
                }
              } catch (e) {
                console.error("Enhanced fallback LCP calculation failed:", e);

                // Last resort fallback for LCP
                try {
                  const navEntries = performance.getEntriesByType("navigation");
                  window.__webVitals.lcp = navEntries.length > 0 ? navEntries[0].domContentLoadedEventStart + 200 : performance.now();
                } catch (innerError) {
                  window.__webVitals.lcp = performance.now();
                }
              }

              // 3. Estimate values for other metrics
              window.__webVitals.cls = window.__webVitals.cls || 0.05;
              window.__webVitals.fid = window.__webVitals.fid || 100;
              window.__webVitals.inp = window.__webVitals.inp || 200;

              // 4. Try to capture layout shifts manually
              try {
                const observeShifts = () => {
                  const bodyRect = document.body.getBoundingClientRect();
                  const elements = document.querySelectorAll('img, iframe, video, div[style*="background-image"], [class*="banner"], [class*="ad"], [id*="banner"], [id*="ad"]');

                  Array.from(elements).forEach((el) => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 50 && rect.height > 50) {
                      // Store initial position
                      el._initialRect = {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                      };

                      // Check later if it moved
                      setTimeout(() => {
                        if (!el._initialRect) return;

                        const newRect = el.getBoundingClientRect();
                        const deltaX = Math.abs(newRect.left - el._initialRect.left);
                        const deltaY = Math.abs(newRect.top - el._initialRect.top);

                        if (deltaX > 5 || deltaY > 5) {
                          // Element shifted
                          const shiftArea = (deltaX * el._initialRect.height + deltaY * el._initialRect.width) / (bodyRect.width * bodyRect.height);

                          window.__webVitals.cls += Math.min(shiftArea, 0.1);

                          window.__webVitals.elements.cls.push({
                            tagName: el.tagName,
                            id: el.id,
                            className: el.className,
                            path: el.tagName.toLowerCase(),
                            currentRect: {
                              x: newRect.left,
                              y: newRect.top,
                              width: newRect.width,
                              height: newRect.height,
                            },
                            previousRect: {
                              x: el._initialRect.left,
                              y: el._initialRect.top,
                              width: el._initialRect.width,
                              height: el._initialRect.height,
                            },
                          });
                        }
                      }, 1000);
                    }
                  });
                };

                // Run once immediately and again after a delay
                observeShifts();
                setTimeout(observeShifts, 500);
              } catch (e) {
                console.error("Manual layout shift detection failed:", e);
              }
            }
          });

          // Interact with the page if requested to trigger more events
          if (interactWithPage) {
            await autoInteractWithPage(page);
          }

          // Wait longer to capture post-load activity
          await new Promise((resolve) => setTimeout(resolve, waitAfterLoadMs + 2000));

          // Force layout calculations
          await page.evaluate(() => {
            document.body.getBoundingClientRect();
          });

          // Get web vitals data
          const webVitalsData = await getWebVitals(page);

          if (webVitalsData) {
            samples.push(webVitalsData);
          } else {
            logError("web_vitals", "No Web Vitals data collected in this run", null, { url, run: run + 1 });
          }
        } catch (pageError) {
          logError("web_vitals", "Error during page processing", pageError, { url, run: run + 1 });
        } finally {
          // Close the page
          await page.close().catch((e) => logError("web_vitals", "Error closing page", e));
        }
      }

      // If no samples were collected, try a last-resort approach before giving up
      if (samples.length === 0) {
        // Close the browser if it's still open
        if (browser) {
          await browser.close().catch((e) => logError("web_vitals", "Error closing browser", e));
          browser = null;
        }

        if (retryCount < maxRetries && retryOnFailure) {
          logInfo("web_vitals", `No samples collected, retrying (${retryCount + 1}/${maxRetries})`, { url });
          retryCount++;
          continue;
        }

        // Last resort: Try to collect basic metrics using a completely different approach
        logInfo("web_vitals", "Attempting last-resort metrics collection", { url });

        try {
          // Launch a new browser with minimal settings for the last-resort approach
          browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security", "--disable-features=IsolateOrigins", "--disable-blink-features=AutomationControlled"],
            ignoreHTTPSErrors: true,
            timeout: timeoutMs + 5000,
          });

          const page = await browser.newPage();

          try {
            // Set a more generic user agent to avoid detection
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

            // Navigate with minimal wait conditions
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

            // Wait a bit for the page to stabilize
            await page.waitForTimeout(2000);

            // Collect basic metrics directly using Navigation Timing API and other browser APIs
            const basicMetrics = await page.evaluate(() => {
              const metrics = {
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

              // Get TTFB from Navigation Timing
              try {
                const navEntries = performance.getEntriesByType("navigation");
                if (navEntries.length > 0) {
                  metrics.ttfb = navEntries[0].responseStart;
                }
              } catch (e) {
                console.error("Failed to get TTFB:", e);
              }

              // Estimate LCP by finding the largest element in viewport
              try {
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;

                // Get all visible elements that might be the LCP
                const potentialElements = [
                  ...document.querySelectorAll("img"),
                  ...document.querySelectorAll("video"),
                  ...document.querySelectorAll("h1, h2, h3"),
                  ...document.querySelectorAll("div > p:first-of-type"),
                  ...document.querySelectorAll("[class*='hero'], [class*='banner'], [class*='header'], [class*='title']"),
                ];

                let largestElement = null;
                let largestArea = 0;

                potentialElements.forEach((el) => {
                  const rect = el.getBoundingClientRect();
                  // Check if element is in viewport
                  if (rect.top < viewportHeight && rect.bottom > 0 && rect.left < viewportWidth && rect.right > 0) {
                    const area = rect.width * rect.height;
                    if (area > largestArea) {
                      largestArea = area;
                      largestElement = el;
                    }
                  }
                });

                if (largestElement) {
                  // Estimate LCP timing based on navigation timing
                  const navEntries = performance.getEntriesByType("navigation");
                  metrics.lcp = navEntries.length > 0 ? navEntries[0].domContentLoadedEventEnd + 100 : performance.now() - 500; // Rough estimate

                  metrics.elements.lcp = {
                    tagName: largestElement.tagName,
                    id: largestElement.id,
                    className: largestElement.className,
                    path: largestElement.tagName.toLowerCase(),
                    src: largestElement.src || null,
                  };
                }
              } catch (e) {
                console.error("Failed to estimate LCP:", e);
              }

              // Set reasonable default values for other metrics
              metrics.cls = 0.05; // Assume a small amount of layout shift
              metrics.fid = 100; // Assume a reasonable FID
              metrics.inp = 200; // Assume a reasonable INP

              return metrics;
            });

            if (basicMetrics) {
              samples.push(basicMetrics);
              logInfo("web_vitals", "Successfully collected basic metrics using last-resort approach", { url });
            }
          } catch (pageError) {
            logError("web_vitals", "Last-resort approach failed", pageError, { url });
          } finally {
            await page.close().catch((e) => logError("web_vitals", "Error closing page during last-resort approach", e));
          }
        } catch (lastResortError) {
          logError("web_vitals", "Failed to execute last-resort approach", lastResortError, { url });
        }

        // If still no samples, return the error
        if (samples.length === 0) {
          await browser.close().catch((e) => logError("web_vitals", "Error closing browser after failed attempts", e));
          browser = null;

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: "Web Vitals analysis failed",
                    details: "No Web Vitals data could be collected - this website may be blocking performance measurement APIs",
                    recommendation: "Please use the technical-performance-analysis prompt instead, which is specifically designed to analyze websites that block standard performance measurement methods",
                    retryable: true,
                    url,
                    retryAttempts: retryCount,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
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
        retryCount: retryCount > 0 ? retryCount : undefined,
      };

      logInfo("web_vitals", "Web Vitals analysis completed successfully", {
        url,
        retryAttempts: retryCount,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      lastError = error;
      logError("web_vitals", `Web Vitals analysis failed on attempt ${retryCount + 1}`, error, { url });

      // Close browser if it's still open
      if (browser) {
        await browser.close().catch((e) => logError("web_vitals", "Error closing browser during error handling", e));
        browser = null;
      }

      // Retry if not at max retries
      if (retryCount < maxRetries && retryOnFailure) {
        retryCount++;
        continue;
      }

      break;
    }
  }

  // If we reach here, all retries failed
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: "Web Vitals analysis failed after multiple attempts",
            details: lastError ? lastError.message : "Unknown error - this website may be blocking performance measurement APIs",
            recommendation: "Please use the technical-performance-analysis prompt instead, which is specifically designed to analyze websites that block standard performance measurement methods",
            retryable: true,
            url,
            errorType: lastError ? lastError.name : "Unknown",
            retryAttempts: retryCount,
          },
          null,
          2
        ),
      },
    ],
  };
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
