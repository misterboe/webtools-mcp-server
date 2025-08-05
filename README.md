# Webtools MCP Server

⚠️ **IMPORTANT DISCLAIMER**: This software has been developed with the assistance of AI technology. It is provided as-is and should NOT be used in production environments without thorough testing and validation. The code may contain errors, security vulnerabilities, or unexpected behavior. Use at your own risk for research, learning, or development purposes only.

A Model Context Protocol server providing comprehensive web analysis tools including HTML extraction, markdown conversion, screenshot capabilities, debug console, advanced performance analysis, and Lighthouse-powered web audits for performance, accessibility, SEO, and more.

## Prerequisites

- **Node.js**: Version 14 or higher
- **Chrome/Chromium**: Automatically provided by Puppeteer
  - The server will use Puppeteer's bundled Chrome
  - No need to install Chrome separately

## Features

### Core Tools

- `webtool_gethtml`: Raw HTML content extraction
  - JavaScript rendering support
  - Proxy support
  - Automatic retries
- `webtool_readpage`: Markdown conversion
  - Clean content extraction
  - Link preservation
  - Image handling
  - Custom selector support
- `webtool_screenshot`: Screenshot capture
  - Full page screenshots
  - Element-specific capture
  - Device emulation
  - Custom viewport settings
- `webtool_debug`: Debug console
  - Console output capture
  - Network request monitoring
  - Error tracking
  - Performance metrics
  - Layout thrashing detection
- `webtool_lighthouse`: Comprehensive Web Audit
  - Performance analysis
  - Accessibility testing
  - SEO evaluation
  - Best practices review
  - Progressive Web App assessment
  - Device emulation support

### Performance Analysis Tools

- `webtool_performance_trace`: Advanced Performance Analysis
  - Layout thrashing detection
  - CSS variables impact analysis
  - JavaScript execution timeline with layout correlation
  - Long task breakdown and attribution
  - Memory and DOM size analysis
  - Resource loading optimization
- `webtool_network_monitor`: Network Activity Analysis
  - Detailed request and response analysis
  - Resource timing information
  - Waterfall visualization data
  - Optimization recommendations
  - Third-party request analysis
  - Cache analysis
- `webtool_coverage_analysis`: Code Coverage Analysis
  - JavaScript and CSS coverage analysis
  - Unused code identification
  - Code splitting recommendations
  - Third-party code analysis
- `webtool_web_vitals`: Core Web Vitals Analysis
  - LCP (Largest Contentful Paint) analysis
  - CLS (Cumulative Layout Shift) analysis
  - FID/INP (First Input Delay/Interaction to Next Paint) analysis
  - TTFB (Time to First Byte) analysis
  - Element-specific analysis
- `webtool_performance_test`: Cross-device and Network Testing
  - Multi-device testing
  - Network condition simulation
  - Comparative analysis
  - Baseline comparison
  - Device-specific recommendations

### MCP Prompts

- `analyze-website`: Comprehensive Website Analysis
  - Performance, accessibility, SEO, and UX analysis
  - Device type selection (mobile/desktop)
  - Detailed recommendations tailored to device type
  - Complete analysis report with actionable insights
- `get-website-content`: Content Extraction
  - Main content extraction from any webpage
  - Clean markdown conversion
  - Removal of navigation, ads, and non-essential elements
  - Preservation of important formatting and structure
- `screenshot-website`: Screenshot Capture
  - Visual representation of webpage
  - Full page capture
  - Simple URL-based interface
- `technical-performance-analysis`: Technical Performance Analysis
  - Detailed technical analysis of performance bottlenecks
  - Code examples and optimization suggestions
  - Focus area selection (JavaScript, rendering, resources, network)
  - Performance metrics with severity assessment
  - Actionable, code-level recommendations

## Installation

You can install the package globally:

```bash
npm install -g @bschauer/webtools-mcp-server
```

Or use it directly with npx:

```bash
npx @bschauer/webtools-mcp-server
```

### Claude Desktop Integration

You can use this server directly with Claude Desktop by adding it to your configuration:

```json
{
  "mcpServers": {
    "webtools": {
      "command": "npx",
      "args": ["-y", "@bschauer/webtools-mcp-server@1.7.2"]
    }
  }
}
```

## Configuration

Create a configuration file at `~/.mcp/webtools-mcp-server.config.json`:

