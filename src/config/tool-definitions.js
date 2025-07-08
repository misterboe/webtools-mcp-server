/**
 * Tool definitions for the MCP server
 * Contains the input schemas and descriptions for all available tools
 */

import { SSL_CONFIG } from "./constants.js";

// Tool definitions
export const TOOL_DEFINITIONS = [
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
          default: SSL_CONFIG.ignoreSSLErrorsByDefault,
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
          default: SSL_CONFIG.ignoreSSLErrorsByDefault,
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
          default: SSL_CONFIG.ignoreSSLErrorsByDefault,
        },
      },
      required: ["url"],
    },
  },
  {
    name: "webtool_debug",
    description: "Debug a webpage by capturing console output, network requests, errors, and layout thrashing with custom device emulation. Includes advanced response size management with pagination, output limits, and compact formatting to stay within MCP token limits.",
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
        // Output control parameters to manage response size
        maxConsoleEvents: {
          type: "number",
          description: "Maximum number of console events to include in the response",
          default: 20,
        },
        maxNetworkEvents: {
          type: "number",
          description: "Maximum number of network events to include in the response",
          default: 30,
        },
        maxErrorEvents: {
          type: "number",
          description: "Maximum number of error events to include in the response",
          default: 10,
        },
        maxResourceEvents: {
          type: "number",
          description: "Maximum number of resource timing events to include in the response",
          default: 15,
        },
        skipStackTraces: {
          type: "boolean",
          description: "Skip stack traces in layout thrashing events to reduce response size",
          default: false,
        },
        compactFormat: {
          type: "boolean",
          description: "Use compact format for all sections to reduce response size",
          default: false,
        },
        summarizeOnly: {
          type: "boolean",
          description: "Include only summary and counts without detailed event data",
          default: false,
        },
        // Pagination parameters for large datasets
        page: {
          type: "number",
          description: "Page number for paginated results (starts at 1)",
          default: 1,
        },
        pageSize: {
          type: "number",
          description: "Number of events per page for paginated results",
          default: 20,
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution, only for trusted sites)",
          default: SSL_CONFIG.ignoreSSLErrorsByDefault,
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
          default: SSL_CONFIG.ignoreSSLErrorsByDefault,
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
          default: SSL_CONFIG.ignoreSSLErrorsByDefault,
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
  {
    name: "webtool_coverage_analysis",
    description: "Analyze JavaScript and CSS coverage to identify unused code and optimization opportunities. Uses Chrome DevTools Protocol Coverage API to provide detailed insights into code usage.",
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
        waitAfterLoadMs: {
          type: "number",
          description: "Additional time to wait after page load to capture more interactions",
          default: 2000,
        },
        includeThirdParty: {
          type: "boolean",
          description: "Whether to include third-party scripts and stylesheets in the analysis",
          default: true,
        },
        useProxy: {
          type: "boolean",
          description: "Whether to use a proxy for this request",
          default: false,
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution)",
          default: SSL_CONFIG.ignoreSSLErrorsByDefault,
        },
        disableCache: {
          type: "boolean",
          description: "Whether to disable browser cache for the analysis",
          default: true,
        },
        networkConditionName: {
          type: "string",
          description: "Predefined network condition to emulate (e.g., 'Slow 3G', 'Fast 3G', '4G', 'WiFi', 'Fiber')",
        },
        networkCondition: {
          type: "object",
          description: "Custom network condition configuration",
          properties: {
            downloadThroughput: {
              type: "number",
              description: "Download throughput in bytes/s",
            },
            uploadThroughput: {
              type: "number",
              description: "Upload throughput in bytes/s",
            },
            latency: {
              type: "number",
              description: "Latency in milliseconds",
            },
          },
        },
        deviceName: {
          type: "string",
          description: "Predefined device to emulate (e.g., 'Pixel 7', 'iPhone 14')",
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
      },
      required: ["url"],
    },
  },
  {
    name: "webtool_web_vitals",
    description: "Analyze Core Web Vitals metrics (LCP, CLS, FID/INP, TTFB) and identify problematic elements affecting these metrics. Uses Performance Observer API to provide detailed insights into real user experience metrics.",
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
        waitAfterLoadMs: {
          type: "number",
          description: "Additional time to wait after page load to capture more metrics",
          default: 3000,
        },
        interactWithPage: {
          type: "boolean",
          description: "Whether to automatically interact with the page to trigger more events",
          default: true,
        },
        useProxy: {
          type: "boolean",
          description: "Whether to use a proxy for this request",
          default: false,
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution)",
          default: SSL_CONFIG.ignoreSSLErrorsByDefault,
        },
        networkConditionName: {
          type: "string",
          description: "Predefined network condition to emulate (e.g., 'Slow 3G', 'Fast 3G', '4G', 'WiFi', 'Fiber')",
        },
        networkCondition: {
          type: "object",
          description: "Custom network condition configuration",
          properties: {
            downloadThroughput: {
              type: "number",
              description: "Download throughput in bytes/s",
            },
            uploadThroughput: {
              type: "number",
              description: "Upload throughput in bytes/s",
            },
            latency: {
              type: "number",
              description: "Latency in milliseconds",
            },
          },
        },
        deviceName: {
          type: "string",
          description: "Predefined device to emulate (e.g., 'Pixel 7', 'iPhone 14')",
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
        runMultipleTimes: {
          type: "boolean",
          description: "Whether to run the analysis multiple times to get more accurate results",
          default: false,
        },
        numberOfRuns: {
          type: "number",
          description: "Number of runs to perform if runMultipleTimes is true",
          default: 3,
        },
      },
      required: ["url"],
    },
  },
  {
    name: "webtool_network_monitor",
    description: "Analyze network activity and resource loading performance. Provides detailed insights into network requests, timing, and optimization opportunities.",
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
        waitAfterLoadMs: {
          type: "number",
          description: "Additional time to wait after page load to capture more requests",
          default: 2000,
        },
        useProxy: {
          type: "boolean",
          description: "Whether to use a proxy for this request",
          default: false,
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution)",
          default: SSL_CONFIG.ignoreSSLErrorsByDefault,
        },
        includeThirdParty: {
          type: "boolean",
          description: "Whether to include third-party requests in the analysis",
          default: true,
        },
        disableCache: {
          type: "boolean",
          description: "Whether to disable browser cache for the analysis",
          default: true,
        },
        captureHeaders: {
          type: "boolean",
          description: "Whether to capture request and response headers",
          default: true,
        },
        captureContent: {
          type: "boolean",
          description: "Whether to capture request and response content",
          default: false,
        },
        captureTimings: {
          type: "boolean",
          description: "Whether to capture detailed timing information",
          default: true,
        },
        filterByType: {
          type: "string",
          description: "Filter requests by resource type (e.g., 'document', 'stylesheet', 'script', 'image', 'font', 'media', 'json', 'text')",
        },
        filterByDomain: {
          type: "string",
          description: "Filter requests by domain (e.g., 'example.com')",
        },
        sortBy: {
          type: "string",
          description: "Sort requests by a specific property",
          enum: ["startTime", "duration", "size", "type"],
          default: "startTime",
        },
        networkConditionName: {
          type: "string",
          description: "Predefined network condition to emulate (e.g., 'Slow 3G', 'Fast 3G', '4G', 'WiFi', 'Fiber')",
        },
        networkCondition: {
          type: "object",
          description: "Custom network condition configuration",
          properties: {
            downloadThroughput: {
              type: "number",
              description: "Download throughput in bytes/s",
            },
            uploadThroughput: {
              type: "number",
              description: "Upload throughput in bytes/s",
            },
            latency: {
              type: "number",
              description: "Latency in milliseconds",
            },
          },
        },
        deviceName: {
          type: "string",
          description: "Predefined device to emulate (e.g., 'Pixel 7', 'iPhone 14')",
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
        // New parameters for response size optimization
        maxRequests: {
          type: "number",
          description: "Maximum number of requests to include in the response (to limit response size)",
          default: 100,
        },
        summarizeOnly: {
          type: "boolean",
          description: "Whether to include only summary and recommendations without detailed request data (to reduce response size)",
          default: false,
        },
        page: {
          type: "number",
          description: "Page number for paginated results (starts at 1)",
          default: 1,
        },
        pageSize: {
          type: "number",
          description: "Number of requests per page for paginated results",
          default: 20,
        },
        includeRecommendations: {
          type: "boolean",
          description: "Whether to include optimization recommendations in the output",
          default: true,
        },
      },
      required: ["url"],
    },
  },
  {
    name: "webtool_performance_test",
    description: "Run performance tests across different devices and network conditions. Compare results and identify device-specific or network-specific issues.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the webpage to test",
        },
        timeoutMs: {
          type: "number",
          description: "Timeout in milliseconds for each test",
          default: 30000,
        },
        waitAfterLoadMs: {
          type: "number",
          description: "Additional time to wait after page load for each test",
          default: 3000,
        },
        useProxy: {
          type: "boolean",
          description: "Whether to use a proxy for this request",
          default: false,
        },
        ignoreSSLErrors: {
          type: "boolean",
          description: "Whether to ignore SSL certificate errors (use with caution)",
          default: SSL_CONFIG.ignoreSSLErrorsByDefault,
        },
        devices: {
          type: "array",
          description: "Devices to test on",
          items: {
            type: "string",
          },
          default: ["desktop", "mobile"],
        },
        networkConditions: {
          type: "array",
          description: "Network conditions to test with",
          items: {
            type: "string",
          },
          default: ["WiFi", "4G", "3G"],
        },
        tests: {
          type: "array",
          description: "Tests to run",
          items: {
            type: "string",
            enum: ["web_vitals", "network", "coverage"],
          },
          default: ["web_vitals", "network", "coverage"],
        },
        compareResults: {
          type: "boolean",
          description: "Whether to compare results between different scenarios",
          default: true,
        },
        baselineDevice: {
          type: "string",
          description: "Device to use as baseline for comparison",
          default: "desktop",
        },
        baselineNetwork: {
          type: "string",
          description: "Network condition to use as baseline for comparison",
          default: "WiFi",
        },
        includeScreenshots: {
          type: "boolean",
          description: "Whether to include screenshots in the results",
          default: true,
        },
        runMultipleTimes: {
          type: "boolean",
          description: "Whether to run each test multiple times to get more accurate results",
          default: false,
        },
        numberOfRuns: {
          type: "number",
          description: "Number of runs to perform for each test if runMultipleTimes is true",
          default: 3,
        },
      },
      required: ["url"],
    },
  },
];
