import { test } from "node:test";
import assert from "node:assert/strict";
import { GraphStore } from "../src/graph.ts";
import { timeline, causalAncestors, openRecommendations, unaddressedFactors } from "../src/analysis.ts";

const H = { source: "human" as const };

test("edge rules reject invalid type pairs", () => {
  const g = new GraphStore();
  const a = g.addNode("Person", "Driver", H), b = g.addNode("Occurrence", "O", H);
  assert.throws(() => g.addEdge("PART_OF", a.id, b.id, H), /not allowed/);
});

test("causal edges require evidence or citation", () => {
  const g = new GraphStore();
  const c = g.addNode("CausalFactor", "c", H), e = g.addNode("Event", "e", H);
  assert.throws(() => g.addEdge("CAUSED", c.id, e.id, H), /requires evidence/);
  g.addEdge("CAUSED", c.id, e.id, { ...H, citation: "p.1" });
});

test("AI items are proposed and excluded until accepted", () => {
  const g = new GraphStore();
  const f = g.addNode("CausalFactor", "ai factor", { source: "ai", confidence: 0.5 });
  assert.equal(f.status, "proposed");
  assert.equal(unaddressedFactors(g).length, 0);
  g.review("node", f.id, "accepted", "investigator-1");
  assert.equal(unaddressedFactors(g).length, 1);
  assert.ok(g.auditTrail().some((a: any) => a.action === "accepted_node"));
});

test("timeline orders events and refuses cycles", () => {
  const g = new GraphStore();
  const o = g.addNode("Occurrence", "o", H);
  const [a, b, c] = ["a", "b", "c"].map(l => g.addNode("Event", l, H));
  for (const e of [c, a, b]) g.addEdge("PART_OF", e.id, o.id, H);
  g.addEdge("PRECEDES", a.id, b.id, H); g.addEdge("PRECEDES", b.id, c.id, H);
  assert.deepEqual(timeline(g, o.id).map(n => n.label), ["a", "b", "c"]);
  assert.throws(() => g.addEdge("PRECEDES", c.id, a.id, H), /cycle/);
});

test("causal ancestors and open recommendations", () => {
  const g = new GraphStore();
  const ev = g.addNode("Evidence", "ev", H);
  const e = g.addNode("Event", "e", H), f = g.addNode("CausalFactor", "f", H), s = g.addNode("CausalFactor", "s", H);
  g.addEdge("CAUSED", f.id, e.id, { ...H, evidenceId: ev.id });
  g.addEdge("CAUSED", s.id, f.id, { ...H, evidenceId: ev.id });
  assert.deepEqual(causalAncestors(g, e.id).map(a => a.node.label), ["f", "s"]);
  const r = g.addNode("Recommendation", "r", H);
  assert.equal(openRecommendations(g).length, 1);
  const act = g.addNode("Action", "a", H);
  g.addEdge("IMPLEMENTS", act.id, r.id, H);
  assert.equal(openRecommendations(g).length, 0);
});
