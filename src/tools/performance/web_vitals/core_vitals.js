/**
 * Core Web Vitals Analyzer
 * Analyzes Core Web Vitals metrics from Performance Observer data
 */

import { logInfo, logError } from "../../../utils/logging.js";

/**
 * Analyze Web Vitals data from samples
 * @param {Array} samples - Web Vitals data samples
 * @returns {Object} Web Vitals analysis
 */
export function analyzeWebVitalsData(samples) {
  try {
    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      return {
        error: "No Web Vitals data available",
      };
    }

    // Extract metrics from samples
    const lcpValues = samples.map((sample) => sample.lcp).filter(Boolean);
    const clsValues = samples.map((sample) => sample.cls).filter(Boolean);
    const fidValues = samples.map((sample) => sample.fid).filter(Boolean);
    const inpValues = samples.map((sample) => sample.inp).filter(Boolean);
    const ttfbValues = samples.map((sample) => sample.ttfb).filter(Boolean);

    // Calculate LCP analysis
    const lcpAnalysis =
      lcpValues.length > 0
        ? {
            value: calculateAverage(lcpValues),
            min: Math.min(...lcpValues),
            max: Math.max(...lcpValues),
            median: calculateMedian(lcpValues),
            p75: calculatePercentile(lcpValues, 75),
            p95: calculatePercentile(lcpValues, 95),
            rating: getRatingForLCP(calculateAverage(lcpValues)),
            samples: lcpValues,
          }
        : null;

    // Calculate CLS analysis
    const clsAnalysis =
      clsValues.length > 0
        ? {
            value: calculateAverage(clsValues),
            min: Math.min(...clsValues),
            max: Math.max(...clsValues),
            median: calculateMedian(clsValues),
            p75: calculatePercentile(clsValues, 75),
            p95: calculatePercentile(clsValues, 95),
            rating: getRatingForCLS(calculateAverage(clsValues)),
            samples: clsValues,
          }
        : null;

    // Calculate FID analysis
    const fidAnalysis =
      fidValues.length > 0
        ? {
            value: calculateAverage(fidValues),
            min: Math.min(...fidValues),
            max: Math.max(...fidValues),
            median: calculateMedian(fidValues),
            p75: calculatePercentile(fidValues, 75),
            p95: calculatePercentile(fidValues, 95),
            rating: getRatingForFID(calculateAverage(fidValues)),
            samples: fidValues,
          }
        : null;

    // Calculate INP analysis
    const inpAnalysis =
      inpValues.length > 0
        ? {
            value: calculateAverage(inpValues),
            min: Math.min(...inpValues),
            max: Math.max(...inpValues),
            median: calculateMedian(inpValues),
            p75: calculatePercentile(inpValues, 75),
            p95: calculatePercentile(inpValues, 95),
            rating: getRatingForINP(calculateAverage(inpValues)),
            samples: inpValues,
          }
        : null;

    // Calculate TTFB analysis
    const ttfbAnalysis =
      ttfbValues.length > 0
        ? {
            value: calculateAverage(ttfbValues),
            min: Math.min(...ttfbValues),
            max: Math.max(...ttfbValues),
            median: calculateMedian(ttfbValues),
            p75: calculatePercentile(ttfbValues, 75),
            p95: calculatePercentile(ttfbValues, 95),
            rating: getRatingForTTFB(calculateAverage(ttfbValues)),
            samples: ttfbValues,
          }
        : null;

    // Calculate overall score
    const overallScore = calculateOverallScore({
      lcp: lcpAnalysis,
      cls: clsAnalysis,
      fid: fidAnalysis,
      inp: inpAnalysis,
      ttfb: ttfbAnalysis,
    });

    return {
      lcp: lcpAnalysis,
      cls: clsAnalysis,
      fid: fidAnalysis,
      inp: inpAnalysis,
      ttfb: ttfbAnalysis,
      overallScore,
      sampleCount: samples.length,
    };
  } catch (error) {
    logError("web_vitals_analyzer", "Failed to analyze Web Vitals data", error);
    return {
      error: `Failed to analyze Web Vitals data: ${error.message}`,
    };
  }
}

/**
 * Calculate average of an array of numbers
 * @param {Array<number>} values - Array of numbers
 * @returns {number} Average value
 */
function calculateAverage(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Calculate median of an array of numbers
 * @param {Array<number>} values - Array of numbers
 * @returns {number} Median value
 */
function calculateMedian(values) {
  if (!values || values.length === 0) return 0;

  const sortedValues = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sortedValues.length / 2);

  return sortedValues.length % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid];
}

