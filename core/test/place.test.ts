import { test } from "node:test";
import assert from "node:assert/strict";
import { GraphStore } from "../src/graph.ts";
import { timeline } from "../src/analysis.ts";
import { placeEvent } from "../src/timeline.ts";

const H = { source: "human" as const };
const setup = (labels: string[]) => {
  const g = new GraphStore(), o = g.addNode("Occurrence", "o", H);
  const ev = labels.map(l => g.addNode("Event", l, H));
  ev.forEach(e => placeEvent(g, e.id, o.id, "end", "t"));
  return { g, o, ev };
};
const order = (g: GraphStore, id: string) => timeline(g, id).map(n => n.label);

test("end appends; first event just attaches", () => {
  const { g, o } = setup(["a", "b", "c"]);
  assert.deepEqual(order(g, o.id), ["a", "b", "c"]);
});

test("insert after a middle event keeps the rest in order", () => {
  const { g, o, ev } = setup(["a", "b", "c"]);
  const x = g.addNode("Event", "x", H);
  placeEvent(g, x.id, o.id, ev[0].id, "t");
  assert.deepEqual(order(g, o.id), ["a", "x", "b", "c"]);
});

test("start inserts before the current first event", () => {
  const { g, o } = setup(["a", "b"]);
  const x = g.addNode("Event", "x", H);
  placeEvent(g, x.id, o.id, "start", "t");
  assert.deepEqual(order(g, o.id), ["x", "a", "b"]);
});

test("moving an existing event re-links neighbours", () => {
  const { g, o, ev } = setup(["a", "b", "c", "d"]);
  placeEvent(g, ev[0].id, o.id, ev[2].id, "t");          // move a after c
  assert.deepEqual(order(g, o.id), ["b", "c", "a", "d"]);
  placeEvent(g, ev[3].id, o.id, "start", "t");           // move d to start
  assert.deepEqual(order(g, o.id), ["d", "b", "c", "a"]);
  placeEvent(g, ev[1].id, o.id, "end", "t");             // move b to end
  assert.deepEqual(order(g, o.id), ["d", "c", "a", "b"]);
});

test("bad input rolls back and leaves the timeline untouched", () => {
  const { g, o, ev } = setup(["a", "b"]);
  assert.throws(() => placeEvent(g, ev[0].id, o.id, ev[0].id, "t"), /itself/);
  assert.throws(() => placeEvent(g, ev[0].id, o.id, "nope", "t"), /not in this occurrence/);
  const o2 = g.addNode("Occurrence", "o2", H);
  assert.throws(() => placeEvent(g, ev[0].id, o2.id, "end", "t"), /different occurrence/);
  assert.deepEqual(order(g, o.id), ["a", "b"]);
});