```json
{
  "proxy": {
    "enabled": false,
    "url": "http://your-proxy-server:port",
    "timeout": 10000
  },
  "browser": {
    "ignoreSSLErrors": false,
    "defaultViewport": {
      "width": 1920,
      "height": 1080
    }
  },
  "devices": {
    "mobile": {
      "width": 375,
      "height": 812,
      "deviceScaleFactor": 3,
      "isMobile": true,
      "hasTouch": true,
      "isLandscape": false,
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    },
    "tablet": {
      "width": 768,
      "height": 1024,
      "deviceScaleFactor": 2,
      "isMobile": true,
      "hasTouch": true,
      "isLandscape": false,
      "userAgent": "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    },
    "desktop": {
      "width": 1920,
      "height": 1080,
      "deviceScaleFactor": 1,
      "isMobile": false,
      "hasTouch": false,
      "isLandscape": true,
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
  },
  "networkConditions": {
    "Slow 3G": {
      "downloadThroughput": 500000,
      "uploadThroughput": 300000,
      "latency": 400
    },
    "Fast 3G": {
      "downloadThroughput": 1500000,
      "uploadThroughput": 750000,
      "latency": 300
    },
    "4G": {
      "downloadThroughput": 4000000,
      "uploadThroughput": 2000000,
      "latency": 100
    },
    "WiFi": {
      "downloadThroughput": 10000000,
      "uploadThroughput": 5000000,
      "latency": 20
    },
    "Fiber": {
      "downloadThroughput": 100000000,
      "uploadThroughput": 50000000,
      "latency": 5
    }
  }
}
```

### Environment Variables

You can also configure the server using environment variables:

- `USE_PROXY`: Enable proxy support (true/false)
- `PROXY_URL`: Proxy server URL
- `PROXY_TIMEOUT`: Proxy timeout in milliseconds
- `IGNORE_SSL_ERRORS`: Ignore SSL certificate errors by default for all tools (true/false) - useful for development environments like DDEV

## Tool Usage Examples

### HTML Content Extraction

```javascript
webtool_gethtml({
  url: "https://example.com",
  useJavaScript: true,
  useProxy: false,
  ignoreSSLErrors: false,
});
```

### Page Reading (Markdown Conversion)

```javascript
webtool_readpage({
  url: "https://example.com",
  useJavaScript: true,
  useProxy: false,
  selector: "main",
  ignoreSSLErrors: false,
});
```

### Screenshot Capture

```javascript
webtool_screenshot({
  url: "https://example.com",
  selector: ".content",
  useProxy: false,
  deviceConfig: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
  },
});
```

### Debug Console

```javascript
webtool_debug({
  url: "https://example.com",
  captureConsole: true,
  captureNetwork: true,
  captureErrors: true,
  captureLayoutThrashing: true, // Enable layout thrashing detection
  timeoutMs: 15000,
});
```

// Focus on layout thrashing detection

```javascript
webtool_debug({
  url: "https://example.com",
  captureConsole: false,
  captureNetwork: false,
  captureErrors: true,
  captureLayoutThrashing: true,
  timeoutMs: 15000,
});
```

### Lighthouse Web Audit

```javascript
webtool_lighthouse({
  url: "https://example.com",
  categories: ["performance", "accessibility", "best-practices", "seo", "pwa"],
  device: "mobile", // or "desktop"
  ignoreSSLErrors: false,
});
```

// Run specific category audits only

```javascript
webtool_lighthouse({
  url: "https://example.com",
  categories: ["performance", "seo"], // Only performance and SEO
  device: "desktop",
});
```

### Advanced Performance Analysis

```javascript
webtool_performance_trace({
  url: "https://example.com",
  timeoutMs: 15000,
  captureCPUProfile: true,
  captureNetworkActivity: true,
  captureJSProfile: true,
  captureRenderingPerformance: true,
  captureMemoryProfile: true,
  deviceConfig: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
  },
});
```

// Focus on specific performance aspects

```javascript
webtool_performance_trace({
  url: "https://example.com",
  captureRenderingPerformance: true, // Focus on layout and rendering
  captureMemoryProfile: true, // Include memory analysis
  deviceConfig: {
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    isMobile: true,
  },
});
```

### Network Activity Analysis

```javascript
webtool_network_monitor({
  url: "https://example.com",
  timeoutMs: 15000,
  waitAfterLoadMs: 2000,
  includeThirdParty: true,
  disableCache: true,
  captureHeaders: true,
  captureTimings: true,
  deviceName: "mobile", // Use predefined device
  networkConditionName: "4G", // Use predefined network condition
});
```

### Code Coverage Analysis

```javascript
webtool_coverage_analysis({
  url: "https://example.com",
  timeoutMs: 15000,
  waitAfterLoadMs: 2000,
  includeThirdParty: true,
  disableCache: true,
  deviceName: "desktop",
});
```

