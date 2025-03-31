/**
 * Network conditions configuration for performance testing
 * Provides predefined network profiles and utilities for network throttling
 */

/**
 * Predefined network conditions for common scenarios
 * These can be used with Chrome DevTools Protocol for network throttling
 */
export const PREDEFINED_NETWORK_CONDITIONS = {
  // Mobile network conditions
  "Slow 3G": {
    name: "Slow 3G",
    downloadThroughput: (500 * 1024) / 8, // 500 Kbps in bytes/s
    uploadThroughput: (300 * 1024) / 8, // 300 Kbps in bytes/s
    latency: 400, // ms
    description: "Slow 3G connection with high latency (400ms RTT, 500Kbps down, 300Kbps up)",
  },
  "Fast 3G": {
    name: "Fast 3G",
    downloadThroughput: (1.5 * 1024 * 1024) / 8, // 1.5 Mbps in bytes/s
    uploadThroughput: (750 * 1024) / 8, // 750 Kbps in bytes/s
    latency: 300, // ms
    description: "Fast 3G connection with moderate latency (300ms RTT, 1.5Mbps down, 750Kbps up)",
  },
  "4G": {
    name: "4G",
    downloadThroughput: (4 * 1024 * 1024) / 8, // 4 Mbps in bytes/s
    uploadThroughput: (2 * 1024 * 1024) / 8, // 2 Mbps in bytes/s
    latency: 100, // ms
    description: "4G connection with low latency (100ms RTT, 4Mbps down, 2Mbps up)",
  },

  // Wired network conditions
  WiFi: {
    name: "WiFi",
    downloadThroughput: (30 * 1024 * 1024) / 8, // 30 Mbps in bytes/s
    uploadThroughput: (15 * 1024 * 1024) / 8, // 15 Mbps in bytes/s
    latency: 20, // ms
    description: "WiFi connection with very low latency (20ms RTT, 30Mbps down, 15Mbps up)",
  },
  Fiber: {
    name: "Fiber",
    downloadThroughput: (100 * 1024 * 1024) / 8, // 100 Mbps in bytes/s
    uploadThroughput: (50 * 1024 * 1024) / 8, // 50 Mbps in bytes/s
    latency: 5, // ms
    description: "Fiber connection with minimal latency (5ms RTT, 100Mbps down, 50Mbps up)",
  },

  // Special conditions
  "Regular 2G": {
    name: "Regular 2G",
    downloadThroughput: (250 * 1024) / 8, // 250 Kbps in bytes/s
    uploadThroughput: (50 * 1024) / 8, // 50 Kbps in bytes/s
    latency: 600, // ms
    description: "Regular 2G connection with very high latency (600ms RTT, 250Kbps down, 50Kbps up)",
  },
  "Good 2G": {
    name: "Good 2G",
    downloadThroughput: (450 * 1024) / 8, // 450 Kbps in bytes/s
    uploadThroughput: (150 * 1024) / 8, // 150 Kbps in bytes/s
    latency: 500, // ms
    description: "Good 2G connection with high latency (500ms RTT, 450Kbps down, 150Kbps up)",
  },
  Offline: {
    name: "Offline",
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
    offline: true,
    description: "Offline mode with no network connectivity",
  },
  "No throttling": {
    name: "No throttling",
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
    description: "No network throttling applied",
  },
};

/**
 * Get a network condition by name
 * @param {string} conditionName - Name of the predefined network condition
 * @returns {Object|null} Network condition or null if not found
 */
export function getNetworkConditionByName(conditionName) {
  return PREDEFINED_NETWORK_CONDITIONS[conditionName] || null;
}

/**
 * Validate a network condition configuration
 * @param {Object} networkConfig - Network condition to validate
 * @returns {Object} Validated network condition with defaults applied
 */
export function validateNetworkCondition(networkConfig = {}) {
  // Apply defaults for missing properties
  return {
    name: networkConfig.name || "Custom Network",
    downloadThroughput: networkConfig.downloadThroughput !== undefined ? networkConfig.downloadThroughput : (4 * 1024 * 1024) / 8, // 4 Mbps default
    uploadThroughput: networkConfig.uploadThroughput !== undefined ? networkConfig.uploadThroughput : (2 * 1024 * 1024) / 8, // 2 Mbps default
    latency: networkConfig.latency !== undefined ? networkConfig.latency : 100, // 100ms default
    offline: networkConfig.offline !== undefined ? networkConfig.offline : false,
    description: networkConfig.description || "Custom network condition",
  };
}

/**
 * Create a custom network condition
 * @param {Object} networkConfig - Custom network condition
 * @returns {Object} Complete network condition
 */
export function createCustomNetworkCondition(networkConfig = {}) {
  return validateNetworkCondition(networkConfig);
}

/**
 * Get network condition from tool arguments
 * @param {Object} args - Tool arguments
 * @returns {Object} Network condition
 */
export function getNetworkCondition(args) {
  // If a predefined network condition name is provided, use that
  if (args.networkConditionName && PREDEFINED_NETWORK_CONDITIONS[args.networkConditionName]) {
    return PREDEFINED_NETWORK_CONDITIONS[args.networkConditionName];
  }

  // If a custom network condition is provided, use that
  if (args.networkCondition) {
    return validateNetworkCondition(args.networkCondition);
  }

  // Default to 4G
  return PREDEFINED_NETWORK_CONDITIONS["4G"];
}

/**
 * Get a list of available network condition names
 * @returns {Array<string>} List of predefined network condition names
 */
export function getAvailableNetworkConditions() {
  return Object.keys(PREDEFINED_NETWORK_CONDITIONS);
}

/**
 * Apply network conditions to a CDP session
 * @param {Object} client - CDP client session
 * @param {Object} networkCondition - Network condition to apply
 * @returns {Promise<void>}
 */
export async function applyNetworkConditions(client, networkCondition) {
  if (!client) {
    throw new Error("CDP client is required to apply network conditions");
  }

  const condition = validateNetworkCondition(networkCondition);

  // Enable network domain if not already enabled
  try {
    await client.send("Network.enable");
  } catch (error) {
    // Network might already be enabled, continue
  }

  // Apply network conditions
  await client.send("Network.emulateNetworkConditions", {
    offline: condition.offline,
    latency: condition.latency,
    downloadThroughput: condition.downloadThroughput,
    uploadThroughput: condition.uploadThroughput,
  });
}
