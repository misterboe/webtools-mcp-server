/**
 * JavaScript Coverage Analyzer
 * Analyzes JavaScript coverage data from Chrome DevTools Protocol
 */

import { logInfo, logError } from "../../../utils/logging.js";
import { URL } from "url";

/**
 * Analyze JavaScript coverage data
 * @param {Array} jsCoverage - JavaScript coverage data from CDP
 * @param {Object} options - Analysis options
 * @param {string} options.url - The URL of the page being analyzed
 * @param {boolean} options.includeThirdParty - Whether to include third-party scripts in the analysis
 * @returns {Promise<Object>} JavaScript coverage analysis
 */
export async function analyzeJSCoverage(jsCoverage, options = {}) {
  const { url, includeThirdParty = true } = options;

  try {
    if (!jsCoverage || !Array.isArray(jsCoverage) || jsCoverage.length === 0) {
      return {
        error: "No JavaScript coverage data available",
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

    // Process each script
    const scriptAnalysis = jsCoverage.map((script) => {
      const scriptUrl = script.url;
      let isThirdParty = false;

      // Determine if script is third-party
      if (scriptUrl) {
        try {
          const scriptDomain = new URL(scriptUrl).hostname;
          isThirdParty = scriptDomain !== baseDomain && !scriptDomain.endsWith(`.${baseDomain}`);
        } catch (e) {
          // If URL parsing fails, consider it first-party (could be a data URL or relative path)
          isThirdParty = false;
        }
      }

      // Calculate coverage statistics
      const totalBytes = script.functions.reduce((sum, func) => sum + func.ranges.reduce((s, range) => s + range.endOffset - range.startOffset, 0), 0);

      // Calculate unused bytes
      let unusedBytes = 0;
      const unusedRanges = [];

      for (const func of script.functions) {
        for (const range of func.ranges) {
          if (!range.count) {
            unusedBytes += range.endOffset - range.startOffset;
            unusedRanges.push({
              startOffset: range.startOffset,
              endOffset: range.endOffset,
              startLine: getLineFromOffset(script.scriptSource, range.startOffset),
              endLine: getLineFromOffset(script.scriptSource, range.endOffset),
              length: range.endOffset - range.startOffset,
            });
          }
        }
      }

      // Calculate percentage
      const unusedPercentage = totalBytes > 0 ? (unusedBytes / totalBytes) * 100 : 0;

      return {
        url: scriptUrl || "(inline script)",
        isThirdParty,
        totalBytes,
        unusedBytes,
        unusedPercentage,
        unusedRanges: unusedRanges.sort((a, b) => b.length - a.length).slice(0, 10), // Top 10 largest unused ranges
      };
    });

    // Filter scripts based on third-party setting
    const filteredScripts = includeThirdParty ? scriptAnalysis : scriptAnalysis.filter((script) => !script.isThirdParty);

    // Calculate overall statistics
    const totalBytes = filteredScripts.reduce((sum, script) => sum + script.totalBytes, 0);
    const unusedBytes = filteredScripts.reduce((sum, script) => sum + script.unusedBytes, 0);
    const unusedPercentage = totalBytes > 0 ? (unusedBytes / totalBytes) * 100 : 0;

    // Sort scripts by unused bytes (descending)
    const sortedScripts = [...filteredScripts].sort((a, b) => b.unusedBytes - a.unusedBytes);

    // Analyze third-party scripts separately
    const thirdPartyScripts = scriptAnalysis.filter((script) => script.isThirdParty);
    const thirdPartyTotalBytes = thirdPartyScripts.reduce((sum, script) => sum + script.totalBytes, 0);
    const thirdPartyUnusedBytes = thirdPartyScripts.reduce((sum, script) => sum + script.unusedBytes, 0);
    const thirdPartyUnusedPercentage = thirdPartyTotalBytes > 0 ? (thirdPartyUnusedBytes / thirdPartyTotalBytes) * 100 : 0;

    // Generate recommendations
    const recommendations = generateJSRecommendations(sortedScripts, thirdPartyScripts);

    return {
      totalBytes,
      unusedBytes,
      unusedPercentage,
      files: filteredScripts.map((script) => ({
        url: script.url,
        isThirdParty: script.isThirdParty,
        totalBytes: script.totalBytes,
        unusedBytes: script.unusedBytes,
        unusedPercentage: script.unusedPercentage,
      })),
      unusedByFile: sortedScripts.slice(0, 10).map((script) => ({
        url: script.url,
        isThirdParty: script.isThirdParty,
        totalBytes: script.totalBytes,
        unusedBytes: script.unusedBytes,
        unusedPercentage: script.unusedPercentage,
        topUnusedRanges: script.unusedRanges,
      })),
      thirdPartyAnalysis: {
        totalBytes: thirdPartyTotalBytes,
        unusedBytes: thirdPartyUnusedBytes,
        unusedPercentage: thirdPartyUnusedPercentage,
        files: thirdPartyScripts.map((script) => ({
          url: script.url,
          totalBytes: script.totalBytes,
          unusedBytes: script.unusedBytes,
          unusedPercentage: script.unusedPercentage,
        })),
      },
      recommendations,
    };
  } catch (error) {
    logError("js_coverage_analyzer", "Failed to analyze JavaScript coverage", error);
    return {
      error: `Failed to analyze JavaScript coverage: ${error.message}`,
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
 * Get line number from character offset in source code
 * @param {string} source - Source code
 * @param {number} offset - Character offset
 * @returns {number} Line number (1-based)
 */
function getLineFromOffset(source, offset) {
  if (!source) return 1;

  const lines = source.substring(0, offset).split("\n");
  return lines.length;
}

/**
 * Generate recommendations based on JavaScript coverage analysis
 * @param {Array} sortedScripts - Scripts sorted by unused bytes (descending)
 * @param {Array} thirdPartyScripts - Third-party scripts
 * @returns {Array} Recommendations
 */
function generateJSRecommendations(sortedScripts, thirdPartyScripts) {
  const recommendations = [];

  // Check for large unused scripts
  const largeUnusedScripts = sortedScripts.filter((script) => script.unusedPercentage > 50 && script.totalBytes > 50000);

  if (largeUnusedScripts.length > 0) {
    recommendations.push({
      type: "code_splitting",
      title: "Consider code splitting for large scripts",
      description: `Found ${largeUnusedScripts.length} large scripts with more than 50% unused code. Consider implementing code splitting to load only the necessary code for each page.`,
      impact: "high",
      scripts: largeUnusedScripts.slice(0, 5).map((script) => ({
        url: script.url,
        unusedPercentage: script.unusedPercentage,
        unusedBytes: script.unusedBytes,
      })),
    });
  }

  // Check for third-party scripts with high unused code
  const inefficientThirdParty = thirdPartyScripts.filter((script) => script.unusedPercentage > 70 && script.totalBytes > 30000);

  if (inefficientThirdParty.length > 0) {
    recommendations.push({
      type: "third_party_optimization",
      title: "Optimize third-party script loading",
      description: `Found ${inefficientThirdParty.length} third-party scripts with more than 70% unused code. Consider loading these scripts asynchronously, using defer, or implementing lazy loading.`,
      impact: "medium",
      scripts: inefficientThirdParty.slice(0, 5).map((script) => ({
        url: script.url,
        unusedPercentage: script.unusedPercentage,
        unusedBytes: script.unusedBytes,
      })),
    });
  }

  // Check for potential tree-shaking opportunities
  const treeShakingCandidates = sortedScripts.filter((script) => !script.isThirdParty && script.unusedPercentage > 40 && (script.url.includes("bundle") || script.url.includes("vendor") || script.url.includes("main")));

  if (treeShakingCandidates.length > 0) {
    recommendations.push({
      type: "tree_shaking",
      title: "Implement tree-shaking for bundled code",
      description: `Found ${treeShakingCandidates.length} bundled scripts with significant unused code. Consider implementing tree-shaking in your build process to eliminate unused exports.`,
      impact: "high",
      scripts: treeShakingCandidates.slice(0, 5).map((script) => ({
        url: script.url,
        unusedPercentage: script.unusedPercentage,
        unusedBytes: script.unusedBytes,
      })),
    });
  }

  // Check for inline scripts with high unused code
  const inefficientInlineScripts = sortedScripts.filter((script) => script.url === "(inline script)" && script.unusedPercentage > 50 && script.totalBytes > 10000);

  if (inefficientInlineScripts.length > 0) {
    recommendations.push({
      type: "inline_script_optimization",
      title: "Optimize inline scripts",
      description: `Found ${inefficientInlineScripts.length} large inline scripts with significant unused code. Consider refactoring these scripts or moving them to external files with proper loading strategies.`,
      impact: "medium",
      scripts: inefficientInlineScripts.slice(0, 3).map((script) => ({
        unusedPercentage: script.unusedPercentage,
        unusedBytes: script.unusedBytes,
        totalBytes: script.totalBytes,
      })),
    });
  }

  // General recommendation if overall unused code is high
  if (sortedScripts.length > 0) {
    const totalBytes = sortedScripts.reduce((sum, script) => sum + script.totalBytes, 0);
    const unusedBytes = sortedScripts.reduce((sum, script) => sum + script.unusedBytes, 0);
    const overallUnusedPercentage = totalBytes > 0 ? (unusedBytes / totalBytes) * 100 : 0;

    if (overallUnusedPercentage > 40) {
      recommendations.push({
        type: "general_js_optimization",
        title: "Implement lazy loading for JavaScript",
        description: `Overall, ${overallUnusedPercentage.toFixed(1)}% of JavaScript code is unused on this page. Consider implementing lazy loading strategies to defer non-critical JavaScript until needed.`,
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
