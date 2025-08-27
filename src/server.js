import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, ListPromptsRequestSchema, GetPromptRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { logInfo, logError } from "./utils/logging.js";
import { checkSiteAvailability } from "./utils/html.js";
import { fetchWithRetry } from "./utils/fetch.js";

// Tool handler imports - will be loaded dynamically based on configuration
// Lazy loading to reduce memory footprint when tools are not needed

// Import configurations
import { TOOL_DEFINITIONS } from "./config/tool-definitions.js";
import { SERVER_CAPABILITIES } from "./config/capabilities.js";
import { ResourceConfigManager } from "./config/resource-configs.js";
import { estimateTokenUsage } from "./config/tool-manager.js";

// Import prompts
import { PROMPT_DEFINITIONS, PROMPT_HANDLERS } from "./prompts/index.js";

// Import resource management system
import { createResourceManager } from "./utils/resource-manager.js";

// Dynamic resource storage
const dynamicResources = new Map();

// Tool handler cache for lazy loading
const toolHandlerCache = new Map();

/**
 * Lazy load a tool handler
 * @param {string} toolName - Name of the tool to load
 * @returns {Function} Tool handler function
 */
async function loadToolHandler(toolName) {
  if (toolHandlerCache.has(toolName)) {
    return toolHandlerCache.get(toolName);
  }

  let handler;
  
  switch (toolName) {
    case "webtool_gethtml":
      const { getHtml } = await import("./tools/html.js");
      handler = getHtml;
      break;
    case "webtool_readpage":
      const { readPage } = await import("./tools/html.js");
      handler = readPage;
      break;
    case "webtool_screenshot":
      const { screenshot } = await import("./tools/screenshot.js");
      handler = screenshot;
      break;
    case "webtool_debug":
      const { debug } = await import("./tools/debug.js");
      handler = debug;
      break;
    case "webtool_lighthouse":
      const { runLighthouse } = await import("./tools/lighthouse.js");
      handler = runLighthouse;
      break;
    case "webtool_performance_trace":
      const { performanceTrace } = await import("./tools/performance/trace/index.js");
      handler = performanceTrace;
      break;
    case "webtool_coverage_analysis":
      const { runCoverageAnalysis } = await import("./tools/performance/coverage/index.js");
      handler = runCoverageAnalysis;
      break;
    case "webtool_web_vitals":
      const { runWebVitalsAnalysis } = await import("./tools/performance/web_vitals/index.js");
      handler = runWebVitalsAnalysis;
      break;
    case "webtool_network_monitor":
      const { runNetworkMonitor } = await import("./tools/performance/network/index.js");
      handler = runNetworkMonitor;
      break;
    case "webtool_performance_test":
      const { runPerformanceTest } = await import("./tools/performance/test_framework/index.js");
      handler = runPerformanceTest;
      break;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }

  toolHandlerCache.set(toolName, handler);
  return handler;
}

/**
 * Create and configure the MCP server
 * @param {string[]} enabledTools - Array of enabled tool names
 * @returns {Server} The configured server instance
 */
export function createServer(enabledTools = []) {
  // Filter tool definitions based on enabled tools
  const filteredToolDefinitions = enabledTools.length > 0 
    ? TOOL_DEFINITIONS.filter(tool => enabledTools.includes(tool.name))
    : TOOL_DEFINITIONS;

  // Log tool configuration
  const tokenUsage = estimateTokenUsage(enabledTools.length > 0 ? enabledTools : TOOL_DEFINITIONS.map(t => t.name));
  logInfo("tool-manager", "🎯 Tool Configuration", {
    enabledTools: filteredToolDefinitions.length,
    totalAvailable: TOOL_DEFINITIONS.length,
    tools: filteredToolDefinitions.map(t => t.name),
    estimatedTokens: `${tokenUsage.totalTokens.toLocaleString()} tokens`,
    tokenReduction: enabledTools.length > 0 && enabledTools.length < TOOL_DEFINITIONS.length 
      ? `${tokenUsage.reductionPercent}% reduction (${tokenUsage.savedTokens.toLocaleString()} tokens saved)`
      : "no reduction (all tools loaded)"
  });

  // Initialize resource management system for enabled tools only
  const resourceManager = createResourceManager(dynamicResources);
  const configManager = new ResourceConfigManager().loadPreset('ALL_ENABLED');
  
  // Configure resource handling only for enabled tools
  for (const [toolName, config] of Object.entries(configManager.getConfig())) {
    if (config.enabled && (enabledTools.length === 0 || enabledTools.includes(toolName))) {
      resourceManager.enableForTool(toolName, config);
      logInfo("resource", `🚀 Resource support enabled for tool: ${toolName}`);
    }
  }

  // Create server instance
  const server = new Server(
    {
      name: "webtools-server",
      version: "1.8.0",
    },
    {
      capabilities: {
        ...SERVER_CAPABILITIES,
        prompts: {},
        resources: {},
      },
    }
  );

  // Set up request handlers with filtered tools
  setupRequestHandlers(server, filteredToolDefinitions, resourceManager);

  // Set up error handling
  server.onerror = (error) => {
    logError("server", "Server error", error);
  };

  return server;
}

/**
 * Set up request handlers for the server
 * @param {Server} server - The server instance
 * @param {Array} toolDefinitions - Filtered tool definitions based on enabled tools
 * @param {Object} resourceManager - Resource manager instance
 */
function setupRequestHandlers(server, toolDefinitions, resourceManager) {
  // List available tools (only enabled ones)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolDefinitions,
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
      
      // Check if tool is enabled
      const enabledToolNames = toolDefinitions.map(t => t.name);
      if (!enabledToolNames.includes(name)) {
        throw new McpError(ErrorCode.MethodNotFound, `Tool not enabled: ${name}. Available tools: ${enabledToolNames.join(", ")}`);
      }

      // Load tool handler dynamically (lazy loading)
      const toolHandler = await loadToolHandler(name);

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
  
  // Resource management system is already logged in createServer

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logInfo("server", "Shutting down gracefully");
    await server.close();
    process.exit(0);
  });
}
