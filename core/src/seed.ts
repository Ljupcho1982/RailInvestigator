import { GraphStore } from "./graph.ts";

/** Fictional demo investigation (not a real occurrence). Includes AI proposals awaiting review. */
export function buildDemo(g: GraphStore) {
  const H = { source: "human" as const };
  const occ = g.addNode("Occurrence", "Illustrative SPAD, junction X (fictional)", H, { class: "serious_incident" });
  const ev = g.addNode("Evidence", "Driver interview (fictional)", H);
  const e1 = g.addNode("Event", "Train approaches signal at danger", H);
  const e2 = g.addNode("Event", "Signal passed at danger", H);
  const e3 = g.addNode("Event", "Train stops 120 m beyond signal", H);
  const cf = g.addNode("CausalFactor", "Signal sighted late due to vegetation", H, { level: "direct" });
  const sys = g.addNode("CausalFactor", "No vegetation inspection regime", H, { level: "systemic" });
  const rec = g.addNode("Recommendation", "Introduce sighting-inspection regime", H);
  for (const e of [e1, e2, e3]) g.addEdge("PART_OF", e.id, occ.id, H);
  g.addEdge("PRECEDES", e1.id, e2.id, H);
  g.addEdge("PRECEDES", e2.id, e3.id, H);
  g.addEdge("CAUSED", cf.id, e2.id, { ...H, evidenceId: ev.id });
  g.addEdge("CAUSED", sys.id, cf.id, { ...H, evidenceId: ev.id });
  g.addEdge("ADDRESSES", rec.id, sys.id, H);
  const AI = { source: "ai" as const, confidence: 0.4, citation: "demo-report p.12 §2" };
  const fat = g.addNode("CausalFactor", "Driver fatigue", AI, { level: "contributory" });
  g.addEdge("CONTRIBUTED_TO", fat.id, e2.id, AI);
  g.addNode("Condition", "Low sun at approach", { ...AI, confidence: 0.85, citation: "demo-report p.4 §1" });
  return { occ, e1, e2, e3, cf, sys, rec, fat };
}
