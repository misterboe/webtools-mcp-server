/**
 * Technical Performance Analysis Prompt Definition
 * Provides in-depth technical analysis of performance bottlenecks with code examples
 */

export const technicalPerformanceAnalysisPrompt = {
  name: "technical-performance-analysis",
  description: "Detaillierte technische Analyse von Performance-Schwachstellen mit Code-Beispielen und Optimierungsvorschlägen",
  arguments: [
    {
      name: "url",
      description: "Die URL der zu analysierenden Website",
      required: true,
    },
    {
      name: "focusArea",
      description: "Schwerpunktbereich der Analyse",
      required: false,
      options: ["general", "javascript", "rendering", "resources", "network"],
      default: "general",
    },
  ],
  getMessages: (args) => {
    const focusArea = args.focusArea || "general";
    let focusDetails = "";

    switch (focusArea) {
      case "javascript":
        focusDetails = "Konzentriere dich besonders auf JavaScript-Ausführungsprobleme, lange Tasks, ineffiziente Event-Handler und blockierende Skripts.";
        break;
      case "rendering":
        focusDetails = "Konzentriere dich besonders auf Rendering-Probleme, Layout Shifts, Reflows, ineffiziente Animationen und Paint-Bottlenecks.";
        break;
      case "resources":
        focusDetails = "Konzentriere dich besonders auf Ressourcen-Probleme, große Dateien, ineffiziente Bilder, ungenutzten CSS/JS-Code und falsche Ressourcen-Priorisierung.";
        break;
      case "network":
        focusDetails = "Konzentriere dich besonders auf Netzwerk-Probleme, langsame API-Calls, ineffiziente Requests, fehlende Kompression und Cache-Probleme.";
        break;
      default:
        focusDetails = "Führe eine umfassende Analyse aller Performance-Aspekte durch.";
    }

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `# Technische Performance-Analyse für ${args.url}

Bitte führe eine detaillierte technische Analyse der Website ${args.url} durch, mit besonderem Fokus auf Performance-Schwachstellen und deren technische Ursachen im Code. ${focusDetails}

## Analysiere folgende Performance-Aspekte:

### 1. JavaScript-Ausführung und Hauptthread-Blockierung
- **Total Blocking Time (TBT)** - Identifiziere lange Tasks (>50ms) und deren Ursachen
- **First Input Delay (FID) / Interaction to Next Paint (INP)** - Bewerte Interaktivitätsprobleme
- **CPU-intensive Operationen** - Finde rechenintensive Code-Abschnitte
- **Event-Handler-Effizienz** - Analysiere ineffiziente Event-Handler und deren Implementierung
- **Ausführungsreihenfolge** - Überprüfe Skript-Ladereihenfolge und -Priorisierung
- **Unnötige Berechnungen** - Identifiziere redundante oder ineffiziente Berechnungen

### 2. Rendering-Performance
- **Layout Thrashing** - Finde Code-Muster, die wiederholt Layout-Berechnungen auslösen
- **Layout Shifts (CLS)** - Identifiziere Ursachen für visuelle Instabilität
- **Rendering-Pipeline-Blockierungen** - Analysiere Flaschenhälse in der Rendering-Pipeline
- **DOM-Manipulation** - Bewerte ineffiziente DOM-Operationen
- **Animations-Performance** - Überprüfe CSS/JS-Animationen auf Performance-Probleme

### 3. Ressourcenoptimierung
- **JavaScript-Größe und Aufteilung** - Analysiere Bundle-Größen und Code-Splitting
- **CSS-Optimierung** - Finde ungenutzte Stile und ineffiziente Selektoren
- **Bildoptimierung** - Identifiziere nicht optimal komprimierte oder dimensionierte Bilder
- **Webfont-Optimierung** - Überprüfe Webfont-Ladeprobleme
- **Ressourcen-Priorisierung** - Bewerte die Ladereihenfolge kritischer Ressourcen

### 4. Netzwerk und Ladezeiten
- **Server-Antwortzeiten** - Analysiere langsame API-Calls und Server-Responses
- **Ressourcen-Waterfall** - Identifiziere Blockierungs- und Abhängigkeitsprobleme
- **Caching-Konfiguration** - Überprüfe Cache-Header und -Strategien
- **HTTP/2 oder HTTP/3 Nutzung** - Bewerte Protokoll-Optimierungspotenzial
- **Kritischer Rendering-Pfad** - Analysiere Optimierungsmöglichkeiten

## Erforderliche Ausgabeformate:

### 1. Detaillierte Problembeschreibung
Für jedes identifizierte Problem liefere:
- Exakte technische Beschreibung des Problems
- Metriken und Messwerte (z.B. Blockierungszeit in ms, Anzahl der Probleme)
- Auswirkung auf Benutzerwahrnehmung und Core Web Vitals
- Schweregrad (kritisch, hoch, mittel, niedrig)

### 2. Code-Analyse mit Beispielen
Für identifizierte Code-Probleme:
- Konkrete Code-Beispiele aus der Website (Skript-URL, Zeilennummern wenn möglich)
- Problematisches Code-Muster mit Erklärung
- Optimierter Code-Vorschlag
- Technische Erklärung der Verbesserung

### 3. Optimierungsempfehlungen
Für jedes Problem:
- Konkrete, umsetzbare technische Lösungsansätze
- Erwarteter Performance-Gewinn
- Implementierungskomplexität
- Priorisierungsvorschlag basierend auf Aufwand/Nutzen-Verhältnis

Bitte sei so spezifisch und technisch wie möglich. Verwende Web-Performance-Fachbegriffe und beziehe dich auf konkrete APIs, Methoden und Techniken. Stelle Vermutungen klar als solche dar und unterscheide zwischen sicheren Erkenntnissen und Hypothesen, die weiterer Überprüfung bedürfen.`,
        },
      },
    ];
  },
};

/**
 * Handle technical-performance-analysis prompt request
 * @param {Object} args - Request arguments
 * @returns {Object} - Prompt response
 */
export function handleTechnicalPerformanceAnalysisPrompt(args) {
  if (!args.url) {
    throw new Error("URL is required");
  }

  const focusArea = args.focusArea || "general";
  const validFocusAreas = ["general", "javascript", "rendering", "resources", "network"];

  if (!validFocusAreas.includes(focusArea)) {
    throw new Error("Focus area must be one of: general, javascript, rendering, resources, network");
  }

  let focusAreaDisplay = focusArea;
  if (focusArea === "general") {
    focusAreaDisplay = "comprehensive";
  }

  return {
    description: `Technical ${focusAreaDisplay} performance analysis for ${args.url}`,
    messages: technicalPerformanceAnalysisPrompt.getMessages(args),
  };
}
