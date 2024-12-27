# Webtools MCP Server

A Model Context Protocol (MCP) server that provides web scraping and content extraction tools. This server can be used with any MCP-compatible client to fetch and process web content.

## Features

- `webtool_gethtml`: Get raw HTML content from any webpage
- `webtool_readpage`: Convert webpage content to clean, formatted Markdown
- Automatic retry mechanism with exponential backoff
- Optional proxy support
- JavaScript rendering support (via Puppeteer)
- Intelligent HTML cleaning and formatting
- Markdown conversion with image and link preservation

## Installation

You can run this server directly using `npx`:

```json
{
  "mcpServers": {
    "webtools": {
      "command": "npx",
      "args": [
        "-y",
        "@bschauer/webtools-mcp-server"
      ]
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

## Optional Dependencies

- `puppeteer`: Required for JavaScript rendering support. Will be automatically installed if needed.

## License

MIT 