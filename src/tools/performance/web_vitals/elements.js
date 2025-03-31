/**
 * Problematic Elements Analyzer
 * Identifies elements causing Core Web Vitals issues
 */

import { logInfo, logError } from "../../../utils/logging.js";

/**
 * Identify problematic elements from Web Vitals data
 * @param {Array} samples - Web Vitals data samples
 * @returns {Object} Problematic elements analysis
 */
export function identifyProblematicElements(samples) {
  try {
    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      return {
        error: "No Web Vitals data available",
        lcp: null,
        cls: [],
        inp: null,
      };
    }

    // Extract elements data from samples
    const lcpElements = samples.filter((sample) => sample.elements && sample.elements.lcp).map((sample) => sample.elements.lcp);

    const clsElements = samples.filter((sample) => sample.elements && sample.elements.cls).flatMap((sample) => sample.elements.cls);

    const inpElements = samples.filter((sample) => sample.elements && sample.elements.inp).map((sample) => sample.elements.inp);

    // Identify LCP element (most frequent)
    const lcpElement = identifyMostFrequentElement(lcpElements);

    // Identify CLS elements (sorted by impact)
    const clsElementsAnalysis = analyzeClsElements(clsElements);

    // Identify INP element (most frequent)
    const inpElement = identifyMostFrequentElement(inpElements);

    return {
      lcp: lcpElement,
      cls: clsElementsAnalysis,
      inp: inpElement,
    };
  } catch (error) {
    logError("elements_analyzer", "Failed to identify problematic elements", error);
    return {
      error: `Failed to identify problematic elements: ${error.message}`,
      lcp: null,
      cls: [],
      inp: null,
    };
  }
}

/**
 * Identify the most frequent element in an array of elements
 * @param {Array} elements - Array of elements
 * @returns {Object|null} Most frequent element or null if no elements
 */
function identifyMostFrequentElement(elements) {
  if (!elements || elements.length === 0) {
    return null;
  }

  // Count occurrences of each element path
  const pathCounts = {};

  for (const element of elements) {
    if (!element || !element.path) continue;

    const path = element.path;
    pathCounts[path] = (pathCounts[path] || 0) + 1;
  }

  // Find the most frequent path
  let mostFrequentPath = null;
  let maxCount = 0;

  for (const path in pathCounts) {
    if (pathCounts[path] > maxCount) {
      mostFrequentPath = path;
      maxCount = pathCounts[path];
    }
  }

  // Find the first element with this path
  const mostFrequentElement = elements.find((element) => element && element.path === mostFrequentPath);

  if (mostFrequentElement) {
    return {
      ...mostFrequentElement,
      frequency: maxCount,
      totalOccurrences: elements.length,
    };
  }

  return null;
}

/**
 * Analyze CLS elements to identify the most problematic ones
 * @param {Array} elements - Array of CLS elements
 * @returns {Array} Analyzed CLS elements sorted by impact
 */
function analyzeClsElements(elements) {
  if (!elements || elements.length === 0) {
    return [];
  }

  // Group elements by path
  const elementsByPath = {};

  for (const element of elements) {
    if (!element || !element.path) continue;

    const path = element.path;

    if (!elementsByPath[path]) {
      elementsByPath[path] = {
        path,
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        shifts: [],
        totalShiftDistance: 0,
        occurrences: 0,
      };
    }

    // Add shift information
    if (element.currentRect && element.previousRect) {
      const shiftX = Math.abs(element.currentRect.x - element.previousRect.x);
      const shiftY = Math.abs(element.currentRect.y - element.previousRect.y);
      const shiftDistance = Math.sqrt(shiftX * shiftX + shiftY * shiftY);

      elementsByPath[path].shifts.push({
        x: shiftX,
        y: shiftY,
        distance: shiftDistance,
        currentRect: element.currentRect,
        previousRect: element.previousRect,
      });

      elementsByPath[path].totalShiftDistance += shiftDistance;
    }

    elementsByPath[path].occurrences++;
  }

  // Convert to array and calculate average shift
  const analyzedElements = Object.values(elementsByPath).map((element) => {
    return {
      ...element,
      averageShiftDistance: element.totalShiftDistance / (element.shifts.length || 1),
      impact: calculateClsImpact(element),
    };
  });

  // Sort by impact (descending)
  return analyzedElements.sort((a, b) => b.impact - a.impact);
}

/**
 * Calculate CLS impact score for an element
 * @param {Object} element - Element with shift data
 * @returns {number} Impact score
 */
function calculateClsImpact(element) {
  if (!element || !element.shifts || element.shifts.length === 0) {
    return 0;
  }

  // Impact is based on:
  // 1. Total shift distance
  // 2. Number of occurrences
  // 3. Element size (larger elements have more impact)

  const averageSize =
    element.shifts.reduce((sum, shift) => {
      const currentArea = shift.currentRect.width * shift.currentRect.height;
      const previousArea = shift.previousRect.width * shift.previousRect.height;
      return sum + (currentArea + previousArea) / 2;
    }, 0) / element.shifts.length;

  // Normalize size (0-1 scale, assuming 1,000,000 pixels² as max)
  const normalizedSize = Math.min(averageSize / 1000000, 1);

  // Calculate impact score
  return element.totalShiftDistance * element.occurrences * (0.3 + 0.7 * normalizedSize);
}

