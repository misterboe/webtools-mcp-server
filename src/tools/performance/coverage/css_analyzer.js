/**
 * CSS Coverage Analyzer
 * Analyzes CSS coverage data from Chrome DevTools Protocol
 */

import { logInfo, logError } from "../../../utils/logging.js";
import { URL } from "url";

/**
 * Analyze CSS coverage data
 * @param {Array} cssCoverage - CSS coverage data from CDP
 * @param {Object} options - Analysis options
 * @param {string} options.url - The URL of the page being analyzed
 * @param {boolean} options.includeThirdParty - Whether to include third-party stylesheets in the analysis
 * @returns {Promise<Object>} CSS coverage analysis
 */
export async function analyzeCSSCoverage(cssCoverage, options = {}) {
  const { url, includeThirdParty = true } = options;

  try {
    if (!cssCoverage || !Array.isArray(cssCoverage) || cssCoverage.length === 0) {
      return {
        error: "No CSS coverage data available",
        totalBytes: 0,
        unusedBytes: 0,
        unusedPercentage: 0,
        files: [],
        unusedByFile: [],
        thirdPartyAnalysis: {
          totalBytes: 0,
          unusedBytes: 0,
          unusedPercentage: 0,
          files: [],
        },
        recommendations: [],
      };
    }

    // Parse the base URL to determine first-party vs third-party
    const baseUrl = new URL(url);
    const baseDomain = baseUrl.hostname;

    // Process each stylesheet
    const stylesheetAnalysis = await Promise.all(
      cssCoverage.map(async (rule) => {
        // Extract stylesheet URL from header
        const styleSheetId = rule.styleSheetId;
        const header = rule.header || {};
        const stylesheetUrl = header.sourceURL || "(inline stylesheet)";
        let isThirdParty = false;

        // Determine if stylesheet is third-party
        if (stylesheetUrl && stylesheetUrl !== "(inline stylesheet)") {
          try {
            const stylesheetDomain = new URL(stylesheetUrl).hostname;
            isThirdParty = stylesheetDomain !== baseDomain && !stylesheetDomain.endsWith(`.${baseDomain}`);
          } catch (e) {
            // If URL parsing fails, consider it first-party (could be a data URL or relative path)
            isThirdParty = false;
          }
        }

        // Calculate coverage statistics
        const startOffset = rule.startOffset || 0;
        const endOffset = rule.endOffset || 0;
        const used = rule.used || false;

        const ruleLength = endOffset - startOffset;
        const unusedBytes = used ? 0 : ruleLength;

        return {
          styleSheetId,
          url: stylesheetUrl,
          isThirdParty,
          startOffset,
          endOffset,
          used,
          ruleLength,
          unusedBytes,
        };
      })
    );

    // Group by stylesheet
    const stylesheetMap = new Map();

    for (const rule of stylesheetAnalysis) {
      if (!stylesheetMap.has(rule.url)) {
        stylesheetMap.set(rule.url, {
          url: rule.url,
          isThirdParty: rule.isThirdParty,
          totalBytes: 0,
          unusedBytes: 0,
          rules: [],
        });
      }

      const stylesheet = stylesheetMap.get(rule.url);
      stylesheet.totalBytes += rule.ruleLength;
      stylesheet.unusedBytes += rule.unusedBytes;
      stylesheet.rules.push(rule);
    }

    // Convert map to array
    const stylesheets = Array.from(stylesheetMap.values());

    // Calculate percentages
    for (const stylesheet of stylesheets) {
      stylesheet.unusedPercentage = stylesheet.totalBytes > 0 ? (stylesheet.unusedBytes / stylesheet.totalBytes) * 100 : 0;
    }

    // Filter stylesheets based on third-party setting
    const filteredStylesheets = includeThirdParty ? stylesheets : stylesheets.filter((stylesheet) => !stylesheet.isThirdParty);

    // Calculate overall statistics
    const totalBytes = filteredStylesheets.reduce((sum, stylesheet) => sum + stylesheet.totalBytes, 0);
    const unusedBytes = filteredStylesheets.reduce((sum, stylesheet) => sum + stylesheet.unusedBytes, 0);
    const unusedPercentage = totalBytes > 0 ? (unusedBytes / totalBytes) * 100 : 0;

    // Sort stylesheets by unused bytes (descending)
    const sortedStylesheets = [...filteredStylesheets].sort((a, b) => b.unusedBytes - a.unusedBytes);

    // Analyze third-party stylesheets separately
    const thirdPartyStylesheets = stylesheets.filter((stylesheet) => stylesheet.isThirdParty);
    const thirdPartyTotalBytes = thirdPartyStylesheets.reduce((sum, stylesheet) => sum + stylesheet.totalBytes, 0);
    const thirdPartyUnusedBytes = thirdPartyStylesheets.reduce((sum, stylesheet) => sum + stylesheet.unusedBytes, 0);
    const thirdPartyUnusedPercentage = thirdPartyTotalBytes > 0 ? (thirdPartyUnusedBytes / thirdPartyTotalBytes) * 100 : 0;

    // Generate recommendations
    const recommendations = generateCSSRecommendations(sortedStylesheets, thirdPartyStylesheets);

    return {
      totalBytes,
      unusedBytes,
      unusedPercentage,
      files: filteredStylesheets.map((stylesheet) => ({
        url: stylesheet.url,
        isThirdParty: stylesheet.isThirdParty,
        totalBytes: stylesheet.totalBytes,
        unusedBytes: stylesheet.unusedBytes,
        unusedPercentage: stylesheet.unusedPercentage,
      })),
      unusedByFile: sortedStylesheets.slice(0, 10).map((stylesheet) => ({
        url: stylesheet.url,
        isThirdParty: stylesheet.isThirdParty,
        totalBytes: stylesheet.totalBytes,
        unusedBytes: stylesheet.unusedBytes,
        unusedPercentage: stylesheet.unusedPercentage,
        unusedRules: stylesheet.rules.filter((rule) => !rule.used).length,
        totalRules: stylesheet.rules.length,
      })),
      thirdPartyAnalysis: {
        totalBytes: thirdPartyTotalBytes,
        unusedBytes: thirdPartyUnusedBytes,
        unusedPercentage: thirdPartyUnusedPercentage,
        files: thirdPartyStylesheets.map((stylesheet) => ({
          url: stylesheet.url,
          totalBytes: stylesheet.totalBytes,
          unusedBytes: stylesheet.unusedBytes,
          unusedPercentage: stylesheet.unusedPercentage,
        })),
      },
      recommendations,
    };
  } catch (error) {
    logError("css_coverage_analyzer", "Failed to analyze CSS coverage", error);
    return {
      error: `Failed to analyze CSS coverage: ${error.message}`,
      totalBytes: 0,
      unusedBytes: 0,
      unusedPercentage: 0,
      files: [],
      unusedByFile: [],
      thirdPartyAnalysis: {
        totalBytes: 0,
        unusedBytes: 0,
        unusedPercentage: 0,
        files: [],
      },
      recommendations: [],
    };
  }
}

