/**
 * Performance Test Framework
 * Runs performance tests across different devices and network conditions
 */

import { logInfo, logError } from "../../../utils/logging.js";
import { BROWSER_HEADERS } from "../../../config/constants.js";
import { checkSiteAvailability } from "../../../utils/html.js";
import { fetchWithRetry } from "../../../utils/fetch.js";
import { getDeviceConfig } from "../../../config/devices.js";
import { getNetworkCondition } from "../../../config/network_conditions.js";
import { configureCdpSession } from "../../../utils/cdp_helpers.js";
import { runWebVitalsAnalysis } from "../web_vitals/index.js";
import { runNetworkMonitor } from "../network/index.js";
import { runCoverageAnalysis } from "../coverage/index.js";

/**
 * Run performance tests across different scenarios
 * @param {Object} args - The tool arguments
 * @returns {Promise<Object>} Performance test results
 */
export async function runPerformanceTest(args) {
  const {
    url,
    timeoutMs = 30000,
    waitAfterLoadMs = 3000,
    useProxy = false,
    ignoreSSLErrors = false,
    devices = ["desktop", "mobile"],
    networkConditions = ["WiFi", "4G", "3G"],
    tests = ["web_vitals", "network", "coverage"],
    compareResults = true,
    baselineDevice = "desktop",
    baselineNetwork = "WiFi",
    includeScreenshots = true,
    runMultipleTimes = false,
    numberOfRuns = 3,
  } = args;

  try {
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

    logInfo("performance_test", "Starting performance test framework", { url, devices, networkConditions, tests });

    // Prepare test scenarios
    const scenarios = [];

    for (const deviceName of devices) {
      for (const networkName of networkConditions) {
        scenarios.push({
          deviceName,
          networkName,
          isBaseline: deviceName === baselineDevice && networkName === baselineNetwork,
        });
      }
    }

    // Run tests for each scenario
    const results = [];

    for (const scenario of scenarios) {
      logInfo("performance_test", `Running tests for scenario`, {
        device: scenario.deviceName,
        network: scenario.networkName,
        isBaseline: scenario.isBaseline,
      });

      const scenarioResults = {
        device: scenario.deviceName,
        network: scenario.networkName,
        isBaseline: scenario.isBaseline,
        testResults: {},
      };

      // Run Web Vitals test if requested
      if (tests.includes("web_vitals")) {
        try {
          const webVitalsResult = await runWebVitalsAnalysis({
            url,
            timeoutMs,
            waitAfterLoadMs,
            deviceName: scenario.deviceName,
            networkConditionName: scenario.networkName,
            useProxy,
            ignoreSSLErrors,
            runMultipleTimes,
            numberOfRuns,
          });

          // Extract the JSON result from the content
          const webVitalsData = JSON.parse(webVitalsResult.content[0].text);
          scenarioResults.testResults.webVitals = webVitalsData;
        } catch (error) {
          logError("performance_test", "Web Vitals test failed", error, {
            device: scenario.deviceName,
            network: scenario.networkName,
          });

          scenarioResults.testResults.webVitals = {
            error: "Test failed",
            details: error.message,
          };
        }
      }

      // Run Network test if requested
      if (tests.includes("network")) {
        try {
          const networkResult = await runNetworkMonitor({
            url,
            timeoutMs,
            waitAfterLoadMs,
            deviceName: scenario.deviceName,
            networkConditionName: scenario.networkName,
            useProxy,
            ignoreSSLErrors,
            captureHeaders: false, // Reduce result size
          });

          // Extract the JSON result from the content
          const networkData = JSON.parse(networkResult.content[0].text);
          scenarioResults.testResults.network = networkData;
        } catch (error) {
          logError("performance_test", "Network test failed", error, {
            device: scenario.deviceName,
            network: scenario.networkName,
          });

          scenarioResults.testResults.network = {
            error: "Test failed",
            details: error.message,
          };
        }
      }

      // Run Coverage test if requested
      if (tests.includes("coverage")) {
        try {
          const coverageResult = await runCoverageAnalysis({
            url,
            timeoutMs,
            waitAfterLoadMs,
            deviceName: scenario.deviceName,
            networkConditionName: scenario.networkName,
            useProxy,
            ignoreSSLErrors,
          });

          // Extract the JSON result from the content
          const coverageData = JSON.parse(coverageResult.content[0].text);
          scenarioResults.testResults.coverage = coverageData;
        } catch (error) {
          logError("performance_test", "Coverage test failed", error, {
            device: scenario.deviceName,
            network: scenario.networkName,
          });

          scenarioResults.testResults.coverage = {
            error: "Test failed",
            details: error.message,
          };
        }
      }

      // Take screenshot if requested
      if (includeScreenshots) {
        try {
          const puppeteer = await import("puppeteer");
          const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", useProxy ? `--proxy-server=${process.env.PROXY_URL || ""}` : "", "--ignore-certificate-errors"].filter(Boolean),
            ignoreHTTPSErrors: ignoreSSLErrors,
          });

          const page = await browser.newPage();

          // Set HTTP headers
          await page.setExtraHTTPHeaders(BROWSER_HEADERS);

          // Get device configuration
          const deviceConfig = getDeviceConfig({ deviceName: scenario.deviceName });

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

          // Configure CDP session with network conditions
          const networkConditionConfig = getNetworkCondition({ networkConditionName: scenario.networkName });
          await configureCdpSession(client, {
            networkCondition: networkConditionConfig,
          });

          // Navigate to the page
          await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: timeoutMs,
          });

          // Wait for a moment
          await new Promise((resolve) => setTimeout(resolve, waitAfterLoadMs));

          // Take screenshot
          const screenshot = await page.screenshot({
            type: "jpeg",
            quality: 80,
            fullPage: false,
          });

          // Convert to base64
          scenarioResults.screenshot = `data:image/jpeg;base64,${screenshot.toString("base64")}`;

          // Close browser
          await browser.close();
        } catch (error) {
          logError("performance_test", "Screenshot failed", error, {
            device: scenario.deviceName,
            network: scenario.networkName,
          });

          scenarioResults.screenshot = null;
        }
      }

      results.push(scenarioResults);
    }

    // Compare results if requested
    let comparison = null;

    if (compareResults && results.length > 1) {
      const baseline = results.find((result) => result.isBaseline);

      if (baseline) {
        comparison = {
          baseline: {
            device: baseline.device,
            network: baseline.network,
          },
          comparisons: [],
        };

        for (const result of results) {
          if (result === baseline) continue;

          const comparisonResult = {
            device: result.device,
            network: result.network,
            metrics: {},
          };

          // Compare Web Vitals
          if (tests.includes("web_vitals") && baseline.testResults.webVitals && !baseline.testResults.webVitals.error && result.testResults.webVitals && !result.testResults.webVitals.error) {
            const baselineWebVitals = baseline.testResults.webVitals.webVitals;
            const currentWebVitals = result.testResults.webVitals.webVitals;

            comparisonResult.metrics.webVitals = {
              lcp: compareMetric(currentWebVitals.lcp?.value, baselineWebVitals.lcp?.value, false),
              cls: compareMetric(currentWebVitals.cls?.value, baselineWebVitals.cls?.value, false),
              fid: compareMetric(currentWebVitals.fid?.value, baselineWebVitals.fid?.value, false),
              inp: compareMetric(currentWebVitals.inp?.value, baselineWebVitals.inp?.value, false),
              ttfb: compareMetric(currentWebVitals.ttfb?.value, baselineWebVitals.ttfb?.value, false),
              overallScore: compareMetric(currentWebVitals.overallScore, baselineWebVitals.overallScore, true),
            };
          }

          // Compare Network
          if (tests.includes("network") && baseline.testResults.network && !baseline.testResults.network.error && result.testResults.network && !result.testResults.network.error) {
            const baselineNetwork = baseline.testResults.network.summary;
            const currentNetwork = result.testResults.network.summary;

            comparisonResult.metrics.network = {
              totalRequests: compareMetric(currentNetwork.totalRequests, baselineNetwork.totalRequests, false),
              totalSize: compareMetric(currentNetwork.totalSize, baselineNetwork.totalSize, false),
              totalDuration: compareMetric(currentNetwork.totalDuration, baselineNetwork.totalDuration, false),
            };
          }

          // Compare Coverage
          if (tests.includes("coverage") && baseline.testResults.coverage && !baseline.testResults.coverage.error && result.testResults.coverage && !result.testResults.coverage.error) {
            const baselineCoverage = baseline.testResults.coverage;
            const currentCoverage = result.testResults.coverage;

            comparisonResult.metrics.coverage = {
              unusedJsBytes: compareMetric(currentCoverage.summary?.unusedJsBytes, baselineCoverage.summary?.unusedJsBytes, false),
              unusedCssBytes: compareMetric(currentCoverage.summary?.unusedCssBytes, baselineCoverage.summary?.unusedCssBytes, false),
              totalJsBytes: compareMetric(currentCoverage.summary?.totalJsBytes, baselineCoverage.summary?.totalJsBytes, false),
              totalCssBytes: compareMetric(currentCoverage.summary?.totalCssBytes, baselineCoverage.summary?.totalCssBytes, false),
            };
          }

          comparison.comparisons.push(comparisonResult);
        }
      }
    }

    // Generate recommendations based on all results
    const recommendations = generateRecommendations(results, tests);

    logInfo("performance_test", "Performance test framework completed successfully", { url });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              url,
              scenarios: scenarios.map((s) => ({ device: s.deviceName, network: s.networkName, isBaseline: s.isBaseline })),
              results,
              comparison,
              recommendations,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    logError("performance_test", "Performance test framework failed", error, { url });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Performance test framework failed",
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
  }
}

