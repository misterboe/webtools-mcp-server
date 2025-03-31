/**
 * Memory and DOM growth analysis module
 */

/**
 * Analyze memory and DOM growth in the trace data
 * @param {Array} memoryEvents - Memory-related events
 * @param {Array} domEvents - DOM-related events
 * @param {Array} allEvents - All trace events
 * @returns {Object} Memory and DOM growth analysis
 */
export function analyzeMemoryAndDomGrowth(memoryEvents, domEvents, allEvents) {
  // Analyze memory usage over time
  const memoryUsage = analyzeMemoryUsage(memoryEvents, allEvents);

  // Analyze DOM size over time
  const domSize = analyzeDomSize(domEvents, allEvents);

  // Detect potential memory leaks
  const potentialLeaks = detectPotentialLeaks(memoryEvents, domEvents, allEvents);

  // Detect event listener leaks
  const eventListenerLeaks = detectEventListenerLeaks(allEvents);

  // Analyze element growth
  const elementGrowth = analyzeElementGrowth(domEvents, allEvents);

  // Generate recommendations
  const recommendations = generateMemoryDomRecommendations(memoryUsage, domSize, potentialLeaks, eventListenerLeaks, elementGrowth);

  return {
    memoryUsage,
    domSize,
    potentialLeaks,
    eventListenerLeaks,
    elementGrowth,
    recommendations,
  };
}

/**
 * Analyze memory usage over time
 * @param {Array} memoryEvents - Memory-related events
 * @param {Array} allEvents - All trace events
 * @returns {Object} Memory usage analysis
 */
function analyzeMemoryUsage(memoryEvents, allEvents) {
  // Extract memory usage data points
  const memoryDataPoints = [];

  // Look for UpdateCounters events with memory data
  for (const event of allEvents) {
    if (event.name === "UpdateCounters" && event.args?.data?.jsHeapSizeUsed) {
      memoryDataPoints.push({
        timestamp: event.ts,
        jsHeapSizeUsed: event.args.data.jsHeapSizeUsed,
        jsHeapSizeTotal: event.args.data.jsHeapSizeTotal || 0,
        jsHeapSizeLimit: event.args.data.jsHeapSizeLimit || 0,
      });
    }
  }

  // If we don't have enough data points, return limited analysis
  if (memoryDataPoints.length < 2) {
    return {
      dataPoints: memoryDataPoints,
      trend: "unknown",
      growthRate: 0,
      peakUsage: memoryDataPoints.length > 0 ? Math.max(...memoryDataPoints.map((p) => p.jsHeapSizeUsed)) : 0,
      averageUsage: memoryDataPoints.length > 0 ? memoryDataPoints.reduce((sum, p) => sum + p.jsHeapSizeUsed, 0) / memoryDataPoints.length : 0,
    };
  }

  // Sort data points by timestamp
  memoryDataPoints.sort((a, b) => a.timestamp - b.timestamp);

  // Calculate growth rate
  const firstPoint = memoryDataPoints[0];
  const lastPoint = memoryDataPoints[memoryDataPoints.length - 1];
  const timeSpanSeconds = (lastPoint.timestamp - firstPoint.timestamp) / 1000000; // Convert to seconds
  const memoryGrowthBytes = lastPoint.jsHeapSizeUsed - firstPoint.jsHeapSizeUsed;
  const growthRatePerSecond = timeSpanSeconds > 0 ? memoryGrowthBytes / timeSpanSeconds : 0;

  // Determine trend
  let trend = "stable";
  if (growthRatePerSecond > 100000) {
    // 100KB per second
    trend = "rapidly increasing";
  } else if (growthRatePerSecond > 10000) {
    // 10KB per second
    trend = "increasing";
  } else if (growthRatePerSecond < -10000) {
    // -10KB per second
    trend = "decreasing";
  }

  // Calculate peak and average usage
  const peakUsage = Math.max(...memoryDataPoints.map((p) => p.jsHeapSizeUsed));
  const averageUsage = memoryDataPoints.reduce((sum, p) => sum + p.jsHeapSizeUsed, 0) / memoryDataPoints.length;

  return {
    dataPoints: memoryDataPoints.map((p) => ({
      timestamp: p.timestamp,
      jsHeapSizeUsed: p.jsHeapSizeUsed,
      jsHeapSizeTotal: p.jsHeapSizeTotal,
      jsHeapSizeLimit: p.jsHeapSizeLimit,
    })),
    trend,
    growthRate: growthRatePerSecond,
    peakUsage,
    averageUsage,
    percentOfLimit: memoryDataPoints[0].jsHeapSizeLimit > 0 ? (peakUsage / memoryDataPoints[0].jsHeapSizeLimit) * 100 : null,
  };
}

