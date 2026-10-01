// Local API + static UI. Binds to 127.0.0.1 only — evidence never leaves the machine.
// Usage: node --experimental-sqlite app/server.ts [investigation.db]   (no arg = in-memory demo)
import { createServer, type IncomingMessage } from "node:http";
import { readFileSync } from "node:fs";
import { GraphStore } from "../core/src/graph.ts";
import { buildDemo } from "../core/src/seed.ts";
import { NODE_TYPES, EDGE_TYPES, EDGE_RULES, CAUSAL_LEVEL, OCCURRENCE_CLASS, type NodeType, type EdgeType } from "../core/src/ontology.ts";
import { timeline, openRecommendations, unaddressedFactors } from "../core/src/analysis.ts";

const dbPath = process.argv[2];
const g = new GraphStore(dbPath ?? ":memory:");
if (!dbPath) buildDemo(g);
const REVIEWER = process.env.RAIL_REVIEWER ?? "investigator";
const PORT = Number(process.env.PORT ?? 4173);

const cleanLabel = (v: unknown) => (typeof v === "string" && v.trim() && v.length <= 300 ? v.trim() : null);
const cleanProps = (v: unknown) => {
  if (v === undefined) return {};
  if (typeof v !== "object" || v === null || Array.isArray(v) || JSON.stringify(v).length > 4000) return null;
  return v as Record<string, unknown>;
};
const json = (res: any, body: unknown, code = 200) => {
  res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body));
};
const body = (req: IncomingMessage) => new Promise<any>((ok, no) => {
  let s = ""; req.on("data", c => (s += c)); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { no(e); } });
});

createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, "http://x");
    // Reject cross-site browser requests (CSRF / DNS-rebinding hardening).
    if (req.headers.host?.split(":")[0] !== "127.0.0.1" && req.headers.host?.split(":")[0] !== "localhost") return json(res, { error: "bad host" }, 403);
    if (url.pathname === "/" ) { res.writeHead(200, { "content-type": "text/html" }); return res.end(readFileSync(new URL("./public/index.html", import.meta.url))); }
    if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
    if (url.pathname === "/api/occurrences") return json(res, g.nodesOfType("Occurrence"));
    if (url.pathname === "/api/timeline") return json(res, timeline(g, url.searchParams.get("id")!));
    if (url.pathname === "/api/graph") {
      const nodes = (["CausalFactor", "Event", "Consequence"] as const).flatMap(t => g.nodesOfType(t));
      const ids = new Set(nodes.map(n => n.id));
      const edges = [...g.edges({ type: "CAUSED" }), ...g.edges({ type: "CONTRIBUTED_TO" })].filter(e => ids.has(e.from) && ids.has(e.to));
      return json(res, { nodes, edges });
    }
    if (url.pathname === "/api/pending") {
      const p = g.pending();
      const label = (id: string) => g.getNode(id)?.label ?? id;
      return json(res, { nodes: p.nodes, edges: p.edges.map(e => ({ ...e, fromLabel: label(e.from), toLabel: label(e.to) })) });
    }
    if (url.pathname === "/api/recommendations") return json(res, { open: openRecommendations(g), unaddressed: unaddressedFactors(g) });
    if (url.pathname === "/api/audit") return json(res, g.auditTrail());
    const mutating = req.method !== "GET" && req.method !== "HEAD";
    // JSON-only mutations: a cross-site form can't send this, and we send no CORS headers.
    if (mutating && req.headers["content-type"] !== "application/json") return json(res, { error: "json only" }, 415);
    if (url.pathname === "/api/review" && req.method === "POST") {
      const b = await body(req);
      if (!["node", "edge"].includes(b.kind) || !["accepted", "rejected"].includes(b.decision) || typeof b.id !== "string") return json(res, { error: "bad request" }, 400);
      g.review(b.kind, b.id, b.decision, REVIEWER);
      return json(res, { ok: true });
    }
    if (url.pathname === "/api/schema") return json(res, { NODE_TYPES, EDGE_TYPES, EDGE_RULES, CAUSAL_LEVEL, OCCURRENCE_CLASS });
    if (url.pathname === "/api/case") {
      const nodes = g.allNodes(), label = new Map(nodes.map(n => [n.id, n.label]));
      const edges = g.allEdges().map(e => ({ ...e, fromLabel: label.get(e.from), toLabel: label.get(e.to) }));
      return json(res, { nodes, edges });
    }
    if (url.pathname === "/api/node" && req.method === "POST") {
      const b = await body(req);
      if (!(NODE_TYPES as readonly string[]).includes(b.type)) return json(res, { error: "unknown node type" }, 400);
      const label = cleanLabel(b.label), props = cleanProps(b.props);
      if (!label) return json(res, { error: "label required (max 300 chars)" }, 400);
      if (!props) return json(res, { error: "props must be a small object" }, 400);
      const node = g.addNode(b.type as NodeType, label, { source: "human" }, props);
      // Convenience: a new Event can be attached to its occurrence in one step.
      if (b.type === "Event" && b.occurrenceId) {
        const o = g.getNode(b.occurrenceId);
        if (o?.type !== "Occurrence") return json(res, { error: "occurrenceId is not an Occurrence" }, 400);
        g.addEdge("PART_OF", node.id, o.id, { source: "human" });
      }
      return json(res, node, 201);
    }
    if (url.pathname === "/api/node" && req.method === "PATCH") {
      const b = await body(req);
      const patch: { label?: string; props?: Record<string, unknown> } = {};
      if (b.label !== undefined) { const l = cleanLabel(b.label); if (!l) return json(res, { error: "label required (max 300 chars)" }, 400); patch.label = l; }
      if (b.props !== undefined) { const p = cleanProps(b.props); if (!p) return json(res, { error: "props must be a small object" }, 400); patch.props = p; }
      return json(res, g.updateNode(String(b.id), patch, REVIEWER));
    }
    if (url.pathname === "/api/edge" && req.method === "POST") {
      const b = await body(req);
      if (!(EDGE_TYPES as readonly string[]).includes(b.type)) return json(res, { error: "unknown edge type" }, 400);
      const citation = typeof b.citation === "string" && b.citation.trim() ? b.citation.trim().slice(0, 300) : undefined;
      const evidenceId = typeof b.evidenceId === "string" && b.evidenceId ? b.evidenceId : undefined;
      if (evidenceId && g.getNode(evidenceId)?.type !== "Evidence") return json(res, { error: "evidenceId is not an Evidence node" }, 400);
      return json(res, g.addEdge(b.type as EdgeType, String(b.from), String(b.to), { source: "human", evidenceId, citation }), 201);
    }
    if (url.pathname === "/api/remove" && req.method === "POST") {
      const b = await body(req);
      if (!["node", "edge"].includes(b.kind) || typeof b.id !== "string") return json(res, { error: "bad request" }, 400);
      g.remove(b.kind, b.id, REVIEWER);
      return json(res, { ok: true });
    }
    json(res, { error: "not found" }, 404);
  } catch (e) { json(res, { error: (e as Error).message }, e instanceof SyntaxError || /not allowed|itself|cycle|requires|not found|removed|label|endpoint|unknown/.test((e as Error).message) ? 400 : 500); }
}).listen(PORT, "127.0.0.1", () => console.log(`RailInvestigator on http://127.0.0.1:${PORT} (${dbPath ?? "demo, in-memory"})`));
