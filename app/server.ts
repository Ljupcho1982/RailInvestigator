// Local API + static UI. Binds to 127.0.0.1 only — evidence never leaves the machine.
// Usage: node --experimental-sqlite app/server.ts [investigation.db]   (no arg = in-memory demo)
import { createServer, type IncomingMessage } from "node:http";
import { readFileSync } from "node:fs";
import { GraphStore } from "../core/src/graph.ts";
import { buildDemo } from "../core/src/seed.ts";
import { timeline, openRecommendations, unaddressedFactors } from "../core/src/analysis.ts";

const dbPath = process.argv[2];
const g = new GraphStore(dbPath ?? ":memory:");
if (!dbPath) buildDemo(g);
const REVIEWER = process.env.RAIL_REVIEWER ?? "investigator";
const PORT = Number(process.env.PORT ?? 4173);

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
    if (url.pathname === "/api/review" && req.method === "POST") {
      if (req.headers["content-type"] !== "application/json") return json(res, { error: "json only" }, 415);
      const b = await body(req);
      if (!["node", "edge"].includes(b.kind) || !["accepted", "rejected"].includes(b.decision) || typeof b.id !== "string") return json(res, { error: "bad request" }, 400);
      g.review(b.kind, b.id, b.decision, REVIEWER);
      return json(res, { ok: true });
    }
    json(res, { error: "not found" }, 404);
  } catch (e) { json(res, { error: (e as Error).message }, 500); }
}).listen(PORT, "127.0.0.1", () => console.log(`RailInvestigator on http://127.0.0.1:${PORT} (${dbPath ?? "demo, in-memory"})`));