/**
 * Analyze DOM size over time
 * @param {Array} domEvents - DOM-related events
 * @param {Array} allEvents - All trace events
 * @returns {Object} DOM size analysis
 */
function analyzeDomSize(domEvents, allEvents) {
  // Extract DOM node count data points
  const domDataPoints = [];

  // Look for UpdateCounters events with DOM node data
  for (const event of allEvents) {
    if (event.name === "UpdateCounters" && event.args?.data?.nodes) {
      domDataPoints.push({
        timestamp: event.ts,
        nodes: event.args.data.nodes,
        documents: event.args.data.documents || 0,
        jsEventListeners: event.args.data.jsEventListeners || 0,
      });
    }
  }

  // If we don't have enough data points, return limited analysis
  if (domDataPoints.length < 2) {
    return {
      dataPoints: domDataPoints,
      trend: "unknown",
      growthRate: 0,
      peakNodes: domDataPoints.length > 0 ? Math.max(...domDataPoints.map((p) => p.nodes)) : 0,
      averageNodes: domDataPoints.length > 0 ? domDataPoints.reduce((sum, p) => sum + p.nodes, 0) / domDataPoints.length : 0,
    };
  }

  // Sort data points by timestamp
  domDataPoints.sort((a, b) => a.timestamp - b.timestamp);

  // Calculate growth rate
  const firstPoint = domDataPoints[0];
  const lastPoint = domDataPoints[domDataPoints.length - 1];
  const timeSpanSeconds = (lastPoint.timestamp - firstPoint.timestamp) / 1000000; // Convert to seconds
  const nodeGrowth = lastPoint.nodes - firstPoint.nodes;
  const growthRatePerSecond = timeSpanSeconds > 0 ? nodeGrowth / timeSpanSeconds : 0;

  // Determine trend
  let trend = "stable";
  if (growthRatePerSecond > 10) {
    // 10 nodes per second
    trend = "rapidly increasing";
  } else if (growthRatePerSecond > 1) {
    // 1 node per second
    trend = "increasing";
  } else if (growthRatePerSecond < -1) {
    // -1 node per second
    trend = "decreasing";
  }

  // Calculate peak and average nodes
  const peakNodes = Math.max(...domDataPoints.map((p) => p.nodes));
  const averageNodes = domDataPoints.reduce((sum, p) => sum + p.nodes, 0) / domDataPoints.length;

  return {
    dataPoints: domDataPoints.map((p) => ({
      timestamp: p.timestamp,
      nodes: p.nodes,
      documents: p.documents,
      jsEventListeners: p.jsEventListeners,
    })),
    trend,
    growthRate: growthRatePerSecond,
    peakNodes,
    averageNodes,
    eventListenersPerNode: domDataPoints[domDataPoints.length - 1].nodes > 0 ? domDataPoints[domDataPoints.length - 1].jsEventListeners / domDataPoints[domDataPoints.length - 1].nodes : 0,
  };
}

/**
 * Detect potential memory leaks
 * @param {Array} memoryEvents - Memory-related events
 * @param {Array} domEvents - DOM-related events
 * @param {Array} allEvents - All trace events
 * @returns {Array} Potential memory leaks
 */
