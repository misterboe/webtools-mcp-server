/**
 * Performance analysis modules index
 * Exports all analysis functions for use in performance_trace.js
 */

import { analyzeLongTasks } from "./long_tasks.js";
import { analyzeLayoutThrashing } from "./layout_thrashing.js";
import { analyzeJavaScriptExecution } from "./js_execution.js";
import { analyzeCssVariablesImpact } from "./css_variables.js";
import { analyzeMemoryAndDomGrowth } from "./memory_dom.js";
import { analyzeResourceLoading } from "./resource_loading.js";

/**
 * Analyze trace data to identify performance bottlenecks
 * @param {Object} traceData - The trace data from Chrome DevTools
 * @param {Object} options - Analysis options
 * @param {boolean} options.analyzeLayoutThrashing - Whether to analyze layout thrashing
 * @param {boolean} options.analyzeCssVariables - Whether to analyze CSS variables impact
 * @param {boolean} options.analyzeJsExecution - Whether to analyze JavaScript execution
 * @param {boolean} options.analyzeLongTasks - Whether to analyze long tasks
 * @param {boolean} options.analyzeMemoryAndDom - Whether to analyze memory and DOM growth
 * @param {boolean} options.analyzeResourceLoading - Whether to analyze resource loading
 * @param {number} options.longTaskThresholdMs - Threshold for long tasks detection
 * @param {number} options.layoutThrashingThreshold - Threshold for layout thrashing detection
 * @param {number} options.memoryLeakThresholdKb - Threshold for memory leak detection
 * @param {string} options.detailLevel - Level of detail in the analysis output
 * @param {boolean} options.includeRecommendations - Whether to include optimization recommendations
 * @param {string} options.focusSelector - CSS selector to focus the analysis on
 * @param {string} options.focusTimeRangeMs - Time range to focus the analysis on
 * @returns {Array<Object>} List of identified bottlenecks
 */
export function analyzeTraceData(traceData, options = {}) {
  // Set default options
  const analysisOptions = {
    analyzeLayoutThrashing: true,
    analyzeCssVariables: true,
    analyzeJsExecution: true,
    analyzeLongTasks: true,
    analyzeMemoryAndDom: true,
    analyzeResourceLoading: true,
    longTaskThresholdMs: 50,
    layoutThrashingThreshold: 10,
    memoryLeakThresholdKb: 10,
    detailLevel: "detailed",
    includeRecommendations: true,
    ...options,
  };
  try {
    const bottlenecks = [];
    const events = traceData?.events || [];

    // If no events, return early
    if (!events || events.length === 0) {
      return [
        {
          type: "analysis_error",
          description: "No trace events found",
          details: "The trace data does not contain any events to analyze",
        },
      ];
    }

    // Apply time range filter if specified
    let filteredEvents = events;
    if (analysisOptions.focusTimeRangeMs) {
      const [startTime, endTime] = analysisOptions.focusTimeRangeMs.split("-").map(Number);
      if (!isNaN(startTime) && !isNaN(endTime)) {
        filteredEvents = events.filter((event) => {
          const ts = event.ts / 1000; // Convert to milliseconds
          return ts >= startTime && ts <= endTime;
        });
      }
    }

    // Analyze long tasks if enabled
    if (analysisOptions.analyzeLongTasks) {
      const longTasksAnalysis = analyzeLongTasks(filteredEvents, {
        threshold: analysisOptions.longTaskThresholdMs,
        detailLevel: analysisOptions.detailLevel,
        includeRecommendations: analysisOptions.includeRecommendations,
      });
      if (longTasksAnalysis) {
        bottlenecks.push(longTasksAnalysis);
      }
    }

    // Analyze layout thrashing if enabled
    if (analysisOptions.analyzeLayoutThrashing) {
      const layoutThrashingAnalysis = analyzeLayoutThrashing(filteredEvents, {
        threshold: analysisOptions.layoutThrashingThreshold,
        detailLevel: analysisOptions.detailLevel,
        includeRecommendations: analysisOptions.includeRecommendations,
        focusSelector: analysisOptions.focusSelector,
      });
      if (layoutThrashingAnalysis) {
        bottlenecks.push(layoutThrashingAnalysis);
      }
    }

    // Analyze JavaScript execution if enabled
    if (analysisOptions.analyzeJsExecution) {
      const jsExecutionAnalysis = analyzeJavaScriptExecution(filteredEvents, {
        detailLevel: analysisOptions.detailLevel,
        includeRecommendations: analysisOptions.includeRecommendations,
      });
      if (jsExecutionAnalysis) {
        bottlenecks.push(jsExecutionAnalysis);
      }
    }

    // Analyze CSS variables impact if enabled
    if (analysisOptions.analyzeCssVariables) {
      const styleEvents = filteredEvents.filter((event) => event.name === "RecalculateStyles" || event.name === "UpdateLayoutTree" || event.name === "ParseAuthorStyleSheet");

      if (styleEvents.length > 0) {
        const cssVariablesImpact = analyzeCssVariablesImpact(styleEvents, filteredEvents, {
          detailLevel: analysisOptions.detailLevel,
          includeRecommendations: analysisOptions.includeRecommendations,
          focusSelector: analysisOptions.focusSelector,
        });

        if (cssVariablesImpact.variablesDetected) {
          bottlenecks.push({
            type: "css_variables_impact",
            description: `Detected ${cssVariablesImpact.variableChanges.length} CSS variable changes causing style recalculations`,
            details: cssVariablesImpact,
          });
        }
      }
    }

    // Analyze memory and DOM size if enabled
    if (analysisOptions.analyzeMemoryAndDom) {
      const memoryEvents = filteredEvents.filter((event) => event.name === "UpdateCounters" || event.name.includes("GC") || event.name.includes("Memory"));

      const domEvents = filteredEvents.filter((event) => event.name.includes("DOM") || event.name === "AddElement" || event.name === "RemoveElement");

      if (memoryEvents.length > 0 || domEvents.length > 0) {
        const memoryAnalysis = analyzeMemoryAndDomGrowth(memoryEvents, domEvents, filteredEvents, {
          leakThresholdKb: analysisOptions.memoryLeakThresholdKb,
          detailLevel: analysisOptions.detailLevel,
          includeRecommendations: analysisOptions.includeRecommendations,
          focusSelector: analysisOptions.focusSelector,
        });

        bottlenecks.push({
          type: "memory_dom_analysis",
          description: `${memoryAnalysis.potentialLeaks.length > 0 ? `Detected ${memoryAnalysis.potentialLeaks.length} potential memory leaks` : "No significant memory issues detected"}`,
          details: memoryAnalysis,
        });
      }
    }

    // Analyze resource loading if enabled
    if (analysisOptions.analyzeResourceLoading) {
      const resourceLoadingAnalysis = analyzeResourceLoading(filteredEvents, {
        detailLevel: analysisOptions.detailLevel,
        includeRecommendations: analysisOptions.includeRecommendations,
      });
      if (resourceLoadingAnalysis) {
        bottlenecks.push(resourceLoadingAnalysis);
      }
    }

    return bottlenecks;
  } catch (error) {
    console.error("Failed to analyze trace data", error);
    return [
      {
        type: "analysis_error",
        description: "Failed to analyze performance data",
        details: error.message,
      },
    ];
  }
}

// Export utility functions that are used across multiple analysis modules
export { determineTaskType, findTaskContext, determineResourceType, groupResourcesByType, generateResourceOptimizationSuggestions } from "./utils.js";
