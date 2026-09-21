#!/usr/bin/env node

/**
 * CodeGraph Generator for LLMs & AI Agents
 * Parses codebase AST via TypeScript Compiler API to produce a high-fidelity
 * Knowledge Graph (nodes, edges, symbols, routes, components, and indices).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.resolve(ROOT_DIR, "src");

const OUTPUT_JSON = path.resolve(ROOT_DIR, "codegraph.json");
const OUTPUT_MD = path.resolve(ROOT_DIR, "CODEGRAPH.md");

/** Helper to walk directories recursively */
function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".git" ||
        entry.name === ".gemini" ||
        entry.name === ".agents" ||
        entry.name === ".claude" ||
        entry.name === ".fallow" ||
        entry.name === ".kiro"
      ) {
        continue;
      }
      walkDir(fullPath, fileList);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx") ||
        entry.name.endsWith(".js") ||
        entry.name.endsWith(".mjs")) &&
      !entry.name.endsWith(".d.ts")
    ) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function getFileCategory(relPath) {
  if (relPath.startsWith("src/app/api/")) return "api-route";
  if (relPath.startsWith("src/app/") && relPath.endsWith("page.tsx")) return "page";
  if (relPath.startsWith("src/app/") && relPath.endsWith("layout.tsx")) return "layout";
  if (relPath.includes("components/")) return "component";
  if (relPath.includes("lib/")) return "library";
  if (relPath.endsWith(".test.ts") || relPath.endsWith(".test.tsx") || relPath.endsWith(".spec.ts")) return "test";
  if (relPath.startsWith("scripts/")) return "script";
  return "source";
}

function resolveImportPath(importSpecifier, currentFilePath) {
  if (importSpecifier.startsWith("@/")) {
    const sub = importSpecifier.replace(/^@\//, "");
    const base = path.join(SRC_DIR, sub);
    for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts", ""]) {
      const candidate = base + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return path.relative(ROOT_DIR, candidate);
      }
    }
    return `src/${sub}`;
  }
  if (importSpecifier.startsWith(".")) {
    const currentDir = path.dirname(currentFilePath);
    const base = path.resolve(currentDir, importSpecifier);
    for (const ext of [".tsx", ".ts", ".mjs", ".js", "/index.tsx", "/index.ts", ""]) {
      const candidate = base + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return path.relative(ROOT_DIR, candidate);
      }
    }
    return path.relative(ROOT_DIR, base);
  }
  return importSpecifier; // External package
}

console.log("🔍 Scanning codebase for CodeGraph generation...");
const allFiles = walkDir(SRC_DIR).concat(walkDir(path.resolve(ROOT_DIR, "scripts")));

const nodes = [];
const edges = [];
const symbolIndex = {};
const fileIndex = {};
const routeIndex = {};
const componentTree = {};