/**
 * Get element type based on tag name and attributes
 * @param {Object} element - Element data
 * @returns {string} Element type description
 */
export function getElementType(element) {
  if (!element) return "Unknown";

  const tagName = (element.tagName || "").toLowerCase();
  const className = element.className || "";
  const id = element.id || "";

  // Check for images
  if (tagName === "img" || tagName === "picture" || tagName === "svg") {
    return "Image";
  }

  // Check for videos
  if (tagName === "video" || (tagName === "iframe" && (element.src || "").includes("youtube"))) {
    return "Video";
  }

  // Check for ads
  if (className.includes("ad") || id.includes("ad") || (tagName === "iframe" && (element.src || "").includes("ads"))) {
    return "Advertisement";
  }

  // Check for headers/hero sections
  if (tagName === "header" || id.includes("header") || className.includes("header") || className.includes("hero")) {
    return "Header/Hero Section";
  }

  // Check for navigation
  if (tagName === "nav" || id.includes("nav") || className.includes("nav") || className.includes("menu")) {
    return "Navigation";
  }

  // Check for buttons
  if (tagName === "button" || tagName === "a" || element.role === "button") {
    return "Button/Link";
  }

  // Check for forms
  if (tagName === "form" || tagName === "input" || tagName === "select" || tagName === "textarea") {
    return "Form Element";
  }

  // Check for text content
  if (tagName === "p" || tagName === "h1" || tagName === "h2" || tagName === "h3" || tagName === "h4" || tagName === "h5" || tagName === "h6" || tagName === "span" || (tagName === "div" && !className && !id)) {
    return "Text Content";
  }

  // Default to container
  if (tagName === "div" || tagName === "section" || tagName === "article") {
    return "Container";
  }

  return `${tagName.charAt(0).toUpperCase() + tagName.slice(1)} Element`;
}

/**
 * Get optimization suggestions for an element based on its type and metrics
 * @param {Object} element - Element data
 * @param {string} metricType - Metric type (lcp, cls, inp)
 * @returns {Array<string>} Optimization suggestions
 */
export function getElementOptimizationSuggestions(element, metricType) {
  if (!element) return [];

  const elementType = getElementType(element);
  const suggestions = [];

  // LCP suggestions
  if (metricType === "lcp") {
    if (elementType === "Image") {
      suggestions.push("Use responsive images with srcset and sizes attributes");
      suggestions.push("Implement lazy loading for images below the fold");
      suggestions.push("Consider using WebP or AVIF formats for better compression");
      suggestions.push("Preload the LCP image with <link rel='preload'>");
      suggestions.push("Optimize image dimensions and quality");
    } else if (elementType === "Text Content") {
      suggestions.push("Ensure text is visible during webfont loading with font-display: swap");
      suggestions.push("Preload critical webfonts");
      suggestions.push("Consider using system fonts or variable fonts");
    } else {
      suggestions.push("Minimize render-blocking resources");
      suggestions.push("Implement critical CSS for above-the-fold content");
      suggestions.push("Consider server-side rendering or static generation");
    }
  }

  // CLS suggestions
  if (metricType === "cls") {
    if (elementType === "Image") {
      suggestions.push("Set explicit width and height attributes on images");
      suggestions.push("Use aspect-ratio CSS property");
      suggestions.push("Implement content-visibility for off-screen images");
    } else if (elementType === "Advertisement") {
      suggestions.push("Reserve space for ad slots with min-height and min-width");
      suggestions.push("Use placeholder elements for ads");
    } else if (elementType === "Form Element") {
      suggestions.push("Avoid inserting new elements above existing content after user input");
      suggestions.push("Pre-allocate space for dynamic content");
    } else {
      suggestions.push("Avoid inserting content above existing content");
      suggestions.push("Use transform animations instead of properties that trigger layout");
      suggestions.push("Ensure all dynamic content has reserved space");
    }
  }

  // INP suggestions
  if (metricType === "inp") {
    if (elementType === "Button/Link") {
      suggestions.push("Optimize event handlers to be less complex");
      suggestions.push("Use event delegation for multiple similar elements");
      suggestions.push("Debounce or throttle event handlers for frequent events");
    } else if (elementType === "Form Element") {
      suggestions.push("Validate forms asynchronously");
      suggestions.push("Implement progressive enhancement for form submissions");
      suggestions.push("Use requestAnimationFrame for visual updates");
    } else {
      suggestions.push("Break up long tasks into smaller, asynchronous tasks");
      suggestions.push("Use a web worker for heavy computations");
      suggestions.push("Implement code-splitting and lazy loading");
    }
  }

  return suggestions;
}
