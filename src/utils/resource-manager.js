/**
 * 🚀 Generic Dynamic Resource Manager for MCP Webtools Server
 * 
 * This system provides a unified, reusable resource management layer that can be
 * applied to ANY tool without code duplication. It follows the hybrid middleware +
 * configuration pattern for maximum flexibility and minimal migration effort.
 * 
 * Key Features:
 * - ✅ Zero code duplication across tools
 * - ✅ Configuration-driven resource behavior
 * - ✅ Transparent tool wrapping
 * - ✅ Custom URI schemes and templates
 * - ✅ Automatic resource lifecycle management
 * - ✅ MCP 2025 compliance
 */

import { logInfo } from './logging.js';

/**
 * Core Resource Manager Class
 * Handles resource creation, storage, and lifecycle for all tools
 */
export class ResourceManager {
    constructor(resourceStore) {
        this.resourceStore = resourceStore;
        this.toolConfigs = new Map();
        this.contentAdapters = new Map();
        this.uriGenerators = new Map();
        
        // Initialize default adapters
        this.registerDefaultAdapters();
        this.registerDefaultUriGenerators();
    }

    /**
     * Register default content adapters for common data types
     */
    registerDefaultAdapters() {
        this.contentAdapters.set('text', new TextContentAdapter());
        this.contentAdapters.set('image', new ImageContentAdapter());
        this.contentAdapters.set('json', new JsonContentAdapter());
        this.contentAdapters.set('html', new HtmlContentAdapter());
        this.contentAdapters.set('markdown', new MarkdownContentAdapter());
    }

    /**
     * Register default URI generators for different tool types
     */
    registerDefaultUriGenerators() {
        this.uriGenerators.set('web', new WebUriGenerator());
        this.uriGenerators.set('performance', new PerformanceUriGenerator());
        this.uriGenerators.set('debug', new DebugUriGenerator());
        this.uriGenerators.set('image', new ImageUriGenerator());
    }

    /**
     * 🎯 Enable resource storage for a specific tool
     * This is the main API that makes any tool resource-aware
     */
    enableForTool(toolName, config) {
        const normalizedConfig = this.normalizeConfig(toolName, config);
        this.toolConfigs.set(toolName, normalizedConfig);
        
        logInfo(`📦 Resource storage enabled for tool: ${toolName}`);
        return this;
    }

    /**
     * 🔄 Process tool result and create resources if configured
     * This is the core middleware that transparently adds resource capabilities
     */
    async processToolResult(toolName, args, result) {
        const config = this.toolConfigs.get(toolName);
        if (!config || !config.enabled) {
            return result;
        }

        try {
            const resources = await this.createResourcesFromResult(toolName, args, result, config);
            
            if (resources.length > 0) {
                // Store all resources
                for (const resource of resources) {
                    this.resourceStore.set(resource.uri, resource);
                    logInfo(`💾 Resource created: ${resource.uri}`);
                }

                // Enhance result with resource information
                result.resourceUris = resources.map(r => r.uri);
                result.resourceSummary = this.createResourceSummary(resources);
                
                // Update response content to inform about resource creation
                result.content = this.enhanceContentWithResourceInfo(result.content, resources, config);
            }

            return result;
        } catch (error) {
            logInfo(`❌ Resource creation failed for ${toolName}: ${error.message}`);
            // Don't fail the original tool - just return original result
            return result;
        }
    }

    /**
     * Create resources from tool result based on configuration
     */
    async createResourcesFromResult(toolName, args, result, config) {
        const resources = [];

        // Process each configured output
        for (const outputConfig of config.outputs) {
            const content = this.extractContent(result, outputConfig.contentPath);
            if (!content) continue;

            const adapter = this.contentAdapters.get(outputConfig.contentType);
            if (!adapter) {
                logInfo(`⚠️  No adapter found for content type: ${outputConfig.contentType}`);
                continue;
            }

            const uriGenerator = this.uriGenerators.get(outputConfig.uriType || 'web');
            if (!uriGenerator) {
                logInfo(`⚠️  No URI generator found for type: ${outputConfig.uriType}`);
                continue;
            }

            // Create resource using adapter and URI generator
            const resource = await this.createSingleResource(
                toolName, args, content, outputConfig, adapter, uriGenerator
            );

            if (resource) {
                resources.push(resource);
            }
        }

        return resources;
    }