for (const filePath of allFiles) {
  const relPath = path.relative(ROOT_DIR, filePath);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const fileNodeId = `file:${relPath}`;
  const category = getFileCategory(relPath);

  const fileNode = {
    id: fileNodeId,
    type: "FILE",
    name: path.basename(filePath),
    path: relPath,
    category,
    sizeBytes: Buffer.byteLength(fileContent, "utf-8"),
    lineCount: fileContent.split("\n").length,
    symbols: [],
    imports: [],
    exports: [],
  };

  fileIndex[relPath] = {
    category,
    symbols: [],
    imports: [],
    importedBy: [],
  };

  const fileSymbols = [];
  const fileImports = [];
  const referencedComponents = new Set();

  function visit(node) {
    // 1. Import declarations
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier.text;
      const resolved = resolveImportPath(moduleSpecifier, filePath);
      const isExternal = !moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("@/");

      const importedNames = [];
      if (node.importClause) {
        if (node.importClause.name) {
          importedNames.push(node.importClause.name.text);
        }
        if (node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const elem of node.importClause.namedBindings.elements) {
              importedNames.push(elem.name.text);
            }
          } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
            importedNames.push(`* as ${node.importClause.namedBindings.name.text}`);
          }
        }
      }

      fileImports.push({
        module: moduleSpecifier,
        resolved,
        isExternal,
        names: importedNames,
      });

      edges.push({
        source: fileNodeId,
        target: isExternal ? `package:${moduleSpecifier}` : `file:${resolved}`,
        type: "IMPORTS",
        metadata: { symbols: importedNames, isExternal },
      });
    }

    // 2. Export declarations & statements
    const isExported =
      (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0 ||
      (node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
    const isDefault =
      (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Default) !== 0 ||
      (node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword));

    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const startLine = lineAndChar.line + 1;
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;

    // Functions
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      const isComponent = /^[A-Z]/.test(name);
      const isHook = /^use[A-Z]/.test(name);
      const kind = isComponent ? "COMPONENT" : isHook ? "HOOK" : "FUNCTION";

      const symbolNode = {
        id: `symbol:${relPath}#${name}`,
        type: "SYMBOL",
        name,
        kind,
        file: relPath,
        startLine,
        endLine,
        isExported: Boolean(isExported || isDefault),
        isDefault: Boolean(isDefault),
      };

      fileSymbols.push(symbolNode);
    }

    // Variable / Arrow Function / Component statements
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.text;
          const isComponent = /^[A-Z]/.test(name);
          const isHook = /^use[A-Z]/.test(name);
          const isFunc = decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer));
          const kind = isComponent ? "COMPONENT" : isHook ? "HOOK" : isFunc ? "FUNCTION" : "CONST";

          const symbolNode = {
            id: `symbol:${relPath}#${name}`,
            type: "SYMBOL",
            name,
            kind,
            file: relPath,
            startLine,
            endLine,
            isExported: Boolean(isExported || isDefault),
            isDefault: Boolean(isDefault),
          };

          fileSymbols.push(symbolNode);
        }
      }
    }

    // Interfaces
    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.text;
      fileSymbols.push({
        id: `symbol:${relPath}#${name}`,
        type: "SYMBOL",
        name,
        kind: "INTERFACE",
        file: relPath,
        startLine,
        endLine,
        isExported: Boolean(isExported || isDefault),
        isDefault: false,
      });
    }

    // Type Aliases
    if (ts.isTypeAliasDeclaration(node)) {
      const name = node.name.text;
      fileSymbols.push({
        id: `symbol:${relPath}#${name}`,
        type: "SYMBOL",
        name,
        kind: "TYPE",
        file: relPath,
        startLine,
        endLine,
        isExported: Boolean(isExported || isDefault),
        isDefault: false,
      });
    }

    // JSX Elements (Component References)
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText();
      if (/^[A-Z]/.test(tagName)) {
        referencedComponents.add(tagName);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // App Router API Endpoints Detection
  if (relPath.startsWith("src/app/api/") && relPath.endsWith("route.ts")) {
    const routeUrl = "/" + relPath.replace(/^src\/app\//, "").replace(/\/route\.ts$/, "");
    const methods = fileSymbols
      .filter((s) => ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].includes(s.name))
      .map((s) => s.name);

    routeIndex[routeUrl] = {
      file: relPath,
      methods,
      line: 1,
    };

    nodes.push({
      id: `route:${routeUrl}`,
      type: "ROUTE",
      name: routeUrl,
      path: relPath,
      methods,
    });

    edges.push({
      source: `route:${routeUrl}`,
      target: fileNodeId,
      type: "HANDLED_BY",
    });
  }

  // App Router Pages Detection
  if (relPath.startsWith("src/app/") && relPath.endsWith("page.tsx")) {
    const pageUrl = "/" + relPath.replace(/^src\/app\//, "").replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "");
    nodes.push({
      id: `page:${pageUrl || "/"}`,
      type: "PAGE",
      name: pageUrl || "/",
      path: relPath,
    });
  }

  // Store file symbols in node and indices
  fileNode.symbols = fileSymbols.map((s) => s.name);
  fileNode.imports = fileImports;
  fileIndex[relPath].symbols = fileSymbols.map((s) => ({ name: s.name, kind: s.kind, isExported: s.isExported }));
  fileIndex[relPath].imports = fileImports.map((i) => i.resolved);

  for (const sym of fileSymbols) {
    nodes.push(sym);
    edges.push({
      source: fileNodeId,
      target: sym.id,
      type: "DEFINES",
    });

    if (!symbolIndex[sym.name]) {
      symbolIndex[sym.name] = [];
    }
    symbolIndex[sym.name].push({
      id: sym.id,
      file: sym.file,
      kind: sym.kind,
      isExported: sym.isExported,
      line: sym.startLine,
    });

    // Component hierarchy
    if (sym.kind === "COMPONENT") {
      componentTree[sym.name] = {
        file: relPath,
        children: Array.from(referencedComponents),
      };
      for (const child of referencedComponents) {
        edges.push({
          source: sym.id,
          target: `component:${child}`,
          type: "RENDERS",
        });
      }
    }
  }

  nodes.push(fileNode);
}

// Compute importedBy inverse index
for (const [filePath, data] of Object.entries(fileIndex)) {
  for (const imp of data.imports) {
    if (fileIndex[imp]) {
      fileIndex[imp].importedBy.push(filePath);
    }
  }
}

// Summary statistics
const stats = {
  totalFiles: allFiles.length,
  totalSymbols: Object.keys(symbolIndex).length,
  totalRoutes: Object.keys(routeIndex).length,
  totalEdges: edges.length,
  generatedAt: new Date().toISOString(),
};

const codeGraphPayload = {
  version: "1.0.0",
  project: "music-tool",
  stats,
  nodes,
  edges,
  indices: {
    symbolIndex,
    fileIndex,
    routeIndex,
    componentTree,
  },
};

// Write machine-readable JSON
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(codeGraphPayload, null, 2), "utf-8");
console.log(`✅ CodeGraph JSON saved to: ${OUTPUT_JSON}`);

