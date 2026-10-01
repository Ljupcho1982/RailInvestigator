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

## Desktop app
```
npm install
npm run desktop     # build + launch the desktop app (add --no-sandbox only inside containers/root)
npm run dist        # build installers into release/ (AppImage + .deb on Linux)
```
Each investigation is one SQLite file (**File → New Case… / Open Case… / Save a Copy…**); the last case reopens
on launch, and a demo case is available from the File menu. The app runs the local API on `127.0.0.1` with a
random port inside the app, shows the UI in a sandboxed window with a strict content-security policy, and
blocks navigation to anywhere else. **No network access is needed to use it.**

Built and tested on Linux (packaged AppImage/.deb launched headless, data persisted across restarts).
Windows and macOS builds are configured in `.github/workflows/build.yml` but **not yet built or tested**;
installers are unsigned and use the default Electron icon.

## Try it (command line)
Requires Node >= 22.18 (zero dependencies; uses built-in `node:sqlite`).
```
npm test
npm run demo      # console demo
npm run app       # review queue / timeline / causal graph UI at http://127.0.0.1:4173 (demo data)
```
The **Case builder** tab lets you add, edit and remove items and links by hand (no AI needed). New events can be placed at the start, the end or after a chosen event, and the Timeline tab has a per-event "Move…" control. Edits keep the previous value in the audit log; removals are soft deletes that analysis ignores.

Pass a `.db` path (`node --experimental-sqlite app/server.ts case.db`) to open a saved investigation.
