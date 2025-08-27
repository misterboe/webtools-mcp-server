# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Model Context Protocol (MCP) server that provides comprehensive web analysis tools including HTML extraction, screenshot capture, debugging, performance analysis, and Lighthouse audits. The server is built with Node.js, uses Puppeteer for browser automation, and is designed to be used with Claude Desktop.

## Commands

### Development Commands
- `npm start` - Start the MCP server
- `npm test` - Run tests
- `npm run inspect` - Start MCP Inspector for debugging and testing tools
- `npm install` - Install dependencies
- `node src/index.js` - Direct server execution

### Installation & Usage
- `npm install -g @bschauer/webtools-mcp-server` - Global installation
- `npx @bschauer/webtools-mcp-server` - Direct execution via npx
- `node src/index.js --help` - Show configuration help and token optimization options

### Token Usage Optimization
- **Default**: All tools loaded (~10.3k tokens)
- **ENABLED_TOOLS environment variable**: Control which tools are loaded
- **--tools CLI argument**: Override tool selection
- **Available presets**: ALL, BASIC (~1k tokens), WEB, DEBUG, PERFORMANCE, FULL_ANALYSIS
- **Individual tools**: Comma-separated list of specific tools

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

### General Rules
- **NEVER use hardcoded URLs** in code, tests, or documentation (e.g., never hardcode specific domain names like `zg-raiffeisen-24.ddev.site`)
- Always use environment variables, configuration files, or generic examples for URLs
- Use placeholder domains like `example.com` or `your-domain.com` in documentation

### Git and Release Guidelines
- **NEVER include Claude attribution** in commit messages (no "Generated with Claude Code" or "Co-Authored-By: Claude")
- Keep commit messages clean and professional
- Follow conventional commit format when creating releases
- Update CHANGELOG.md with meaningful descriptions of changes

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
- `ENABLED_TOOLS=<preset|tools>` - Control which tools are loaded to optimize token usage
  - Available presets: `ALL`, `BASIC`, `WEB`, `DEBUG`, `PERFORMANCE`, `FULL_ANALYSIS`
  - Individual tools: comma-separated list (e.g., `webtool_gethtml,webtool_readpage`)
  - Default: `ALL` (load all tools, ~10.3k tokens)
  - Example: `ENABLED_TOOLS=BASIC` (~1k tokens, 89% reduction)
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

### MCP Inspector
- Use `npm run inspect` to start the MCP Inspector for debugging
- The inspector provides a web interface to test tools, view resources, and debug MCP communication
- Access the inspector at the URL provided in the console output (typically http://localhost:6274)
- Use the session token for authentication or set `DANGEROUSLY_OMIT_AUTH=true` to disable auth

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

### Response Size Management
- **Token Limits**: Debug tool responses are limited to 25k tokens (MCP protocol limit)
- **Pagination**: Use `page` and `pageSize` parameters to browse through large datasets
  - `page=1` (default): Start with first page
  - `pageSize=20` (default): Number of events per page
  - Example: `page=2, pageSize=10` shows events 11-20
- **Output Control Parameters**: Use `maxConsoleEvents`, `maxNetworkEvents`, `maxErrorEvents`, `maxResourceEvents` to limit output size
- **Compact Mode**: Use `compactFormat=true` for abbreviated output format
- **Summary Mode**: Use `summarizeOnly=true` for only counts and basic stats
- **Stack Traces**: Use `skipStackTraces=true` to reduce layout thrashing verbosity
- **Default Limits**: Conservative defaults (Console: 20, Network: 30, Errors: 10, Resources: 15) prevent token overflow
- **Pagination vs Limits**: When using pagination (`page` or `pageSize`), it overrides max limits for consistent paging

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