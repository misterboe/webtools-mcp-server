# Changelog

## [1.7.2] - 2025-08-05

### Fixed

- **Coverage Analysis Tool Packaging**
  - Fixed missing coverage analysis tool files in npm package
  - Added exception to .gitignore for `src/tools/performance/coverage/` directory
  - Resolves `ERR_MODULE_NOT_FOUND` error when using npm package version
  - Coverage tool functionality now works correctly with both local and npm installations

## [1.7.1] - 2025-08-01

### Added

- **Comprehensive Testing Framework**
  - Added complete test suite for webtool_readpage functionality
  - Improved test file organization with modular structure
  - Enhanced test coverage for resource response optimization

### Improved

- **Resource Response System**
  - Implemented generic dynamic resource system for all MCP tools
  - Optimized resource responses for better performance
  - Enhanced resource configuration management
  - Better separation of concerns in resource handling

- **Device Configuration**
  - Added getDeviceConfig functionality for improved device emulation
  - Enhanced device profile management system
  - Better integration with existing device configuration

### Fixed

- Test file organization and structure improvements
- Resource response optimization issues
- Enhanced error handling in dynamic resource system

## [1.7.0] - 2025-01-08

### Added

- **Advanced Response Size Management for Debug Tool**
  - New pagination support with `page` and `pageSize` parameters for browsing large datasets
  - Output control parameters: `maxConsoleEvents`, `maxNetworkEvents`, `maxErrorEvents`, `maxResourceEvents`
  - Compact formatting option with `compactFormat` parameter for abbreviated output
  - Summary-only mode with `summarizeOnly` parameter for counts and basic stats
  - Stack trace control with `skipStackTraces` parameter to reduce layout thrashing verbosity
  - Automatic token count management to prevent MCP 25k token limit errors

- **Enhanced SSL Configuration System**
  - New `IGNORE_SSL_ERRORS` environment variable for development environments (DDEV support)
  - Centralized SSL configuration in `src/config/constants.js`
  - Consistent SSL handling across all tools with conditional bypass
  - Improved documentation for SSL error management

### Improved

- **Debug Tool Response Optimization**
  - Up to 82% token reduction (from ~35k to ~2k tokens) with conservative defaults
  - Intelligent pagination vs. limits logic for optimal user experience
  - Clear truncation messaging with parameter hints for users
  - Backward compatibility maintained for existing tool calls

- **Server Capabilities and Documentation**
  - Comprehensive capabilities documentation with response management features
  - Enhanced tool definitions with detailed parameter descriptions
  - Complete JSDoc documentation for all new parameters
  - Updated CLAUDE.md with Response Size Management guidelines

- **Developer Experience**
  - Consistent parameter naming across performance tools
  - Multiple recommended parameter sets for different use cases
  - Clear examples for pagination, limits, and formatting options
  - Fixed deprecated API usage and variable naming conflicts

### Fixed

- Hardcoded SSL bypass in screenshot and debug tools (now conditional)
- Variable naming conflict in debug tool pagination logic
- Deprecated `page.target()` usage in CDP session creation
- Inconsistent SSL behavior across different tools

## [1.6.1]

### Added

- MCP Prompts Support für verbesserte Interaktion mit dem Server
  - Neue Prompt-Definitionen mit modularem Aufbau
  - analyze-website: Umfassende Website-Analyse mit Device-Auswahl (Desktop/Mobile)
  - get-website-content: Extraktion und Konvertierung von Website-Inhalten in Markdown
  - screenshot-website: Einfaches Erstellen von Website-Screenshots
  - technical-performance-analysis: Detaillierte technische Analyse von Performance-Schwachstellen

### Improved

- Bessere Modularisierung der Prompt-Funktionalität
- Verbesserte Fehlerbehandlung bei Prompt-Anfragen
- Detailliertere technische Analyse-Optionen
- Unterstützung für spezifische Analyse-Schwerpunkte

## [1.6.0] - 2025-03-31

### Added

