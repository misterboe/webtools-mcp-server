/**
 * Layout thrashing analysis module
 */

/**
 * Analyze layout thrashing in the trace data
 * @param {Array} events - All trace events
 * @returns {Object|null} Layout thrashing analysis or null if no layout thrashing found
 */
export function analyzeLayoutThrashing(events) {
  // Find layout and style events
  const layoutEvents = events.filter((event) => event.name === "Layout" || event.name === "UpdateLayoutTree");
  const recalcStyleEvents = events.filter((event) => event.name === "RecalculateStyles");

  if (layoutEvents.length === 0) {
    return null;
  }

  // Find layout invalidation sequences (read-write-read patterns)
  const layoutSequences = findLayoutThrashingSequences(events);

  // Find forced layout events (layout operations triggered by JavaScript)
  const forcedLayouts = findForcedLayouts(events);

  // Create a DOM mutation heatmap
  const domMutations = events.filter((event) => event.name === "UpdateLayoutTree" || event.name === "Layout" || event.name === "RecalculateStyles");

  const mutationHeatmap = createDomMutationHeatmap(domMutations);

  // Identify the worst offenders
  const worstOffenders = findWorstLayoutThrashingOffenders(events);

  // Generate recommendations
  const recommendations = generateLayoutThrashingRecommendations(layoutEvents, recalcStyleEvents, layoutSequences, forcedLayouts, worstOffenders);

  return {
    type: "layout_thrashing",
    description: `Detected ${layoutSequences.length} layout thrashing sequences and ${forcedLayouts.length} forced layouts`,
    details: {
      layoutOperations: layoutEvents.length,
      styleRecalculations: recalcStyleEvents.length,
      layoutThrashingSequences: layoutSequences,
      forcedLayouts: forcedLayouts,
      domMutationHeatmap: mutationHeatmap,
      worstOffenders: worstOffenders,
      recommendations: recommendations,
    },
  };
}

/**
 * Find sequences of events that indicate layout thrashing
 * @param {Array} events - All trace events
 * @returns {Array} Layout thrashing sequences
 */
function findLayoutThrashingSequences(events) {
  const sequences = [];
  const layoutReadEvents = events.filter((e) => e.name === "Layout" && e.args?.data?.beginData?.stackTrace);

  // For each layout read, check if it's followed by a write and then another read
  for (let i = 0; i < layoutReadEvents.length - 1; i++) {
    const currentRead = layoutReadEvents[i];
    const nextRead = layoutReadEvents[i + 1];

    // Find any DOM write events between these two reads
    const writesBetween = events.filter((e) => e.ts > currentRead.ts && e.ts < nextRead.ts && (e.name === "UpdateLayoutTree" || e.name.includes("Mutation")));

    if (writesBetween.length > 0) {
      sequences.push({
        firstRead: {
          time: currentRead.ts,
          duration: currentRead.dur / 1000,
          stackTrace: currentRead.args?.data?.beginData?.stackTrace || [],
        },
        writes: writesBetween.map((w) => ({
          time: w.ts,
          type: w.name,
          duration: w.dur / 1000,
        })),
        secondRead: {
          time: nextRead.ts,
          duration: nextRead.dur / 1000,
          stackTrace: nextRead.args?.data?.beginData?.stackTrace || [],
        },
        timeBetweenReads: (nextRead.ts - currentRead.ts) / 1000,
        impact: nextRead.dur / 1000, // The duration of the forced layout
      });
    }
  }

  return sequences;
}

/**
 * Find layout operations that were forced by JavaScript
 * @param {Array} events - All trace events
 * @returns {Array} Forced layout operations
 */
function findForcedLayouts(events) {
  const forcedLayouts = [];

  // Look for Layout events with stack traces (indicating they were forced by JS)
  const layoutEvents = events.filter((e) => e.name === "Layout" && e.args?.data?.beginData?.stackTrace && e.args.data.beginData.stackTrace.length > 0);

  for (const layout of layoutEvents) {
    // Find the JS event that triggered this layout
    const jsEvents = events.filter((e) => e.ts < layout.ts && e.ts + e.dur >= layout.ts && (e.name === "V8.Execute" || e.name === "FunctionCall" || e.name === "EvaluateScript"));

    if (jsEvents.length > 0) {
      const jsEvent = jsEvents[jsEvents.length - 1]; // Get the most recent JS event

      forcedLayouts.push({
        layout: {
          time: layout.ts,
          duration: layout.dur / 1000,
        },
        javascript: {
          time: jsEvent.ts,
          duration: jsEvent.dur / 1000,
          functionName: jsEvent.args?.data?.functionName || "anonymous",
          url: jsEvent.args?.data?.url || jsEvent.args?.data?.fileName || "unknown",
          lineNumber: jsEvent.args?.data?.lineNumber,
          columnNumber: jsEvent.args?.data?.columnNumber,
        },
        stackTrace: layout.args?.data?.beginData?.stackTrace || [],
      });
    }
  }

  return forcedLayouts;
}

/**
 * Create a heatmap of DOM mutations
 * @param {Array} domEvents - DOM-related events
 * @returns {Object} DOM mutation heatmap
 */