    /**
     * Create a single resource using the configured adapter and URI generator
     */
    async createSingleResource(toolName, args, content, config, adapter, uriGenerator) {
        try {
            const metadata = {
                toolName,
                args,
                config,
                timestamp: new Date(),
                domain: args.url ? new URL(args.url).hostname : 'local',
                // ✨ Enhanced URL context for better resource identification
                urlPath: args.url ? new URL(args.url).pathname : '',
                urlPathSegments: args.url ? new URL(args.url).pathname.split('/').filter(Boolean) : [],
                lastPathSegment: args.url ? new URL(args.url).pathname.split('/').filter(Boolean).pop() || '' : '',
                pathHash: args.url ? this.generatePathHash(new URL(args.url).pathname) : '',
                fullUrl: args.url || 'local',
                port: args.url ? new URL(args.url).port : '',
                urlForDisplay: args.url ? this.createDisplayUrl(args.url) : 'local'
            };

            // Generate URI using the appropriate generator
            const uri = await uriGenerator.generateUri(metadata);
            
            // Process content using the appropriate adapter
            const processedContent = await adapter.processContent(content, metadata);
            
            // Create resource with enhanced identification structure
            return {
                uri,
                name: this.interpolateTemplate(config.nameTemplate, metadata),
                description: this.interpolateTemplate(config.descriptionTemplate || `Content from ${toolName} tool`, metadata),
                content: processedContent.content,
                mimeType: processedContent.mimeType,
                timestamp: metadata.timestamp.toISOString(),
                sourceUrl: args.url,
                toolName: toolName,
                size: this.calculateContentSize(processedContent.content),
                // ✨ Enhanced metadata for better client identification
                metadata: {
                    originalContentType: content.type,
                    processingInfo: processedContent.metadata,
                    // URL context information
                    urlContext: {
                        domain: metadata.domain,
                        path: metadata.urlPath,
                        pathSegments: metadata.urlPathSegments,
                        lastPathSegment: metadata.lastPathSegment,
                        pathHash: metadata.pathHash,
                        fullUrl: metadata.fullUrl,
                        displayUrl: metadata.urlForDisplay,
                        port: metadata.port
                    },
                    // Tool execution context
                    executionContext: {
                        toolName,
                        timestamp: metadata.timestamp.toISOString(),
                        args: {
                            // Store relevant args (exclude sensitive data)
                            url: args.url,
                            device: args.device || args.deviceName,
                            networkCondition: args.networkCondition || args.networkConditionName
                        }
                    }
                }
            };
        } catch (error) {
            logInfo(`❌ Failed to create resource: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract content from tool result using JSONPath-style selectors
     */
    extractContent(result, contentPath) {
        try {
            const parts = contentPath.split('.');
            let current = result;
            
            for (const part of parts) {
                const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
                if (arrayMatch) {
                    const [, prop, index] = arrayMatch;
                    current = current[prop]?.[parseInt(index)];
                } else {
                    current = current[part];
                }
                
                if (current === undefined) return null;
            }
            
            return current;
        } catch (error) {
            logInfo(`⚠️  Content extraction failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Enhanced template interpolation with full URL context
     */
    interpolateTemplate(template, metadata) {
        return template
            .replace('{toolName}', metadata.toolName)
            .replace('{domain}', metadata.domain)
            .replace('{timestamp}', metadata.timestamp.toISOString().substring(11, 19))
            .replace('{date}', metadata.timestamp.toISOString().substring(0, 10))
            .replace('{url}', metadata.args.url || 'local')
            // ✨ New URL context variables
            .replace('{urlPath}', metadata.urlPath)
            .replace('{lastPathSegment}', metadata.lastPathSegment)
            .replace('{pathHash}', metadata.pathHash)
            .replace('{fullUrl}', metadata.fullUrl)
            .replace('{port}', metadata.port)
            .replace('{urlForDisplay}', metadata.urlForDisplay);
    }

    /**
     * Normalize and validate tool configuration
     */
    normalizeConfig(toolName, config) {
        return {
            enabled: config.enabled !== false, // Default to true
            outputs: Array.isArray(config.outputs) ? config.outputs : [config],
            enhanceResponse: config.enhanceResponse !== false, // Default to true
            ...config
        };
    }

    /**
     * Create summary of created resources
     */
    createResourceSummary(resources) {
        const urlContexts = resources
            .map(r => r.metadata?.urlContext)
            .filter(Boolean);
            
        return {
            count: resources.length,
            totalSize: resources.reduce((sum, r) => sum + r.size, 0),
            types: [...new Set(resources.map(r => r.mimeType))],
            uris: resources.map(r => r.uri),
            // ✨ Enhanced summary with URL context
            urlInfo: urlContexts.length > 0 ? {
                domains: [...new Set(urlContexts.map(ctx => ctx.domain))],
                paths: [...new Set(urlContexts.map(ctx => ctx.path))],
                displayUrls: [...new Set(urlContexts.map(ctx => ctx.displayUrl))],
                uniquePages: urlContexts.length
            } : null
        };
    }

    /**
     * Enhance response content with detailed resource information
     */
    enhanceContentWithResourceInfo(originalContent, resources, config) {
        if (!config.enhanceResponse && !config.replaceWithSummary) {
            return originalContent;
        }

        const resourceInfo = resources.map(resource => {
            const urlContext = resource.metadata?.urlContext;
            const pathInfo = urlContext?.path && urlContext.path !== '/' 
                ? ` (${urlContext.path})` 
                : '';
            
            return `💾 **${resource.name}** \`${resource.uri}\` - ${this.formatSize(resource.size)}`;
        }).join('\n');

        // Create more detailed summary with URL context
        const firstResource = resources[0];
        const urlContext = firstResource?.metadata?.urlContext;
        const sourceInfo = urlContext ? `
🌐 **Source:** ${urlContext.fullUrl}
📎 **Path:** ${urlContext.path || '/'}
🏷️ **Page:** ${urlContext.lastPathSegment || urlContext.domain}` : '';

        const enhancedText = `✅ **Content Successfully Processed**
${sourceInfo}

${resourceInfo}

📊 **Summary:** ${resources.length} resource(s) created
🔗 **Total Size:** ${this.formatSize(resources.reduce((sum, r) => sum + r.size, 0))}

🔍 **Resources available for analysis** - Use the resource URIs above to access the complete content.`;

        // Insert enhanced info at the beginning, append to existing content, or replace entirely
        if (config.replaceWithSummary) {
            // Replace original content entirely with just the summary
            return [{ type: 'text', text: enhancedText }];
        } else if (originalContent && originalContent.length > 0) {
            // Append summary before original content
            return [
                { type: 'text', text: enhancedText },
                ...originalContent
            ];
        } else {
            return [{ type: 'text', text: enhancedText }];
        }
    }

    /**
     * Calculate content size in bytes
     */
    calculateContentSize(content) {
        if (typeof content === 'string') {
            return Buffer.byteLength(content, 'utf8');
        } else if (content instanceof Buffer) {
            return content.length;
        } else {
            return Buffer.byteLength(JSON.stringify(content), 'utf8');
        }
    }

    /**
     * Format size in human-readable format
     */
    formatSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Generate a short hash from URL path for uniqueness
     */
    generatePathHash(pathname) {
        if (!pathname || pathname === '/') return '';
        
        // Simple hash function for path uniqueness
        let hash = 0;
        const str = pathname.toLowerCase();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Return short positive hash
        return Math.abs(hash).toString(36).substring(0, 6);
    }

    /**
     * Create a display-friendly URL (truncated if too long)
     */
    createDisplayUrl(url) {
        try {
            const urlObj = new URL(url);
            const displayUrl = `${urlObj.hostname}${urlObj.pathname}`;
            
            // Truncate if too long, but keep the end (most specific part)
            if (displayUrl.length > 50) {
                return '...' + displayUrl.substring(displayUrl.length - 47);
            }
            
            return displayUrl;
        } catch {
            return url.length > 50 ? '...' + url.substring(url.length - 47) : url;
        }
    }
}

/**
 * 🎨 Content Adapters - Handle different content types
 */

class TextContentAdapter {
    async processContent(content, metadata) {
        return {
            content: content.text || content,
            mimeType: 'text/plain',
            metadata: { originalLength: (content.text || content).length }
        };
    }
}

class HtmlContentAdapter {
    async processContent(content, metadata) {
        const htmlContent = content.text || content;
        return {
            content: htmlContent,
            mimeType: 'text/html',
            metadata: {
                originalLength: htmlContent.length,
                hasTitle: /<title>/.test(htmlContent),
                hasScripts: /<script/.test(htmlContent)
            }
        };
    }
}

class ImageContentAdapter {
    async processContent(content, metadata) {
        return {
            content: content.data || content,
            mimeType: content.mimeType || 'image/jpeg',
            metadata: {
                format: content.mimeType?.split('/')[1] || 'jpeg',
                isBase64: typeof content.data === 'string'
            }
        };
    }
}

class JsonContentAdapter {
    async processContent(content, metadata) {
        const jsonContent = typeof content === 'object' 
            ? JSON.stringify(content, null, 2)
            : content.text || content;
            
        return {
            content: jsonContent,
            mimeType: 'application/json',
            metadata: {
                isValidJson: this.isValidJson(jsonContent),
                objectKeys: this.extractTopLevelKeys(jsonContent)
            }
        };
    }

    isValidJson(str) {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }

    extractTopLevelKeys(str) {
        try {
            const obj = JSON.parse(str);
            return Object.keys(obj).slice(0, 10); // First 10 keys
        } catch {
            return [];
        }
    }
}

class MarkdownContentAdapter {
    async processContent(content, metadata) {
        const mdContent = content.text || content;
        return {
            content: mdContent,
            mimeType: 'text/markdown',
            metadata: {
                originalLength: mdContent.length,
                hasHeaders: /^#+\s/m.test(mdContent),
                hasLinks: /\[.*\]\(.*\)/.test(mdContent),
                hasTables: /\|.*\|/.test(mdContent)
            }
        };
    }
}

/**
 * 🔗 URI Generators - Generate appropriate URIs for different tool types
 */

class WebUriGenerator {
    async generateUri(metadata) {
        const { domain, timestamp, toolName, urlPath, pathHash } = metadata;
        const timeStr = timestamp.toISOString().substring(11, 19);
        
        // Include path information in URI for better identification
        if (urlPath && urlPath !== '/') {
            // Clean path for URI (remove leading slash, replace special chars)
            const cleanPath = urlPath.substring(1).replace(/[^a-zA-Z0-9\-_/]/g, '-');
            return `web://${domain}/${cleanPath}/${toolName}-${timeStr}`;
        }
        
        return `web://${domain}/${toolName}-${timeStr}`;
    }
}

class PerformanceUriGenerator {
    async generateUri(metadata) {
        const { domain, timestamp, toolName, urlPath } = metadata;
        const timeStr = timestamp.toISOString().substring(11, 19);
        
        // Include path information for performance resources
        if (urlPath && urlPath !== '/') {
            const cleanPath = urlPath.substring(1).replace(/[^a-zA-Z0-9\-_/]/g, '-');
            return `perf://${domain}/${cleanPath}/${toolName}-${timeStr}`;
        }
        
        return `perf://${domain}/${toolName}-${timeStr}`;
    }
}

class DebugUriGenerator {
    async generateUri(metadata) {
        const { domain, timestamp, toolName, urlPath } = metadata;
        const timeStr = timestamp.toISOString().substring(11, 19);
        
        // Include path information for debug resources
        if (urlPath && urlPath !== '/') {
            const cleanPath = urlPath.substring(1).replace(/[^a-zA-Z0-9\-_/]/g, '-');
            return `debug://${domain}/${cleanPath}/${toolName}-${timeStr}`;
        }
        
        return `debug://${domain}/${toolName}-${timeStr}`;
    }
}

class ImageUriGenerator {
    async generateUri(metadata) {
        const { domain, timestamp, toolName, urlPath } = metadata;
        const timeStr = timestamp.toISOString().substring(11, 19);
        
        // Include path information for image resources  
        if (urlPath && urlPath !== '/') {
            const cleanPath = urlPath.substring(1).replace(/[^a-zA-Z0-9\-_/]/g, '-');
            return `image://${domain}/${cleanPath}/${toolName}-${timeStr}`;
        }
        
        return `image://${domain}/${toolName}-${timeStr}`;
    }
}

/**
 * 🛠️ Tool Wrapper Utility
 * Makes it easy to wrap existing tools with resource capabilities
 */
export class ToolResourceWrapper {
    constructor(resourceManager) {
        this.resourceManager = resourceManager;
    }

    /**
     * Wrap a tool function to automatically handle resources
     */
    wrapTool(toolName, toolFunction, config) {
        // Enable resource storage for this tool
        this.resourceManager.enableForTool(toolName, config);

        // Return wrapped function
        return async (args) => {
            const result = await toolFunction(args);
            return await this.resourceManager.processToolResult(toolName, args, result);
        };
    }

    /**
     * Batch wrap multiple tools
     */
    wrapTools(toolConfigs) {
        const wrappedTools = {};
        
        for (const [toolName, { toolFunction, config }] of Object.entries(toolConfigs)) {
            wrappedTools[toolName] = this.wrapTool(toolName, toolFunction, config);
        }
        
        return wrappedTools;
    }
}

/**
 * 📋 Configuration Builder
 * Fluent API for building tool resource configurations
 */
export class ResourceConfigBuilder {
    constructor(toolName) {
        this.config = {
            toolName,
            enabled: true,
            outputs: []
        };
    }

    static for(toolName) {
        return new ResourceConfigBuilder(toolName);
    }

    enable(enabled = true) {
        this.config.enabled = enabled;
        return this;
    }

    addOutput(contentPath, contentType, options = {}) {
        this.config.outputs.push({
            contentPath,
            contentType,
            uriType: options.uriType || 'web',
            nameTemplate: options.nameTemplate || `{domain} - {toolName} ({timestamp})`,
            descriptionTemplate: options.descriptionTemplate,
            ...options
        });
        return this;
    }

    enhanceResponse(enhance = true) {
        this.config.enhanceResponse = enhance;
        return this;
    }
    
    replaceWithSummary(replace = true) {
        this.config.replaceWithSummary = replace;
        return this;
    }

    build() {
        return this.config;
    }
}

/**
 * 🚀 Export convenience function for quick setup
 */
export function createResourceManager(resourceStore) {
    return new ResourceManager(resourceStore);
}

export function createToolWrapper(resourceManager) {
    return new ToolResourceWrapper(resourceManager);
}