function detectPotentialLeaks(memoryEvents, domEvents, allEvents) {
  const potentialLeaks = [];

  // Extract memory usage data points
  const memoryDataPoints = [];

  // Look for UpdateCounters events with memory data
  for (const event of allEvents) {
    if (event.name === "UpdateCounters" && event.args?.data?.jsHeapSizeUsed) {
      memoryDataPoints.push({
        timestamp: event.ts,
        jsHeapSizeUsed: event.args.data.jsHeapSizeUsed,
        jsHeapSizeTotal: event.args.data.jsHeapSizeTotal || 0,
        jsHeapSizeLimit: event.args.data.jsHeapSizeLimit || 0,
        nodes: event.args.data.nodes || 0,
        jsEventListeners: event.args.data.jsEventListeners || 0,
      });
    }
  }

  // Sort data points by timestamp
  memoryDataPoints.sort((a, b) => a.timestamp - b.timestamp);

  // Check for continuous memory growth
  if (memoryDataPoints.length >= 3) {
    const firstPoint = memoryDataPoints[0];
    const lastPoint = memoryDataPoints[memoryDataPoints.length - 1];
    const timeSpanSeconds = (lastPoint.timestamp - firstPoint.timestamp) / 1000000; // Convert to seconds
    const memoryGrowthBytes = lastPoint.jsHeapSizeUsed - firstPoint.jsHeapSizeUsed;
    const growthRatePerSecond = timeSpanSeconds > 0 ? memoryGrowthBytes / timeSpanSeconds : 0;

    // Check if memory is continuously growing
    if (growthRatePerSecond > 10000 && timeSpanSeconds > 5) {
      // 10KB per second for at least 5 seconds
      // Look for garbage collection events
      const gcEvents = allEvents.filter((e) => e.name.includes("GC"));

      // If we have GC events but memory is still growing, it's a stronger indicator of a leak
      if (gcEvents.length > 0) {
        potentialLeaks.push({
          type: "continuous_memory_growth",
          severity: "high",
          growthRate: growthRatePerSecond,
          timeSpan: timeSpanSeconds,
          gcEvents: gcEvents.length,
          description: `Memory is continuously growing at ${(growthRatePerSecond / 1024).toFixed(2)}KB/s despite ${gcEvents.length} garbage collection events`,
        });
      } else {
        potentialLeaks.push({
          type: "continuous_memory_growth",
          severity: "medium",
          growthRate: growthRatePerSecond,
          timeSpan: timeSpanSeconds,
          description: `Memory is continuously growing at ${(growthRatePerSecond / 1024).toFixed(2)}KB/s`,
        });
      }
    }
  }

  // Check for continuous DOM growth
  if (memoryDataPoints.length >= 3) {
    const nodeDataPoints = memoryDataPoints.filter((p) => p.nodes > 0);

    if (nodeDataPoints.length >= 3) {
      const firstPoint = nodeDataPoints[0];
      const lastPoint = nodeDataPoints[nodeDataPoints.length - 1];
      const timeSpanSeconds = (lastPoint.timestamp - firstPoint.timestamp) / 1000000; // Convert to seconds
      const nodeGrowth = lastPoint.nodes - firstPoint.nodes;
      const growthRatePerSecond = timeSpanSeconds > 0 ? nodeGrowth / timeSpanSeconds : 0;

      // Check if DOM is continuously growing
      if (growthRatePerSecond > 1 && timeSpanSeconds > 5 && nodeGrowth > 10) {
        // 1 node per second for at least 5 seconds, with at least 10 nodes added
        potentialLeaks.push({
          type: "continuous_dom_growth",
          severity: "high",
          growthRate: growthRatePerSecond,
          timeSpan: timeSpanSeconds,
          nodeGrowth,
          description: `DOM is continuously growing at ${growthRatePerSecond.toFixed(2)} nodes/s (${nodeGrowth} nodes added over ${timeSpanSeconds.toFixed(1)}s)`,
        });
      }
    }
  }

  // Check for event listener growth
  if (memoryDataPoints.length >= 3) {
    const listenerDataPoints = memoryDataPoints.filter((p) => p.jsEventListeners > 0);

    if (listenerDataPoints.length >= 3) {
      const firstPoint = listenerDataPoints[0];
      const lastPoint = listenerDataPoints[listenerDataPoints.length - 1];
      const timeSpanSeconds = (lastPoint.timestamp - firstPoint.timestamp) / 1000000; // Convert to seconds
      const listenerGrowth = lastPoint.jsEventListeners - firstPoint.jsEventListeners;
      const growthRatePerSecond = timeSpanSeconds > 0 ? listenerGrowth / timeSpanSeconds : 0;

      // Check if event listeners are continuously growing
      if (growthRatePerSecond > 0.5 && timeSpanSeconds > 5 && listenerGrowth > 5) {
        // 0.5 listeners per second for at least 5 seconds, with at least 5 listeners added
        potentialLeaks.push({
          type: "event_listener_growth",
          severity: "high",
          growthRate: growthRatePerSecond,
          timeSpan: timeSpanSeconds,
          listenerGrowth,
          description: `Event listeners are continuously growing at ${growthRatePerSecond.toFixed(2)} listeners/s (${listenerGrowth} listeners added over ${timeSpanSeconds.toFixed(1)}s)`,
        });
      }
    }
  }

  return potentialLeaks;
}

