/**
 * 📋 Resource Configuration for All WebTools MCP Server Tools
 * 
 * This file defines how each tool should handle resource creation.
 * The configuration is used by the ResourceManager to automatically
 * convert tool outputs to stored resources.
 * 
 * 🎯 Zero Code Duplication Strategy:
 * Instead of modifying each tool individually, we configure resource
 * behavior declaratively here, then apply it via middleware.
 */

import { ResourceConfigBuilder } from '../utils/resource-manager.js';

/**
 * 🌐 Web Content Tools
 * Tools that fetch and process web content
 */
export const WEB_TOOLS_CONFIG = {
    // HTML content extraction
    webtool_gethtml: ResourceConfigBuilder
        .for('webtool_gethtml')
        .addOutput('content[0].text', 'html', {
            uriType: 'web',
            nameTemplate: '{urlForDisplay} - HTML Content ({timestamp})',
            descriptionTemplate: 'HTML content from {fullUrl}{urlPath} loaded at {timestamp}'
        })
        .build(),

    // Page content in markdown format
    webtool_readpage: ResourceConfigBuilder
        .for('webtool_readpage')
        .addOutput('content[0].text', 'markdown', {
            uriType: 'web',
            nameTemplate: '{urlForDisplay} - Page Content ({timestamp})',
            descriptionTemplate: 'Markdown content from {fullUrl}{urlPath} processed at {timestamp}'
        })
        .build()
};

/**
 * 📸 Visual Tools  
 * Tools that capture visual content
 */
export const VISUAL_TOOLS_CONFIG = {
    // Screenshot capture
    webtool_screenshot: ResourceConfigBuilder
        .for('webtool_screenshot')
        .addOutput('content[0]', 'image', {
            uriType: 'image',
            nameTemplate: '{urlForDisplay} - Screenshot ({timestamp})',
            descriptionTemplate: 'Screenshot of {fullUrl}{urlPath} captured at {timestamp}'
        })
        .build()
};

/**
 * 🐞 Debug and Analysis Tools
 * Tools that provide debugging and analysis information
 */
export const DEBUG_TOOLS_CONFIG = {
    // Debug information with console, network, errors
    webtool_debug: ResourceConfigBuilder
        .for('webtool_debug')
        .addOutput('content[0].text', 'markdown', {
            uriType: 'debug',
            nameTemplate: '{urlForDisplay} - Debug Report ({timestamp})',
            descriptionTemplate: 'Debug analysis of {fullUrl}{urlPath} generated at {timestamp}'
        })
        .build()
};

/**
 * ⚡ Performance Analysis Tools
 * Tools that analyze website performance and optimization
 */
export const PERFORMANCE_TOOLS_CONFIG = {
    // Lighthouse audit results
    webtool_lighthouse: ResourceConfigBuilder
        .for('webtool_lighthouse')
        .addOutput('content[0].text', 'markdown', {
            uriType: 'performance',
            nameTemplate: '{urlForDisplay} - Lighthouse Report ({timestamp})',
            descriptionTemplate: 'Lighthouse audit of {fullUrl}{urlPath} conducted at {timestamp}'
        })
        .build(),

    // Performance trace analysis
    webtool_performance_trace: ResourceConfigBuilder
        .for('webtool_performance_trace')
        .addOutput('content[0].text', 'json', {
            uriType: 'performance',
            nameTemplate: '{urlForDisplay} - Performance Trace ({timestamp})',
            descriptionTemplate: 'Performance trace of {fullUrl}{urlPath} captured at {timestamp}'
        })
        .build(),

    // Code coverage analysis
    webtool_coverage_analysis: ResourceConfigBuilder
        .for('webtool_coverage_analysis')
        .addOutput('content[0].text', 'json', {
            uriType: 'performance',
            nameTemplate: '{urlForDisplay} - Coverage Analysis ({timestamp})',
            descriptionTemplate: 'Coverage analysis of {fullUrl}{urlPath} analyzed at {timestamp}'
        })
        .build(),

    // Core Web Vitals analysis
    webtool_web_vitals: ResourceConfigBuilder
        .for('webtool_web_vitals')
        .addOutput('content[0].text', 'json', {
            uriType: 'performance',
            nameTemplate: '{urlForDisplay} - Web Vitals ({timestamp})',
            descriptionTemplate: 'Web Vitals of {fullUrl}{urlPath} measured at {timestamp}'
        })
        .build(),

    // Network activity monitoring
    webtool_network_monitor: ResourceConfigBuilder
        .for('webtool_network_monitor')
        .addOutput('content[0].text', 'json', {
            uriType: 'performance',
            nameTemplate: '{urlForDisplay} - Network Monitor ({timestamp})',
            descriptionTemplate: 'Network analysis of {fullUrl}{urlPath} monitored at {timestamp}'
        })
        .build(),

    // Performance testing across conditions
    webtool_performance_test: ResourceConfigBuilder
        .for('webtool_performance_test')
        .addOutput('content[0].text', 'json', {
            uriType: 'performance',
            nameTemplate: '{urlForDisplay} - Performance Test ({timestamp})',
            descriptionTemplate: 'Performance test of {fullUrl}{urlPath} executed at {timestamp}'
        })
        .build()
};

/**
 * 📊 Consolidated Configuration
 * All tool configurations combined for easy import
 */
export const ALL_TOOLS_CONFIG = {
    ...WEB_TOOLS_CONFIG,
    ...VISUAL_TOOLS_CONFIG,
    ...DEBUG_TOOLS_CONFIG,
    ...PERFORMANCE_TOOLS_CONFIG
};

/**
 * 🎯 Quick Configuration Presets
 * Pre-defined configuration sets for common scenarios
 */
