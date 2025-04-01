/**
 * Analyze Website Prompt Definition
 * Provides comprehensive website performance analysis
 */

export const analyzeWebsitePrompt = {
  name: "analyze-website",
  description: "Umfassende Analyse einer Website mit Fokus auf Performance, SEO, Accessibility und User Experience für Desktop oder Mobile",
  arguments: [
    {
      name: "url",
      description: "Die URL der zu analysierenden Website",
      required: true,
    },
    {
      name: "device",
      description: "Gerättyp für die Analyse (mobile oder desktop)",
      required: false,
      options: ["mobile", "desktop"],
      default: "mobile",
    },
  ],
  getMessages: (args) => {
    const deviceType = args.device || "desktop";
    const isDesktop = deviceType === "desktop";

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `# Webseiten-Performance-Analyse Plan

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
   
---------------------

Bitte führe eine umfassende Analyse der Website ${args.url} für ${isDesktop ? "Desktop" : "Mobile"}-Geräte durch.

Der Test wird spezifisch für ${isDesktop ? "Desktop-Computer" : "mobile Geräte"} durchgeführt, daher fokussiere die Analyse auf die relevanten Aspekte für diesen Gerätetyp.

Berücksichtige folgende Bereiche:

1. **Performance-Analyse**
   - Core Web Vitals (LCP, CLS, INP) für ${isDesktop ? "Desktop" : "Mobile"}
   - Ladegeschwindigkeit und Optimierungsmöglichkeiten
   - JavaScript- und CSS-Nutzungseffizienz
   - Ressourcenladung und Netzwerkauslastung${!isDesktop ? "\n   - Mobile Netzwerk-Einschränkungen (3G/4G)" : ""}

2. **Technische SEO-Bewertung**
   - Meta-Tags und strukturierte Daten
   - Crawlability und Indexierbarkeit
   - ${isDesktop ? "Desktop" : "Mobile"} Responsivität${!isDesktop ? "\n   - Mobile-First Indexierung" : ""}
   - Seitengeschwindigkeit als Rankingfaktor

3. **Accessibility-Bewertung**
   - WCAG-Konformitätsniveau
   - Screenreader-Kompatibilität
   - Tastaturnavigation
   - Farbkontrast und Textlesbarkeit${!isDesktop ? "\n   - Touch-Ziele und deren Größe" : ""}

4. **User Experience Überprüfung**
   - ${isDesktop ? "Desktop" : "Mobile"} Usability
   - Navigationsstruktur und Intuitivität${!isDesktop ? "\n   - Touch-freundliche Navigation" : ""}
   - Lesbarkeit und Struktur des Inhalts
   - Interaktive Elemente und Formulare

5. **Sicherheitsübersicht**
   - SSL-Implementierung
   - Safe-Browsing-Status
   - Prüfung auf häufige Schwachstellen

6. **Umsetzbare Empfehlungen für ${isDesktop ? "Desktop" : "Mobile"}**
   - Priorisierte Liste von Verbesserungen speziell für ${isDesktop ? "Desktop" : "Mobile"}-Geräte
   - Implementierungsvorschläge für kritische Probleme
   - Schnelle Erfolge vs. langfristige Verbesserungen

Bitte liefere spezifische, umsetzbare Erkenntnisse, die die Leistung, Benutzererfahrung und Effektivität der Website auf ${isDesktop ? "Desktop" : "Mobile"}-Geräten messbar verbessern könnten.`,
        },
      },
    ];
  },
};

/**
 * Handle analyze-website prompt request
 * @param {Object} args - Request arguments
 * @returns {Object} - Prompt response
 */
export function handleAnalyzeWebsitePrompt(args) {
  if (!args.url) {
    throw new Error("URL is required");
  }

  const deviceType = args.device || "desktop";
  if (deviceType !== "mobile" && deviceType !== "desktop") {
    throw new Error("Device type must be 'mobile' or 'desktop'");
  }

  return {
    description: `Comprehensive ${deviceType} website analysis for ${args.url}`,
    messages: analyzeWebsitePrompt.getMessages(args),
  };
}
