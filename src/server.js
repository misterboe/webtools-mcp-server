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
import { performanceTrace } from "./tools/performance_trace.js";

// Tool definitions
const TOOL_DEFINITIONS = [
  {
    name: "webtool_gethtml",
    description: "Get the HTML content of a webpage. Automatically handles retries and proxy if needed.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the webpage to fetch",
        },
        useJavaScript: {
          type: "boolean",
          description: "Whether to execute JavaScript (requires Puppeteer)",
          default: false,
        },
        useProxy: {
          type: "boolean",
          description: "Whether to use a proxy for this request",
          default: false,
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution, only for trusted sites)",
          default: false,
        },
      },
      required: ["url"],
    },
  },
  {
    name: "webtool_readpage",
    description: "Get the webpage content in Markdown format, including links and images. Handles blocked access automatically.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the webpage to fetch",
        },
        useJavaScript: {
          type: "boolean",
          description: "Whether to execute JavaScript (requires Puppeteer)",
          default: false,
        },
        useProxy: {
          type: "boolean",
          description: "Whether to use a proxy for this request",
          default: false,
        },
        selector: {
          type: "string",
          description: "Optional CSS selector to extract specific content (e.g., 'main', 'article')",
          default: "body",
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution, only for trusted sites)",
          default: false,
        },
      },
      required: ["url"],
    },
  },
  {
    name: "webtool_screenshot",
    description: "Take a screenshot of a webpage or specific element on the page with custom device emulation",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the webpage to screenshot",
        },
        selector: {
          type: "string",
          description: "Optional CSS selector to screenshot a specific element",
        },
        useProxy: {
          type: "boolean",
          description: "Whether to use a proxy for this request",
          default: false,
        },
        deviceConfig: {
          type: "object",
          description: "Custom device configuration for emulation",
          properties: {
            name: {
              type: "string",
              description: "Device name for identification",
            },
            userAgent: {
              type: "string",
              description: "Custom user agent string",
            },
            width: {
              type: "number",
              description: "Viewport width",
            },
            height: {
              type: "number",
              description: "Viewport height",
            },
            deviceScaleFactor: {
              type: "number",
              description: "Device scale factor for high DPI displays",
              default: 1,
            },
            isMobile: {
              type: "boolean",
              description: "Whether to emulate a mobile device",
              default: false,
            },
            hasTouch: {
              type: "boolean",
              description: "Whether the device has touch capabilities",
              default: false,
            },
            isLandscape: {
              type: "boolean",
              description: "Whether to use landscape orientation",
              default: false,
            },
          },
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution, only for trusted sites)",
          default: false,
        },
      },
      required: ["url"],
    },
  },
  {
    name: "webtool_debug",
    description: "Debug a webpage by capturing console output, network requests, errors, and layout thrashing with custom device emulation",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the webpage to debug",
        },
        captureConsole: {
          type: "boolean",
          description: "Capture console.log, warn, error output",
          default: true,
        },
        captureNetwork: {
          type: "boolean",
          description: "Capture network requests and responses",
          default: true,
        },
        captureErrors: {
          type: "boolean",
          description: "Capture JavaScript errors and exceptions",
          default: true,
        },
        captureLayoutThrashing: {
          type: "boolean",
          description: "Capture layout thrashing events (forced layout/reflow)",
          default: false,
        },
        timeoutMs: {
          type: "number",
          description: "How long to collect debug information in milliseconds",
          default: 15000,
        },
        useProxy: {
          type: "boolean",
          description: "Whether to use a proxy for this request",
          default: false,
        },
        deviceConfig: {
          type: "object",
          description: "Custom device configuration for emulation",
          properties: {
            width: {
              type: "number",
              description: "Viewport width in pixels",
              default: 1920,
            },
            height: {
              type: "number",
              description: "Viewport height in pixels",
              default: 1080,
            },
            deviceScaleFactor: {
              type: "number",
              description: "Device scale factor (e.g., 2 for retina displays)",
              default: 1,
            },
            isMobile: {
              type: "boolean",
              description: "Whether to emulate a mobile device",
              default: false,
            },
            hasTouch: {
              type: "boolean",
              description: "Whether to enable touch events",
              default: false,
            },
            isLandscape: {
              type: "boolean",
              description: "Whether to use landscape orientation",
              default: false,
            },
            userAgent: {
              type: "string",
              description: "Custom user agent string",
            },
          },
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution, only for trusted sites)",
          default: false,
        },
      },
      required: ["url"],
    },
  },
  {
    name: "webtool_lighthouse",
    description:
      "Run a Lighthouse audit on a webpage to generate a comprehensive performance report with detailed resource analysis. The report includes specific file paths, resource sizes, and performance metrics similar to Chrome DevTools. Identifies exact files causing performance issues without offering improvement suggestions.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the webpage to audit",
        },
        categories: {
          type: "array",
          description: "Categories to include in the audit",
          items: {
            type: "string",
            enum: ["performance", "accessibility", "best-practices", "seo", "pwa"],
          },
          default: ["performance", "accessibility", "best-practices", "seo", "pwa"],
        },
        device: {
          type: "string",
          description: "Device to emulate",
          enum: ["mobile", "desktop"],
          default: "mobile",
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution, only for trusted sites)",
          default: false,
        },
      },
      required: ["url"],
    },
  },
  {
    name: "webtool_performance_trace",
    description:
      "Perform a detailed performance analysis with specialized modules for layout thrashing, CSS variables impact, JavaScript execution timeline, long tasks breakdown, memory and DOM growth analysis, and resource loading optimization. Provides actionable recommendations for performance improvements.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the webpage to analyze",
        },
        timeoutMs: {
          type: "number",
          description: "Timeout in milliseconds for the analysis",
          default: 15000,
        },
        captureCPUProfile: {
          type: "boolean",
          description: "Whether to capture CPU profile to identify JavaScript bottlenecks",
          default: true,
        },
        captureNetworkActivity: {
          type: "boolean",
          description: "Whether to capture detailed network requests and timing",
          default: true,
        },
        captureJSProfile: {
          type: "boolean",
          description: "Whether to capture JavaScript execution profile",
          default: true,
        },
        captureRenderingPerformance: {
          type: "boolean",
          description: "Whether to capture rendering performance metrics (layout shifts, layer tree)",
          default: true,
        },
        captureMemoryProfile: {
          type: "boolean",
          description: "Whether to capture memory usage profile",
          default: false,
        },
        useProxy: {
          type: "boolean",
          description: "Whether to use a proxy for this request",
          default: false,
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution)",
          default: false,
        },
        // Analysis module controls
        analyzeLayoutThrashing: {
          type: "boolean",
          description: "Whether to analyze layout thrashing patterns",
          default: true,
        },
        analyzeCssVariables: {
          type: "boolean",
          description: "Whether to analyze CSS variables impact",
          default: true,
        },
        analyzeJsExecution: {
          type: "boolean",
          description: "Whether to analyze JavaScript execution and its correlation with layout events",
          default: true,
        },
        analyzeLongTasks: {
          type: "boolean",
          description: "Whether to analyze long tasks and their attribution",
          default: true,
        },
        analyzeMemoryAndDom: {
          type: "boolean",
          description: "Whether to analyze memory usage and DOM growth",
          default: true,
        },
        analyzeResourceLoading: {
          type: "boolean",
          description: "Whether to analyze resource loading waterfall",
          default: true,
        },
        // Threshold controls
        longTaskThresholdMs: {
          type: "number",
          description: "Threshold in milliseconds for long tasks detection",
          default: 50,
        },
        layoutThrashingThreshold: {
          type: "number",
          description: "Threshold for layout thrashing detection (number of layout operations)",
          default: 10,
        },
        memoryLeakThresholdKb: {
          type: "number",
          description: "Threshold in KB/s for memory leak detection",
          default: 10,
        },
        // Output controls
        detailLevel: {
          type: "string",
          description: "Level of detail in the analysis output",
          enum: ["basic", "detailed", "comprehensive"],
          default: "detailed",
        },
        includeRecommendations: {
          type: "boolean",
          description: "Whether to include optimization recommendations in the output",
          default: true,
        },
        // Focus controls
        focusSelector: {
          type: "string",
          description: "CSS selector to focus the analysis on specific DOM elements",
        },
        focusTimeRangeMs: {
          type: "string",
          description: "Time range in milliseconds to focus the analysis (format: 'start-end', e.g., '0-5000')",
        },
        deviceConfig: {
          type: "object",
          description: "Device configuration for emulation",
          properties: {
            width: {
              type: "number",
              description: "Viewport width in pixels",
              default: 1920,
            },
            height: {
              type: "number",
              description: "Viewport height in pixels",
              default: 1080,
            },
            deviceScaleFactor: {
              type: "number",
              description: "Device scale factor (e.g., 2 for retina displays)",
              default: 1,
            },
            isMobile: {
              type: "boolean",
              description: "Whether to emulate a mobile device",
              default: false,
            },
            hasTouch: {
              type: "boolean",
              description: "Whether to enable touch events",
              default: false,
            },
            isLandscape: {
              type: "boolean",
              description: "Whether to use landscape orientation",
              default: false,
            },
            userAgent: {
              type: "string",
              description: "Custom user agent string",
            },
          },
        },
      },
      required: ["url"],
    },
  },
];

/**
 * Create and configure the MCP server
 * @returns {Server} The configured server instance
 */
export function createServer() {
  // Create server instance
  const server = new Server(
    {
      name: "webtools-server",
      version: "1.5.1",
    },
    {
      capabilities: {
        tools: {
          performance_analysis: {
            description: "Advanced performance analysis with specialized modules",
            features: ["Layout Thrashing Analysis", "CSS Variables Impact Analysis", "JavaScript Execution Timeline", "Long Task Breakdown", "Memory and DOM Growth Analysis", "Resource Loading Optimization"],
            recommended_parameters: {
              analyzeLayoutThrashing: true,
              longTaskThresholdMs: 50,
              detailLevel: "comprehensive",
            },
          },
          debug: {
            description: "Comprehensive webpage debugging with console, network, error capture, and layout thrashing detection",
            features: ["Console Output Capture", "Network Request Monitoring", "JavaScript Error Tracking", "Performance Metrics Collection", "DOM Mutation Tracking", "Layout Thrashing Detection"],
            recommended_parameters: {
              captureConsole: true,
              captureNetwork: true,
              captureErrors: true,
              captureLayoutThrashing: true,
              timeoutMs: 15000,
            },
          },
        },
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
