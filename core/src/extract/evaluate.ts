import type { GraphStore } from "../graph.ts";

/** Hand-labelled reference for one report. Edges refer to nodes by label. */
export interface Gold {
  nodes: { type: string; label: string }[];
  edges: { type: string; from: string; to: string }[];
}
export interface Score { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number }

const STOP = new Set(["the", "was", "were", "and", "for", "with", "that", "had", "has", "from", "its"]);
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "").replace(/(.)\1$/, "$1");
const tokens = (s: string) =>
  new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem));
/** Fuzzy label match: Jaccard similarity of word sets >= threshold. */
export function similar(a: string, b: string, threshold = 0.5): boolean {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return false;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter) >= threshold;
}

function score(tp: number, predicted: number, gold: number): Score {
  const fp = predicted - tp, fn = gold - tp;
  const precision = predicted ? tp / predicted : 0, recall = gold ? tp / gold : 0;
  return { tp, fp, fn, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
}

/** Greedy one-to-one matching of predicted to gold items. */
function match<P, G>(pred: P[], gold: G[], eq: (p: P, g: G) => boolean): number {
  const used = new Set<number>(); let tp = 0;
  for (const p of pred) {
    const i = gold.findIndex((g, k) => !used.has(k) && eq(p, g));
    if (i >= 0) { used.add(i); tp++; }
  }
  return tp;
}

/**
 * Score what the AI *proposed* (status proposed or accepted, AI-sourced) against gold.
 * Causal edges are reported separately: they carry the most risk.
 */
export function evaluate(g: GraphStore, gold: Gold) {
  const rows = (t: string) => g.db.prepare(t).all() as any[];
  const nodes = rows("SELECT id,type,label FROM nodes WHERE json_extract(provenance,'$.source')='ai' AND status!='rejected'");
  const label = new Map(nodes.map(n => [n.id, n.label as string]));
  const edges = rows("SELECT type,src,dst FROM edges WHERE json_extract(provenance,'$.source')='ai' AND status!='rejected'")
    .filter(e => label.has(e.src) && label.has(e.dst))
    .map(e => ({ type: e.type as string, from: label.get(e.src)!, to: label.get(e.dst)! }));

  const nodeEq = (p: any, q: any) => p.type === q.type && similar(p.label, q.label);
  const edgeEq = (p: any, q: any) => p.type === q.type && similar(p.from, q.from) && similar(p.to, q.to);
  const isCausal = (e: { type: string }) => e.type === "CAUSED" || e.type === "CONTRIBUTED_TO";

  return {
    nodes: score(match(nodes, gold.nodes, nodeEq), nodes.length, gold.nodes.length),
    edges: score(match(edges, gold.edges, edgeEq), edges.length, gold.edges.length),
    causalEdges: score(match(edges.filter(isCausal), gold.edges.filter(isCausal), edgeEq),
      edges.filter(isCausal).length, gold.edges.filter(isCausal).length),
  };
}
