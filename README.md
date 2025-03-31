# Webtools MCP Server

⚠️ **IMPORTANT DISCLAIMER**: This software has been developed with the assistance of AI technology. It is provided as-is and should NOT be used in production environments without thorough testing and validation. The code may contain errors, security vulnerabilities, or unexpected behavior. Use at your own risk for research, learning, or development purposes only.

A Model Context Protocol server providing comprehensive web analysis tools including HTML extraction, markdown conversion, screenshot capabilities, debug console, advanced performance analysis, and Lighthouse-powered web audits for performance, accessibility, SEO, and more.

## Prerequisites

- **Node.js**: Version 14 or higher
- **Chrome/Chromium**: Automatically provided by Puppeteer
  - The server will use Puppeteer's bundled Chrome
  - No need to install Chrome separately

## Changelog

### Version 1.5.1 - Layout Thrashing Detection & Stability Improvements

- 🔍 Enhanced debug tool with layout thrashing detection
- 🔄 Improved server capabilities communication
- 🛠️ Increased stability for debug tool
- 💬 Enhanced client-server communication

### Version 1.5.0 - Enhanced Performance Analysis

- 🔍 Advanced performance analysis with specialized modules:
  - **Layout Thrashing Analysis**: Detects and visualizes layout thrashing patterns
  - **CSS Variables Impact Analyzer**: Tracks CSS variable changes and their cascade effects
  - **JavaScript Execution Timeline**: Maps JS functions to layout events
  - **Long Task Breakdown Analyzer**: Provides detailed attribution of long tasks
  - **Memory and DOM Size Analyzer**: Tracks DOM growth and detects memory leaks
  - **Resource Loading Optimizer**: Analyzes resource loading waterfall
- 🧩 Modular architecture for performance analysis tools
- 📊 More detailed performance bottleneck detection
- 📈 Better visualization of performance issues
- 🛠️ More actionable recommendations for performance optimization

### Version 1.4.1 - Chrome Integration Fix

- 🛠️ Fixed Chrome detection and availability issues
- 🔧 Added automatic Chrome installation via Puppeteer
- 📚 Updated documentation with Chrome requirements
- 💬 Improved error messages for better troubleshooting

### Version 1.4.0 - Lighthouse Integration & Documentation Update

- 🔍 Unified Lighthouse-based web auditing system
- 📊 Support for multiple audit categories in a single request
- 📱 Device emulation for mobile and desktop
- 📄 Comprehensive documentation update
- 🔧 Improved configuration options
- 🐛 Enhanced error handling and reporting

### Version 1.3.0 - Comprehensive Web Analysis Toolkit

- 🌟 Added Lighthouse integration for web audits
- 🚀 Support for performance, accessibility, SEO, and best practices audits
- 🔧 Enhanced configuration options
- 📊 Improved reporting formats
- 🔄 Better resource analysis capabilities

### Version 1.2.0 - Debug Enhancement

- 🐛 Added Debug capabilities for web pages
- 📸 Screenshot functionality improvements
- 📊 Enhanced error reporting

### Version 1.1.0 - Visual & Content Capture

- 📷 Screenshot capabilities
- 📄 Basic HTML extraction
- 📝 Markdown conversion
- 🔄 Proxy support

### Version 1.0.0 - Initial Release

- 🌐 Initial release
- 📑 Basic HTML fetching
- 📚 Page reading functionality
- ⚠️ Error handling

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
- `webtool_performance_trace`: Advanced Performance Analysis
  - Layout thrashing detection
  - CSS variables impact analysis
  - JavaScript execution timeline with layout correlation
  - Long task breakdown and attribution
  - Memory and DOM size analysis
  - Resource loading optimization

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
      "args": ["-y", "@bschauer/webtools-mcp-server@1.5.1"]
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
  }
}
```

### Environment Variables

You can also configure the server using environment variables:

- `USE_PROXY`: Enable proxy support (true/false)
- `PROXY_URL`: Proxy server URL
- `PROXY_TIMEOUT`: Proxy timeout in milliseconds

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

## Troubleshooting

Common issues and solutions:

### Chrome Installation

- **Note**: Chrome is now automatically installed via Puppeteer - no additional steps required
- If you encounter any Chrome-related issues, try reinstalling the package with `npm install -g @bschauer/webtools-mcp-server`

### Connection Problems

- **Issue**: Cannot connect to website
- **Solution**: Check URL format, website availability, or try with proxy enabled

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