/**
 * Compare a metric between current and baseline values
 * @param {number} current - Current value
 * @param {number} baseline - Baseline value
 * @param {boolean} higherIsBetter - Whether higher values are better
 * @returns {Object} Comparison result
 */
function compareMetric(current, baseline, higherIsBetter) {
  if (current === undefined || baseline === undefined || current === null || baseline === null) {
    return {
      current,
      baseline,
      difference: null,
      percentChange: null,
      improvement: null,
    };
  }

  const difference = current - baseline;
  const percentChange = baseline !== 0 ? (difference / baseline) * 100 : null;

  let improvement = false;

  if (percentChange !== null) {
    improvement = higherIsBetter ? percentChange > 0 : percentChange < 0;
  }

  return {
    current,
    baseline,
    difference,
    percentChange,
    improvement,
  };
}

/**
 * Generate recommendations based on test results
 * @param {Array} results - Test results for all scenarios
 * @param {Array} tests - Tests that were run
 * @returns {Array} Recommendations
 */
function generateRecommendations(results, tests) {
  const recommendations = [];

  // Find the worst performing device/network combinations
  if (tests.includes("web_vitals")) {
    const worstLCP = findWorstScenario(results, "webVitals", "lcp", "value", false);
    const worstCLS = findWorstScenario(results, "webVitals", "cls", "value", false);
    const worstINP = findWorstScenario(results, "webVitals", "inp", "value", false);

    if (worstLCP) {
      recommendations.push({
        type: "device_specific_lcp",
        title: `Optimize LCP for ${worstLCP.device} on ${worstLCP.network}`,
        description: `LCP is ${worstLCP.value.toFixed(0)}ms on ${worstLCP.device}/${worstLCP.network}, which is significantly worse than other scenarios`,
        impact: "high",
        suggestions: ["Optimize images specifically for this device type", "Implement responsive loading strategies", "Consider device-specific critical CSS", "Test with real devices of this type"],
      });
    }

    if (worstCLS) {
      recommendations.push({
        type: "device_specific_cls",
        title: `Reduce Layout Shifts for ${worstCLS.device} on ${worstCLS.network}`,
        description: `CLS is ${worstCLS.value.toFixed(3)} on ${worstCLS.device}/${worstCLS.network}, which is significantly worse than other scenarios`,
        impact: "high",
        suggestions: ["Set explicit dimensions for images and media", "Ensure responsive layouts maintain stability", "Test layout behavior specifically on this device type", "Reserve space for dynamic content"],
      });
    }

    if (worstINP) {
      recommendations.push({
        type: "device_specific_inp",
        title: `Improve Interactivity for ${worstINP.device} on ${worstINP.network}`,
        description: `INP is ${worstINP.value.toFixed(0)}ms on ${worstINP.device}/${worstINP.network}, which is significantly worse than other scenarios`,
        impact: "high",
        suggestions: ["Optimize JavaScript execution for lower-powered devices", "Reduce main thread blocking during interactions", "Implement progressive enhancement for interactions", "Test with real devices of this type"],
      });
    }
  }

  // Find network-specific issues
  if (tests.includes("network")) {
    const slowNetworkScenarios = results.filter((result) => result.network === "3G" && result.testResults.network && !result.testResults.network.error);

    if (slowNetworkScenarios.length > 0) {
      const largeResources = [];

      for (const scenario of slowNetworkScenarios) {
        const network = scenario.testResults.network;

        if (network.requests) {
          const largeResourcesInScenario = network.requests
            .filter((req) => req.size > 100000)
            .map((req) => ({
              url: req.url,
              size: req.size,
              type: req.resourceType,
              device: scenario.device,
            }));

          largeResources.push(...largeResourcesInScenario);
        }
      }

      if (largeResources.length > 0) {
        recommendations.push({
          type: "slow_network_optimization",
          title: "Optimize for slow networks",
          description: `Found ${largeResources.length} large resources that significantly impact performance on slow networks`,
          impact: "high",
          items: largeResources.slice(0, 5),
          suggestions: ["Implement adaptive loading based on network conditions", "Reduce resource sizes for slow connections", "Prioritize critical resources", "Consider using service workers for offline support"],
        });
      }
    }
  }

  // Find device-specific coverage issues
  if (tests.includes("coverage")) {
    const mobileScenarios = results.filter((result) => result.device === "mobile" && result.testResults.coverage && !result.testResults.coverage.error);

    if (mobileScenarios.length > 0) {
      const unusedJsPercentages = mobileScenarios
        .map((scenario) => {
          const coverage = scenario.testResults.coverage;
          if (coverage.summary) {
            return {
              device: scenario.device,
              network: scenario.network,
              unusedJsPercent: coverage.summary.unusedJsPercent,
            };
          }
          return null;
        })
        .filter(Boolean);

      if (unusedJsPercentages.length > 0 && unusedJsPercentages.some((item) => item.unusedJsPercent > 40)) {
        recommendations.push({
          type: "mobile_code_splitting",
          title: "Implement code splitting for mobile",
          description: "Mobile devices are loading significant amounts of unused JavaScript",
          impact: "high",
          items: unusedJsPercentages,
          suggestions: ["Implement device-specific code splitting", "Use dynamic imports for features not needed on mobile", "Create separate entry points for different device types", "Consider a progressive web app approach"],
        });
      }
    }
  }

  // Add general recommendations if no specific issues found
  if (recommendations.length === 0) {
    recommendations.push({
      type: "general_optimization",
      title: "Continue monitoring performance across devices",
      description: "No significant device or network-specific issues found",
      impact: "low",
      suggestions: ["Implement continuous performance monitoring", "Test with real devices regularly", "Consider implementing user-centric performance metrics", "Set performance budgets for different device types"],
    });
  }

  return recommendations;
}