/**
 * Detect event listener leaks
 * @param {Array} allEvents - All trace events
 * @returns {Array} Event listener leaks
 */
function detectEventListenerLeaks(allEvents) {
  const eventListenerLeaks = [];

  // Extract event listener data points
  const listenerDataPoints = [];

  // Look for UpdateCounters events with event listener data
  for (const event of allEvents) {
    if (event.name === "UpdateCounters" && event.args?.data?.jsEventListeners) {
      listenerDataPoints.push({
        timestamp: event.ts,
        jsEventListeners: event.args.data.jsEventListeners,
        nodes: event.args.data.nodes || 0,
      });
    }
  }

  // Sort data points by timestamp
  listenerDataPoints.sort((a, b) => a.timestamp - b.timestamp);

  // Check for continuous event listener growth
  if (listenerDataPoints.length >= 3) {
    const firstPoint = listenerDataPoints[0];
    const lastPoint = listenerDataPoints[listenerDataPoints.length - 1];
    const timeSpanSeconds = (lastPoint.timestamp - firstPoint.timestamp) / 1000000; // Convert to seconds
    const listenerGrowth = lastPoint.jsEventListeners - firstPoint.jsEventListeners;
    const nodeGrowth = lastPoint.nodes - firstPoint.nodes;

    // If listeners are growing faster than nodes, it might indicate a leak
    if (listenerGrowth > 0 && (nodeGrowth === 0 || listenerGrowth / nodeGrowth > 1.5)) {
      eventListenerLeaks.push({
        type: "disproportionate_listener_growth",
        severity: "medium",
        listenerGrowth,
        nodeGrowth,
        ratio: nodeGrowth > 0 ? listenerGrowth / nodeGrowth : listenerGrowth,
        timeSpan: timeSpanSeconds,
        description: `Event listeners (${listenerGrowth}) are growing faster than DOM nodes (${nodeGrowth})`,
      });
    }
  }

  return eventListenerLeaks;
}

/**
 * Analyze element growth
 * @param {Array} domEvents - DOM-related events
 * @param {Array} allEvents - All trace events
 * @returns {Object} Element growth analysis
 */
