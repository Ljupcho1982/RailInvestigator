// Usage: node --experimental-sqlite scripts/run-extraction.ts <report.pdf> [gold.json]
// Backend: ANTHROPIC_API_KEY + RAIL_MODEL (cloud, sends text off-device) or RAIL_OLLAMA_MODEL (local).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { GraphStore } from "../core/src/graph.ts";
import { pdfToText } from "../core/src/extract/pdf.ts";
import { chunkDocument } from "../core/src/extract/ingest.ts";
import { extractDocument } from "../core/src/extract/extractor.ts";
import { anthropicLLM, ollamaLLM } from "../core/src/extract/anthropic.ts";
import { evaluate } from "../core/src/extract/evaluate.ts";

const [pdf, goldPath] = process.argv.slice(2);
if (!pdf) { console.error("usage: run-extraction.ts <report.pdf> [gold.json]"); process.exit(1); }
const llm = process.env.RAIL_OLLAMA_MODEL ? ollamaLLM(process.env.RAIL_OLLAMA_MODEL)
  : process.env.ANTHROPIC_API_KEY && process.env.RAIL_MODEL ? anthropicLLM(process.env.ANTHROPIC_API_KEY, process.env.RAIL_MODEL)
  : (console.error("set RAIL_OLLAMA_MODEL (local) or ANTHROPIC_API_KEY + RAIL_MODEL (cloud)"), process.exit(1));

const g = new GraphStore(`${basename(pdf, ".pdf")}.db`);
const chunks = chunkDocument(basename(pdf, ".pdf"), pdfToText(pdf));
console.log(`${chunks.length} chunks`);
const r = await extractDocument(g, llm, chunks);
console.log(`proposed ${r.addedNodes} nodes, ${r.addedEdges} edges; ${r.rejected.length} rejected`);
if (goldPath) console.log(JSON.stringify(evaluate(g, JSON.parse(readFileSync(goldPath, "utf8"))), null, 2));
