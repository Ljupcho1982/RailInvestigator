// Compiles core/ and app/ TypeScript to plain JavaScript in dist/ (types stripped, .ts imports -> .js)
// and copies the UI. The desktop app runs from dist/, so it needs no TypeScript support at runtime.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { stripTypeScriptTypes } from "node:module";

const root = new URL("..", import.meta.url).pathname, out = join(root, "dist");
const SKIP = new Set(["core/src/demo.ts", "app/server.ts"]);   // console demo is not part of the app
rmSync(out, { recursive: true, force: true });

function walk(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
let count = 0;
for (const dir of ["core/src", "app"]) {
  for (const file of walk(join(root, dir))) {
    const rel = relative(root, file);
    if (rel.includes("/public/") || !file.endsWith(".ts") || SKIP.has(rel)) continue;
    const js = stripTypeScriptTypes(readFileSync(file, "utf8"), { mode: "strip" })
      .replace(/(from\s+["']\.[^"']*)\.ts(["'])/g, "$1.js$2");
    const dest = join(out, rel.replace(/\.ts$/, ".js"));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, js);
    count++;
  }
}
cpSync(join(root, "app/public"), join(out, "app/public"), { recursive: true });
console.log(`built ${count} modules + UI -> dist/`);
