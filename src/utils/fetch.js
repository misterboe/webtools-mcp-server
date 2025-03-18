import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";
import { BROWSER_HEADERS, PROXY_CONFIG } from "../config/constants.js";
import { logInfo, logError } from "./logging.js";
import { sleep } from "./helpers.js";

/**
 * Fetch content with retry and proxy support
 * @param {string} url - The URL to fetch
 * @param {Object} options - Options for the fetch request
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<Response>} The fetch response
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  let proxyAttempted = false;

  logInfo("fetch", "Starting fetch request", { url, options, maxRetries });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

      const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers: {
          ...BROWSER_HEADERS,
          ...options.headers,
        },
      };

      // Handle SSL certificate verification
      if (options.ignoreSSLErrors) {
        const https = await import("https");
        fetchOptions.agent = new https.Agent({
          rejectUnauthorized: false,
        });
        logInfo("fetch", "SSL certificate verification disabled", { url });
      }

      if (PROXY_CONFIG.enabled && (attempt > 0 || proxyAttempted)) {
        logInfo("fetch", `Using proxy on attempt ${attempt + 1}`, {
          proxy: PROXY_CONFIG.url,
          attempt: attempt + 1,
        });
        fetchOptions.agent = new HttpsProxyAgent(PROXY_CONFIG.url);
        fetchOptions.timeout = PROXY_CONFIG.timeout;
        proxyAttempted = true;
      }

      logInfo("fetch", `Attempt ${attempt + 1} started`, {
        url,
        attempt: attempt + 1,
        options: fetchOptions,
      });

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      logInfo("fetch", `Attempt ${attempt + 1} completed`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
      });

      if (response.status === 403 || response.status === 429) {
        throw new Error(`Access blocked (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      logError("fetch", `Attempt ${attempt + 1} failed`, error, {
        url,
        attempt: attempt + 1,
        willRetry: attempt < maxRetries - 1,
      });

      if (error.name === "AbortError" || error.message.includes("ECONNREFUSED") || error.message.includes("certificate")) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        logInfo("fetch", `Scheduling retry`, {
          attempt: attempt + 1,
          nextAttemptIn: Math.round(delay / 1000),
        });
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
