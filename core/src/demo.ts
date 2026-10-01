import { GraphStore } from "./graph.ts";
import { timeline, causalAncestors, openRecommendations, unaddressedFactors } from "./analysis.ts";

const g = new GraphStore();
const H = { source: "human" as const };
const occ = g.addNode("Occurrence", "Illustrative SPAD, junction X", H, { class: "serious_incident" });
const ev = g.addNode("Evidence", "Driver interview (fictional)", H);
const e1 = g.addNode("Event", "Train approaches signal at danger", H);
const e2 = g.addNode("Event", "Signal passed at danger", H);
const cf = g.addNode("CausalFactor", "Signal sighted late due to vegetation", H, { level: "direct" });
const sys = g.addNode("CausalFactor", "No vegetation inspection regime", H, { level: "systemic" });
const rec = g.addNode("Recommendation", "Introduce sighting-inspection regime", H);
for (const e of [e1, e2]) g.addEdge("PART_OF", e.id, occ.id, H);
g.addEdge("PRECEDES", e1.id, e2.id, H);
g.addEdge("CAUSED", cf.id, e2.id, { ...H, evidenceId: ev.id });
g.addEdge("CAUSED", sys.id, cf.id, { ...H, evidenceId: ev.id });
g.addEdge("ADDRESSES", rec.id, sys.id, H);
// An AI suggestion stays out of analysis until a human accepts it.
g.addNode("CausalFactor", "Driver fatigue (AI suggestion)", { source: "ai", confidence: 0.4, citation: "p.12" });

console.log("Timeline:", timeline(g, occ.id).map(n => n.label));
console.log("Why SPAD:", causalAncestors(g, e2.id).map(a => `${a.depth}: ${a.node.label}`));
console.log("Open recs:", openRecommendations(g).map(r => r.label));
console.log("Unaddressed factors:", unaddressedFactors(g).map(f => f.label));
console.log("Pending review:", g.pending().nodes.length);
