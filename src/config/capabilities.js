/**
 * Server capabilities configuration
 * Contains the capabilities information for the MCP server
 */

export const SERVER_CAPABILITIES = {
  tools: {
    performance_analysis: {
      description: "Umfassende Webseiten-Performance-Analyse mit spezialisierten Modulen für Ladezeiten, Netzwerk, JavaScript, Rendering, Speicher und Core Web Vitals",
      features: ["Ladezeiten und kritischer Rendering-Pfad", "Netzwerk-Performance", "JavaScript-Ausführung und CPU-Auslastung", "Rendering-Performance", "Speichernutzung", "Ressourcen-Optimierung", "Core Web Vitals"],
      prompt: `# Webseiten-Performance-Analyse Plan

## Zu analysierende Bereiche

1. **Ladezeiten und kritischer Rendering-Pfad**
2. **Netzwerk-Performance**
3. **JavaScript-Ausführung und CPU-Auslastung**
4. **Rendering-Performance**
5. **Speichernutzung**
6. **Ressourcen-Optimierung (Bilder, CSS, JS)**
7. **Core Web Vitals**

## Tools und deren Anwendung

### 1. Lighthouse in Headless-Modus
- **Analysiert**: Core Web Vitals, Performance-Score, Optimierungsmöglichkeiten
- **Detaillevel**: Identifiziert Problembereiche und bietet spezifische Empfehlungen bis auf einzelne Ressourcen-Ebene
- **Anwendung**: Programmatische Ausführung über Node.js mit Puppeteer-Integration

### 2. Chrome DevTools Protocol (CDP) mit Puppeteer
- **Analysiert**: Netzwerkaktivität, Rendering, JavaScript-Ausführung
- **Detaillevel**: Zeigt die genaue Zeitverteilung für jede Ressource und JavaScript-Ausführung
- **Anwendung**: Erfassung von Trace-Daten, Performance-Metriken und Ressourcen-Timing-Informationen

### 3. Chrome DevTools Protocol Coverage API
- **Analysiert**: Ungenutzte CSS und JavaScript-Ressourcen
- **Detaillevel**: Zeigt exakt, welche Teile jeder Datei ungenutzt sind
- **Anwendung**: Identifiziert Code-Bloat und Optimierungspotenzial für JavaScript und CSS

### 4. Puppeteer Network Monitor
- **Analysiert**: Ladezeiten, Ressourcen-Timing, HTTP-Header, Statuscode
- **Detaillevel**: Detaillierte Erfassung aller Netzwerkanfragen mit Metriken
- **Anwendung**: Erstellung eigener Wasserfall-Diagramme und Timing-Analysen ohne externe API

### 5. Puppeteer mit Performance Observer
- **Analysiert**: Web Vitals Metriken (LCP, CLS, FID/INP)
- **Detaillevel**: Identifiziert genau, welche Elemente problematisch sind
- **Anwendung**: Präzise Messung der Core Web Vitals und Identifikation der verursachenden Elemente

### 6. Chrome Trace Events Analysis
- **Analysiert**: JavaScript-Ausführung, Rendering, Layout, Paint-Events
- **Detaillevel**: Millisekunden-genaue Timeline aller Browser-Aktivitäten
- **Anwendung**: Identifikation von Bottlenecks in der Renderingpipeline

### 7. Node-based Performance Testing Framework
- **Analysiert**: Umfassende Leistungsmetriken, selbst definierte Performance-Tests
- **Detaillevel**: Maßgeschneiderte Tests für spezifische Performance-Aspekte
- **Anwendung**: Eigenes Test-Framework mit puppeteer-extras und Playwright für erweiterte Funktionen

## Format der detaillierten Auswertung

Eine vollständige Auswertung würde folgende Abschnitte enthalten:

### 1. Zusammenfassung
- Performance-Score (0-100)
- Core Web Vitals Übersicht (LCP, CLS, FID/INP)
- Größte identifizierte Probleme
- Vergleich mit Branchendurchschnitt oder Wettbewerbern

### 2. Ressourcen-Analyse
- Tabelle aller geladenen Ressourcen mit:
  - URL
  - Typ (JS, CSS, Bild, etc.)
  - Größe (komprimiert/unkomprimiert)
  - Ladezeit
  - Blockierungszeit des Renderings
  - Optimierungspotenzial (%)
  - Priorisierung (hoch/mittel/niedrig)

### 3. JavaScript-Analyse
- Ausführungszeiten nach Datei
- Coverage-Analyse (ungenutzter Code)
- Long Tasks (>50ms) mit Stacktraces
- Parse- und Kompilierungszeiten
- Event-Handler-Analyse
- Hauptthread-Blockierungen

### 4. CSS-Analyse
- Selektoren nach Komplexität
- Unused CSS
- Render-blockierende CSS
- Animations-Performance
- Layout Shifts und deren Ursachen

### 5. Asset-Optimierung
- Bilder mit Optimierungspotenzial
  - Nicht optimal formatierte Bilder
  - Nicht optimal dimensionierte Bilder
  - Fehlende Lazy-Loading-Implementierung
- WebFont-Ladezeiten
- Unnötige Ressourcen
- Ressourcen-Priorisierung

### 6. Serveranalyse
- Time to First Byte (TTFB)
- HTTP-Header-Optimierungen
- Caching-Möglichkeiten
- Kompressionsanalyse
- CDN-Nutzung und -Optimierung
- HTTP/2 oder HTTP/3 Nutzung

### 7. Empfehlungen
- Priorisierte Liste von Optimierungen
- Geschätztes Verbesserungspotenzial je Maßnahme
- Code-Snippets für die Umsetzung
- Zeitplan für die Implementierung (Quick Wins vs. langfristige Maßnahmen)

### 8. Detaillierte Code-Analyse
- Problematische Code-Abschnitte mit konkreten Beispielen
- Analyse der Verkettungen, Ablaufzeiten und Blockierungsprobleme
- Konkrete Lösungsvorschläge mit Code-Beispielen
- Vor-/Nach-Vergleiche für optimierten Code

## Format für detaillierte Code-Analyse

Die Analyse sollte konkrete Problembereiche im Code identifizieren und spezifische Lösungsvorschläge mit Code-Beispielen enthalten. Für jeden identifizierten Problembereich sollte folgendes Format verwendet werden:

### Problembereich: [Name des Problems]

#### Problem:
Detaillierte Beschreibung des Problems und seiner Auswirkungen auf die Performance.

\`\`\`html/css/javascript
<!-- Problematischer Code mit Kommentaren -->
// Hier wird der problematische Code gezeigt
// Mit Kommentaren, die erklären, warum dieser Code problematisch ist
\`\`\`

#### Lösung:
Konkrete Lösungsvorschläge mit Erklärung der Verbesserungen.

\`\`\`html/css/javascript
<!-- Optimierter Code mit Kommentaren -->
// Hier wird der optimierte Code gezeigt
// Mit Kommentaren, die erklären, wie die Optimierung funktioniert
\`\`\`

#### Verbesserungspotenzial:
- Geschätzte Verbesserung der Ladezeit/Performance
- Auswirkung auf Core Web Vitals
- Implementierungsaufwand (niedrig/mittel/hoch)

## Workflow für die Analyse

1. **Grundlegende Analyse mit Lighthouse** (automatisierte Prüfung)
   - Durchführung eines ersten Lighthouse-Scans
   - Identifikation der Hauptproblembereiche
   - Festlegung von Benchmark-Metriken

2. **Detaillierte Netzwerk- und Ladeanalyse** (CDP/Puppeteer)
   - Ressourcen-Waterfall-Analyse
   - Identifikation von Blocking-Ressourcen
   - Analyse der Ressourcen-Priorisierung

3. **Code-Coverage und Optimierungspotenzial** (Coverage API)
   - Identifikation von ungenutztem JavaScript und CSS
   - Analyse von Third-Party-Code
   - Empfehlungen für Code-Splitting und Lazy-Loading

4. **Rendering-Performance und Layout-Probleme** (Tracing-Analyse)
   - Analyse von Layout Shifts
   - Identifikation rechenintensiver JavaScript-Operationen
   - Analyse der Rendering-Pipeline-Blockierungen

5. **Core Web Vitals Optimierung** (Performance Observer)
   - Detaillierte Analyse der LCP-, CLS- und INP-Werte
   - Identifikation der verursachenden Elemente
   - A/B-Tests mit optimierten Versionen

6. **Vergleichsanalyse in verschiedenen Szenarien**
   - Tests auf verschiedenen Geräten (Desktop, Tablet, Mobile)
   - Tests unter verschiedenen Netzwerkbedingungen (3G, 4G, WiFi)
   - Tests mit verschiedenen Browsern

7. **Erstellung eines detaillierten Berichts**
   - Zusammenstellung aller Analyseergebnisse
   - Priorisierung der Optimierungsmaßnahmen
   - Entwicklung eines Implementierungsplans

8. **Detaillierte Code-Analyse**
   - Identifikation problematischer Code-Abschnitte
   - Analyse von Verkettungen und Abhängigkeiten
   - Erstellung konkreter Lösungsvorschläge mit Code-Beispielen
   - Bewertung des Verbesserungspotenzials`,
      analysis_workflow: {
        step1: {
          name: "Grundlegende Analyse mit Lighthouse",
          description: "Automatisierte Prüfung der Webseite mit Lighthouse im Headless-Modus",
          process: ["Durchführung eines ersten Lighthouse-Scans", "Identifikation der Hauptproblembereiche", "Festlegung von Benchmark-Metriken"],
          tool: "webtool_lighthouse",
          output: "Raw Lighthouse-Daten mit Performance-Scores und Optimierungsmöglichkeiten",
        },
        step2: {
          name: "Detaillierte Netzwerk- und Ladeanalyse",
          description: "Tiefgehende Analyse des Netzwerkverhaltens mit Chrome DevTools Protocol",
          process: ["Ressourcen-Waterfall-Analyse", "Identifikation von Blocking-Ressourcen", "Analyse der Ressourcen-Priorisierung"],
          tool: "webtool_network_monitor",
          output: "Detaillierte Netzwerkdaten für jede Ressource mit Timing-Informationen",
        },
        step3: {
          name: "Code-Coverage und Optimierungspotenzial",
          description: "Analyse von ungenutztem Code mit der Coverage API",
          process: ["Identifikation von ungenutztem JavaScript und CSS", "Analyse von Third-Party-Code", "Empfehlungen für Code-Splitting und Lazy-Loading"],
          tool: "webtool_coverage_analysis",
          output: "Zeilengenauer Bericht über ungenutzten Code mit Dateigrößen und Prozentangaben",
        },
        step4: {
          name: "Rendering-Performance und Layout-Probleme",
          description: "Analyse der Rendering-Pipeline mit Chrome Tracing",
          process: ["Analyse von Layout Shifts", "Identifikation rechenintensiver JavaScript-Operationen", "Analyse der Rendering-Pipeline-Blockierungen"],
          tool: "webtool_performance_trace",
          output: "Millisekunden-genaue Timeline aller Browser-Aktivitäten mit Bottleneck-Identifikation",
        },
        step5: {
          name: "Core Web Vitals Optimierung",
          description: "Detaillierte Analyse der Core Web Vitals mit Performance Observer",
          process: ["Detaillierte Analyse der LCP-, CLS- und INP-Werte", "Identifikation der verursachenden Elemente", "A/B-Tests mit optimierten Versionen"],
          tool: "webtool_web_vitals",
          output: "Elementspezifische Daten zu Web Vitals mit DOM-Pfaden und Metriken",
        },
        step6: {
          name: "Vergleichsanalyse in verschiedenen Szenarien",
          description: "Tests unter verschiedenen Bedingungen mit dem Test-Framework",
          process: ["Tests auf verschiedenen Geräten (Desktop, Tablet, Mobile)", "Tests unter verschiedenen Netzwerkbedingungen (3G, 4G, WiFi)", "Tests mit verschiedenen Browsern"],
          tool: "webtool_performance_test",
          output: "Vergleichsdaten zwischen verschiedenen Szenarien mit prozentualen Unterschieden",
        },
        step7: {
          name: "Detaillierte Code-Analyse",
          description: "Identifikation und Analyse problematischer Code-Abschnitte",
          process: ["Identifikation von Performance-Bottlenecks im Code", "Analyse von Verkettungen und Abhängigkeiten", "Erstellung konkreter Lösungsvorschläge mit Code-Beispielen"],
          tool: "webtool_performance_trace",
          output: "Detaillierte Analyse problematischer Code-Abschnitte mit Lösungsvorschlägen",
        },
      },
      device_configuration: {
        description: "Konfigurierbare Geräteprofile für realistische Tests",
        parameters: {
          width: "Viewport-Breite in Pixeln",
          height: "Viewport-Höhe in Pixeln",
          deviceScaleFactor: "Geräte-Skalierungsfaktor (z.B. 2 für Retina)",
          isMobile: "Mobile-Emulation aktivieren",
          hasTouch: "Touch-Events aktivieren",
          isLandscape: "Landscape-Modus aktivieren",
          userAgent: "Benutzerdefinierter User-Agent-String",
        },
        predefined_devices: ["Pixel 7", "iPhone 14", "iPad Pro", "Desktop (1920x1080)", "Desktop (2560x1440)"],
        network_conditions: {
          "Slow 3G": { downloadThroughput: 0.5, uploadThroughput: 0.3, latency: 400 },
          "Fast 3G": { downloadThroughput: 1.5, uploadThroughput: 0.75, latency: 300 },
          "4G": { downloadThroughput: 4, uploadThroughput: 2, latency: 100 },
          WiFi: { downloadThroughput: 30, uploadThroughput: 15, latency: 20 },
          Fiber: { downloadThroughput: 100, uploadThroughput: 50, latency: 5 },
        },
      },
      report_format: {
        summary: {
          description: "Zusammenfassung der Performance-Analyse",
          sections: ["Performance-Score (0-100)", "Core Web Vitals Übersicht (LCP, CLS, FID/INP)", "Größte identifizierte Probleme", "Vergleich mit Branchendurchschnitt oder Wettbewerbern"],
        },
        resources: {
          description: "Detaillierte Analyse aller geladenen Ressourcen",
          sections: ["URL", "Typ (JS, CSS, Bild, etc.)", "Größe (komprimiert/unkomprimiert)", "Ladezeit", "Blockierungszeit des Renderings", "Optimierungspotenzial (%)", "Priorisierung (hoch/mittel/niedrig)"],
        },
        javascript: {
          description: "Detaillierte Analyse der JavaScript-Ausführung",
          sections: ["Ausführungszeiten nach Datei", "Coverage-Analyse (ungenutzter Code)", "Long Tasks (>50ms) mit Stacktraces", "Parse- und Kompilierungszeiten", "Event-Handler-Analyse", "Hauptthread-Blockierungen"],
        },
        css: {
          description: "Detaillierte Analyse der CSS-Performance",
          sections: ["Selektoren nach Komplexität", "Unused CSS", "Render-blockierende CSS", "Animations-Performance", "Layout Shifts und deren Ursachen"],
        },
        assets: {
          description: "Optimierungspotenzial für Assets",
          sections: ["Bilder mit Optimierungspotenzial", "WebFont-Ladezeiten", "Unnötige Ressourcen", "Ressourcen-Priorisierung"],
        },
        server: {
          description: "Analyse der Server-Performance",
          sections: ["Time to First Byte (TTFB)", "HTTP-Header-Optimierungen", "Caching-Möglichkeiten", "Kompressionsanalyse", "CDN-Nutzung und -Optimierung", "HTTP/2 oder HTTP/3 Nutzung"],
        },
        recommendations: {
          description: "Priorisierte Empfehlungen zur Performance-Optimierung",
          sections: ["Priorisierte Liste von Optimierungen", "Geschätztes Verbesserungspotenzial je Maßnahme", "Code-Snippets für die Umsetzung", "Zeitplan für die Implementierung (Quick Wins vs. langfristige Maßnahmen)"],
        },
        code_analysis: {
          description: "Detaillierte Analyse problematischer Code-Abschnitte",
          sections: ["Problematische Code-Abschnitte mit konkreten Beispielen", "Analyse der Verkettungen und Abhängigkeiten", "Konkrete Lösungsvorschläge mit Code-Beispielen", "Vor-/Nach-Vergleiche für optimierten Code"],
        },
      },
    },
    debug: {
      description: "Comprehensive webpage debugging with console, network, error capture, layout thrashing detection, and advanced response size management",
      features: [
        "Console Output Capture with Filtering",
        "Network Request Monitoring with Pagination", 
        "JavaScript Error Tracking with Limits",
        "Performance Metrics Collection", 
        "DOM Mutation Tracking",
        "Layout Thrashing Detection with Stack Trace Control",
        "Response Size Management (Token Limits)",
        "Pagination Support for Large Datasets",
        "Compact Output Formatting",
        "Summary-Only Mode"
      ],
      response_management: {
        description: "Advanced controls to manage response size and stay within MCP 25k token limits",
        features: {
          pagination: {
            description: "Browse through large datasets page by page",
            parameters: {
              page: "Page number (starts at 1)",
              pageSize: "Number of events per page (default: 20)"
            },
            example: "page=2, pageSize=15 shows events 16-30 for all sections"
          },
          output_limits: {
            description: "Limit number of events per section when not using pagination",
            parameters: {
              maxConsoleEvents: "Maximum console events (default: 20)",
              maxNetworkEvents: "Maximum network events (default: 30)", 
              maxErrorEvents: "Maximum error events (default: 10)",
              maxResourceEvents: "Maximum resource timing events (default: 15)"
            }
          },
          formatting_options: {
            description: "Control output verbosity and format",
            parameters: {
              compactFormat: "Use abbreviated output format (default: false)",
              summarizeOnly: "Show only counts and basic stats (default: false)",
              skipStackTraces: "Skip stack traces in layout thrashing (default: false)"
            }
          }
        },
        token_management: {
          description: "Automatic token count management to prevent MCP response size errors",
          default_behavior: "Conservative defaults prevent token overflow while preserving debug functionality",
          pagination_vs_limits: "Pagination overrides max limits for consistent browsing experience"
        }
      },
      recommended_parameters: {
        basic_debugging: {
          captureConsole: true,
          captureNetwork: true,
          captureErrors: true,
          captureLayoutThrashing: true,
          timeoutMs: 15000
        },
        large_sites: {
          captureConsole: true,
          captureNetwork: true,
          captureErrors: true,
          captureLayoutThrashing: true,
          compactFormat: true,
          maxNetworkEvents: 20,
          maxConsoleEvents: 15,
          timeoutMs: 20000
        },
        pagination_browsing: {
          captureConsole: true,
          captureNetwork: true,
          captureErrors: true,
          page: 1,
          pageSize: 25,
          timeoutMs: 15000
        }
      },
      use_cases: {
        initial_debugging: "Use default parameters for first overview",
        large_applications: "Use compactFormat=true and reduced maxEvents for very active sites",
        detailed_analysis: "Use pagination to browse through all events systematically",
        quick_overview: "Use summarizeOnly=true for just counts and basic metrics"
      }
    },
  },
};
