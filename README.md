# RailInvestigator

A local-first knowledge graph and (planned) desktop app for analysing railway
accidents and serious incidents: timelines, causal-factor chains, evidence
traceability and safety-recommendation tracking, with AI that **proposes** and
investigators **decide**.

**Status:** foundation. The ontology and graph core exist and are tested; extraction pipeline and a local web UI exist; Tauri packaging is next. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ONTOLOGY.md](docs/ONTOLOGY.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## Principles
1. **Human in the loop** – AI output is stored as `proposed` and excluded from analysis until accepted.
2. **Provenance everywhere** – every node/edge records source, citation, confidence; all reviews are audit-logged.
3. **Causal claims need support** – `CAUSED`/`CONTRIBUTED_TO` edges require evidence or a citation.
4. **Local-first** – data stays on the investigator's machine; cloud LLMs are opt-in.

## Try it
Requires Node >= 22.18 (zero dependencies; uses built-in `node:sqlite`).
```
npm test
npm run demo      # console demo
npm run app       # review queue / timeline / causal graph UI at http://127.0.0.1:4173 (demo data)
```
The **Case builder** tab lets you add, edit and remove items and links by hand (no AI needed). Edits keep the previous value in the audit log; removals are soft deletes that analysis ignores.

Pass a `.db` path (`node --experimental-sqlite app/server.ts case.db`) to open a saved investigation.
