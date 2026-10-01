import { test } from "node:test";
import assert from "node:assert/strict";
import { GraphStore } from "../src/graph.ts";
import { evaluate, similar } from "../src/extract/evaluate.ts";

const AI = { source: "ai" as const, citation: "x" };

test("similar matches reworded labels but not unrelated ones", () => {
  assert.ok(similar("Signal passed at danger", "signal was passed at danger"));
  assert.ok(!similar("Vegetation growth", "Brake failure"));
});

test("evaluate scores precision/recall, causal separately", () => {
  const g = new GraphStore();
  const a = g.addNode("CausalFactor", "Vegetation obscured signal", AI);
  const b = g.addNode("Event", "Signal passed at danger", AI);
  const c = g.addNode("Event", "Hallucinated derailment", AI);
  g.addEdge("CAUSED", a.id, b.id, AI);
  g.addEdge("CAUSED", a.id, c.id, AI);
  const r = evaluate(g, {
    nodes: [{ type: "CausalFactor", label: "vegetation obscuring the signal" }, { type: "Event", label: "signal passed at danger" }, { type: "Event", label: "train stops" }],
    edges: [{ type: "CAUSED", from: "vegetation obscuring the signal", to: "signal passed at danger" }],
  });
  assert.deepEqual([r.nodes.tp, r.nodes.fp, r.nodes.fn], [2, 1, 1]);
  assert.equal(r.causalEdges.precision, 0.5);
  assert.equal(r.causalEdges.recall, 1);
});

test("rejected and human items are excluded from scoring", () => {
  const g = new GraphStore();
  g.addNode("Event", "human event", { source: "human" });
  const x = g.addNode("Event", "ai event", AI); g.review("node", x.id, "rejected", "inv");
  assert.equal(evaluate(g, { nodes: [], edges: [] }).nodes.fp, 0);
});