- Complete performance analysis framework with specialized tools:
  - Network Monitor: Detailed network activity and resource loading analysis
  - Coverage Analysis: JavaScript and CSS coverage analysis
  - Web Vitals Analysis: Core Web Vitals metrics and element identification
  - Performance Test Framework: Cross-device and network condition testing
- Comparative analysis across devices and network conditions
- Configurable device profiles for realistic testing
- Network condition simulation
- Detailed reporting with actionable recommendations

### Improved

- Modular architecture for better maintainability
- Split large files into smaller, more focused modules
- Better organization of performance analysis tools
- Enhanced configuration options for device emulation
- More comprehensive documentation

## [1.5.1] - 2025-03-31

### Added

- Enhanced debug tool with layout thrashing detection
  - Automatic detection of DOM operations that cause layout thrashing
  - Stack trace capture for layout thrashing events
  - Detailed recommendations for fixing layout thrashing issues
- Improved server capabilities communication
  - Better description of available tools and features
  - Recommended parameters for optimal tool usage
  - More detailed tool documentation

### Improved

- Increased stability for debug tool
  - Better error handling for navigation failures
  - Improved timeout handling with progress logging
  - More robust browser launch process
- Enhanced client-server communication
  - More detailed capabilities information
  - Better parameter documentation
  - Clearer error messages

## [1.5.0] - 2025-03-31

### Added

- Enhanced performance analysis with specialized modules:
  - Layout Thrashing Analysis: Detects and visualizes layout thrashing patterns
  - CSS Variables Impact Analyzer: Tracks CSS variable changes and their cascade effects
  - JavaScript Execution Timeline: Maps JS functions to layout events
  - Long Task Breakdown Analyzer: Provides detailed attribution of long tasks
  - Memory and DOM Size Analyzer: Tracks DOM growth and detects memory leaks
  - Resource Loading Optimizer: Analyzes resource loading waterfall

### Improved

- Modular architecture for performance analysis tools
- More detailed performance bottleneck detection
- Better visualization of performance issues
- More actionable recommendations for performance optimization

## [1.4.1] - 2024-03-25

### Fixed

- Chrome detection and availability issues
- Improved error handling for missing Chrome installations
- Added support for automatically finding Puppeteer's Chrome installation
- Updated documentation with Chrome requirements and troubleshooting tips

## [1.4.0] - 2024-03-25

### Added

- Unified Lighthouse-based web auditing system
- Support for multiple audit categories in a single request
- Device emulation for mobile and desktop rendering

### Improved

- Comprehensive documentation update
- Better alignment of documentation with actual implementation
- Enhanced error handling and reporting
- Improved configuration options
- Clearer examples and usage instructions

## [1.3.0] - 2024-03-21

### Added

- Asset Optimizer Tool
  - Image optimization analysis
  - Font optimization suggestions
  - CSS analysis and optimization
  - JavaScript optimization recommendations
  - Resource size and loading analysis
- Security Scanner Tool
  - Security headers analysis
  - CSP (Content Security Policy) validation
  - SSL/TLS certificate checking
  - Dependency vulnerability scanning
- Accessibility Checker Tool
  - WCAG compliance checking
  - ARIA validation
  - Contrast ratio analysis
  - Structure and navigation checks
- SEO Analyzer Tool
  - Meta tags analysis
  - Structured data validation
  - Mobile-friendliness check
  - Content quality assessment
- Performance Analyzer Tool
  - Core Web Vitals measurement
  - Resource loading analysis
  - Performance timeline tracking
  - Memory usage profiling

### Improved

- Enhanced error handling across all tools
- More detailed reporting formats
- Better resource analysis capabilities
- Improved proxy handling
- More robust browser automation

## [1.2.0] - 2024-03-20

### Added

- Debug capabilities for web pages
- Screenshot functionality improvements
- Enhanced error reporting

## [1.1.0] - 2024-03-19

### Added

- Screenshot capabilities
- Basic HTML extraction
- Markdown conversion
- Proxy support

## [1.0.0] - 2024-03-18

### Added

- Initial release
- Basic HTML fetching
- Page reading functionality
- Error handling