/**
 * Generate recommendations based on CSS coverage analysis
 * @param {Array} sortedStylesheets - Stylesheets sorted by unused bytes (descending)
 * @param {Array} thirdPartyStylesheets - Third-party stylesheets
 * @returns {Array} Recommendations
 */
function generateCSSRecommendations(sortedStylesheets, thirdPartyStylesheets) {
  const recommendations = [];

  // Check for large unused stylesheets
  const largeUnusedStylesheets = sortedStylesheets.filter((stylesheet) => stylesheet.unusedPercentage > 50 && stylesheet.totalBytes > 10000);

  if (largeUnusedStylesheets.length > 0) {
    recommendations.push({
      type: "css_optimization",
      title: "Optimize CSS delivery",
      description: `Found ${largeUnusedStylesheets.length} stylesheets with more than 50% unused CSS. Consider implementing critical CSS and deferring non-critical styles.`,
      impact: "high",
      stylesheets: largeUnusedStylesheets.slice(0, 5).map((stylesheet) => ({
        url: stylesheet.url,
        unusedPercentage: stylesheet.unusedPercentage,
        unusedBytes: stylesheet.unusedBytes,
      })),
    });
  }

  // Check for third-party stylesheets with high unused code
  const inefficientThirdParty = thirdPartyStylesheets.filter((stylesheet) => stylesheet.unusedPercentage > 70 && stylesheet.totalBytes > 5000);

  if (inefficientThirdParty.length > 0) {
    recommendations.push({
      type: "third_party_css_optimization",
      title: "Optimize third-party CSS",
      description: `Found ${inefficientThirdParty.length} third-party stylesheets with more than 70% unused CSS. Consider using a CSS purifier or loading these styles asynchronously.`,
      impact: "medium",
      stylesheets: inefficientThirdParty.slice(0, 5).map((stylesheet) => ({
        url: stylesheet.url,
        unusedPercentage: stylesheet.unusedPercentage,
        unusedBytes: stylesheet.unusedBytes,
      })),
    });
  }

  // Check for potential CSS purging opportunities
  const purgeCandidates = sortedStylesheets.filter((stylesheet) => !stylesheet.isThirdParty && stylesheet.unusedPercentage > 60 && (stylesheet.url.includes("styles") || stylesheet.url.includes("css") || stylesheet.url.includes("main")));

  if (purgeCandidates.length > 0) {
    recommendations.push({
      type: "css_purging",
      title: "Implement CSS purging",
      description: `Found ${purgeCandidates.length} stylesheets with significant unused CSS. Consider implementing PurgeCSS or similar tools in your build process.`,
      impact: "high",
      stylesheets: purgeCandidates.slice(0, 5).map((stylesheet) => ({
        url: stylesheet.url,
        unusedPercentage: stylesheet.unusedPercentage,
        unusedBytes: stylesheet.unusedBytes,
      })),
    });
  }

  // Check for inline stylesheets with high unused code
  const inefficientInlineStyles = sortedStylesheets.filter((stylesheet) => stylesheet.url === "(inline stylesheet)" && stylesheet.unusedPercentage > 50 && stylesheet.totalBytes > 5000);

  if (inefficientInlineStyles.length > 0) {
    recommendations.push({
      type: "inline_css_optimization",
      title: "Optimize inline styles",
      description: `Found ${inefficientInlineStyles.length} large inline stylesheets with significant unused CSS. Consider refactoring these styles or moving them to external files with proper loading strategies.`,
      impact: "medium",
      stylesheets: inefficientInlineStyles.slice(0, 3).map((stylesheet) => ({
        unusedPercentage: stylesheet.unusedPercentage,
        unusedBytes: stylesheet.unusedBytes,
        totalBytes: stylesheet.totalBytes,
      })),
    });
  }

  // General recommendation if overall unused CSS is high
  if (sortedStylesheets.length > 0) {
    const totalBytes = sortedStylesheets.reduce((sum, stylesheet) => sum + stylesheet.totalBytes, 0);
    const unusedBytes = sortedStylesheets.reduce((sum, stylesheet) => sum + stylesheet.unusedBytes, 0);
    const overallUnusedPercentage = totalBytes > 0 ? (unusedBytes / totalBytes) * 100 : 0;

    if (overallUnusedPercentage > 50) {
      recommendations.push({
        type: "general_css_optimization",
        title: "Implement critical CSS",
        description: `Overall, ${overallUnusedPercentage.toFixed(1)}% of CSS is unused on this page. Consider implementing critical CSS for above-the-fold content and lazy-loading the rest.`,
        impact: "high",
        details: {
          totalBytes,
          unusedBytes,
          unusedPercentage: overallUnusedPercentage,
        },
      });
    }
  }

  return recommendations;
}
