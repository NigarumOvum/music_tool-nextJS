#!/usr/bin/env node

/**
 * CodeGraph Query CLI for LLMs & AI Agents
 * Fast zero-overhead querying of symbols, files, routes, and dependency relationships.
 *
 * Usage:
 *   node scripts/query-codegraph.mjs symbol <SymbolName>
 *   node scripts/query-codegraph.mjs file <FilePath>
 *   node scripts/query-codegraph.mjs routes
 *   node scripts/query-codegraph.mjs callers <SymbolName>
 *   node scripts/query-codegraph.mjs stats
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const GRAPH_FILE = path.resolve(ROOT_DIR, "codegraph.json");

if (!fs.existsSync(GRAPH_FILE)) {
  console.error("❌ codegraph.json not found. Run 'npm run codegraph' first.");
  process.exit(1);
}

const graph = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf-8"));
const [,, command, query] = process.argv;

if (!command) {
  console.log(`
CodeGraph Query Tool for LLMs & Agents:

Commands:
  symbol <Name>     Find definition, line numbers, kind, and files for a symbol
  file <Path>       Inspect a file's exported symbols, imports, and importers
  routes            List all Next.js App Router API endpoints and methods
  callers <Symbol>  Find all files/nodes that reference or import a symbol
  stats             Display overall repository graph metrics
`);
  process.exit(0);
}

switch (command.toLowerCase()) {
  case "symbol": {
    if (!query) {
      console.error("Usage: node query-codegraph.mjs symbol <Name>");
      process.exit(1);
    }
    const matches = graph.indices.symbolIndex[query];
    if (!matches || matches.length === 0) {
      // Partial matching
      const partials = Object.keys(graph.indices.symbolIndex).filter((k) =>
        k.toLowerCase().includes(query.toLowerCase())
      );
      if (partials.length > 0) {
        console.log(`🔍 No exact match for '${query}'. Did you mean:`);
        partials.slice(0, 10).forEach((p) => console.log(`  - ${p}`));
      } else {
        console.log(`❌ Symbol '${query}' not found in CodeGraph.`);
      }
      process.exit(0);
    }

    console.log(`\n📌 Symbol: ${query}`);
    matches.forEach((m) => {
      console.log(`  • Kind: ${m.kind}`);
      console.log(`    File: ${m.file}:${m.line}`);
      console.log(`    Exported: ${m.isExported ? "Yes" : "No"}`);
    });

    // Find incoming edges/references
    const incomingEdges = graph.edges.filter(
      (e) =>
        e.metadata?.symbols?.includes(query) ||
        (e.target.includes(query) && e.type !== "DEFINES")
    );
    if (incomingEdges.length > 0) {
      console.log(`\n  🔗 Referenced By:`);
      incomingEdges.forEach((e) => console.log(`    <- ${e.source} (${e.type})`));
    }
    console.log("");
    break;
  }

  case "file": {
    if (!query) {
      console.error("Usage: node query-codegraph.mjs file <Path>");
      process.exit(1);
    }
    const normalized = query.replace(/^\.\//, "").replace(/^\//, "");
    const fileData =
      graph.indices.fileIndex[normalized] ||
      Object.entries(graph.indices.fileIndex).find(([k]) => k.includes(normalized))?.[1];

    if (!fileData) {
      console.log(`❌ File '${query}' not found in CodeGraph.`);
      process.exit(0);
    }

    console.log(`\n📄 File: ${normalized}`);
    console.log(`  Category: ${fileData.category}`);
    console.log(`\n  📦 Symbols Defined (${fileData.symbols.length}):`);
    fileData.symbols.forEach((s) =>
      console.log(`    • [${s.kind}] ${s.name}${s.isExported ? " (export)" : ""}`)
    );

    console.log(`\n  📥 Imports (${fileData.imports.length}):`);
    fileData.imports.forEach((imp) => console.log(`    -> ${imp}`));

    console.log(`\n  📤 Imported By (${fileData.importedBy.length}):`);
    fileData.importedBy.forEach((by) => console.log(`    <- ${by}`));
    console.log("");
    break;
  }

  case "callers": {
    if (!query) {
      console.error("Usage: node query-codegraph.mjs callers <SymbolName>");
      process.exit(1);
    }
    const callers = graph.edges.filter(
      (e) =>
        e.metadata?.symbols?.includes(query) ||
        (e.target.includes(query) && e.type !== "DEFINES")
    );
    if (callers.length === 0) {
      console.log(`❌ No callers or references found for '${query}'.`);
    } else {
      console.log(`\n🔗 Callers / References for '${query}' (${callers.length}):`);
      const uniqueSources = [...new Set(callers.map((e) => e.source))];
      uniqueSources.forEach((src) => {
        const edge = callers.find((e) => e.source === src);
        console.log(`  <- ${src} (${edge.type})`);
      });
      console.log("");
    }
    break;
  }

  case "search": {
    if (!query) {
      console.error("Usage: node query-codegraph.mjs search <keyword>");
      process.exit(1);
    }
    const q = query.toLowerCase();
    const matchingSymbols = Object.keys(graph.indices.symbolIndex).filter((k) =>
      k.toLowerCase().includes(q)
    );
    const matchingFiles = Object.keys(graph.indices.fileIndex).filter((k) =>
      k.toLowerCase().includes(q)
    );
    console.log(`\n🔎 Search results for '${query}':`);
    console.log(`  Matching Files (${matchingFiles.length}):`);
    matchingFiles.slice(0, 15).forEach((f) => console.log(`    📄 ${f}`));
    console.log(`\n  Matching Symbols (${matchingSymbols.length}):`);
    matchingSymbols.slice(0, 15).forEach((s) => console.log(`    📌 ${s}`));
    console.log("");
    break;
  }

  case "deps": {
    if (!query) {
      console.error("Usage: node query-codegraph.mjs deps <Path>");
      process.exit(1);
    }
    const normalized = query.replace(/^\.\//, "").replace(/^\//, "");
    const outgoing = graph.edges.filter((e) => e.source.includes(normalized) && e.type === "IMPORTS");
    const incoming = graph.edges.filter((e) => e.target.includes(normalized) && e.type === "IMPORTS");
    console.log(`\n🕸️ Dependency graph for '${normalized}':`);
    console.log(`  Dependencies (${outgoing.length}):`);
    outgoing.forEach((e) => console.log(`    -> ${e.target}`));
    console.log(`  Dependents (${incoming.length}):`);
    incoming.forEach((e) => console.log(`    <- ${e.source}`));
    console.log("");
    break;
  }

  case "routes": {
    console.log(`\n📡 API Routes (${Object.keys(graph.indices.routeIndex).length}):\n`);
    for (const [url, data] of Object.entries(graph.indices.routeIndex)) {
      console.log(`  • [${data.methods.join(", ")}] ${url} -> ${data.file}`);
    }
    console.log("");
    break;
  }

  case "stats": {
    console.log("\n📊 CodeGraph Stats:");
    console.log(`  Total Files:      ${graph.stats.totalFiles}`);
    console.log(`  Total Symbols:    ${graph.stats.totalSymbols}`);
    console.log(`  API Routes:       ${graph.stats.totalRoutes}`);
    console.log(`  Graph Edges:      ${graph.stats.totalEdges}`);
    console.log(`  Generated At:     ${graph.stats.generatedAt}\n`);
    break;
  }

  default:
    console.error(`Unknown command: '${command}'. Use symbol, file, routes, callers, search, deps, or stats.`);
}

