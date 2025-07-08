# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Model Context Protocol (MCP) server that provides comprehensive web analysis tools including HTML extraction, screenshot capture, debugging, performance analysis, and Lighthouse audits. The server is built with Node.js, uses Puppeteer for browser automation, and is designed to be used with Claude Desktop.

## Commands

### Development Commands
- `npm start` - Start the MCP server
- `npm test` - Run tests (currently not implemented)
- `npm install` - Install dependencies
- `node src/index.js` - Direct server execution

### Installation & Usage
- `npm install -g @bschauer/webtools-mcp-server` - Global installation
- `npx @bschauer/webtools-mcp-server` - Direct execution via npx

## Architecture

### Core Components

**Entry Points:**
- `src/index.js` - Main entry point that starts the server
- `src/server.js` - Server configuration and request handling

**Tool System:**
- `src/tools/` - Individual tool implementations
  - `html.js` - HTML extraction and markdown conversion
  - `screenshot.js` - Screenshot capture with device emulation
  - `debug.js` - Debug console with layout thrashing detection
  - `lighthouse.js` - Lighthouse audit integration
  - `performance/` - Performance analysis tools (trace, coverage, web vitals, network)

**Configuration:**
- `src/config/` - Configuration files
  - `tool-definitions.js` - Tool schemas and parameter definitions
  - `capabilities.js` - Server capabilities declaration
  - `devices.js` - Device emulation profiles
  - `network_conditions.js` - Network condition profiles

**Utilities:**
- `src/utils/` - Shared utility functions
  - `cdp_helpers.js` - Chrome DevTools Protocol helpers
  - `html.js` - HTML processing utilities
  - `fetch.js` - HTTP request utilities with retry logic
  - `logging.js` - Logging utilities

**MCP Prompts:**
- `src/prompts/` - Predefined prompt templates
  - `analyze-website.js` - Comprehensive website analysis
  - `get-website-content.js` - Content extraction
  - `screenshot-website.js` - Screenshot capture
  - `technical-performance-analysis.js` - Technical performance analysis

### Performance Analysis Framework

The server includes a sophisticated performance analysis system with multiple specialized modules:

**Core Analysis Tools:**
- `src/tools/performance/trace/` - Performance tracing with CPU profiling
- `src/tools/performance/coverage/` - Code coverage analysis
- `src/tools/performance/web_vitals/` - Core Web Vitals metrics
- `src/tools/performance/network/` - Network activity monitoring
- `src/tools/performance/test_framework/` - Cross-device/network testing

**Analysis Modules:**
- `src/tools/performance/analysis/` - Specialized analysis modules
  - `layout_thrashing.js` - Layout thrashing detection
  - `css_variables.js` - CSS variables impact analysis
  - `js_execution.js` - JavaScript execution timeline analysis
  - `long_tasks.js` - Long task breakdown and attribution
  - `memory_dom.js` - Memory usage and DOM growth analysis
  - `resource_loading.js` - Resource loading optimization

### Key Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `puppeteer` - Browser automation and Chrome DevTools Protocol
- `lighthouse` - Web performance auditing
- `turndown` - HTML to Markdown conversion
- `chrome-launcher` - Chrome browser launching
- `sharp` - Image processing
- `node-fetch` - HTTP requests

## Development Guidelines

### Tool Development
- Tools follow a consistent pattern with input validation and error handling
- All tools support device emulation via `deviceConfig` parameter
- Tools return structured responses with `content` array containing text or image data
- Error responses include helpful troubleshooting information

### Performance Analysis
- Performance tools use Chrome DevTools Protocol for deep browser insights
- Analysis modules can be enabled/disabled individually for focused analysis
- Tools support custom thresholds for performance metrics
- Results include actionable recommendations when `includeRecommendations` is enabled

### Configuration
- Device profiles are defined in `src/config/devices.js`
- Network conditions are defined in `src/config/network_conditions.js`
- Tool schemas are centralized in `src/config/tool-definitions.js`
- SSL configuration is defined in `src/config/constants.js`
- Configuration can be overridden via environment variables or config files

### Environment Variables
- `IGNORE_SSL_ERRORS=true` - Sets default SSL error handling for all tools (useful for development environments like DDEV)
- `USE_PROXY=true` - Enables proxy support
- `PROXY_URL` - Proxy server URL
- `PROXY_TIMEOUT` - Proxy timeout in milliseconds

### Error Handling
- All tools implement comprehensive error handling with retry logic
- Site availability is checked before tool execution
- CDP session management includes fallback mechanisms
- Errors include context for debugging and user guidance

### Testing & Validation
- Use real websites for testing tools
- Test with various device configurations and network conditions
- Validate performance analysis results against Chrome DevTools
- Test proxy configurations when available

## Common Issues

### Browser/Chrome Issues
- Chrome is automatically installed via Puppeteer
- If Chrome issues occur, reinstall the package
- SSL errors can be ignored with `ignoreSSLErrors` parameter (use cautiously)

### Development Environment Issues
- **DDEV/Local Development**: Use `IGNORE_SSL_ERRORS=true` environment variable for self-signed certificates
- **HTTPS Development Sites**: Set `ignoreSSLErrors=true` parameter for individual tool calls
- **Mixed Environments**: Environment variable sets the default, parameter can override per tool

### Performance Analysis Issues
- Increase timeout values for complex pages
- Use `focusSelector` to analyze specific DOM elements
- Enable specific analysis modules based on investigation needs
- Check for JavaScript errors that might affect performance metrics

### Network Issues
- Proxy support is available but should be used responsibly
- Network conditions can be simulated for testing
- CORS issues may affect some analysis tools
- Third-party request analysis can be enabled/disabled

## Security Considerations

- SSL certificate checking should remain enabled unless absolutely necessary
- Proxy usage should comply with applicable laws and website terms
- The server can access arbitrary websites - use responsibly
- Website scraping may be prohibited by some sites' Terms of Service