### Core Web Vitals Analysis

```javascript
webtool_web_vitals({
  url: "https://example.com",
  timeoutMs: 15000,
  waitAfterLoadMs: 3000,
  interactWithPage: true,
  deviceName: "mobile",
  networkConditionName: "4G",
});
```

### Cross-device and Network Testing

```javascript
webtool_performance_test({
  url: "https://example.com",
  timeoutMs: 30000,
  devices: ["desktop", "mobile", "tablet"],
  networkConditions: ["WiFi", "4G", "3G"],
  tests: ["web_vitals", "network", "coverage"],
  compareResults: true,
  baselineDevice: "desktop",
  baselineNetwork: "WiFi",
  includeScreenshots: true,
});
```

## Response Format

All tools return responses in the following format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "..." // Markdown formatted report
    }
  ]
}
```

For screenshots:

```json
{
  "content": [
    {
      "type": "image",
      "data": "...", // Base64 encoded PNG
      "mimeType": "image/png"
    }
  ]
}
```

For Lighthouse audits:

```json
{
  "content": [
    {
      "type": "text",
      "text": "..." // Markdown formatted report with audit results
    }
  ]
}
```

## Best Practices

1. Start with basic HTML retrieval before using advanced analysis
2. Use JavaScript rendering only when necessary (slower but more complete)
3. Set appropriate timeouts for complex pages
4. Use selectors to target specific page sections when possible
5. Enable proxy support only when needed for geo-restricted content
6. For Lighthouse audits, specify only the categories you need to improve performance
7. Check errors carefully - they often contain helpful troubleshooting tips
8. When using device emulation, match real device specifications for accurate results
9. For large websites, focus on specific pages rather than entire sites
10. Use the debug tool to understand JavaScript errors before applying fixes
11. For performance testing, start with the baseline device and network condition
12. Compare results across different devices and network conditions to identify device-specific issues
13. Use the performance test framework to identify optimization opportunities for specific scenarios
14. Focus on Core Web Vitals metrics for the best user experience improvements
15. Use code coverage analysis to identify unused code and optimize bundle size

## Troubleshooting

Common issues and solutions:

### Chrome Installation

- **Note**: Chrome is now automatically installed via Puppeteer - no additional steps required
- If you encounter any Chrome-related issues, try reinstalling the package with `npm install -g @bschauer/webtools-mcp-server`

### Connection Problems

- **Issue**: Cannot connect to website
- **Solution**: Check URL format, website availability, or try with proxy enabled

### SSL Certificate Issues

- **Issue**: SSL certificate errors with DDEV or local development sites
- **Solution**: Set `IGNORE_SSL_ERRORS=true` environment variable or use `ignoreSSLErrors=true` parameter for individual tools
- **Note**: For production sites, ensure proper SSL certificate configuration instead of bypassing SSL checks

### JavaScript Rendering Issues

- **Issue**: Page content missing when using JavaScript rendering
- **Solution**: Increase timeout, check for navigation errors in debug output

### Screenshot Problems

- **Issue**: Blank or incomplete screenshots
- **Solution**: Ensure selectors are correct, increase viewport size, check debug console

### Lighthouse Audit Timeouts

- **Issue**: Lighthouse audit times out
- **Solution**: Increase timeout setting, reduce categories, try with a faster connection

### Proxy Connection Failures

- **Issue**: Cannot connect through proxy
- **Solution**: Verify proxy URL, check proxy connection timeout, ensure proxy is operational

### Layout Thrashing Detection Issues

- **Issue**: No layout thrashing events detected
- **Solution**: Ensure captureLayoutThrashing is set to true, increase timeoutMs, try with different pages

### Performance Test Framework Issues

- **Issue**: Performance test framework times out
- **Solution**: Reduce the number of devices and network conditions, increase timeout, run tests individually

### Network Monitor Issues

- **Issue**: Network monitor shows incomplete data
- **Solution**: Increase waitAfterLoadMs, ensure captureTimings is set to true, check for CORS issues

### Code Coverage Analysis Issues

- **Issue**: Code coverage analysis shows no results
- **Solution**: Ensure the page loads JavaScript, increase waitAfterLoadMs, check for script loading errors

## Security Considerations

- This tool can access arbitrary websites - use responsibly
- The proxy feature should be used with caution and in compliance with applicable laws
- SSL certificate checking should remain enabled unless absolutely necessary
- Website owners may detect and block automated access
- Some websites prohibit scraping in their Terms of Service

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

bschauer
