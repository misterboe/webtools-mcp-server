/**
 * Get Website Content Prompt Definition
 * Extracts main content from website and converts to markdown
 */

export const getWebsiteContentPrompt = {
  name: "get-website-content",
  description: "Extrahiert den Hauptinhalt einer Website und konvertiert ihn in ein gut lesbares Markdown-Format.",
  arguments: [
    {
      name: "url",
      description: "Die URL der Website, deren Inhalt extrahiert werden soll",
      required: true,
    },
  ],
  getMessages: (args) => {
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Bitte extrahiere den Hauptinhalt von ${args.url} und formatiere ihn ansprechend als Markdown.

Konzentriere dich auf:
- Den Hauptartikel/Hauptinhalt
- Wichtige Überschriften und Strukturelemente
- Schlüsselinformationen und Daten
- Entfernung von Navigation, Werbung, Fußzeilen und anderen nicht-essentiellen Elementen
- Beibehaltung der ursprünglichen Bedeutung und wichtiger Formatierungen

Das Ziel ist eine saubere, gut lesbare Version des primären Inhalts dieser Webseite in gut formatiertem Markdown zu erhalten.`,
        },
      },
    ];
  },
};

/**
 * Handle get-website-content prompt request
 * @param {Object} args - Request arguments
 * @returns {Object} - Prompt response
 */
export function handleGetWebsiteContentPrompt(args) {
  if (!args.url) {
    throw new Error("URL is required");
  }

  return {
    description: `Extraktion und Konvertierung des Inhalts von ${args.url} in Markdown`,
    messages: getWebsiteContentPrompt.getMessages(args),
  };
}