/**
 * Find the worst performing scenario for a specific metric
 * @param {Array} results - Test results for all scenarios
 * @param {string} testType - Type of test (webVitals, network, coverage)
 * @param {string} metricName - Name of the metric
 * @param {string} valueProp - Property name for the value
 * @param {boolean} higherIsBetter - Whether higher values are better
 * @returns {Object|null} Worst scenario or null if not found
 */
function findWorstScenario(results, testType, metricName, valueProp, higherIsBetter) {
  const validResults = results.filter(
    (result) =>
      result.testResults[testType] &&
      !result.testResults[testType].error &&
      result.testResults[testType].webVitals &&
      result.testResults[testType].webVitals[metricName] &&
      result.testResults[testType].webVitals[metricName][valueProp] !== undefined
  );

  if (validResults.length < 2) return null;

  // Calculate average value across all scenarios
  const values = validResults.map((result) => result.testResults[testType].webVitals[metricName][valueProp]);

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  // Find scenarios that are significantly worse than average
  const threshold = 1.5; // 50% worse than average

  const significantlyWorse = validResults.filter((result) => {
    const value = result.testResults[testType].webVitals[metricName][valueProp];
    return higherIsBetter ? value < average / threshold : value > average * threshold;
  });

  if (significantlyWorse.length === 0) return null;

  // Return the worst one
  return significantlyWorse.sort((a, b) => {
    const valueA = a.testResults[testType].webVitals[metricName][valueProp];
    const valueB = b.testResults[testType].webVitals[metricName][valueProp];
    return higherIsBetter ? valueA - valueB : valueB - valueA;
  })[0];
}
