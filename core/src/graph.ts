import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { NODE_TYPES, EDGE_TYPES, validateEdge, type NodeType, type EdgeType } from "./ontology.ts";

/** Where a claim comes from. Every node/edge carries one. */
export interface Provenance {
  source: "human" | "ai";
  evidenceId?: string;   // Evidence node supporting the claim
  citation?: string;     // e.g. "report.pdf p.14 para 3"
  confidence?: number;   // 0..1, AI-proposed only
}

export type Status = "proposed" | "accepted" | "rejected";

export interface GraphNode {
  id: string; type: NodeType; label: string;
  props: Record<string, unknown>; status: Status; provenance: Provenance;
}
export interface GraphEdge {
  id: string; type: EdgeType; from: string; to: string;
  props: Record<string, unknown>; status: Status; provenance: Provenance;
}

/**
 * Local-first graph store (SQLite). AI-sourced items are always created as
 * "proposed" and only count in analysis once a human accepts them.
 */
export class GraphStore {
  db: DatabaseSync;
  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY, type TEXT NOT NULL, label TEXT NOT NULL,
        props TEXT NOT NULL, status TEXT NOT NULL, provenance TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS edges(id TEXT PRIMARY KEY, type TEXT NOT NULL,
        src TEXT NOT NULL REFERENCES nodes(id), dst TEXT NOT NULL REFERENCES nodes(id),
        props TEXT NOT NULL, status TEXT NOT NULL, provenance TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL,
        actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, detail TEXT);
      CREATE INDEX IF NOT EXISTS edges_src ON edges(src); CREATE INDEX IF NOT EXISTS edges_dst ON edges(dst);
    `);
    try { this.db.exec("ALTER TABLE audit ADD COLUMN detail TEXT"); } catch { /* column already exists */ }
  }

  private log(actor: string, action: string, target: string, detail?: unknown) {
    this.db.prepare("INSERT INTO audit(ts,actor,action,target,detail) VALUES(?,?,?,?,?)")
      .run(new Date().toISOString(), actor, action, target, detail === undefined ? null : JSON.stringify(detail));
  }

  addNode(type: NodeType, label: string, provenance: Provenance, props: Record<string, unknown> = {}): GraphNode {
    if (!NODE_TYPES.includes(type)) throw new Error(`unknown node type ${type}`);
    const status: Status = provenance.source === "ai" ? "proposed" : "accepted";
    const n: GraphNode = { id: randomUUID(), type, label, props, status, provenance };
    this.db.prepare("INSERT INTO nodes VALUES(?,?,?,?,?,?)")
      .run(n.id, type, label, JSON.stringify(props), status, JSON.stringify(provenance));
    this.log(provenance.source, "add_node", n.id);
    return n;
  }

  addEdge(type: EdgeType, from: string, to: string, provenance: Provenance, props: Record<string, unknown> = {}): GraphEdge {
    if (!EDGE_TYPES.includes(type)) throw new Error(`unknown edge type ${type}`);
    const a = this.getNode(from), b = this.getNode(to);
    if (!a || !b) throw new Error("edge endpoint not found");
    const err = validateEdge(type, a.type, b.type);
    if (err) throw new Error(err);
    if (from === to) throw new Error(`${type}: an item cannot link to itself`);
    // A loop of PRECEDES edges has no valid timeline order, so refuse to create one.
    if (type === "PRECEDES" && this.reaches(to, from)) throw new Error("PRECEDES: would create a cycle in the timeline");
    // Causal claims need support: a human-made causal edge must cite evidence.
    if ((type === "CAUSED" || type === "CONTRIBUTED_TO") && !provenance.evidenceId && !provenance.citation)
      throw new Error(`${type} requires evidence or citation`);
    const status: Status = provenance.source === "ai" ? "proposed" : "accepted";
    const e: GraphEdge = { id: randomUUID(), type, from, to, props, status, provenance };
    this.db.prepare("INSERT INTO edges VALUES(?,?,?,?,?,?,?)")
      .run(e.id, type, from, to, JSON.stringify(props), status, JSON.stringify(provenance));
    this.log(provenance.source, "add_edge", e.id);
    return e;
  }

  /** True if `target` is reachable from `start` over accepted/proposed PRECEDES edges. */
  private reaches(start: string, target: string): boolean {
    const next = this.db.prepare("SELECT dst FROM edges WHERE type='PRECEDES' AND src=? AND status!='rejected'");
    const seen = new Set<string>(), stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === target) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const r of next.all(cur) as { dst: string }[]) stack.push(r.dst);
    }
    return false;
  }

  review(kind: "node" | "edge", id: string, decision: "accepted" | "rejected", reviewer: string) {
    const table = kind === "node" ? "nodes" : "edges";
    this.db.prepare(`UPDATE ${table} SET status=? WHERE id=?`).run(decision, id);
    this.log(reviewer, `${decision}_${kind}`, id);
  }

  /**
   * Edit a node's label and/or props. The previous values are kept in the audit
   * log. Editing an AI-proposed item does not accept it — review stays separate.
   */
  updateNode(id: string, patch: { label?: string; props?: Record<string, unknown> }, actor: string): GraphNode {
    const n = this.getAnyNode(id);
    if (!n) throw new Error("node not found");
    if (n.status === "rejected") throw new Error("node was removed");
    const label = patch.label ?? n.label;
    if (!label.trim()) throw new Error("label required");
    const props = patch.props ?? n.props;
    this.db.prepare("UPDATE nodes SET label=?, props=? WHERE id=?").run(label.trim(), JSON.stringify(props), id);
    this.log(actor, "edit_node", id, { before: { label: n.label, props: n.props }, after: { label: label.trim(), props } });
    return this.getAnyNode(id)!;
  }

  /**
   * Remove a node or edge. This is a soft delete (status "rejected"): history and
   * audit stay intact, and analysis ignores it. Removing a node removes its edges.
   */
  remove(kind: "node" | "edge", id: string, actor: string) {
    if (kind === "edge") {
      this.db.prepare("UPDATE edges SET status='rejected' WHERE id=?").run(id);
      this.log(actor, "remove_edge", id);
      return;
    }
    this.db.prepare("UPDATE nodes SET status='rejected' WHERE id=?").run(id);
    const touched = this.db.prepare("SELECT id FROM edges WHERE (src=? OR dst=?) AND status!='rejected'").all(id, id) as { id: string }[];
    this.db.prepare("UPDATE edges SET status='rejected' WHERE src=? OR dst=?").run(id, id);
    this.log(actor, "remove_node", id, { edgesRemoved: touched.map(e => e.id) });
  }

  /** Any non-removed node regardless of review status (for the case builder). */
  allNodes(): GraphNode[] {
    return this.db.prepare("SELECT * FROM nodes WHERE status!='rejected' ORDER BY rowid").all().map(r => this.rowToNode(r));
  }
  allEdges(): GraphEdge[] {
    return this.db.prepare("SELECT * FROM edges WHERE status!='rejected' ORDER BY rowid").all().map(r => this.rowToEdge(r));
  }
  private getAnyNode(id: string) { return this.getNode(id); }

  private rowToNode(r: any): GraphNode {
    return { id: r.id, type: r.type, label: r.label, props: JSON.parse(r.props), status: r.status, provenance: JSON.parse(r.provenance) };
  }
  private rowToEdge(r: any): GraphEdge {
    return { id: r.id, type: r.type, from: r.src, to: r.dst, props: JSON.parse(r.props), status: r.status, provenance: JSON.parse(r.provenance) };
  }

  getNode(id: string): GraphNode | undefined {
    const r = this.db.prepare("SELECT * FROM nodes WHERE id=?").get(id);
    return r ? this.rowToNode(r) : undefined;
  }
  nodesOfType(type: NodeType, status: Status = "accepted"): GraphNode[] {
    return this.db.prepare("SELECT * FROM nodes WHERE type=? AND status=?").all(type, status).map(r => this.rowToNode(r));
  }
  edges(opts: { type?: EdgeType; from?: string; to?: string; status?: Status } = {}): GraphEdge[] {
    const status = opts.status ?? "accepted";
    return this.db.prepare("SELECT * FROM edges WHERE status=?").all(status).map(r => this.rowToEdge(r))
      .filter(e => (!opts.type || e.type === opts.type) && (!opts.from || e.from === opts.from) && (!opts.to || e.to === opts.to));
  }
  pending(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: this.db.prepare("SELECT * FROM nodes WHERE status='proposed'").all().map(r => this.rowToNode(r)),
      edges: this.edges({ status: "proposed" }),
    };
  }
  auditTrail() { return this.db.prepare("SELECT * FROM audit ORDER BY seq").all(); }
}
