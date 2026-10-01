import { NODE_TYPES, EDGE_TYPES, type NodeType, type EdgeType } from "../ontology.ts";
import { GraphStore } from "../graph.ts";
import type { Chunk } from "./ingest.ts";

/** Shape the LLM must return for each chunk. `ref` is a local id used by edges. */
export interface Proposal {
  nodes: { ref: string; type: string; label: string; props?: Record<string, unknown>; confidence?: number }[];
  edges: { type: string; from: string; to: string; confidence?: number }[];
}

/** Pluggable model backend (local or cloud). Must return JSON text. */
export interface LLM { complete(system: string, user: string): Promise<string> }

export const SYSTEM_PROMPT = `You extract structured railway-investigation facts from a passage.
Return ONLY JSON: {"nodes":[{"ref","type","label","props"?,"confidence"}],"edges":[{"type","from","to","confidence"}]}.
Node types: ${NODE_TYPES.join(", ")}.
Edge types: ${EDGE_TYPES.join(", ")}.
Rules: use only facts stated in the passage; never invent causes; use CAUSED/CONTRIBUTED_TO only when
the passage explicitly states the causal link; confidence in 0..1; people by role, not name.`;

export interface ExtractResult { addedNodes: number; addedEdges: number; rejected: string[] }

/** Parse and validate model output; tolerate code fences. Throws on non-JSON. */
export function parseProposal(raw: string): Proposal {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const p = JSON.parse((m ? m[1] : raw).trim());
  if (!Array.isArray(p.nodes) || !Array.isArray(p.edges)) throw new Error("proposal must have nodes[] and edges[]");
  return p;
}

/**
 * Run extraction on one chunk. Everything lands as `proposed` with the chunk's
 * citation; invalid items are skipped and reported, never silently accepted.
 */
export async function extractChunk(g: GraphStore, llm: LLM, chunk: Chunk): Promise<ExtractResult> {
  const res: ExtractResult = { addedNodes: 0, addedEdges: 0, rejected: [] };
  let p: Proposal;
  try { p = parseProposal(await llm.complete(SYSTEM_PROMPT, chunk.text)); }
  catch (e) { res.rejected.push(`${chunk.citation}: ${(e as Error).message}`); return res; }

  const refs = new Map<string, string>();
  for (const n of p.nodes) {
    if (!(NODE_TYPES as readonly string[]).includes(n.type)) { res.rejected.push(`${chunk.citation}: node type ${n.type}`); continue; }
    const node = g.addNode(n.type as NodeType, n.label, { source: "ai", citation: chunk.citation, confidence: n.confidence }, n.props ?? {});
    refs.set(n.ref, node.id); res.addedNodes++;
  }
  for (const e of p.edges) {
    const from = refs.get(e.from), to = refs.get(e.to);
    if (!from || !to) { res.rejected.push(`${chunk.citation}: edge ${e.type} has unknown endpoint`); continue; }
    try {
      g.addEdge(e.type as EdgeType, from, to, { source: "ai", citation: chunk.citation, confidence: e.confidence });
      res.addedEdges++;
    } catch (err) { res.rejected.push(`${chunk.citation}: ${(err as Error).message}`); }
  }
  return res;
}

export async function extractDocument(g: GraphStore, llm: LLM, chunks: Chunk[]): Promise<ExtractResult> {
  const total: ExtractResult = { addedNodes: 0, addedEdges: 0, rejected: [] };
  for (const c of chunks) {
    const r = await extractChunk(g, llm, c);
    total.addedNodes += r.addedNodes; total.addedEdges += r.addedEdges; total.rejected.push(...r.rejected);
  }
  return total;
}
