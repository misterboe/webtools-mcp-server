/**
 * Screenshot Website Prompt Definition
 * Takes a screenshot of a website
 */

export const screenshotWebsitePrompt = {
  name: "screenshot-website",
  description: "Erstellt einen Screenshot einer Website für visuelle Analyse und Dokumentation.",
  arguments: [
    {
      name: "url",
      description: "Die URL der Website, von der ein Screenshot erstellt werden soll",
      required: true,
    },
  ],
  getMessages: (args) => {
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Bitte erstelle einen Screenshot der Website ${args.url} und zeige mir, wie die Website aussieht.

Wenn möglich, erfasse die gesamte Seite, damit ich das vollständige Layout sehen kann.`,
        },
      },
    ];
  },
};

/**
 * Handle screenshot-website prompt request
 * @param {Object} args - Request arguments
 * @returns {Object} - Prompt response
 */
export function handleScreenshotWebsitePrompt(args) {
  if (!args.url) {
    throw new Error("URL is required");
  }

  return {
    description: `Screenshot der Website ${args.url}`,
    messages: screenshotWebsitePrompt.getMessages(args),
  };
}
