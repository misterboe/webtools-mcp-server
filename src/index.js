#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from 'node-fetch';
import TurndownService from 'turndown';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Optional Puppeteer import for JavaScript-heavy pages
let puppeteer;
try {
    puppeteer = await import('puppeteer');
} catch (e) {
    console.error('Puppeteer not available, will use basic fetch for all requests');
}

// Common browser headers to avoid detection
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
};

// Proxy configuration (can be overridden by environment variables)
const PROXY_CONFIG = {
    enabled: process.env.USE_PROXY === 'true',
    url: process.env.PROXY_URL || 'http://localhost:8888',
    timeout: parseInt(process.env.PROXY_TIMEOUT, 10) || 30000
};

// Create server instance
const server = new Server(
    {
        name: "webtools-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
});

// Configure Turndown to handle images better
turndownService.addRule('images', {
    filter: ['img'],
    replacement: function (content, node) {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        const title = node.getAttribute('title') || '';
        return src ? `![${alt}](${src}${title ? ` "${title}"` : ''})` : '';
    }
});

// Add rules for cleaning up navigation and footer elements
turndownService.remove(['nav', 'footer', 'script', 'style', '.navigation', '#navigation', '.footer', '#footer']);

// Helper function for exponential backoff
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to fetch content with retry and proxy support
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;
    let proxyAttempted = false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                options.timeout || 30000
            );

            // Add proxy on second attempt if enabled
            const fetchOptions = {
                ...options,
                signal: controller.signal,
                headers: {
                    ...BROWSER_HEADERS,
                    ...options.headers
                }
            };

            if (PROXY_CONFIG.enabled && (attempt > 0 || proxyAttempted)) {
                console.error(`Attempting with proxy (attempt ${attempt + 1})`);
                fetchOptions.agent = new HttpsProxyAgent(PROXY_CONFIG.url);
                fetchOptions.timeout = PROXY_CONFIG.timeout;
                proxyAttempted = true;
            }

            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            // Handle common blocking scenarios
            if (response.status === 403 || response.status === 429) {
                throw new Error(`Access blocked (${response.status})`);
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response;
        } catch (error) {
            lastError = error;
            console.error(`Attempt ${attempt + 1} failed:`, error.message);

            // Don't retry on certain errors
            if (error.name === 'AbortError' || 
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('certificate')) {
                throw error;
            }

            // Wait before retry with exponential backoff
            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                console.error(`Retrying in ${Math.round(delay/1000)}s...`);
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

// Helper function to clean up HTML content
function cleanupHTML(html) {
    // Remove scripts and styles
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove navigation and footer elements
    html = html.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
    html = html.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
    
    // Clean up whitespace
    html = html.replace(/\s+/g, ' ').trim();
    
    return html;
}

// Helper function to extract title from HTML
function extractTitle(html) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : 'Untitled Page';
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "webtool_gethtml",
                description: "Get the HTML content of a webpage. Automatically handles retries and proxy if needed.",
                inputSchema: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string",
                            description: "The URL of the webpage to fetch"
                        },
                        useJavaScript: {
                            type: "boolean",
                            description: "Whether to execute JavaScript (requires Puppeteer)",
                            default: false
                        },
                        useProxy: {
                            type: "boolean",
                            description: "Whether to use a proxy for this request",
                            default: false
                        }
                    },
                    required: ["url"]
                }
            },
            {
                name: "webtool_readpage",
                description: "Get the webpage content in Markdown format, including links and images. Handles blocked access automatically.",
                inputSchema: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string",
                            description: "The URL of the webpage to fetch"
                        },
                        useJavaScript: {
                            type: "boolean",
                            description: "Whether to execute JavaScript (requires Puppeteer)",
                            default: false
                        },
                        useProxy: {
                            type: "boolean",
                            description: "Whether to use a proxy for this request",
                            default: false
                        },
                        selector: {
                            type: "string",
                            description: "Optional CSS selector to extract specific content (e.g., 'main', 'article')",
                            default: "body"
                        }
                    },
                    required: ["url"]
                }
            }
        ]
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === "webtool_gethtml") {
            const { url, useJavaScript = false, useProxy = false } = args;

            if (useJavaScript && !puppeteer) {
                throw new Error("JavaScript execution requested but Puppeteer is not available");
            }

            let content;
            if (useJavaScript) {
                const browser = await puppeteer.launch({ 
                    headless: 'new', 
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        useProxy && PROXY_CONFIG.url ? `--proxy-server=${PROXY_CONFIG.url}` : ''
                    ].filter(Boolean)
                });
                try {
                    const page = await browser.newPage();
                    await page.setExtraHTTPHeaders(BROWSER_HEADERS);
                    await page.goto(url, { 
                        waitUntil: 'networkidle0',
                        timeout: 30000
                    });
                    content = await page.content();
                } finally {
                    await browser.close();
                }
            } else {
                const response = await fetchWithRetry(url, {
                    timeout: 30000,
                    useProxy: useProxy || PROXY_CONFIG.enabled
                });
                content = await response.text();
            }

            return {
                content: [
                    {
                        type: "text",
                        text: content
                    }
                ]
            };
        } else if (name === "webtool_readpage") {
            const { url, useJavaScript = false, useProxy = false, selector = "body" } = args;

            if (useJavaScript && !puppeteer) {
                throw new Error("JavaScript execution requested but Puppeteer is not available");
            }

            let html, title;
            if (useJavaScript) {
                const browser = await puppeteer.launch({ 
                    headless: 'new', 
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        useProxy && PROXY_CONFIG.url ? `--proxy-server=${PROXY_CONFIG.url}` : ''
                    ].filter(Boolean)
                });
                try {
                    const page = await browser.newPage();
                    await page.setExtraHTTPHeaders(BROWSER_HEADERS);
                    await page.goto(url, { 
                        waitUntil: 'networkidle0',
                        timeout: 30000
                    });
                    html = await page.content();
                    title = await page.title();
                } finally {
                    await browser.close();
                }
            } else {
                const response = await fetchWithRetry(url, {
                    timeout: 30000,
                    useProxy: useProxy || PROXY_CONFIG.enabled
                });
                html = await response.text();
                title = extractTitle(html);
            }

            // Clean up the HTML
            html = cleanupHTML(html);

            // Convert to Markdown
            const markdown = turndownService.turndown(html)
                .replace(/\n{3,}/g, '\n\n')
                .replace(/^\s*[-*]\s*/gm, '- ');

            const formattedContent = `# ${title}\n\nSource: ${url}\n\n${markdown}`;

            return {
                content: [
                    {
                        type: "text",
                        text: formattedContent
                    }
                ]
            };
        } else {
            throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        console.error("Error executing tool:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${errorMessage}`
                }
            ]
        };
    }
});

// Initialize and start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Webtools MCP Server running on stdio");
    if (PROXY_CONFIG.enabled) {
        console.error(`Proxy enabled: ${PROXY_CONFIG.url}`);
    }

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.error("Shutting down...");
        process.exit();
    });
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
}); 