export const CONFIG_PRESETS = {
    // Enable resources for all tools
    ALL_ENABLED: Object.fromEntries(
        Object.entries(ALL_TOOLS_CONFIG).map(([toolName, config]) => [
            toolName, { ...config, enabled: true }
        ])
    ),

    // Enable only web content tools
    WEB_ONLY: Object.fromEntries(
        Object.entries(WEB_TOOLS_CONFIG).map(([toolName, config]) => [
            toolName, { ...config, enabled: true }
        ])
    ),

    // Enable only performance tools
    PERFORMANCE_ONLY: Object.fromEntries(
        Object.entries(PERFORMANCE_TOOLS_CONFIG).map(([toolName, config]) => [
            toolName, { ...config, enabled: true }
        ])
    ),

    // Enable only visual tools
    VISUAL_ONLY: Object.fromEntries(
        Object.entries(VISUAL_TOOLS_CONFIG).map(([toolName, config]) => [
            toolName, { ...config, enabled: true }
        ])
    ),

    // Minimal set - just HTML and screenshots
    MINIMAL: {
        webtool_gethtml: { ...WEB_TOOLS_CONFIG.webtool_gethtml, enabled: true },
        webtool_screenshot: { ...VISUAL_TOOLS_CONFIG.webtool_screenshot, enabled: true }
    }
};

/**
 * 🔧 Configuration Utilities
 */
export class ResourceConfigManager {
    constructor() {
        this.activeConfig = {};
    }

    /**
     * Load a preset configuration
     */
    loadPreset(presetName) {
        if (!CONFIG_PRESETS[presetName]) {
            throw new Error(`Unknown preset: ${presetName}`);
        }
        
        this.activeConfig = { ...CONFIG_PRESETS[presetName] };
        return this;
    }

    /**
     * Enable resource storage for specific tools
     */
    enableTools(...toolNames) {
        for (const toolName of toolNames) {
            if (ALL_TOOLS_CONFIG[toolName]) {
                this.activeConfig[toolName] = { 
                    ...ALL_TOOLS_CONFIG[toolName], 
                    enabled: true 
                };
            }
        }
        return this;
    }

    /**
     * Disable resource storage for specific tools
     */
    disableTools(...toolNames) {
        for (const toolName of toolNames) {
            if (this.activeConfig[toolName]) {
                this.activeConfig[toolName].enabled = false;
            }
        }
        return this;
    }

    /**
     * Override configuration for specific tools
     */
    overrideConfig(toolName, configOverrides) {
        if (this.activeConfig[toolName]) {
            this.activeConfig[toolName] = {
                ...this.activeConfig[toolName],
                ...configOverrides
            };
        }
        return this;
    }

    /**
     * Get the active configuration
     */
    getConfig() {
        return this.activeConfig;
    }

    /**
     * Get configuration for a specific tool
     */
    getToolConfig(toolName) {
        return this.activeConfig[toolName];
    }

    /**
     * Check if a tool has resource storage enabled
     */
    isToolEnabled(toolName) {
        return this.activeConfig[toolName]?.enabled === true;
    }

    /**
     * Get list of enabled tools
     */
    getEnabledTools() {
        return Object.entries(this.activeConfig)
            .filter(([, config]) => config.enabled)
            .map(([toolName]) => toolName);
    }

    /**
     * Get summary of configuration
     */
    getConfigSummary() {
        const enabled = this.getEnabledTools();
        const disabled = Object.keys(ALL_TOOLS_CONFIG).filter(
            toolName => !enabled.includes(toolName)
        );

        return {
            totalTools: Object.keys(ALL_TOOLS_CONFIG).length,
            enabledCount: enabled.length,
            disabledCount: disabled.length,
            enabledTools: enabled,
            disabledTools: disabled
        };
    }
}

/**
 * 🎛️ Environment-based Configuration
 * Different configurations for different environments
 */
export function getConfigForEnvironment(env = process.env.NODE_ENV) {
    switch (env) {
        case 'development':
            // In development, enable all tools for testing
            return CONFIG_PRESETS.ALL_ENABLED;
            
        case 'production':
            // In production, be more conservative
            return CONFIG_PRESETS.WEB_ONLY;
            
        case 'testing':
            // In testing, minimal set
            return CONFIG_PRESETS.MINIMAL;
            
        default:
            // Default to all enabled
            return CONFIG_PRESETS.ALL_ENABLED;
    }
}

/**
 * 📄 Export default configuration based on environment
 */
export const DEFAULT_CONFIG = getConfigForEnvironment();

/**
 * 🔍 Configuration Validation
 */
export function validateConfig(config) {
    const errors = [];
    
    for (const [toolName, toolConfig] of Object.entries(config)) {
        // Check if tool exists in our definitions
        if (!ALL_TOOLS_CONFIG[toolName]) {
            errors.push(`Unknown tool: ${toolName}`);
            continue;
        }

        // Check required fields
        if (typeof toolConfig.enabled !== 'boolean') {
            errors.push(`Tool ${toolName}: 'enabled' must be a boolean`);
        }

        if (toolConfig.enabled && (!toolConfig.outputs || !Array.isArray(toolConfig.outputs))) {
            errors.push(`Tool ${toolName}: 'outputs' must be an array when enabled`);
        }

        // Validate outputs
        if (toolConfig.outputs) {
            for (let i = 0; i < toolConfig.outputs.length; i++) {
                const output = toolConfig.outputs[i];
                
                if (!output.contentPath) {
                    errors.push(`Tool ${toolName}, output ${i}: 'contentPath' is required`);
                }
                
                if (!output.contentType) {
                    errors.push(`Tool ${toolName}, output ${i}: 'contentType' is required`);
                }
            }
        }
    }
    
    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
}