function analyzeElementGrowth(domEvents, allEvents) {
  // This is a simplified version - in a real implementation, we would need to analyze the actual DOM

  // Look for DOM mutation events
  const addNodeEvents = allEvents.filter((e) => e.name === "AddElement" || e.name === "DOMNodeInserted");
  const removeNodeEvents = allEvents.filter((e) => e.name === "RemoveElement" || e.name === "DOMNodeRemoved");

  // Group additions by node type
  const additionsByType = {};

  for (const event of addNodeEvents) {
    const nodeType = event.args?.data?.nodeType || event.args?.data?.nodeName || "unknown";

    if (!additionsByType[nodeType]) {
      additionsByType[nodeType] = {
        count: 0,
        events: [],
      };
    }

    additionsByType[nodeType].count++;
    additionsByType[nodeType].events.push(event);
  }

  // Find the fastest growing element types
  const elementTypes = Object.keys(additionsByType);
  elementTypes.sort((a, b) => additionsByType[b].count - additionsByType[a].count);

  const fastestGrowingTypes = elementTypes.slice(0, 5).map((type) => ({
    type,
    count: additionsByType[type].count,
    netGrowth: additionsByType[type].count - (removeNodeEvents.filter((e) => (e.args?.data?.nodeType || e.args?.data?.nodeName) === type).length || 0),
  }));

  return {
    totalAdditions: addNodeEvents.length,
    totalRemovals: removeNodeEvents.length,
    netGrowth: addNodeEvents.length - removeNodeEvents.length,
    fastestGrowingTypes,
  };
}

/**
 * Generate recommendations for memory and DOM
 * @param {Object} memoryUsage - Memory usage analysis
 * @param {Object} domSize - DOM size analysis
 * @param {Array} potentialLeaks - Potential memory leaks
 * @param {Array} eventListenerLeaks - Event listener leaks
 * @param {Object} elementGrowth - Element growth analysis
 * @returns {Array} Recommendations
 */
function generateMemoryDomRecommendations(memoryUsage, domSize, potentialLeaks, eventListenerLeaks, elementGrowth) {
  const recommendations = [];

  // Check for memory leaks
  if (potentialLeaks.length > 0) {
    const memoryLeaks = potentialLeaks.filter((leak) => leak.type === "continuous_memory_growth");

    if (memoryLeaks.length > 0) {
      recommendations.push({
        type: "memory_leak_prevention",
        description: "Potential memory leak detected",
        recommendation: "Check for objects that aren't being garbage collected, such as event listeners that aren't removed, or references held in closures",
      });
    }
  }

  // Check for DOM growth
  if (potentialLeaks.length > 0) {
    const domLeaks = potentialLeaks.filter((leak) => leak.type === "continuous_dom_growth");

    if (domLeaks.length > 0) {
      recommendations.push({
        type: "dom_growth_prevention",
        description: "Continuous DOM growth detected",
        recommendation: "Ensure DOM elements are properly removed when no longer needed, and consider using DOM recycling for dynamic content",
      });
    }
  }

  // Check for event listener leaks
  if (eventListenerLeaks.length > 0 || potentialLeaks.some((leak) => leak.type === "event_listener_growth")) {
    recommendations.push({
      type: "event_listener_cleanup",
      description: "Potential event listener leak detected",
      recommendation: "Ensure all event listeners are properly removed when components are unmounted or destroyed",
    });
  }

  // Check for excessive DOM size
  if (domSize.peakNodes > 1000) {
    recommendations.push({
      type: "dom_size_optimization",
      description: `Large DOM size detected (${domSize.peakNodes} nodes)`,
      recommendation: "Reduce DOM size by using virtualization for long lists, lazy loading components, and removing unnecessary elements",
    });
  }

  // Check for high memory usage
  if (memoryUsage.percentOfLimit && memoryUsage.percentOfLimit > 70) {
    recommendations.push({
      type: "memory_usage_optimization",
      description: `High memory usage detected (${memoryUsage.percentOfLimit.toFixed(1)}% of limit)`,
      recommendation: "Optimize memory usage by reusing objects, using object pools, and avoiding large arrays or strings",
    });
  }

  // Check for specific element growth
  if (elementGrowth.fastestGrowingTypes.length > 0) {
    const topGrower = elementGrowth.fastestGrowingTypes[0];

    if (topGrower.netGrowth > 50) {
      recommendations.push({
        type: "element_growth_optimization",
        description: `Rapid growth of ${topGrower.type} elements (${topGrower.netGrowth} net increase)`,
        recommendation: `Check for ${topGrower.type} elements that aren't being properly cleaned up or recycled`,
      });
    }
  }

  return recommendations;
}
