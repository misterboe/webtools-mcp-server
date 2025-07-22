import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, ListPromptsRequestSchema, GetPromptRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
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
import { ResourceConfigManager } from "./config/resource-configs.js";

// Import prompts
import { PROMPT_DEFINITIONS, PROMPT_HANDLERS } from "./prompts/index.js";

// Import resource management system
import { createResourceManager } from "./utils/resource-manager.js";

// Dynamic resource storage
const dynamicResources = new Map();

// Initialize resource management system
const resourceManager = createResourceManager(dynamicResources);
const configManager = new ResourceConfigManager().loadPreset('ALL_ENABLED');

// Configure resource handling for all tools
for (const [toolName, config] of Object.entries(configManager.getConfig())) {
  if (config.enabled) {
    resourceManager.enableForTool(toolName, config);
    logInfo("resource", `🚀 Resource support enabled for tool: ${toolName}`);
  }
}

/**
 * Create and configure the MCP server
 * @returns {Server} The configured server instance
 */
export function createServer() {
  // Create server instance
  const server = new Server(
    {
      name: "webtools-server",
      version: "1.7.0",
    },
    {
      capabilities: {
        ...SERVER_CAPABILITIES,
        prompts: {},
        resources: {},
      },
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

  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: PROMPT_DEFINITIONS,
    };
  });

  // Get prompt by name
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Find the appropriate handler for this prompt
    const promptHandler = PROMPT_HANDLERS[name];

    if (!promptHandler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown prompt: ${name}`);
    }

    try {
      return promptHandler(args);
    } catch (error) {
      throw new McpError(ErrorCode.InvalidParams, error.message);
    }
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

      // Execute tool with automatic resource handling
      let result;
      
      // Map tool names to their handler functions
      const toolHandlers = {
        "webtool_gethtml": getHtml,
        "webtool_readpage": readPage,
        "webtool_screenshot": screenshot,
        "webtool_debug": debug,
        "webtool_lighthouse": runLighthouse,
        "webtool_performance_trace": performanceTrace,
        "webtool_coverage_analysis": runCoverageAnalysis,
        "webtool_web_vitals": runWebVitalsAnalysis,
        "webtool_network_monitor": runNetworkMonitor,
        "webtool_performance_test": runPerformanceTest
      };

      // Get the tool handler
      const toolHandler = toolHandlers[name];
      if (!toolHandler) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      // Execute tool and process result through resource manager
      const toolResult = await toolHandler(args);
      result = await resourceManager.processToolResult(name, args, toolResult);

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

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    // Only dynamic resources created by tool calls
    const dynamicResourceList = Array.from(dynamicResources.values()).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }));
    
    logInfo("resource", "Listing resources", { 
      dynamicCount: dynamicResourceList.length 
    });

    return {
      resources: dynamicResourceList
    };
  });

  // Read resource content
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    try {
      // Check if this is a dynamic resource
      if (dynamicResources.has(uri)) {
        const resource = dynamicResources.get(uri);
        logInfo("resource", "Reading dynamic resource", { 
          uri, 
          size: resource.content.length,
          mimeType: resource.mimeType 
        });
        
        return {
          contents: [{
            uri: uri,
            mimeType: resource.mimeType,
            text: resource.content
          }]
        };
      }

      // Resource not found
      throw new Error(`Resource not found: ${uri}. Use webtool_gethtml to load a page first.`);
      
    } catch (error) {
      logError("resource", "Failed to read resource", error, { uri });
      
      throw new McpError(
        ErrorCode.InternalError, 
        `Failed to read resource: ${error.message}`
      );
    }
  });
}


// Note: The old getHtmlWithResources function has been replaced by the 
// generic ResourceManager system. All tools now automatically get 
// resource capabilities through the middleware pattern.

// Note: The old resource content extraction functions have been moved to 
// the ResourceManager system. Complex content processing can now be handled
// through custom content adapters if needed in the future.

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
  
  // Log resource management status
  const summary = configManager.getConfigSummary();
  logInfo("resource", "🎯 Resource Management System Active", {
    enabledTools: summary.enabledCount,
    totalTools: summary.totalTools,
    tools: summary.enabledTools
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logInfo("server", "Shutting down gracefully");
    await server.close();
    process.exit(0);
  });
}
