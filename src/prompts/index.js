/**
 * MCP Prompts Collection
 * Exports all available prompts for the MCP server
 */

import { analyzeWebsitePrompt, handleAnalyzeWebsitePrompt } from "./analyze-website.js";
import { getWebsiteContentPrompt, handleGetWebsiteContentPrompt } from "./get-website-content.js";
import { screenshotWebsitePrompt, handleScreenshotWebsitePrompt } from "./screenshot-website.js";
import { technicalPerformanceAnalysisPrompt, handleTechnicalPerformanceAnalysisPrompt } from "./technical-performance-analysis.js";

// Export prompt definitions for use in prompts/list
export const PROMPT_DEFINITIONS = [analyzeWebsitePrompt, getWebsiteContentPrompt, screenshotWebsitePrompt, technicalPerformanceAnalysisPrompt];

// Export prompt handlers for use in prompts/get
export const PROMPT_HANDLERS = {
  "analyze-website": handleAnalyzeWebsitePrompt,
  "get-website-content": handleGetWebsiteContentPrompt,
  "screenshot-website": handleScreenshotWebsitePrompt,
  "technical-performance-analysis": handleTechnicalPerformanceAnalysisPrompt,
};
