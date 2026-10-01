import { test } from "node:test";
import assert from "node:assert/strict";
import { GraphStore } from "../src/graph.ts";
import { timeline } from "../src/analysis.ts";

const H = { source: "human" as const };

test("updateNode edits, logs before/after, and keeps AI items unaccepted", () => {
  const g = new GraphStore();
  const n = g.addNode("Event", "old", H);
  g.updateNode(n.id, { label: "  new  " }, "inv");
  assert.equal(g.getNode(n.id)!.label, "new");
  const a: any = g.auditTrail().at(-1);
  assert.equal(a.action, "edit_node");
  assert.equal(JSON.parse(a.detail).before.label, "old");
  const ai = g.addNode("Event", "ai", { source: "ai" });
  g.updateNode(ai.id, { label: "ai fixed" }, "inv");
  assert.equal(g.getNode(ai.id)!.status, "proposed");
  assert.throws(() => g.updateNode(n.id, { label: " " }, "inv"), /label required/);
});

test("remove is soft, cascades to edges, and drops item from analysis", () => {
  const g = new GraphStore();
  const o = g.addNode("Occurrence", "o", H), a = g.addNode("Event", "a", H), b = g.addNode("Event", "b", H);
  for (const e of [a, b]) g.addEdge("PART_OF", e.id, o.id, H);
  g.addEdge("PRECEDES", a.id, b.id, H);
  g.remove("node", a.id, "inv");
  assert.deepEqual(timeline(g, o.id).map(n => n.label), ["b"]);
  assert.equal(g.allNodes().length, 2);
  assert.equal(g.allEdges().length, 1);
  assert.throws(() => g.updateNode(a.id, { label: "x" }, "inv"), /removed/);
  const last: any = g.auditTrail().at(-1);
  assert.equal(last.action, "remove_node");
  assert.equal(JSON.parse(last.detail).edgesRemoved.length, 2);
});

test("self-links and timeline cycles are refused at creation", () => {
  const g = new GraphStore();
  const a = g.addNode("Event", "a", H), b = g.addNode("Event", "b", H), c = g.addNode("Event", "c", H);
  assert.throws(() => g.addEdge("CAUSED", a.id, a.id, { ...H, citation: "p.1" }), /itself/);
  g.addEdge("PRECEDES", a.id, b.id, H); g.addEdge("PRECEDES", b.id, c.id, H);
  assert.throws(() => g.addEdge("PRECEDES", c.id, a.id, H), /cycle/);
  g.remove("node", b.id, "inv");            // path a→b→c is gone, so c→a is now fine
  g.addEdge("PRECEDES", c.id, a.id, H);
});

test("saveCopy writes a consistent, independent copy of the case", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "rail-"));
  try {
    const g = new GraphStore();
    const n = g.addNode("Event", "kept", H);
    g.updateNode(n.id, { label: "kept v2" }, "inv");
    g.saveCopy(join(dir, "copy.db"));
    g.addNode("Event", "added after copy", H);
    const copy = new GraphStore(join(dir, "copy.db"));
    assert.deepEqual(copy.allNodes().map(x => x.label), ["kept v2"]);
    assert.ok(copy.auditTrail().some((a: any) => a.action === "edit_node"));   // audit trail travels with the case
    copy.close();
    g.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
