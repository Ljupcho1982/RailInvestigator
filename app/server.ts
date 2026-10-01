// CLI: node --experimental-sqlite app/server.ts [investigation.db]   (no arg = in-memory demo)
import { GraphStore } from "../core/src/graph.ts";
import { buildDemo } from "../core/src/seed.ts";
import { startServer } from "./api.ts";

const dbPath = process.argv[2];
const g = new GraphStore(dbPath ?? ":memory:");
if (!dbPath) buildDemo(g);
const { port } = await startServer(g, { reviewer: process.env.RAIL_REVIEWER ?? "investigator", port: Number(process.env.PORT ?? 4173) });
console.log(`RailInvestigator on http://127.0.0.1:${port} (${dbPath ?? "demo, in-memory"})`);
