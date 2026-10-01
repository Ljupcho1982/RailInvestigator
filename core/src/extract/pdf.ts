import { execFileSync } from "node:child_process";

/**
 * Extract text from a PDF using poppler's `pdftotext -layout`, which separates
 * pages with form feeds (what chunkDocument expects). Needs poppler installed;
 * the desktop build will bundle an equivalent. Scanned PDFs need OCR (not handled yet).
 */
export function pdfToText(path: string): string {
  const text = execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (text.replace(/\s/g, "").length < 200) throw new Error(`${path}: almost no text — scanned PDF? OCR required`);
  return text;
}
