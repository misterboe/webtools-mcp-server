import { logInfo, logError } from "../utils/logging.js";
import { checkSiteAvailability } from "../utils/html.js";
import { fetchWithRetry } from "../utils/fetch.js";
import * as lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

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

    // Configure Chrome flags
    const chromeFlags = ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"];

    // Add SSL error bypass if requested
    if (ignoreSSLErrors) {
      chromeFlags.push("--ignore-certificate-errors");
    }

    // Launch Chrome
    const chrome = await chromeLauncher.launch({
      chromeFlags,
    });

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

          // Filter for failed or warning audits
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