/**
 * Calculate percentile of an array of numbers
 * @param {Array<number>} values - Array of numbers
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} Percentile value
 */
function calculatePercentile(values, percentile) {
  if (!values || values.length === 0) return 0;

  const sortedValues = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;

  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

/**
 * Get rating for LCP value
 * @param {number} lcp - LCP value in milliseconds
 * @returns {string} Rating (good, needs-improvement, poor)
 */
function getRatingForLCP(lcp) {
  if (lcp <= 2500) return "good";
  if (lcp <= 4000) return "needs-improvement";
  return "poor";
}

/**
 * Get rating for CLS value
 * @param {number} cls - CLS value
 * @returns {string} Rating (good, needs-improvement, poor)
 */
function getRatingForCLS(cls) {
  if (cls <= 0.1) return "good";
  if (cls <= 0.25) return "needs-improvement";
  return "poor";
}

/**
 * Get rating for FID value
 * @param {number} fid - FID value in milliseconds
 * @returns {string} Rating (good, needs-improvement, poor)
 */
function getRatingForFID(fid) {
  if (fid <= 100) return "good";
  if (fid <= 300) return "needs-improvement";
  return "poor";
}

/**
 * Get rating for INP value
 * @param {number} inp - INP value in milliseconds
 * @returns {string} Rating (good, needs-improvement, poor)
 */
function getRatingForINP(inp) {
  if (inp <= 200) return "good";
  if (inp <= 500) return "needs-improvement";
  return "poor";
}

/**
 * Get rating for TTFB value
 * @param {number} ttfb - TTFB value in milliseconds
 * @returns {string} Rating (good, needs-improvement, poor)
 */
function getRatingForTTFB(ttfb) {
  if (ttfb <= 800) return "good";
  if (ttfb <= 1800) return "needs-improvement";
  return "poor";
}

/**
 * Calculate overall performance score based on Core Web Vitals
 * @param {Object} metrics - Core Web Vitals metrics
 * @returns {number} Overall score (0-100)
 */
function calculateOverallScore(metrics) {
  // Define weights for each metric
  const weights = {
    lcp: 0.25,
    cls: 0.25,
    inp: 0.25, // Prefer INP over FID as it's the newer metric
    fid: 0.15, // Use FID as fallback if INP is not available
    ttfb: 0.1,
  };

  let totalScore = 0;
  let totalWeight = 0;

  // Calculate score for LCP
  if (metrics.lcp) {
    const lcpScore = calculateMetricScore(metrics.lcp.value, [2500, 4000], false);
    totalScore += lcpScore * weights.lcp;
    totalWeight += weights.lcp;
  }

  // Calculate score for CLS
  if (metrics.cls) {
    const clsScore = calculateMetricScore(metrics.cls.value, [0.1, 0.25], false);
    totalScore += clsScore * weights.cls;
    totalWeight += weights.cls;
  }

  // Calculate score for INP or FID
  if (metrics.inp) {
    const inpScore = calculateMetricScore(metrics.inp.value, [200, 500], false);
    totalScore += inpScore * weights.inp;
    totalWeight += weights.inp;
  } else if (metrics.fid) {
    const fidScore = calculateMetricScore(metrics.fid.value, [100, 300], false);
    totalScore += fidScore * weights.fid;
    totalWeight += weights.fid;
  }

  // Calculate score for TTFB
  if (metrics.ttfb) {
    const ttfbScore = calculateMetricScore(metrics.ttfb.value, [800, 1800], false);
    totalScore += ttfbScore * weights.ttfb;
    totalWeight += weights.ttfb;
  }

  // Normalize score based on available metrics
  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
}

/**
 * Calculate score for a metric based on thresholds
 * @param {number} value - Metric value
 * @param {Array<number>} thresholds - Thresholds for needs-improvement and poor ratings
 * @param {boolean} higherIsBetter - Whether higher values are better
 * @returns {number} Score (0-1)
 */
function calculateMetricScore(value, thresholds, higherIsBetter = false) {
  const [goodThreshold, poorThreshold] = thresholds;

  if (higherIsBetter) {
    // Higher values are better (e.g., throughput)
    if (value >= goodThreshold) return 1;
    if (value <= poorThreshold) return 0;
    return (value - poorThreshold) / (goodThreshold - poorThreshold);
  } else {
    // Lower values are better (e.g., latency)
    if (value <= goodThreshold) return 1;
    if (value >= poorThreshold) return 0;
    return 1 - (value - goodThreshold) / (poorThreshold - goodThreshold);
  }
}
