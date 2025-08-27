#!/usr/bin/env node

import { createServer, startServer } from "./server.js";
import { logInfo, logError } from "./utils/logging.js";
import { parseToolConfiguration, getAvailablePresets } from "./config/tool-manager.js";

/**
 * Parse command line arguments
 * @returns {Object} Parsed configuration
 */
function parseCliArguments() {
  const args = process.argv.slice(2);
  let toolsConfig = null;
  let showHelp = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--tools' && i + 1 < args.length) {
      toolsConfig = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (arg.startsWith('--tools=')) {
      toolsConfig = arg.substring(8);
    } else if (arg === '--help' || arg === '-h') {
      showHelp = true;
    }
  }
  
  return { toolsConfig, showHelp };
}

/**
 * Show help information
 */
function showHelpText() {
  const presets = getAvailablePresets();
  
  console.log(`
Webtools MCP Server - Web Analysis Tools for Claude Desktop

USAGE:
  node src/index.js [OPTIONS]
  npx @bschauer/webtools-mcp-server [OPTIONS]

OPTIONS:
  --tools <preset|tools>    Specify which tools to load
  --help, -h               Show this help message

TOOL CONFIGURATION:
  Environment Variable: ENABLED_TOOLS=<preset|tools>
  CLI Argument: --tools=<preset|tools>
  
PRESETS:`);

  for (const [name, info] of Object.entries(presets)) {
    console.log(`  ${name.padEnd(15)} ${info.description} (${info.tokenUsage})`);
  }

  console.log(`
EXAMPLES:
  # Use only basic tools (saves ~90% tokens)
  ENABLED_TOOLS=BASIC node src/index.js
  
  # Use performance analysis tools
  node src/index.js --tools=PERFORMANCE
  
  # Use specific individual tools
  --tools=webtool_gethtml,webtool_readpage,webtool_screenshot
  
  # Use all tools (default)
  node src/index.js
  
INTEGRATION WITH CLAUDE DESKTOP:
  Add to your MCP configuration:
  {
    "mcpServers": {
      "webtools": {
        "command": "npx",
        "args": ["-y", "@bschauer/webtools-mcp-server@latest"],
        "env": {
          "ENABLED_TOOLS": "BASIC"
        }
      }
    }
  }
`);
}

/**
 * Main entry point for the webtools MCP server
 */
async function main() {
  const { toolsConfig, showHelp } = parseCliArguments();
  
  if (showHelp) {
    showHelpText();
    process.exit(0);
  }
  
  logInfo("server", "Starting Webtools MCP Server");

  try {
    // Parse tool configuration
    const enabledTools = parseToolConfiguration(toolsConfig);
    
    // Create and start the server with tool configuration
    const server = createServer(enabledTools);
    await startServer(server);
  } catch (error) {
    logError("server", "Fatal error in main()", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  logError("server", "Unhandled error in main()", error);
  process.exit(1);
});
