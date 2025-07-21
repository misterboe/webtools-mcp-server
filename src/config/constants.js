// Common browser headers to avoid detection
export const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "max-age=0",
};

// Proxy configuration (can be overridden by environment variables)
export const PROXY_CONFIG = {
  enabled: process.env.USE_PROXY === "true",
  url: process.env.PROXY_URL || "http://localhost:8888",
  timeout: parseInt(process.env.PROXY_TIMEOUT, 10) || 30000,
};

// SSL configuration (can be overridden by environment variables)
export const SSL_CONFIG = {
  ignoreSSLErrorsByDefault: process.env.IGNORE_SSL_ERRORS !== "false",
};
