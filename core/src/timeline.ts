import type { GraphStore } from "./graph.ts";
import { timeline } from "./analysis.ts";

/** Where to put an event: first, last, or directly after a given event. */
export type Position = "start" | "end" | (string & {});

/**
 * Place (or move) an event within an occurrence's timeline by rewiring PRECEDES edges.
 * - Attaches the event to the occurrence (PART_OF) if it isn't already.
 * - Detaches it from its current position first, bridging its old neighbours.
 * - Inserts it between the anchor event and the anchor's former successors.
 * Runs in one transaction: either the whole move happens or nothing changes.
 */
export function placeEvent(g: GraphStore, eventId: string, occurrenceId: string, position: Position, actor: string) {
  const ev = g.getNode(eventId), occ = g.getNode(occurrenceId);
  if (ev?.type !== "Event") throw new Error("not an Event");
  if (occ?.type !== "Occurrence") throw new Error("not an Occurrence");
  const H = { source: "human" as const };

  g.db.exec("BEGIN");
  try {
    const part = g.edges({ type: "PART_OF", from: eventId });
    if (part.some(e => e.to !== occurrenceId)) throw new Error("event belongs to a different occurrence");
    if (!part.length) g.addEdge("PART_OF", eventId, occurrenceId, H);

    // 1. Detach, bridging old neighbours so the rest of the chain stays connected.
    const preds = g.edges({ type: "PRECEDES", to: eventId }), succs = g.edges({ type: "PRECEDES", from: eventId });
    [...preds, ...succs].forEach(e => g.remove("edge", e.id, actor));
    for (const p of preds) for (const s of succs) g.addEdge("PRECEDES", p.from, s.to, H);

    // 2. Resolve the anchor on the timeline without this event.
    const order = timeline(g, occurrenceId).filter(n => n.id !== eventId);
    let anchor: string | null;
    if (position === "start") anchor = null;
    else if (position === "end") anchor = order.length ? order[order.length - 1].id : null;
    else {
      if (position === eventId) throw new Error("cannot place an event after itself");
      if (!order.some(n => n.id === position)) throw new Error("anchor event is not in this occurrence");
      anchor = position;
    }

    // 3. Insert: anchor -> event -> (anchor's former successors | former first events).
    let next: string[];
    if (anchor) {
      const out = g.edges({ type: "PRECEDES", from: anchor });
      out.forEach(e => g.remove("edge", e.id, actor));
      next = out.map(e => e.to);
      g.addEdge("PRECEDES", anchor, eventId, H);
    } else {
      const inbound = new Set(g.edges({ type: "PRECEDES" }).map(e => e.to));
      next = order.filter(n => !inbound.has(n.id)).map(n => n.id);   // current heads
    }
    next.forEach(id => g.addEdge("PRECEDES", eventId, id, H));
    g.db.exec("COMMIT");
  } catch (e) {
    g.db.exec("ROLLBACK");
    throw e;
  }
}
