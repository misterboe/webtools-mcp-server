/**
 * JavaScript execution analysis module
 */

/**
 * Analyze JavaScript execution in the trace data
 * @param {Array} events - All trace events
 * @returns {Object|null} JavaScript execution analysis or null if no JS execution found
 */
export function analyzeJavaScriptExecution(events) {
  // Find JavaScript execution events
  const jsEvents = events.filter((event) => event.name === "V8.Execute" || event.name === "FunctionCall" || event.name === "EvaluateScript");

  if (jsEvents.length === 0) {
    return null;
  }

  // Find layout events for correlation
  const layoutEvents = events.filter((event) => event.name === "Layout" || event.name === "UpdateLayoutTree");

  // Calculate total JavaScript execution time
  const totalJsTime = jsEvents.reduce((sum, event) => sum + (event.dur || 0), 0);

  // Correlate JS execution with layout events
  const jsLayoutCorrelation = correlateJsWithLayout(jsEvents, layoutEvents, events);

  // Analyze the call stack to find functions that trigger layouts
  const callStackAnalysis = analyzeCallStacksForLayout(events);

  // Extract code snippets that cause layout thrashing
  const layoutThrashingCodeSnippets = extractLayoutThrashingCodeSnippets(events);

  // Analyze script evaluation times
  const scriptEvaluations = analyzeScriptEvaluations(jsEvents);

  // Generate recommendations
  const recommendations = generateJsExecutionRecommendations(jsEvents, jsLayoutCorrelation, callStackAnalysis, scriptEvaluations);

  return {
    type: "javascript_execution",
    description: `Total JavaScript execution time: ${(totalJsTime / 1000).toFixed(2)}ms with ${jsLayoutCorrelation.correlatedEvents.length} layout-triggering operations`,
    details: {
      totalExecutionTime: totalJsTime / 1000,
      scriptEvaluation: scriptEvaluations,
      jsLayoutCorrelation: jsLayoutCorrelation,
      callStackAnalysis: callStackAnalysis,
      layoutThrashingCodeSnippets: layoutThrashingCodeSnippets,
      recommendations: recommendations,
    },
  };
}

/**
 * Correlate JavaScript execution with layout events
 * @param {Array} jsEvents - JavaScript execution events
 * @param {Array} layoutEvents - Layout events
 * @param {Array} allEvents - All trace events
 * @returns {Object} Correlation analysis
 */
function correlateJsWithLayout(jsEvents, layoutEvents, allEvents) {
  const correlatedEvents = [];

  // For each layout event, find the JS event that might have triggered it
  for (const layout of layoutEvents) {
    // Look for JS events that completed shortly before this layout
    const THRESHOLD_US = 100 * 1000; // 100ms in microseconds

    const precedingJsEvents = jsEvents.filter((js) => js.ts + js.dur <= layout.ts && js.ts + js.dur > layout.ts - THRESHOLD_US);

    if (precedingJsEvents.length > 0) {
      // Sort by proximity to the layout event
      precedingJsEvents.sort((a, b) => layout.ts - (a.ts + a.dur) - (layout.ts - (b.ts + b.dur)));

      const jsEvent = precedingJsEvents[0]; // Closest JS event

      correlatedEvents.push({
        layout: {
          time: layout.ts,
          duration: layout.dur / 1000,
          type: layout.name,
        },
        javascript: {
          time: jsEvent.ts,
          duration: jsEvent.dur / 1000,
          functionName: jsEvent.args?.data?.functionName || "anonymous",
          url: jsEvent.args?.data?.url || jsEvent.args?.data?.fileName || "unknown",
          lineNumber: jsEvent.args?.data?.lineNumber,
          columnNumber: jsEvent.args?.data?.columnNumber,
        },
        timeBetween: (layout.ts - (jsEvent.ts + jsEvent.dur)) / 1000,
      });
    }
  }

  // Group by JavaScript function
  const byFunction = {};

  for (const corr of correlatedEvents) {
    const key = `${corr.javascript.url}:${corr.javascript.functionName}`;

    if (!byFunction[key]) {
      byFunction[key] = {
        url: corr.javascript.url,
        functionName: corr.javascript.functionName,
        layoutCount: 0,
        totalLayoutDuration: 0,
        correlations: [],
      };
    }

    byFunction[key].layoutCount++;
    byFunction[key].totalLayoutDuration += corr.layout.duration;
    byFunction[key].correlations.push(corr);
  }

  // Convert to array and sort by layout count
  const functionImpact = Object.values(byFunction);
  functionImpact.sort((a, b) => b.layoutCount - a.layoutCount);

  return {
    correlatedEvents,
    functionImpact: functionImpact.slice(0, 10).map((f) => ({
      ...f,
      totalLayoutDuration: f.totalLayoutDuration,
      averageLayoutDuration: f.totalLayoutDuration / f.layoutCount,
      correlations: f.correlations.slice(0, 5), // Limit to 5 correlations per function
    })),
  };
}