// Generate Markdown Knowledge Graph for Agents & LLMs
const markdown = `# Project CodeGraph: music_tool-nextJS

> **Version:** 1.0.0 · **Generated:** ${stats.generatedAt}  
> **Total Files:** ${stats.totalFiles} · **Total Symbols:** ${stats.totalSymbols} · **API Routes:** ${stats.totalRoutes} · **Graph Edges:** ${stats.totalEdges}

---

## 🗺️ Architectural Topology & Component Hierarchy

\`\`\`mermaid
graph TD
    subgraph "App Pages & Layouts"
        ROOT_PAGE["/ (Landing)"]
        STUDIO_PAGE["/song-studio"]
        DAW_PAGE["/daw"]
        TAB_PAGE["/tab-studio"]
        HELPERS_PAGE["/musician-helpers"]
        PROGRESSION_PAGE["/progressions"]
        THEORY_PAGE["/theory-lab"]
        TOOLKIT_PAGE["/music-toolkit"]
    end

    subgraph "Interactive UI Components"
        TAB_CLIENT["TabStudioClient<br/>(MIDI multi-track, tunings, fretboard)"]
        HELPERS_CLIENT["HelpersClient<br/>(Pro Metronome, Tuner)"]
        SONG_CLIENT["SongStudioClient"]
        DAW_CLIENT["DawClient"]
        AUDIO_PROV["AudioProvider"]
    end

    subgraph "Core Music Libraries (Domain Logic)"
        TUNINGS["lib/music/tunings.ts<br/>(Guitar & Bass Tunings)"]
        METRONOME_SND["lib/music/metronome-sound.ts<br/>(Sound Synthesizer)"]
        MIDI_PARSER["lib/music/midi-parser.ts<br/>(SMF parser, tracks, PPQ)"]
        PITCH["lib/music/pitch.ts<br/>(Autocorrelation tuner)"]
        SYNTH["lib/music/instrument-synth.ts"]
        NOTES["lib/music/notes.ts"]
        CLIENT_API["lib/music/client.ts"]
    end

    subgraph "Database & Persistence (Turso LibSQL)"
        DB["lib/music/db.ts<br/>(Songs, Parts, Partitures, Templates)"]
        TURSO_DB[("Turso / LibSQL Database")]
    end

    subgraph "Next.js API Route Handlers"
        API_SONGS["/api/music/songs"]
        API_PARTS["/api/music/songs/[id]/parts"]
        API_PARTITURES["/api/music/songs/[id]/partitures"]
        API_TEMPLATES["/api/music/templates"]
        API_AUTH["/api/auth/*"]
    end

    TAB_PAGE --> TAB_CLIENT
    HELPERS_PAGE --> HELPERS_CLIENT
    STUDIO_PAGE --> SONG_CLIENT
    DAW_PAGE --> DAW_CLIENT

    TAB_CLIENT --> TUNINGS
    TAB_CLIENT --> MIDI_PARSER
    TAB_CLIENT --> METRONOME_SND
    TAB_CLIENT --> CLIENT_API

    HELPERS_CLIENT --> TUNINGS
    HELPERS_CLIENT --> METRONOME_SND
    HELPERS_CLIENT --> PITCH
    HELPERS_CLIENT --> SYNTH

    CLIENT_API --> API_SONGS
    CLIENT_API --> API_PARTITURES

    API_SONGS --> DB
    API_PARTITURES --> DB
    DB --> TURSO_DB
\`\`\`

---

## 📡 API Routes Catalog

| HTTP Method | Route URL | Handler File | Description / Domain |
| :--- | :--- | :--- | :--- |
${Object.entries(routeIndex)
  .map(
    ([url, data]) =>
      `| \`${data.methods.join(", ")}\` | \`${url}\` | [\`${data.file}\`](file://${ROOT_DIR}/${data.file}) | App Router Route Handler |`
  )
  .join("\n")}

