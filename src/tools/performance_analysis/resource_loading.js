/**
 * Resource loading analysis module
 */

import { determineResourceType, groupResourcesByType, generateResourceOptimizationSuggestions } from "./utils.js";

/**
 * Analyze resource loading in the trace data
 * @param {Array} events - All trace events
 * @returns {Object|null} Resource loading analysis or null if no resources found
 */
export function analyzeResourceLoading(events) {
  // Find resource events
  const resourceEvents = events.filter((event) => event.name === "ResourceReceiveResponse" || event.name === "ResourceFinish" || event.name === "ResourceSendRequest");

  if (resourceEvents.length === 0) {
    return null;
  }

  // Extract resource information
  const resources = extractResourceInfo(resourceEvents);

  // Find large resources
  const largeResources = resources.filter((resource) => resource.size > 500000); // 500KB

  // Group resources by type
  const resourcesByType = groupResourcesByType(resources);

  // Generate optimization suggestions
  const optimizationSuggestions = generateResourceOptimizationSuggestions(resources);

  // Analyze resource loading waterfall
  const waterfall = analyzeResourceWaterfall(resources, events);

  return {
    type: "large_resources",
    description: largeResources.length > 0 ? `Found ${largeResources.length} large resources (>500KB)` : `Analyzed ${resources.length} resources`,
    details: {
      resources: largeResources,
      resourcesByType,
      optimizationSuggestions,
      waterfall,
      totalResources: resources.length,
      totalSize: resources.reduce((sum, r) => sum + (r.size || 0), 0),
      totalTransferSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
      totalDuration: resources.reduce((sum, r) => sum + (r.duration || 0), 0),
    },
  };
}

/**
 * Extract resource information from resource events
 * @param {Array} resourceEvents - Resource-related events
 * @returns {Array} Resource information
 */
function extractResourceInfo(resourceEvents) {
  const resources = [];
  const resourceMap = {};

  // First pass: collect basic information
  for (const event of resourceEvents) {
    if (event.name === "ResourceSendRequest") {
      const url = event.args?.data?.url;
      if (url) {
        resourceMap[url] = resourceMap[url] || {
          url,
          requestTime: event.ts,
          type: determineResourceType(url),
          size: 0,
          transferSize: 0,
          duration: 0,
          status: 0,
          mimeType: "",
          priority: event.args?.data?.priority || "Low",
        };
      }
    } else if (event.name === "ResourceReceiveResponse") {
      const url = event.args?.data?.url;
      if (url && resourceMap[url]) {
        resourceMap[url].responseTime = event.ts;
        resourceMap[url].status = event.args?.data?.statusCode || 0;
        resourceMap[url].mimeType = event.args?.data?.mimeType || "";
        resourceMap[url].fromCache = event.args?.data?.fromCache || false;
        resourceMap[url].fromServiceWorker = event.args?.data?.fromServiceWorker || false;
      }
    } else if (event.name === "ResourceFinish") {
      const url = event.args?.data?.url;
      if (url && resourceMap[url]) {
        resourceMap[url].finishTime = event.ts;
        resourceMap[url].encodedDataLength = event.args?.data?.encodedDataLength || 0;
        resourceMap[url].decodedBodyLength = event.args?.data?.decodedBodyLength || 0;

        // Calculate size and duration
        resourceMap[url].size = resourceMap[url].decodedBodyLength || resourceMap[url].encodedDataLength || 0;
        resourceMap[url].transferSize = resourceMap[url].encodedDataLength || 0;

        if (resourceMap[url].requestTime && resourceMap[url].finishTime) {
          resourceMap[url].duration = (resourceMap[url].finishTime - resourceMap[url].requestTime) / 1000; // Convert to ms
        }

        // Add to resources array
        resources.push(resourceMap[url]);
      }
    }
  }

  return resources;
}

/**
 * Analyze resource loading waterfall
 * @param {Array} resources - Resource information
 * @param {Array} events - All trace events
 * @returns {Object} Waterfall analysis
 */
function analyzeResourceWaterfall(resources, events) {
  // Sort resources by request time
  const sortedResources = [...resources].sort((a, b) => a.requestTime - b.requestTime);

  // Calculate critical path
  const criticalPath = calculateCriticalPath(sortedResources);

  // Calculate resource contention
  const contention = calculateResourceContention(sortedResources);

  // Find render-blocking resources
  const renderBlockingResources = findRenderBlockingResources(sortedResources, events);

  return {
    criticalPath,
    contention,
    renderBlockingResources,
    timeToFirstByte: calculateTimeToFirstByte(sortedResources),
    loadSequence: sortedResources.map((r) => ({
      url: r.url,
      type: r.type,
      startTime: r.requestTime,
      endTime: r.finishTime,
      duration: r.duration,
      size: r.size,
      transferSize: r.transferSize,
      status: r.status,
      priority: r.priority,
      fromCache: r.fromCache,
      fromServiceWorker: r.fromServiceWorker,
    })),
  };
}

/**
 * Calculate the critical path of resource loading
 * @param {Array} resources - Resource information
 * @returns {Array} Critical path resources
 */