/**
 * Analyze call stacks to find functions that trigger layouts
 * @param {Array} events - All trace events
 * @returns {Object} Call stack analysis
 */
function analyzeCallStacksForLayout(events) {
  // Find layout events with stack traces
  const layoutsWithStacks = events.filter((e) => e.name === "Layout" && e.args?.data?.beginData?.stackTrace && e.args.data.beginData.stackTrace.length > 0);

  if (layoutsWithStacks.length === 0) {
    return { stacksAnalyzed: false };
  }

  // Analyze the stack traces
  const functionCounts = {};

  for (const layout of layoutsWithStacks) {
    const stackTrace = layout.args.data.beginData.stackTrace;

    // Process each frame in the stack trace
    for (const frame of stackTrace) {
      const key = `${frame.url}:${frame.functionName}:${frame.lineNumber}`;

      if (!functionCounts[key]) {
        functionCounts[key] = {
          url: frame.url,
          functionName: frame.functionName || "anonymous",
          lineNumber: frame.lineNumber,
          columnNumber: frame.columnNumber,
          count: 0,
          totalDuration: 0,
        };
      }

      functionCounts[key].count++;
      functionCounts[key].totalDuration += layout.dur || 0;
    }
  }

  // Convert to array and sort by count
  const functions = Object.values(functionCounts);
  functions.sort((a, b) => b.count - a.count);

  return {
    stacksAnalyzed: true,
    layoutsWithStackTraces: layoutsWithStacks.length,
    topFunctions: functions.slice(0, 15).map((f) => ({
      ...f,
      totalDuration: f.totalDuration / 1000,
      averageDuration: f.totalDuration / f.count / 1000,
    })),
  };
}

/**
 * Extract code snippets that cause layout thrashing
 * @param {Array} events - All trace events
 * @returns {Array} Code snippets that cause layout thrashing
 */
function extractLayoutThrashingCodeSnippets(events) {
  // This is a simplified version since we can't actually extract code
  // In a real implementation, we would need source maps and the actual source code

  // Find the worst layout thrashing offenders
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

  // Create "pseudo-snippets" based on the information we have
  return offenders.slice(0, 10).map((offender) => ({
    url: offender.url,
    functionName: offender.functionName,
    lineNumber: offender.lineNumber,
    columnNumber: offender.columnNumber,
    layoutCount: offender.count,
    totalLayoutDuration: offender.totalDuration / 1000,
    // This would be the actual code in a real implementation
    pseudoCode:
      `/* At ${offender.url}:${offender.lineNumber}:${offender.columnNumber} */\n` +
      `function ${offender.functionName}() {\n` +
      `  // This function triggered layout ${offender.count} times\n` +
      `  // Total layout time: ${(offender.totalDuration / 1000).toFixed(2)}ms\n` +
      `  // Potential layout thrashing detected\n` +
      `}`,
  }));
}

/**
 * Analyze script evaluation times
 * @param {Array} jsEvents - JavaScript execution events
 * @returns {Array} Script evaluation analysis
 */
