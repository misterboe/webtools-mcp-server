import TurndownService from "turndown";

/**
 * Initialize and configure the Turndown service for HTML to Markdown conversion
 * @returns {TurndownService} The configured Turndown service
 */
export function createTurndownService() {
  // Initialize Turndown service for HTML to Markdown conversion
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Configure Turndown to handle images better
  turndownService.addRule("images", {
    filter: ["img"],
    replacement: function (content, node) {
      const alt = node.getAttribute("alt") || "";
      const src = node.getAttribute("src") || "";
      const title = node.getAttribute("title") || "";
      return src ? `![${alt}](${src}${title ? ` "${title}"` : ""})` : "";
    },
  });

  // Add rules for cleaning up navigation and footer elements
  turndownService.remove(["nav", "footer", "script", "style", ".navigation", "#navigation", ".footer", "#footer"]);

  return turndownService;
}
