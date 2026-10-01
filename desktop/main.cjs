// RailInvestigator desktop shell (Electron). Runs the local API in-process on 127.0.0.1 with a
// random port, shows the UI in a locked-down window, and manages case files (SQLite).
const { app, BrowserWindow, Menu, dialog, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { pathToFileURL } = require("node:url");

const DIST = path.join(__dirname, "..", "dist");
const load = (rel) => import(pathToFileURL(path.join(DIST, rel)).href);

let win = null;
let current = null;   // { store, server, file | null }

const configFile = () => path.join(app.getPath("userData"), "config.json");
const readConfig = () => { try { return JSON.parse(fs.readFileSync(configFile(), "utf8")); } catch { return {}; } };
const writeConfig = (c) => { try { fs.mkdirSync(path.dirname(configFile()), { recursive: true }); fs.writeFileSync(configFile(), JSON.stringify(c)); } catch { /* non-fatal */ } };
const defaultCase = () => path.join(app.getPath("documents"), "RailInvestigator", "case.rail.db");

async function closeCurrent() {
  if (!current) return;
  const c = current; current = null;
  await c.server.close();
  c.store.close();
}

/** Open (or create) a case file and point the window at it. file === null opens the in-memory demo. */
async function openCase(file) {
  const { GraphStore } = await load("core/src/graph.js");
  const { startServer } = await load("app/api.js");
  await closeCurrent();
  let store;
  if (file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    store = new GraphStore(file);
  } else {
    store = new GraphStore(":memory:");
    (await load("core/src/seed.js")).buildDemo(store);
  }
  const server = await startServer(store, { reviewer: os.userInfo().username || "investigator", port: 0 });
  current = { store, server, file };
  if (file) writeConfig({ ...readConfig(), lastCase: file });
  const title = file ? `RailInvestigator — ${path.basename(file)}` : "RailInvestigator — demo case (not saved)";
  if (!win) createWindow();
  win.setTitle(title);
  await win.loadURL(`http://127.0.0.1:${server.port}/`);
  win.setTitle(title);   // the page has its own <title>; keep ours
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 820, minWidth: 720, minHeight: 520, title: "RailInvestigator",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged },
  });
  win.on("closed", () => { win = null; });
  win.on("page-title-updated", (e) => e.preventDefault());
  // Never navigate away from our own local origin and never open new windows.
  win.webContents.on("will-navigate", (e, url) => {
    if (!current || new URL(url).origin !== `http://127.0.0.1:${current.server.port}`) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

const fail = (e) => dialog.showErrorBox("RailInvestigator", String(e && e.message || e));
const FILTER = [{ name: "RailInvestigator case", extensions: ["db"] }];

async function newCase() {
  const r = await dialog.showSaveDialog(win, { title: "New case", defaultPath: defaultCase().replace("case.rail", "new-case.rail"), filters: FILTER });
  if (r.canceled || !r.filePath) return;
  if (fs.existsSync(r.filePath)) fs.rmSync(r.filePath);   // the save dialog already confirmed overwrite
  await openCase(r.filePath).catch(fail);
}
async function openExisting() {
  const r = await dialog.showOpenDialog(win, { title: "Open case", properties: ["openFile"], filters: FILTER });
  if (!r.canceled && r.filePaths[0]) await openCase(r.filePaths[0]).catch(fail);
}
async function saveCopy() {
  if (!current) return;
  const r = await dialog.showSaveDialog(win, { title: "Save a copy of this case", defaultPath: "case-copy.rail.db", filters: FILTER });
  if (r.canceled || !r.filePath) return;
  try { if (fs.existsSync(r.filePath)) fs.rmSync(r.filePath); current.store.saveCopy(r.filePath); }
  catch (e) { fail(e); }
}

function buildMenu() {
  const mac = process.platform === "darwin";
  const template = [
    ...(mac ? [{ role: "appMenu" }] : []),
    { label: "File", submenu: [
      { label: "New Case…", accelerator: "CmdOrCtrl+N", click: () => newCase() },
      { label: "Open Case…", accelerator: "CmdOrCtrl+O", click: () => openExisting() },
      { label: "Save a Copy…", accelerator: "CmdOrCtrl+Shift+S", click: () => saveCopy() },
      { type: "separator" },
      { label: "Open Demo Case (not saved)", click: () => openCase(null).catch(fail) },
      { type: "separator" },
      mac ? { role: "close" } : { role: "quit" },
    ] },
    { role: "editMenu" },
    { label: "View", submenu: [
      { role: "reload" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
      { role: "togglefullscreen" }, ...(app.isPackaged ? [] : [{ type: "separator" }, { role: "toggleDevTools" }]),
    ] },
    { label: "Help", submenu: [{
      label: "About RailInvestigator",
      click: () => dialog.showMessageBox(win, { type: "info", title: "About", message: "RailInvestigator " + app.getVersion(),
        detail: "Local-first knowledge graph for railway accident investigation.\nData stays on this computer. AI output is only ever proposed; you decide what is accepted." }),
    }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));   // no camera, geolocation, etc.
  buildMenu();
  // RAIL_CASE lets tests and power users pick the file; otherwise reopen the last case or the default one.
  const file = process.env.RAIL_CASE || readConfig().lastCase || defaultCase();
  await openCase(file).catch((e) => { fail(e); app.quit(); });
});
app.on("window-all-closed", async () => { await closeCurrent(); app.quit(); });
app.on("activate", () => { if (!win && current) createWindow(); });
