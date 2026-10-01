import type { LLM } from "./extractor.ts";

/** Cloud backend via the Anthropic Messages API (opt-in; sends passage text off-device). */
export function anthropicLLM(apiKey: string, model: string): LLM {
  return {
    async complete(system, user) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 4096, system, messages: [{ role: "user", content: user }] }),
      });
      if (!r.ok) throw new Error(`Anthropic API ${r.status}`);
      const j: any = await r.json();
      return j.content.map((c: any) => c.text ?? "").join("");
    },
  };
}

/** Local backend for an Ollama-compatible server (data stays on the machine). */
export function ollamaLLM(model: string, baseUrl = "http://localhost:11434"): LLM {
  return {
    async complete(system, user) {
      const r = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        body: JSON.stringify({ model, stream: false, format: "json",
          messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!r.ok) throw new Error(`Ollama ${r.status}`);
      return ((await r.json()) as any).message.content;
    },
  };
}
