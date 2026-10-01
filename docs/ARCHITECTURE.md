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
 Desktop app (Tauri + web UI)  ── review queue · timeline · causal graph · recommendation tracker · NL query
```

## Components
- **core/** (done, v0): ontology, SQLite graph store, analysis queries. TypeScript, no dependencies.
- **ingest/** (next): document parsing, chunking, citation anchors.
- **extract/** (next): LLM prompts producing ontology-valid JSON; every item cites a source passage. Output enters as `proposed`.
- **desktop/** (planned): Tauri shell, UI with graph (e.g. Cytoscape) and timeline views, review queue as the primary workflow.
- **export** (later): report-ready timeline/causal diagrams; ERA/ERAIL-aligned data export.

## Key decisions
- **Local-first**: single-file SQLite per investigation; no server. Sensitive evidence never leaves the machine unless the user enables a cloud model.
- **Propose/accept model**: AI cannot change analysis results; a human review writes to the audit log.
- **Natural-language query** is translated to graph queries over *accepted* data only, answers cite sources.
- **Anonymisation** by default for Person nodes (role, not name).
