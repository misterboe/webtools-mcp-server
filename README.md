# Webtools MCP Server

A Model Context Protocol server providing comprehensive web analysis tools.

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

### Analysis Tools

- `webtool_performance`: Performance Analyzer

  - Core Web Vitals measurement
  - Resource loading analysis
  - Performance timeline
  - Memory profiling
  - Navigation timing

- `webtool_security`: Security Scanner

  - Security headers analysis
  - CSP validation
  - SSL/TLS certificate checking
  - Dependency scanning
  - Vulnerability detection

- `webtool_accessibility`: Accessibility Checker

  - WCAG compliance
  - ARIA validation
  - Contrast analysis
  - Structure validation
  - Form control checking

- `webtool_seo`: SEO Analyzer

  - Meta tags analysis
  - Structured data validation
  - Mobile-friendliness
  - Content quality
  - Readability scoring

- `webtool_assets`: Asset Optimizer
  - Image optimization
  - Font optimization
  - CSS analysis
  - JavaScript optimization
  - Resource size analysis

## Installation

```bash
npm install @bschauer/webtools-mcp-server
```

## Usage

### Starting the Server

```bash
npx webtools-mcp-server
```

### Configuration

Environment variables:

- `USE_PROXY`: Enable proxy support (true/false)
- `PROXY_URL`: Proxy server URL
- `PROXY_TIMEOUT`: Proxy timeout in milliseconds

### Optional Dependencies

For full functionality, install Puppeteer:

```bash
npm install puppeteer
```

## Tool Examples

### HTML Content Extraction

```json
{
  "url": "https://example.com",
  "useJavaScript": true,
  "useProxy": false
}
```

### Page Reading

```json
{
  "url": "https://example.com",
  "useJavaScript": true,
  "useProxy": false,
  "selector": "main"
}
```

### Screenshot Capture

```json
{
  "url": "https://example.com",
  "selector": ".content",
  "deviceConfig": {
    "width": 1920,
    "height": 1080,
    "deviceScaleFactor": 1,
    "isMobile": false
  }
}
```

### Debug Console

```json
{
  "url": "https://example.com",
  "captureConsole": true,
  "captureNetwork": true,
  "captureErrors": true,
  "timeoutMs": 5000
}
```

### Performance Analysis

```json
{
  "url": "https://example.com",
  "includeCoreWebVitals": true,
  "includeResourceTiming": true,
  "includeMemoryProfile": false,
  "timeoutMs": 15000
}
```

### Security Analysis

```json
{
  "url": "https://example.com",
  "checkHeaders": true,
  "checkDependencies": true,
  "checkCsp": true,
  "checkCertificate": true
}
```

### Accessibility Check

```json
{
  "url": "https://example.com",
  "checkWcag": true,
  "level": "AA",
  "checkContrast": true,
  "checkAria": true
}
```

### SEO Analysis

```json
{
  "url": "https://example.com",
  "checkMetaTags": true,
  "validateStructuredData": true,
  "checkMobileFriendly": true,
  "analyzeContent": true
}
```

### Asset Optimization

```json
{
  "url": "https://example.com",
  "checkImages": true,
  "checkFonts": true,
  "checkCss": true,
  "checkJs": true
}
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

## Error Handling

All tools include comprehensive error handling:

- Automatic retries for transient failures
- Detailed error messages
- Suggestions for resolution
- Proxy fallback options

## License

MIT

## Author

bschauer
