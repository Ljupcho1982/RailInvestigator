import type { GraphStore, GraphNode } from "./graph.ts";

/** Ordered timeline of an occurrence's events (topological over PRECEDES, accepted edges only). */
export function timeline(g: GraphStore, occurrenceId: string): GraphNode[] {
  const ids = g.edges({ type: "PART_OF", to: occurrenceId }).map(e => e.from);
  const set = new Set(ids);
  const prec = g.edges({ type: "PRECEDES" }).filter(e => set.has(e.from) && set.has(e.to));
  const indeg = new Map(ids.map(i => [i, 0]));
  prec.forEach(e => indeg.set(e.to, indeg.get(e.to)! + 1));
  const queue = ids.filter(i => indeg.get(i) === 0), out: string[] = [];
  while (queue.length) {
    const n = queue.shift()!; out.push(n);
    for (const e of prec.filter(p => p.from === n)) {
      indeg.set(e.to, indeg.get(e.to)! - 1);
      if (indeg.get(e.to) === 0) queue.push(e.to);
    }
  }
  if (out.length !== ids.length) throw new Error("timeline contains a cycle");
  return out.map(i => g.getNode(i)!);
}

/** All accepted causal ancestors of a node (what led to it), with the path depth. */
export function causalAncestors(g: GraphStore, nodeId: string): { node: GraphNode; depth: number }[] {
  const causal = [...g.edges({ type: "CAUSED" }), ...g.edges({ type: "CONTRIBUTED_TO" })];
  const seen = new Map<string, number>(), queue: [string, number][] = [[nodeId, 0]];
  while (queue.length) {
    const [cur, d] = queue.shift()!;
    for (const e of causal.filter(c => c.to === cur))
      if (!seen.has(e.from)) { seen.set(e.from, d + 1); queue.push([e.from, d + 1]); }
  }
  return [...seen].map(([id, depth]) => ({ node: g.getNode(id)!, depth })).sort((a, b) => a.depth - b.depth);
}

/** Recommendations with no implementing Action (open loop). */
export function openRecommendations(g: GraphStore): GraphNode[] {
  const done = new Set(g.edges({ type: "IMPLEMENTS" }).map(e => e.to));
  return g.nodesOfType("Recommendation").filter(r => !done.has(r.id));
}

/** Causal factors not addressed by any recommendation. */
export function unaddressedFactors(g: GraphStore): GraphNode[] {
  const addressed = new Set(g.edges({ type: "ADDRESSES" }).map(e => e.to));
  return g.nodesOfType("CausalFactor").filter(f => !addressed.has(f.id));
}
