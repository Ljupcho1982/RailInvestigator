import { test } from "node:test";
import assert from "node:assert/strict";
import { GraphStore } from "../src/graph.ts";
import { chunkDocument } from "../src/extract/ingest.ts";
import { extractDocument, parseProposal, type LLM } from "../src/extract/extractor.ts";

test("chunking keeps page numbers and citations", () => {
  const c = chunkDocument("rep", "A\n\nB\fC", 10);
  assert.deepEqual(c.map(x => x.citation), ["rep p.1 §1", "rep p.2 §1"]);
});

test("parseProposal accepts fenced JSON and rejects junk", () => {
  assert.equal(parseProposal('```json\n{"nodes":[],"edges":[]}\n```').nodes.length, 0);
  assert.throws(() => parseProposal("sorry"));
});

test("extraction creates only proposed items and reports invalid ones", async () => {
  const llm: LLM = { complete: async () => JSON.stringify({
    nodes: [
      { ref: "a", type: "CausalFactor", label: "Vegetation", confidence: 0.8 },
      { ref: "b", type: "Event", label: "SPAD" },
      { ref: "c", type: "Spaceship", label: "bad" },
    ],
    edges: [
      { type: "CAUSED", from: "a", to: "b" },       // ok: has citation from chunk
      { type: "PART_OF", from: "a", to: "b" },      // invalid type pair
      { type: "CAUSED", from: "a", to: "zzz" },     // unknown ref
    ] }) };
  const g = new GraphStore();
  const r = await extractDocument(g, llm, chunkDocument("rep", "text"));
  assert.equal(r.addedNodes, 2); assert.equal(r.addedEdges, 1); assert.equal(r.rejected.length, 3);
  assert.equal(g.pending().nodes.length, 2);
  assert.equal(g.nodesOfType("CausalFactor").length, 0);   // nothing accepted yet
  assert.equal(g.pending().edges[0].provenance.citation, "rep p.1 §1");
});

test("malformed model output is reported, not thrown", async () => {
  const g = new GraphStore();
  const r = await extractDocument(g, { complete: async () => "nope" }, chunkDocument("rep", "x"));
  assert.equal(r.rejected.length, 1);
});
