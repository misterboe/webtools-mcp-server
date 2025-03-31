/**
 * Utility functions for performance analysis
 */

/**
 * Determine the type of a long task based on surrounding events
 * @param {Object} task - The task event
 * @param {Array} events - All trace events
 * @returns {string} The determined task type
 */
export function determineTaskType(task, events) {
  // Find events that occurred during this task
  const taskStart = task.ts;
  const taskEnd = task.ts + task.dur;

  const eventsInTask = events.filter((event) => event.ts >= taskStart && event.ts <= taskEnd);

  // Count event types
  const layoutCount = eventsInTask.filter((e) => e.name === "Layout").length;
  const styleCount = eventsInTask.filter((e) => e.name === "RecalculateStyles").length;
  const jsCount = eventsInTask.filter((e) => e.name === "V8.Execute" || e.name === "FunctionCall").length;
  const paintCount = eventsInTask.filter((e) => e.name.includes("Paint") || e.name.includes("Composite")).length;
  const parseHTMLCount = eventsInTask.filter((e) => e.name.includes("ParseHTML")).length;
  const gcCount = eventsInTask.filter((e) => e.name.includes("GC")).length;

  // Determine the dominant activity
  const counts = [
    { type: "layout", count: layoutCount },
    { type: "style", count: styleCount },
    { type: "javascript", count: jsCount },
    { type: "paint", count: paintCount },
    { type: "parse-html", count: parseHTMLCount },
    { type: "garbage-collection", count: gcCount },
  ];

  counts.sort((a, b) => b.count - a.count);

  if (counts[0].count === 0) {
    return "other";
  }

  return counts[0].type;
}

/**
 * Find the context in which a task occurred (user interaction, etc.)
 * @param {Object} task - The task event
 * @param {Array} events - All trace events
 * @returns {Object} Context information
 */
export function findTaskContext(task, events) {
  const taskStart = task.ts;
  const CONTEXT_WINDOW_MS = 500 * 1000; // 500ms in microseconds

  // Look for events shortly before this task
  const precedingEvents = events.filter((event) => event.ts >= taskStart - CONTEXT_WINDOW_MS && event.ts < taskStart);

  // Check for user interaction events
  const inputEvents = precedingEvents.filter((e) => e.name.includes("Input") || e.name.includes("Click") || e.name.includes("Key") || e.name.includes("Scroll") || e.name.includes("Touch"));

  // Check for network events
  const networkEvents = precedingEvents.filter((e) => e.name.includes("Resource") || e.name.includes("XHR") || e.name.includes("Fetch"));

  // Check for timer events
  const timerEvents = precedingEvents.filter((e) => e.name.includes("Timer") || e.name.includes("RequestAnimation"));

  return {
    userInteraction:
      inputEvents.length > 0
        ? {
            detected: true,
            type: inputEvents[0].name,
            timestamp: inputEvents[0].ts,
          }
        : { detected: false },
    networkActivity:
      networkEvents.length > 0
        ? {
            detected: true,
            type: networkEvents[0].name,
            url: networkEvents[0].args?.data?.url || "unknown",
          }
        : { detected: false },
    timer:
      timerEvents.length > 0
        ? {
            detected: true,
            type: timerEvents[0].name,
          }
        : { detected: false },
  };
}

/**
 * Determine the type of a resource based on its URL
 * @param {string} url - The resource URL
 * @returns {string} The resource type
 */
export function determineResourceType(url) {
  if (!url) return "unknown";

  const extension = url.split(".").pop().toLowerCase().split("?")[0];

  // Image types
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "ico"].includes(extension)) {
    return "image";
  }

  // Script types
  if (["js", "mjs", "jsx"].includes(extension)) {
    return "script";
  }

  // Style types
  if (["css", "scss", "less"].includes(extension)) {
    return "style";
  }

  // Font types
  if (["woff", "woff2", "ttf", "otf", "eot"].includes(extension)) {
    return "font";
  }

  // Document types
  if (["html", "htm", "xhtml", "php", "asp", "aspx", "jsp"].includes(extension)) {
    return "document";
  }

  // Media types
  if (["mp4", "webm", "ogg", "mp3", "wav"].includes(extension)) {
    return "media";
  }

  // Data types
  if (["json", "xml", "csv"].includes(extension)) {
    return "data";
  }

  return "other";
}

/**
 * Group resources by their type
 * @param {Array} resources - The resources to group
 * @returns {Object} Resources grouped by type
 */
export function groupResourcesByType(resources) {
  const groups = {};

  for (const resource of resources) {
    const type = resource.type || determineResourceType(resource.url);

    if (!groups[type]) {
      groups[type] = {
        count: 0,
        totalSize: 0,
        resources: [],
      };
    }

    groups[type].count++;
    groups[type].totalSize += resource.size || 0;
    groups[type].resources.push(resource);
  }

  // Convert to array and sort by total size
  return Object.keys(groups)
    .map((type) => ({
      type,
      count: groups[type].count,
      totalSize: groups[type].totalSize,
      averageSize: groups[type].totalSize / groups[type].count,
      resources: groups[type].resources.slice(0, 5), // Limit to 5 resources per type
    }))
    .sort((a, b) => b.totalSize - a.totalSize);
}

/**
 * Generate optimization suggestions for resources
 * @param {Array} resources - The resources to analyze
 * @returns {Array} Optimization suggestions
 */
export function generateResourceOptimizationSuggestions(resources) {
  const suggestions = [];
  const resourcesByType = groupResourcesByType(resources);

  // Check for large images
  const imageGroup = resourcesByType.find((g) => g.type === "image");
  if (imageGroup && imageGroup.totalSize > 1000000) {
    // 1MB
    suggestions.push({
      type: "image_optimization",
      description: `Large images detected (${(imageGroup.totalSize / 1024 / 1024).toFixed(2)}MB total)`,
      recommendation: "Consider optimizing images using WebP format, responsive images, and proper compression",
    });
  }

  // Check for large scripts
  const scriptGroup = resourcesByType.find((g) => g.type === "script");
  if (scriptGroup && scriptGroup.totalSize > 500000) {
    // 500KB
    suggestions.push({
      type: "script_optimization",
      description: `Large scripts detected (${(scriptGroup.totalSize / 1024 / 1024).toFixed(2)}MB total)`,
      recommendation: "Consider code splitting, tree shaking, and minification to reduce JavaScript size",
    });
  }

  // Check for large stylesheets
  const styleGroup = resourcesByType.find((g) => g.type === "style");
  if (styleGroup && styleGroup.totalSize > 100000) {
    // 100KB
    suggestions.push({
      type: "style_optimization",
      description: `Large stylesheets detected (${(styleGroup.totalSize / 1024).toFixed(2)}KB total)`,
      recommendation: "Consider using CSS optimization, removing unused styles, and minification",
    });
  }

  // Check for many font files
  const fontGroup = resourcesByType.find((g) => g.type === "font");
  if (fontGroup && fontGroup.count > 3) {
    suggestions.push({
      type: "font_optimization",
      description: `Multiple font files detected (${fontGroup.count} files)`,
      recommendation: "Consider using system fonts or limiting font weights and subsets",
    });
  }

  return suggestions;
}
