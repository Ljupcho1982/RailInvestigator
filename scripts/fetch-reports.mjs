// Downloads PDFs listed in data/manifest.json into data/reports/. Skips existing files.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url)));
for (const { id, url } of manifest) {
  const out = new URL(`../data/reports/${id}.pdf`, import.meta.url);
  if (existsSync(out)) { console.log("skip", id); continue; }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.subarray(0, 4).toString() !== "%PDF") throw new Error("not a PDF");
    writeFileSync(out, buf); console.log("ok  ", id, buf.length);
  } catch (e) { console.error("FAIL", id, e.message); }
}
