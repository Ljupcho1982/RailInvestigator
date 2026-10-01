import { GraphStore } from "./graph.ts";
import { buildDemo } from "./seed.ts";
import { timeline, causalAncestors, openRecommendations, unaddressedFactors } from "./analysis.ts";

const g = new GraphStore();
const { occ, e2 } = buildDemo(g);
console.log("Timeline:", timeline(g, occ.id).map(n => n.label));
console.log("Why SPAD:", causalAncestors(g, e2.id).map(a => `${a.depth}: ${a.node.label}`));
console.log("Open recs:", openRecommendations(g).map(r => r.label));
console.log("Unaddressed factors:", unaddressedFactors(g).map(f => f.label));
console.log("Pending review:", g.pending().nodes.length, "nodes,", g.pending().edges.length, "edges");
