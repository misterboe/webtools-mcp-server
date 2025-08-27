/**
 * Tool Configuration Manager
 * Handles selective tool loading based on environment variables and CLI arguments
 */

import { logInfo, logError } from "../utils/logging.js";

// All available tools
const ALL_TOOLS = [
  "webtool_gethtml",
  "webtool_readpage",
  "webtool_screenshot",
  "webtool_debug",
  "webtool_lighthouse",
  "webtool_performance_trace",
  "webtool_coverage_analysis",
  "webtool_web_vitals",
  "webtool_network_monitor",
  "webtool_performance_test"
];

// Predefined tool presets
const TOOL_PRESETS = {
  ALL: ALL_TOOLS,
  BASIC: [
    "webtool_gethtml",
    "webtool_readpage"
  ],
  WEB: [
    "webtool_gethtml",
    "webtool_readpage",
    "webtool_screenshot"
  ],
  DEBUG: [
    "webtool_gethtml",
    "webtool_readpage",
    "webtool_debug",
    "webtool_screenshot"
  ],
  PERFORMANCE: [
    "webtool_performance_trace",
    "webtool_coverage_analysis", 
    "webtool_web_vitals",
    "webtool_network_monitor",
    "webtool_performance_test"
  ],
  FULL_ANALYSIS: [
    "webtool_gethtml",
    "webtool_readpage",
    "webtool_screenshot",
    "webtool_debug",
    "webtool_lighthouse",
    "webtool_performance_trace",
    "webtool_coverage_analysis",
    "webtool_web_vitals",
    "webtool_network_monitor"
  ]
};

/**
 * Parse tool configuration from environment variables or CLI arguments
 * @param {string} [cliTools] - Tools specified via CLI --tools argument
 * @returns {string[]} Array of enabled tool names
 */
export function parseToolConfiguration(cliTools = null) {
  // Priority: CLI argument > Environment variable > Default (ALL)
  const toolsConfig = cliTools || process.env.ENABLED_TOOLS || "ALL";
  
  // Handle presets
  if (TOOL_PRESETS[toolsConfig]) {
    logInfo("tool-manager", `Using preset: ${toolsConfig}`, {
      enabledTools: TOOL_PRESETS[toolsConfig].length,
      tools: TOOL_PRESETS[toolsConfig]
    });
    return TOOL_PRESETS[toolsConfig];
  }
  
  // Handle comma-separated individual tools
  const individualTools = toolsConfig.split(",").map(tool => tool.trim());
  
  // Validate tools exist
  const validTools = [];
  const invalidTools = [];
  
  for (const tool of individualTools) {
    if (ALL_TOOLS.includes(tool)) {
      validTools.push(tool);
    } else {
      invalidTools.push(tool);
    }
  }
  
  // Log warnings for invalid tools
  if (invalidTools.length > 0) {
    logError("tool-manager", "Invalid tools specified", null, {
      invalidTools,
      validTools: ALL_TOOLS
    });
  }
  
  // If no valid tools found, fallback to ALL
  if (validTools.length === 0) {
    logError("tool-manager", "No valid tools specified, falling back to ALL tools", null, {
      originalConfig: toolsConfig,
      fallbackTools: ALL_TOOLS
    });
    return ALL_TOOLS;
  }
  
  logInfo("tool-manager", `Using individual tools`, {
    enabledTools: validTools.length,
    tools: validTools,
    ...(invalidTools.length > 0 && { ignoredInvalidTools: invalidTools })
  });
  
  return validTools;
}

/**
 * Get available tool presets
 * @returns {Object} Available presets with their descriptions
 */
export function getAvailablePresets() {
  return {
    ALL: {
      tools: TOOL_PRESETS.ALL,
      description: "All available tools (default)",
      tokenUsage: "~10.3k tokens"
    },
    BASIC: {
      tools: TOOL_PRESETS.BASIC,
      description: "Basic web content tools (HTML, Markdown)",
      tokenUsage: "~1k tokens"
    },
    WEB: {
      tools: TOOL_PRESETS.WEB,
      description: "Web content and screenshot tools",
      tokenUsage: "~1.5k tokens"
    },
    DEBUG: {
      tools: TOOL_PRESETS.DEBUG,
      description: "Web content, debugging and screenshot tools",
      tokenUsage: "~2.5k tokens"
    },
    PERFORMANCE: {
      tools: TOOL_PRESETS.PERFORMANCE,
      description: "Performance analysis tools only",
      tokenUsage: "~6k tokens"
    },
    FULL_ANALYSIS: {
      tools: TOOL_PRESETS.FULL_ANALYSIS,
      description: "All tools except performance test framework",
      tokenUsage: "~9k tokens"
    }
  };
}

/**
 * Validate if a tool name is valid
 * @param {string} toolName - Tool name to validate
 * @returns {boolean} True if valid
 */
export function isValidTool(toolName) {
  return ALL_TOOLS.includes(toolName);
}

/**
 * Get all available tool names
 * @returns {string[]} Array of all tool names
 */
export function getAllTools() {
  return [...ALL_TOOLS];
}

/**
 * Calculate estimated token usage for enabled tools
 * @param {string[]} enabledTools - Array of enabled tool names
 * @returns {Object} Token usage estimation
 */
export function estimateTokenUsage(enabledTools) {
  // Rough token estimates per tool (based on schema complexity)
  const tokenEstimates = {
    "webtool_gethtml": 500,
    "webtool_readpage": 550,
    "webtool_screenshot": 700,
    "webtool_debug": 1200,
    "webtool_lighthouse": 600,
    "webtool_performance_trace": 1400,
    "webtool_coverage_analysis": 1000,
    "webtool_web_vitals": 1100,
    "webtool_network_monitor": 1400,
    "webtool_performance_test": 900
  };
  
  const totalTokens = enabledTools.reduce((sum, tool) => {
    return sum + (tokenEstimates[tool] || 0);
  }, 0);
  
  const allToolsTokens = ALL_TOOLS.reduce((sum, tool) => {
    return sum + (tokenEstimates[tool] || 0);
  }, 0);
  
  const reductionPercent = Math.round(((allToolsTokens - totalTokens) / allToolsTokens) * 100);
  
  return {
    totalTokens,
    allToolsTokens,
    savedTokens: allToolsTokens - totalTokens,
    reductionPercent,
    toolCount: enabledTools.length,
    totalToolCount: ALL_TOOLS.length
  };
}