# Webtools MCP Server

A Model Context Protocol (MCP) server that provides web scraping, content extraction, and screenshot tools. This server can be used with any MCP-compatible client to fetch, process, and capture web content.

## Features

- `webtool_gethtml`: Get raw HTML content from any webpage
- `webtool_readpage`: Convert webpage content to clean, formatted Markdown
- `webtool_screenshot`: Take screenshots of webpages with custom device emulation
- `webtool_debug`: Capture console output, network requests, and performance metrics
- Automatic retry mechanism with exponential backoff
- Optional proxy support
- JavaScript rendering support (via Puppeteer)
- Intelligent HTML cleaning and formatting
- Markdown conversion with image and link preservation
- Flexible device emulation for screenshots
- Comprehensive debugging capabilities

## Installation

You can run this server directly using `npx`:

```json
{
  "mcpServers": {
    "webtools": {
      "command": "npx",
      "args": ["-y", "@bschauer/webtools-mcp-server"]
    }
  }
}
```

Or install it globally:

```bash
npm install -g @bschauer/webtools-mcp-server
```

## Configuration

The server supports the following environment variables:

- `USE_PROXY`: Set to 'true' to enable proxy support
- `PROXY_URL`: The proxy URL (default: 'http://localhost:8888')
- `PROXY_TIMEOUT`: Proxy timeout in milliseconds (default: 30000)

## Available Tools

### webtool_gethtml

Gets the raw HTML content of a webpage.

Parameters:

- `url` (required): The URL of the webpage to fetch
- `useJavaScript` (optional): Whether to execute JavaScript (requires Puppeteer)
- `useProxy` (optional): Whether to use a proxy for this request

### webtool_readpage

Gets the webpage content in Markdown format.

Parameters:

- `url` (required): The URL of the webpage to fetch
- `useJavaScript` (optional): Whether to execute JavaScript (requires Puppeteer)
- `useProxy` (optional): Whether to use a proxy for this request
- `selector` (optional): CSS selector to extract specific content (default: "body")

### webtool_screenshot

Takes screenshots of webpages with custom device emulation support.

Parameters:

- `url` (required): The URL of the webpage to screenshot
- `selector` (optional): CSS selector to screenshot a specific element
- `useProxy` (optional): Whether to use a proxy for this request
- `deviceConfig` (optional): Custom device configuration for emulation
  - `name`: Device name for identification
  - `userAgent`: Custom user agent string
  - `width`: Viewport width
  - `height`: Viewport height
  - `deviceScaleFactor`: Device scale factor for high DPI displays (default: 1)
  - `isMobile`: Whether to emulate a mobile device (default: false)
  - `hasTouch`: Whether the device has touch capabilities (default: false)
  - `isLandscape`: Whether to use landscape orientation (default: false)

Example screenshot configurations:

```json
// Mobile device screenshot
{
  "url": "https://example.com",
  "deviceConfig": {
    "name": "Custom Mobile",
    "width": 390,
    "height": 844,
    "deviceScaleFactor": 3,
    "isMobile": true,
    "hasTouch": true,
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15"
  }
}

// Tablet in landscape mode
{
  "url": "https://example.com",
  "deviceConfig": {
    "name": "Custom Tablet",
    "width": 1024,
    "height": 768,
    "deviceScaleFactor": 2,
    "isMobile": true,
    "hasTouch": true,
    "isLandscape": true
  }
}

// Specific element screenshot
{
  "url": "https://example.com",
  "selector": ".main-content",
  "deviceConfig": {
    "width": 1920,
    "height": 1080
  }
}
```

### webtool_debug

Captures comprehensive debug information from a webpage including console output, network requests, JavaScript errors, and performance metrics.

Parameters:

- `url` (required): The URL of the webpage to debug
- `captureConsole` (optional): Capture console.log, warn, error output (default: true)
- `captureNetwork` (optional): Capture network requests and responses (default: true)
- `captureErrors` (optional): Capture JavaScript errors and exceptions (default: true)
- `timeoutMs` (optional): How long to collect debug information in milliseconds (default: 10000)
- `useProxy` (optional): Whether to use a proxy for this request (default: false)

The tool returns a formatted markdown report containing:

- Console output with timestamps and log levels
- Network requests and responses
- JavaScript errors and exceptions
- Performance metrics including:
  - Navigation timing
  - Resource loading times
  - DOM events timing
  - Network transfer sizes

Example debug configuration:

```json
{
  "url": "https://example.com",
  "captureConsole": true,
  "captureNetwork": true,
  "captureErrors": true,
  "timeoutMs": 15000
}
```

## Optional Dependencies

- `puppeteer`: Required for JavaScript rendering and screenshot support. Will be automatically installed if needed.

## License

MIT
