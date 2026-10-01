# Architecture

```
 PDFs / data logs / interviews
          │ ingest (text + OCR, page-level chunks)
          ▼
 Extraction pipeline  ── LLM (local by default, cloud opt-in) ──►  proposed nodes/edges + citations
          │
          ▼
 Graph core (this repo: core/)  ── SQLite, ontology validation, provenance, audit log
          │
          ▼
 Desktop app (Electron + web UI)  ── review queue · timeline · causal graph · recommendation tracker · NL query
```

## Components
- **core/** (done, v0): ontology, SQLite graph store, analysis queries. TypeScript, no dependencies.
- **ingest/** (next): document parsing, chunking, citation anchors.
- **extract/** (next): LLM prompts producing ontology-valid JSON; every item cites a source passage. Output enters as `proposed`.
- **app/** (done): local HTTP API (`api.ts`) + dependency-free web UI: case builder, review queue, timeline, causal graph, recommendations.
- **desktop/** (done): Electron shell (`main.cjs`) — case files, menus, sandboxed window. `scripts/build.mjs` compiles TS to `dist/`.
- **export** (later): report-ready timeline/causal diagrams; ERA/ERAIL-aligned data export.

## Key decisions
- **Electron, not Tauri.** Tauri was the first plan (smaller installers), but it needs WebKitGTK system libraries and a Rust toolchain
  that the build environment lacked, so it could not be built or verified. Electron bundles Node 24 (built-in `node:sqlite`), so
  the same core code runs unchanged, and the packaged app could be launched and tested. Cost: ~100 MB installers. The UI talks plain
  HTTP to the core, so a later move to Tauri only needs a different shell.
- **Local-first**: single-file SQLite per investigation; no server. Sensitive evidence never leaves the machine unless the user enables a cloud model.
- **Propose/accept model**: AI cannot change analysis results; a human review writes to the audit log.
- **Natural-language query** is translated to graph queries over *accepted* data only, answers cite sources.
- **Anonymisation** by default for Person nodes (role, not name).
