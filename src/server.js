import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { logInfo, logError } from "./utils/logging.js";
import { checkSiteAvailability } from "./utils/html.js";
import { fetchWithRetry } from "./utils/fetch.js";

// Import tool handlers
import { getHtml, readPage } from "./tools/html.js";
import { screenshot } from "./tools/screenshot.js";
import { debug } from "./tools/debug.js";
import { runLighthouse } from "./tools/lighthouse.js";
import { performanceTrace } from "./tools/performance/trace/index.js";
import { runCoverageAnalysis } from "./tools/performance/coverage/index.js";
import { runWebVitalsAnalysis } from "./tools/performance/web_vitals/index.js";
import { runNetworkMonitor } from "./tools/performance/network/index.js";
import { runPerformanceTest } from "./tools/performance/test_framework/index.js";

// Import configurations
import { TOOL_DEFINITIONS } from "./config/tool-definitions.js";
import { SERVER_CAPABILITIES } from "./config/capabilities.js";

/**
 * Create and configure the MCP server
 * @returns {Server} The configured server instance
 */
export function createServer() {
  // Create server instance
  const server = new Server(
    {
      name: "webtools-server",
      version: "1.6.0",
    },
    {
      capabilities: SERVER_CAPABILITIES,
    }
  );

  // Set up request handlers
  setupRequestHandlers(server);

  // Set up error handling
  server.onerror = (error) => {
    logError("server", "Server error", error);
  };

  return server;
}

/**
 * Set up request handlers for the server
 * @param {Server} server - The server instance
 */
function setupRequestHandlers(server) {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFINITIONS,
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logInfo("tool", "Tool execution started", {
      tool: name,
      arguments: args,
    });

    try {
      // Check site availability first if URL is provided
      if (args.url) {
        const availability = await checkSiteAvailability(args.url, { ignoreSSLErrors: args.ignoreSSLErrors }, fetchWithRetry);
        if (!availability.available) {
          const response = {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: "Site unavailable",
                    details: availability.error,
                    recommendation: availability.recommendation,
                    retryable: true,
                    url: args.url,
                  },
                  null,
                  2
                ),
              },
            ],
          };

          logError("tool", "Site unavailable", null, {
            tool: name,
            url: args.url,
            availability,
          });

          return response;
        }
      }

      // Execute the appropriate tool
      let result;
      switch (name) {
        case "webtool_gethtml":
          result = await getHtml(args);
          break;
        case "webtool_readpage":
          result = await readPage(args);
          break;
        case "webtool_screenshot":
          result = await screenshot(args);
          break;
        case "webtool_debug":
          result = await debug(args);
          break;
        case "webtool_lighthouse":
          result = await runLighthouse(args);
          break;
        case "webtool_performance_trace":
          result = await performanceTrace(args);
          break;
        case "webtool_coverage_analysis":
          result = await runCoverageAnalysis(args);
          break;
        case "webtool_web_vitals":
          result = await runWebVitalsAnalysis(args);
          break;
        case "webtool_network_monitor":
          result = await runNetworkMonitor(args);
          break;
        case "webtool_performance_test":
          result = await runPerformanceTest(args);
          break;
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      logInfo("tool", "Tool execution completed successfully", {
        tool: name,
        url: args.url,
      });

      return result;
    } catch (error) {
      logError("tool", "Tool execution failed", error, {
        tool: name,
        arguments: args,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Operation failed",
                details: error.message,
                recommendation: "Please try again later or with different parameters",
                retryable: true,
                url: args.url,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  });
}

/**
 * Start the server with the specified transport
 * @param {Server} server - The server instance
 * @returns {Promise<void>} A promise that resolves when the server is started
 */
export async function startServer(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logInfo("server", "Server running", {
    transport: "stdio",
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logInfo("server", "Shutting down gracefully");
    await server.close();
    process.exit(0);
  });
}
