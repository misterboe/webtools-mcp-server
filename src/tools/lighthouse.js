import { logInfo, logError } from "../utils/logging.js";
import { checkSiteAvailability } from "../utils/html.js";
import { fetchWithRetry } from "../utils/fetch.js";
import * as lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import fs from "fs";
import path from "path";

// Try to find Puppeteer installation
let puppeteerChromePath = null;
try {
  // Check if Puppeteer is installed
  const puppeteerPkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "node_modules", "puppeteer", "package.json"), "utf8"));
  if (puppeteerPkg) {
    logInfo("lighthouse", "Puppeteer detected, will use as fallback if Chrome is not found");
  }
} catch (error) {
  // Puppeteer not installed, will use system Chrome
  logInfo("lighthouse", "Puppeteer not found, will use system Chrome installation");
}

/**
 * Try to find an available Chrome installation
 * @returns {string|null} Chrome executable path or null if not found
 */
async function findChromeInstallation() {
  // First try environment variable
  if (process.env.CHROME_PATH) {
    if (fs.existsSync(process.env.CHROME_PATH)) {
      logInfo("lighthouse", "Using Chrome from CHROME_PATH environment variable");
      return process.env.CHROME_PATH;
    }
  }

  // Try to find Chrome using chrome-launcher
  try {
    const installation = await chromeLauncher.getChromePath();
    if (installation) {
      logInfo("lighthouse", "Found Chrome installation using chrome-launcher");
      return installation;
    }
  } catch (error) {
    logInfo("lighthouse", "Chrome not found using chrome-launcher");
  }

  // Try to find Puppeteer's Chrome
  try {
    // Common paths for Puppeteer's Chrome
    const possiblePaths = [
      // Global puppeteer installation
      path.resolve(process.cwd(), "node_modules", "puppeteer", ".local-chromium"),
      // User's home directory for puppeteer installation
      path.resolve(process.env.HOME || process.env.USERPROFILE, ".cache", "puppeteer"),
    ];

    for (const basePath of possiblePaths) {
      if (fs.existsSync(basePath)) {
        // Find the first directory in the .local-chromium directory
        const chromiumDirs = fs.readdirSync(basePath);
        for (const dir of chromiumDirs) {
          const platformDirs = fs.readdirSync(path.join(basePath, dir));
          for (const platformDir of platformDirs) {
            // For Mac
            const macPath = path.join(basePath, dir, platformDir, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium");
            if (fs.existsSync(macPath)) {
              logInfo("lighthouse", "Found Puppeteer's Chrome on Mac");
              return macPath;
            }

            // For Linux
            const linuxPath = path.join(basePath, dir, platformDir, "chrome-linux", "chrome");
            if (fs.existsSync(linuxPath)) {
              logInfo("lighthouse", "Found Puppeteer's Chrome on Linux");
              return linuxPath;
            }

            // For Windows
            const winPath = path.join(basePath, dir, platformDir, "chrome-win", "chrome.exe");
            if (fs.existsSync(winPath)) {
              logInfo("lighthouse", "Found Puppeteer's Chrome on Windows");
              return winPath;
            }
          }
        }
      }
    }
  } catch (error) {
    logInfo("lighthouse", "Error finding Puppeteer's Chrome", error);
  }

  return null;
}

/**
 * Run a Lighthouse audit on a webpage
 * @param {Object} args - The tool arguments
 * @returns {Object} The tool response
 */
export async function runLighthouse(args) {
  const { url, categories = ["performance", "accessibility", "best-practices", "seo", "pwa"], device = "mobile", ignoreSSLErrors = false } = args;

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

    // Find Chrome installation
    const chromePath = await findChromeInstallation();

    // Configure Chrome flags
    const chromeFlags = ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"];

    // Add SSL error bypass if requested
    if (ignoreSSLErrors) {
      chromeFlags.push("--ignore-certificate-errors");
    }

    // Launch Chrome options
    const launchOptions = {
      chromeFlags,
    };

    // Use specific Chrome path if found
    if (chromePath) {
      launchOptions.chromePath = chromePath;
    }

    // Launch Chrome
    let chrome;
    try {
      chrome = await chromeLauncher.launch(launchOptions);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Chrome launch failed",
                details: "No Chrome installations found or Chrome could not be launched. " + error.message,
                recommendation: "Please install Chrome/Chromium or install Puppeteer globally: 'npm install -g puppeteer'",
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

    // Use Chrome's default configuration
    const config = {
      extends: "lighthouse:default",
      settings: {
        onlyCategories: categories,
        formFactor: device,
        // Use Chrome's default preset
        preset: device === "desktop" ? "desktop" : "mobile",
        // Skip the throttling simulation for exact Chrome matching
        throttlingMethod: "provided",
        // Disable storage reset to match Chrome's behavior
        disableStorageReset: true,
        // Skip the JS coverage task to match Chrome's behavior
        skipJsComputeBudget: true,
        // Include more details in the report
        maxLength: 1000, // Allow more items to be returned
        screenEmulation: {
          mobile: device === "mobile",
          width: device === "mobile" ? 375 : 1350,
          height: device === "mobile" ? 667 : 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
        // Enable third-party filtering data
        onlyAudits: null,
        skipAudits: null,
      },
    };

    // Configure Lighthouse options
    const options = {
      logLevel: "info",
      output: "json",
      port: chrome.port,
      // Use Chrome's default configuration
      config,
    };

    try {
      // Run Lighthouse
      logInfo("lighthouse", "Starting Lighthouse audit", { url, options });
      const runnerResult = await lighthouse.default(url, options);
      const reportJson = runnerResult.report;
      const lhr = runnerResult.lhr;

      // Extract key metrics and scores
      const results = {
        url: lhr.finalUrl,
        fetchTime: lhr.fetchTime,
        version: lhr.lighthouseVersion,
        userAgent: lhr.userAgent,
        scores: {},
        metrics: {},
        audits: {},
      };

      // Add category scores
      for (const category of Object.values(lhr.categories)) {
        results.scores[category.id] = {
          title: category.title,
          score: category.score * 100, // Convert to percentage
          description: category.description,
        };
      }

      // Add key metrics
      if (lhr.audits["first-contentful-paint"]) {
        results.metrics["first-contentful-paint"] = {
          title: lhr.audits["first-contentful-paint"].title,
          value: lhr.audits["first-contentful-paint"].displayValue,
          score: lhr.audits["first-contentful-paint"].score * 100,
        };
      }

      if (lhr.audits["speed-index"]) {
        results.metrics["speed-index"] = {
          title: lhr.audits["speed-index"].title,
          value: lhr.audits["speed-index"].displayValue,
          score: lhr.audits["speed-index"].score * 100,
        };
      }

      if (lhr.audits["largest-contentful-paint"]) {
        results.metrics["largest-contentful-paint"] = {
          title: lhr.audits["largest-contentful-paint"].title,
          value: lhr.audits["largest-contentful-paint"].displayValue,
          score: lhr.audits["largest-contentful-paint"].score * 100,
        };
      }

      if (lhr.audits["cumulative-layout-shift"]) {
        results.metrics["cumulative-layout-shift"] = {
          title: lhr.audits["cumulative-layout-shift"].title,
          value: lhr.audits["cumulative-layout-shift"].displayValue,
          score: lhr.audits["cumulative-layout-shift"].score * 100,
        };
      }

      if (lhr.audits["total-blocking-time"]) {
        results.metrics["total-blocking-time"] = {
          title: lhr.audits["total-blocking-time"].title,
          value: lhr.audits["total-blocking-time"].displayValue,
          score: lhr.audits["total-blocking-time"].score * 100,
        };
      }

      // Add important audits with opportunities for improvement
      const auditCategories = ["performance", "accessibility", "best-practices", "seo", "pwa"];

      for (const category of auditCategories) {
        if (lhr.categories[category]) {
          results.audits[category] = [];

          // Get audits for this category
          const auditRefs = lhr.categories[category].auditRefs;

          // Filter for failed or warning audits and include full details
          const failedAudits = auditRefs
            .filter((ref) => {
              const audit = lhr.audits[ref.id];
              return audit && (audit.score === null || audit.score < 0.9);
            })
            .map((ref) => {
              const audit = lhr.audits[ref.id];
              return {
                id: ref.id,
                title: audit.title,
                description: audit.description,
                score: audit.score === null ? "N/A" : audit.score * 100,
                displayValue: audit.displayValue || "",
                details: audit.details,
              };
            });

          results.audits[category] = failedAudits;
        }
      }

      // Format the results as a markdown report
      const report = formatLighthouseReport(results);

      return {
        content: [
          {
            type: "text",
            text: report,
          },
        ],
      };
    } finally {
      // Always close Chrome
      await chrome.kill();
    }
  } catch (error) {
    logError("lighthouse", "Lighthouse audit failed", error, { url });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Lighthouse audit failed",
              details: error.message,
              recommendation: "Please try again or check the URL",
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
}

/**
 * Format Lighthouse results as a markdown report
 * @param {Object} results - The Lighthouse results
 * @returns {string} Formatted markdown report
 */
function formatLighthouseReport(results) {
  const report = [`# Lighthouse Report for ${results.url}`, `Generated at: ${results.fetchTime}`, `Lighthouse version: ${results.version}`, "", "## Overall Scores", ""];

  // Add score table
  report.push("| Category | Score |");
  report.push("| -------- | ----- |");

  for (const [id, data] of Object.entries(results.scores)) {
    const emoji = getScoreEmoji(data.score);
    report.push(`| ${data.title} | ${emoji} ${data.score.toFixed(0)}% |`);
  }

  report.push("");
  report.push("## Key Metrics");
  report.push("");

  // Add metrics table
  report.push("| Metric | Value | Score |");
  report.push("| ------ | ----- | ----- |");

  for (const [id, data] of Object.entries(results.metrics)) {
    const emoji = getScoreEmoji(data.score);
    report.push(`| ${data.title} | ${data.value} | ${emoji} ${data.score.toFixed(0)}% |`);
  }

  report.push("");

  // Add opportunities for improvement
  report.push("## Opportunities for Improvement");
  report.push("");

  for (const [category, audits] of Object.entries(results.audits)) {
    if (audits.length > 0) {
      report.push(`### ${getCategoryTitle(category)}`);
      report.push("");

      for (const audit of audits) {
        const score = audit.score === "N/A" ? "N/A" : `${audit.score.toFixed(0)}%`;
        const emoji = audit.score === "N/A" ? "ℹ️" : getScoreEmoji(audit.score);

        report.push(`#### ${audit.title} ${emoji} ${score}`);
        report.push("");
        report.push(audit.description);

        if (audit.displayValue) {
          report.push("");
          report.push(`**Value:** ${audit.displayValue}`);
        }

        // Add detailed information about resources if available
        if (audit.details) {
          if (audit.details.type === "table" && audit.details.items && audit.details.items.length > 0) {
            report.push("");
            report.push("**Affected Resources:**");
            report.push("");

            // Get table headers
            const headers = audit.details.headings.map((h) => h.label || h.key);
            report.push(`| ${headers.join(" | ")} |`);
            report.push(`| ${headers.map(() => "----").join(" | ")} |`);

            // Add table rows for each item
            for (const item of audit.details.items.slice(0, 10)) {
              // Limit to 10 items to avoid excessive output
              const cells = audit.details.headings.map((heading) => {
                const key = heading.key;
                let value = item[key];

                // Format value based on type
                if (value === undefined || value === null) {
                  return "-";
                } else if (typeof value === "object") {
                  if (key === "url" || key === "request") {
                    return formatUrl(value.url || value);
                  }
                  return JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? "..." : "");
                } else if (typeof value === "string" && (key === "url" || key === "request")) {
                  return formatUrl(value);
                } else if (typeof value === "number" && (key === "wastedBytes" || key === "totalBytes")) {
                  return formatBytes(value);
                } else if (typeof value === "number" && key === "wastedMs") {
                  return `${value} ms`;
                }
                return String(value);
              });
              report.push(`| ${cells.join(" | ")} |`);
            }

            // Add note if there are more items
            if (audit.details.items.length > 10) {
              report.push("");
              report.push(`*Note: Showing 10 of ${audit.details.items.length} items*`);
            }
          } else if (audit.details.type === "opportunity" && audit.details.items) {
            // Handle opportunity format
            report.push("");
            report.push("**Improvement Opportunities:**");
            report.push("");

            for (const item of audit.details.items.slice(0, 10)) {
              if (item.url) {
                report.push(`- ${formatUrl(item.url)}: ${item.wastedMs ? `${item.wastedMs} ms wasted` : ""} ${item.wastedBytes ? `${formatBytes(item.wastedBytes)} wasted` : ""}`);
              }
            }

            if (audit.details.items.length > 10) {
              report.push("");
              report.push(`*Note: Showing 10 of ${audit.details.items.length} items*`);
            }
          } else if (audit.details.type === "debugdata" && audit.details.items) {
            // Some debug data might be useful
            report.push("");
            report.push("**Debug Information:**");
            report.push("");
            report.push("```");
            report.push(JSON.stringify(audit.details.items, null, 2).substring(0, 500));
            if (JSON.stringify(audit.details.items, null, 2).length > 500) {
              report.push("...");
            }
            report.push("```");
          }
        }

        report.push("");
      }
    }
  }

  return report.join("\n");
}

/**
 * Get emoji based on score
 * @param {number} score - The score (0-100)
 * @returns {string} Emoji representing the score
 */
function getScoreEmoji(score) {
  if (score >= 90) return "🟢";
  if (score >= 50) return "🟠";
  return "🔴";
}

/**
 * Get category title
 * @param {string} category - The category ID
 * @returns {string} The category title
 */
function getCategoryTitle(category) {
  switch (category) {
    case "performance":
      return "Performance";
    case "accessibility":
      return "Accessibility";
    case "best-practices":
      return "Best Practices";
    case "seo":
      return "SEO";
    case "pwa":
      return "Progressive Web App";
    default:
      return category;
  }
}

/**
 * Format URL for display in the report
 * @param {string} url - The URL to format
 * @returns {string} Formatted URL
 */
function formatUrl(url) {
  try {
    // Extract just the path and filename parts
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // For simplicity, show only the last part if path is long
    if (path.length > 40) {
      const pathParts = path.split("/");
      if (pathParts.length > 2) {
        const filename = pathParts[pathParts.length - 1];
        return `.../${filename} (${urlObj.origin})`;
      }
    }

    return `${path} (${urlObj.origin})`;
  } catch (e) {
    // If URL parsing fails, return as is
    return url.length > 50 ? url.substring(0, 47) + "..." : url;
  }
}

/**
 * Format bytes for display
 * @param {number} bytes - The number of bytes
 * @returns {string} Formatted size (KB, MB, etc.)
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
