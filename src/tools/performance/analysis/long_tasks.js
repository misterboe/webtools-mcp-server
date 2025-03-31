/**
 * Long tasks analysis module
 */

import { determineTaskType, findTaskContext } from "./utils.js";

/**
 * Analyze long tasks in the trace data
 * @param {Array} events - All trace events
 * @returns {Object|null} Long tasks analysis or null if no long tasks found
 */
export function analyzeLongTasks(events) {
  // Find long tasks (tasks that take more than 50ms)
  const longTasks = events.filter((event) => event.name === "RunTask" && event.dur > 50000); // 50ms in microseconds

  if (longTasks.length === 0) {
    return null;
  }

  // Group long tasks by their parent frame to attribute them to specific scripts
  const tasksByFrame = {};
  const tasksByType = {};

  longTasks.forEach((task) => {
    // Try to find the parent frame or script
    const frameId = task.args?.data?.frame || "unknown";
    if (!tasksByFrame[frameId]) {
      tasksByFrame[frameId] = [];
    }
    tasksByFrame[frameId].push(task);

    // Categorize tasks by their type
    const taskType = determineTaskType(task, events);
    if (!tasksByType[taskType]) {
      tasksByType[taskType] = [];
    }
    tasksByType[taskType].push(task);
  });

  // Find tasks that block user interaction
  const interactionBlockingTasks = longTasks.filter((task) => {
    const context = findTaskContext(task, events);
    return context.userInteraction.detected;
  });

  // Find the longest tasks
  longTasks.sort((a, b) => b.dur - a.dur);
  const longestTasks = longTasks.slice(0, 5);

  // Calculate statistics
  const totalBlockingTime = longTasks.reduce((sum, task) => sum + Math.max(0, task.dur - 50000), 0) / 1000; // in ms
  const averageTaskDuration = longTasks.reduce((sum, task) => sum + task.dur, 0) / longTasks.length / 1000; // in ms

  return {
    type: "long_tasks",
    description: `Found ${longTasks.length} long tasks (>50ms) with ${totalBlockingTime.toFixed(2)}ms total blocking time`,
    details: {
      tasks: longTasks.map((task) => ({
        duration: task.dur / 1000, // Convert to ms
        startTime: task.ts,
        type: determineTaskType(task, events),
        frame: task.args?.data?.frame || "unknown",
        // Find nearby events to determine context
        context: findTaskContext(task, events),
      })),
      tasksByType: Object.keys(tasksByType).map((type) => ({
        type,
        count: tasksByType[type].length,
        totalDuration: tasksByType[type].reduce((sum, task) => sum + task.dur, 0) / 1000,
        averageDuration: tasksByType[type].reduce((sum, task) => sum + task.dur, 0) / tasksByType[type].length / 1000,
      })),
      tasksByFrame: Object.keys(tasksByFrame).map((frame) => ({
        frame,
        count: tasksByFrame[frame].length,
        totalDuration: tasksByFrame[frame].reduce((sum, task) => sum + task.dur, 0) / 1000,
      })),
      interactionBlockingTasks: interactionBlockingTasks.length,
      longestTasks: longestTasks.map((task) => ({
        duration: task.dur / 1000,
        startTime: task.ts,
        type: determineTaskType(task, events),
        context: findTaskContext(task, events),
      })),
      statistics: {
        totalBlockingTime,
        averageTaskDuration,
        taskCount: longTasks.length,
        tasksOver100ms: longTasks.filter((task) => task.dur > 100000).length,
        tasksOver200ms: longTasks.filter((task) => task.dur > 200000).length,
      },
      recommendations: generateLongTaskRecommendations(longTasks, tasksByType),
    },
  };
}

/**
 * Generate recommendations for long tasks
 * @param {Array} longTasks - Long task events
 * @param {Object} tasksByType - Tasks grouped by type
 * @returns {Array} Recommendations
 */
function generateLongTaskRecommendations(longTasks, tasksByType) {
  const recommendations = [];

  // Check for JavaScript-heavy tasks
  if (tasksByType.javascript && tasksByType.javascript.length > 0) {
    recommendations.push({
      type: "javascript_optimization",
      description: `${tasksByType.javascript.length} long JavaScript tasks detected`,
      recommendation: "Consider breaking up long JavaScript tasks using requestIdleCallback or setTimeout, or moving heavy computation to Web Workers",
    });
  }

  // Check for layout-heavy tasks
  if (tasksByType.layout && tasksByType.layout.length > 0) {
    recommendations.push({
      type: "layout_optimization",
      description: `${tasksByType.layout.length} long layout tasks detected`,
      recommendation: "Reduce layout thrashing by batching DOM reads and writes, and minimize style recalculations",
    });
  }

  // Check for garbage collection
  if (tasksByType["garbage-collection"] && tasksByType["garbage-collection"].length > 0) {
    recommendations.push({
      type: "memory_optimization",
      description: `${tasksByType["garbage-collection"].length} long garbage collection tasks detected`,
      recommendation: "Reduce memory churn by reusing objects, avoiding large arrays, and managing object references carefully",
    });
  }

  // Check for very long tasks
  if (longTasks.some((task) => task.dur > 500000)) {
    // 500ms
    recommendations.push({
      type: "task_splitting",
      description: "Very long tasks (>500ms) detected",
      recommendation: "Break up long tasks into smaller chunks and use requestAnimationFrame or requestIdleCallback to schedule them",
    });
  }

  return recommendations;
}