function analyzeScriptEvaluations(jsEvents) {
  // Find script evaluation events
  const scriptEvents = jsEvents.filter((e) => e.name === "EvaluateScript");

  // Group by script URL
  const scriptsByUrl = {};

  for (const script of scriptEvents) {
    const url = script.args?.data?.url || script.args?.data?.fileName || "unknown";

    if (!scriptsByUrl[url]) {
      scriptsByUrl[url] = {
        url,
        count: 0,
        totalDuration: 0,
        events: [],
      };
    }

    scriptsByUrl[url].count++;
    scriptsByUrl[url].totalDuration += script.dur || 0;
    scriptsByUrl[url].events.push({
      time: script.ts,
      duration: script.dur / 1000,
    });
  }

  // Convert to array and sort by total duration
  const scripts = Object.values(scriptsByUrl);
  scripts.sort((a, b) => b.totalDuration - a.totalDuration);

  return scripts.slice(0, 10).map((script) => ({
    url: script.url,
    count: script.count,
    totalDuration: script.totalDuration / 1000,
    averageDuration: script.totalDuration / script.count / 1000,
  }));
}

/**
 * Generate recommendations for JavaScript execution
 * @param {Array} jsEvents - JavaScript execution events
 * @param {Object} jsLayoutCorrelation - JavaScript-layout correlation
 * @param {Object} callStackAnalysis - Call stack analysis
 * @param {Array} scriptEvaluations - Script evaluation analysis
 * @returns {Array} Recommendations
 */
function generateJsExecutionRecommendations(jsEvents, jsLayoutCorrelation, callStackAnalysis, scriptEvaluations) {
  const recommendations = [];

  // Check for JavaScript-heavy layout operations
  if (jsLayoutCorrelation.correlatedEvents.length > 10) {
    recommendations.push({
      type: "js_layout_optimization",
      description: `${jsLayoutCorrelation.correlatedEvents.length} layout operations triggered by JavaScript`,
      recommendation: "Batch DOM reads and writes, and use requestAnimationFrame for visual updates to avoid layout thrashing",
    });

    // If we have specific functions that trigger layouts, add more detailed recommendations
    if (jsLayoutCorrelation.functionImpact.length > 0) {
      const topOffender = jsLayoutCorrelation.functionImpact[0];
      recommendations.push({
        type: "specific_js_layout_optimization",
        description: `Function ${topOffender.functionName} in ${topOffender.url} triggered ${topOffender.layoutCount} layout operations`,
        recommendation: "Review this function and batch DOM reads and writes to avoid layout thrashing",
      });
    }
  }

  // Check for large script evaluations
  if (scriptEvaluations.length > 0) {
    const largeScripts = scriptEvaluations.filter((s) => s.totalDuration > 100); // 100ms

    if (largeScripts.length > 0) {
      recommendations.push({
        type: "script_optimization",
        description: `${largeScripts.length} scripts take more than 100ms to evaluate`,
        recommendation: "Consider code splitting, lazy loading, or optimizing these scripts to improve page load performance",
      });
    }
  }

  // Check for excessive JavaScript execution
  const totalJsTime = jsEvents.reduce((sum, event) => sum + (event.dur || 0), 0) / 1000;

  if (totalJsTime > 1000) {
    // 1 second
    recommendations.push({
      type: "js_execution_reduction",
      description: `High JavaScript execution time (${totalJsTime.toFixed(2)}ms)`,
      recommendation: "Reduce JavaScript execution by deferring non-critical operations, using web workers for heavy computation, and optimizing hot functions",
    });
  }

  // Check for deep call stacks
  if (callStackAnalysis.stacksAnalyzed && callStackAnalysis.topFunctions.some((f) => f.count > 20)) {
    recommendations.push({
      type: "call_stack_optimization",
      description: "Deep call stacks detected that trigger layout operations",
      recommendation: "Flatten call hierarchies and avoid nested functions that trigger layout operations",
    });
  }

  return recommendations;
}