function calculateCriticalPath(resources) {
  // This is a simplified version - in a real implementation, we would need to analyze dependencies

  // For now, consider high-priority resources and large resources on the critical path
  const criticalResources = resources.filter((r) => r.priority === "High" || r.priority === "VeryHigh" || (r.type === "script" && r.size > 100000) || (r.type === "style" && r.size > 50000));

  return criticalResources.map((r) => ({
    url: r.url,
    type: r.type,
    duration: r.duration,
    size: r.size,
    priority: r.priority,
  }));
}

/**
 * Calculate resource contention
 * @param {Array} resources - Resource information
 * @returns {Object} Resource contention analysis
 */
function calculateResourceContention(resources) {
  // Count the maximum number of concurrent requests
  let maxConcurrent = 0;
  let currentConcurrent = 0;

  // Create events for request start and end
  const events = [];

  for (const resource of resources) {
    if (resource.requestTime && resource.finishTime) {
      events.push({
        time: resource.requestTime,
        type: "start",
        resource,
      });

      events.push({
        time: resource.finishTime,
        type: "end",
        resource,
      });
    }
  }

  // Sort events by time
  events.sort((a, b) => a.time - b.time);

  // Process events to find maximum concurrency
  const concurrentRequests = [];

  for (const event of events) {
    if (event.type === "start") {
      currentConcurrent++;
      concurrentRequests.push(event.resource);

      if (currentConcurrent > maxConcurrent) {
        maxConcurrent = currentConcurrent;
      }
    } else if (event.type === "end") {
      currentConcurrent--;

      // Remove this resource from concurrent requests
      const index = concurrentRequests.findIndex((r) => r.url === event.resource.url);
      if (index !== -1) {
        concurrentRequests.splice(index, 1);
      }
    }
  }

  return {
    maxConcurrentRequests: maxConcurrent,
    contentionPeriods: findContentionPeriods(events),
  };
}

/**
 * Find periods of high resource contention
 * @param {Array} events - Resource start/end events
 * @returns {Array} Contention periods
 */
function findContentionPeriods(events) {
  const contentionPeriods = [];
  let currentConcurrent = 0;
  let contentionStart = null;

  // Process events to find periods of high contention
  for (const event of events) {
    if (event.type === "start") {
      currentConcurrent++;

      // Start a contention period if we reach 6 concurrent requests
      if (currentConcurrent >= 6 && contentionStart === null) {
        contentionStart = event.time;
      }
    } else if (event.type === "end") {
      currentConcurrent--;

      // End a contention period if we drop below 6 concurrent requests
      if (currentConcurrent < 6 && contentionStart !== null) {
        contentionPeriods.push({
          startTime: contentionStart,
          endTime: event.time,
          duration: (event.time - contentionStart) / 1000, // Convert to ms
          concurrentRequests: currentConcurrent + 1, // +1 because we just decremented
        });

        contentionStart = null;
      }
    }
  }

  // If we still have an open contention period, close it with the last event
  if (contentionStart !== null && events.length > 0) {
    contentionPeriods.push({
      startTime: contentionStart,
      endTime: events[events.length - 1].time,
      duration: (events[events.length - 1].time - contentionStart) / 1000, // Convert to ms
      concurrentRequests: currentConcurrent,
    });
  }

  return contentionPeriods;
}

/**
 * Find render-blocking resources
 * @param {Array} resources - Resource information
 * @param {Array} events - All trace events
 * @returns {Array} Render-blocking resources
 */
function findRenderBlockingResources(resources, events) {
  // Find the first paint event
  const firstPaintEvents = events.filter((e) => e.name === "firstPaint" || e.name === "firstContentfulPaint" || e.name.includes("MarkFirstPaint"));

  if (firstPaintEvents.length === 0) {
    return [];
  }

  // Sort by timestamp
  firstPaintEvents.sort((a, b) => a.ts - b.ts);
  const firstPaintTime = firstPaintEvents[0].ts;

  // Find resources that finished loading after the first paint
  // and are of a type that could block rendering
  const blockingResources = resources.filter(
    (r) =>
      r.finishTime > firstPaintTime &&
      (r.type === "script" || r.type === "style" || r.type === "font") &&
      !r.fromCache && // Cached resources don't block rendering
      r.priority !== "Low" // Low priority resources are usually async/defer
  );

  return blockingResources.map((r) => ({
    url: r.url,
    type: r.type,
    finishTime: r.finishTime,
    delayToFirstPaint: (r.finishTime - firstPaintTime) / 1000, // Convert to ms
    size: r.size,
    priority: r.priority,
  }));
}

/**
 * Calculate time to first byte
 * @param {Array} resources - Resource information
 * @returns {number} Time to first byte in milliseconds
 */
function calculateTimeToFirstByte(resources) {
  // Find the main document resource (usually the first HTML resource)
  const documentResources = resources.filter((r) => r.type === "document" || r.mimeType.includes("html"));

  if (documentResources.length === 0) {
    return null;
  }

  // Sort by request time
  documentResources.sort((a, b) => a.requestTime - b.requestTime);
  const mainDocument = documentResources[0];

  // Calculate TTFB if we have both request and response times
  if (mainDocument.requestTime && mainDocument.responseTime) {
    return (mainDocument.responseTime - mainDocument.requestTime) / 1000; // Convert to ms
  }

  return null;
}