function createDomMutationHeatmap(domEvents) {
  // Group mutations by their target (if available)
  const mutationsByTarget = {};

  for (const event of domEvents) {
    const target = event.args?.data?.nodeName || event.args?.data?.selector || event.args?.data?.tagName || "unknown";

    if (!mutationsByTarget[target]) {
      mutationsByTarget[target] = {
        count: 0,
        totalDuration: 0,
        events: [],
      };
    }

    mutationsByTarget[target].count++;
    mutationsByTarget[target].totalDuration += event.dur || 0;
    mutationsByTarget[target].events.push({
      type: event.name,
      time: event.ts,
      duration: event.dur / 1000,
    });
  }

  // Convert to array and sort by count
  const heatmapEntries = Object.keys(mutationsByTarget).map((target) => ({
    target,
    count: mutationsByTarget[target].count,
    totalDuration: mutationsByTarget[target].totalDuration / 1000,
    averageDuration: mutationsByTarget[target].totalDuration / mutationsByTarget[target].count / 1000,
    events: mutationsByTarget[target].events.slice(0, 10), // Limit to 10 events per target
  }));

  heatmapEntries.sort((a, b) => b.count - a.count);

  return {
    topMutationTargets: heatmapEntries.slice(0, 10), // Top 10 targets
    totalMutations: domEvents.length,
    totalMutationTime: domEvents.reduce((sum, e) => sum + (e.dur || 0), 0) / 1000,
  };
}

/**
 * Find the worst offenders for layout thrashing
 * @param {Array} events - All trace events
 * @returns {Array} Worst layout thrashing offenders
 */
function findWorstLayoutThrashingOffenders(events) {
  // Look for JavaScript functions that trigger layout operations
  const layoutEvents = events.filter((e) => e.name === "Layout" && e.args?.data?.beginData?.stackTrace);

  // Group by the script URL and function name if available
  const offenderMap = {};

  for (const layout of layoutEvents) {
    const stackTrace = layout.args?.data?.beginData?.stackTrace || [];

    if (stackTrace.length > 0) {
      // Use the top of the stack trace as the offender
      const topFrame = stackTrace[0];
      const key = `${topFrame.url}:${topFrame.functionName}:${topFrame.lineNumber}`;

      if (!offenderMap[key]) {
        offenderMap[key] = {
          url: topFrame.url,
          functionName: topFrame.functionName || "anonymous",
          lineNumber: topFrame.lineNumber,
          columnNumber: topFrame.columnNumber,
          count: 0,
          totalDuration: 0,
        };
      }

      offenderMap[key].count++;
      offenderMap[key].totalDuration += layout.dur || 0;
    }
  }

  // Convert to array and sort by count
  const offenders = Object.values(offenderMap);
  offenders.sort((a, b) => b.count - a.count);

  return offenders.slice(0, 10).map((o) => ({
    ...o,
    totalDuration: o.totalDuration / 1000,
    averageDuration: o.totalDuration / o.count / 1000,
  }));
}

/**
 * Generate recommendations for layout thrashing
 * @param {Array} layoutEvents - Layout events
 * @param {Array} recalcStyleEvents - Style recalculation events
 * @param {Array} layoutSequences - Layout thrashing sequences
 * @param {Array} forcedLayouts - Forced layout operations
 * @param {Array} worstOffenders - Worst layout thrashing offenders
 * @returns {Array} Recommendations
 */
function generateLayoutThrashingRecommendations(layoutEvents, recalcStyleEvents, layoutSequences, forcedLayouts, worstOffenders) {
  const recommendations = [];

  // Check for layout thrashing sequences
  if (layoutSequences.length > 0) {
    recommendations.push({
      type: "layout_thrashing_prevention",
      description: `${layoutSequences.length} layout thrashing sequences detected`,
      recommendation: "Batch DOM reads and writes to prevent layout thrashing. Read all properties first, then perform all DOM updates.",
    });

    // If we have specific offenders, add more detailed recommendations
    if (worstOffenders.length > 0) {
      const topOffender = worstOffenders[0];
      recommendations.push({
        type: "specific_layout_thrashing",
        description: `Function ${topOffender.functionName} in ${topOffender.url} triggered ${topOffender.count} layout operations`,
        recommendation: `Review this function at line ${topOffender.lineNumber} and batch DOM reads and writes.`,
      });
    }
  }

  // Check for forced layouts
  if (forcedLayouts.length > 0) {
    recommendations.push({
      type: "forced_layout_prevention",
      description: `${forcedLayouts.length} forced layout operations detected`,
      recommendation: "Avoid accessing properties that trigger layout calculations (like offsetWidth, clientHeight, etc.) immediately after DOM modifications.",
    });
  }

  // Check for excessive style recalculations
  if (recalcStyleEvents.length > 50) {
    recommendations.push({
      type: "style_recalculation_optimization",
      description: `${recalcStyleEvents.length} style recalculations detected`,
      recommendation: "Minimize style changes, use CSS classes instead of inline styles, and consider using CSS containment.",
    });
  }

  // Check for frequent layout operations
  if (layoutEvents.length > 100) {
    recommendations.push({
      type: "layout_frequency_reduction",
      description: `High number of layout operations (${layoutEvents.length})`,
      recommendation: "Reduce the frequency of layout operations by batching DOM updates and using requestAnimationFrame for visual changes.",
    });
  }

  return recommendations;
}
