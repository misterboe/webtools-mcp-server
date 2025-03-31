/**
 * Device configuration for performance testing
 * Provides predefined device profiles and utilities for custom device configuration
 */

/**
 * Predefined device profiles for common devices
 * These can be used directly with Puppeteer's emulation
 */
export const PREDEFINED_DEVICES = {
  // Mobile devices
  "Pixel 7": {
    name: "Pixel 7",
    userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    width: 412,
    height: 915,
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  "iPhone 14": {
    name: "iPhone 14",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  // Tablet devices
  "iPad Pro": {
    name: "iPad Pro",
    userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    width: 1024,
    height: 1366,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  // Desktop devices
  "Desktop (1920x1080)": {
    name: "Desktop (1920x1080)",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    isLandscape: true,
  },
  "Desktop (2560x1440)": {
    name: "Desktop (2560x1440)",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    width: 2560,
    height: 1440,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    isLandscape: true,
  },
};

/**
 * Get a device configuration by name
 * @param {string} deviceName - Name of the predefined device
 * @returns {Object|null} Device configuration or null if not found
 */
export function getDeviceByName(deviceName) {
  return PREDEFINED_DEVICES[deviceName] || null;
}

/**
 * Validate a device configuration
 * @param {Object} deviceConfig - Device configuration to validate
 * @returns {Object} Validated device configuration with defaults applied
 */
export function validateDeviceConfig(deviceConfig = {}) {
  // Apply defaults for missing properties
  return {
    name: deviceConfig.name || "Custom Device",
    userAgent: deviceConfig.userAgent || "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    width: deviceConfig.width || 1920,
    height: deviceConfig.height || 1080,
    deviceScaleFactor: deviceConfig.deviceScaleFactor || 1,
    isMobile: deviceConfig.isMobile !== undefined ? deviceConfig.isMobile : false,
    hasTouch: deviceConfig.hasTouch !== undefined ? deviceConfig.hasTouch : false,
    isLandscape: deviceConfig.isLandscape !== undefined ? deviceConfig.isLandscape : true,
  };
}

/**
 * Create a custom device configuration
 * @param {Object} deviceConfig - Custom device configuration
 * @returns {Object} Complete device configuration
 */
export function createCustomDevice(deviceConfig = {}) {
  return validateDeviceConfig(deviceConfig);
}

/**
 * Get device configuration from tool arguments
 * @param {Object} args - Tool arguments
 * @returns {Object} Device configuration
 */
export function getDeviceConfig(args) {
  // If a predefined device name is provided, use that
  if (args.deviceName && PREDEFINED_DEVICES[args.deviceName]) {
    return PREDEFINED_DEVICES[args.deviceName];
  }

  // If a custom device configuration is provided, use that
  if (args.deviceConfig) {
    return validateDeviceConfig(args.deviceConfig);
  }

  // Default to desktop
  return PREDEFINED_DEVICES["Desktop (1920x1080)"];
}

/**
 * Get a list of available device names
 * @returns {Array<string>} List of predefined device names
 */
export function getAvailableDevices() {
  return Object.keys(PREDEFINED_DEVICES);
}
