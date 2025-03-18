#!/usr/bin/env node

import { createServer, startServer } from "./server.js";
import { logInfo, logError } from "./utils/logging.js";

/**
 * Main entry point for the webtools MCP server
 */
async function main() {
  logInfo("server", "Starting Webtools MCP Server");

  try {
    // Create and start the server
    const server = createServer();
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