---

## 🎸 Key Domain Modules & Libraries

| Module Path | Primary Symbols / Responsibilities | Key Importers |
| :--- | :--- | :--- |
| [\`src/lib/music/tunings.ts\`](file://${ROOT_DIR}/src/lib/music/tunings.ts) | \`GUITAR_TUNINGS\`, \`BASS_TUNINGS\`, \`findClosestString\`, \`centsFromTarget\` | \`helpers-client.tsx\`, \`tab-studio-client.tsx\` |
| [\`src/lib/music/metronome-sound.ts\`](file://${ROOT_DIR}/src/lib/music/metronome-sound.ts) | \`playMetronomeSound\`, \`MetronomeSoundType\` (Digital, Woodblock, Cowbell, Mechanical, Rimshot) | \`helpers-client.tsx\`, \`tab-studio-client.tsx\` |
| [\`src/lib/music/midi-parser.ts\`](file://${ROOT_DIR}/src/lib/music/midi-parser.ts) | \`parseMidiFile\`, \`parseMidi\`, \`MidiNote\`, \`MidiTrackData\` | \`tab-studio-client.tsx\`, \`daw-client.tsx\` |
| [\`src/lib/music/pitch.ts\`](file://${ROOT_DIR}/src/lib/music/pitch.ts) | \`detectPitchAutocorrelation\`, \`PitchDetection\` | \`helpers-client.tsx\` |
| [\`src/lib/music/db.ts\`](file://${ROOT_DIR}/src/lib/music/db.ts) | \`getSongById\`, \`createSongRecord\`, \`fetchPartitures\`, Turso CRUD | API Route Handlers |

---

## 🔍 CodeGraph Agent Query CLI Reference

Agents and LLMs can query the CodeGraph directly via command line:

\`\`\`bash
# Lookup symbol definition and callers
npm run codegraph:query -- symbol playMetronomeSound

# Inspect file dependencies and exported symbols
npm run codegraph:query -- file src/components/music/tab-studio-client.tsx

# List all API routes and methods
npm run codegraph:query -- routes

# Re-generate CodeGraph after code edits
npm run codegraph
\`\`\`
`;

fs.writeFileSync(OUTPUT_MD, markdown, "utf-8");
console.log(`✅ CodeGraph Markdown saved to: ${OUTPUT_MD}`);
