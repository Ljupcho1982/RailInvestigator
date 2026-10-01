/** A passage of a source document with a stable citation anchor. */
export interface Chunk { docId: string; page: number; index: number; text: string; citation: string }

/**
 * Split page-separated text (form feed \f between pages) into paragraph-based
 * chunks of at most maxChars, keeping page numbers for citations.
 */
export function chunkDocument(docId: string, fullText: string, maxChars = 1500): Chunk[] {
  const chunks: Chunk[] = [];
  fullText.split("\f").forEach((pageText, i) => {
    const page = i + 1;
    let buf = "", n = 0;
    const flush = () => {
      if (buf.trim()) { chunks.push({ docId, page, index: n, text: buf.trim(), citation: `${docId} p.${page} §${n + 1}` }); n++; }
      buf = "";
    };
    for (const para of pageText.split(/\n\s*\n/)) {
      if (buf && buf.length + para.length > maxChars) flush();
      buf += (buf ? "\n\n" : "") + para;
    }
    flush();
  });
  return chunks;
}
