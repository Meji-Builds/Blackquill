import "server-only";
import { batches, language } from "./languages";

export type TranslationProvider = "deepl" | "anthropic" | "openai" | "demo";

/**
 * Which machine translation service to use: TRANSLATION_PROVIDER if set, otherwise the first one with a key
 * (DeepL, then Claude, then OpenAI). TRANSLATION_DEMO=1 turns on a fake translator for local testing only.
 */
export function translationProvider(): TranslationProvider | null {
  const forced = process.env.TRANSLATION_PROVIDER as TranslationProvider | undefined;
  const has: Record<TranslationProvider, boolean> = {
    deepl: Boolean(process.env.DEEPL_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    demo: process.env.TRANSLATION_DEMO === "1",
  };
  if (forced && has[forced]) return forced;
  return (["deepl", "anthropic", "openai", "demo"] as const).find((p) => has[p]) ?? null;
}

/** Machine translation needs a provider and the service key (only the server may write the shared cache). */
export const machineTranslationReady = () => Boolean(translationProvider() && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Can this provider produce the language? DeepL covers fewer languages; the language models cover all of ours. */
export function supports(provider: TranslationProvider, code: string): boolean {
  const l = language(code);
  if (!l) return false;
  return provider === "deepl" ? Boolean(l.deepl) : true;
}

/** Translates a title and paragraphs, keeping the paragraph count. */
export async function translateChapter(opts: {
  from: string;
  to: string;
  title: string;
  paragraphs: string[];
}): Promise<{ title: string; paragraphs: string[]; provider: TranslationProvider }> {
  const provider = translationProvider();
  if (!provider) throw new Error("Machine translation isn't set up on this site.");
  if (!supports(provider, opts.to)) throw new Error(`Machine translation into ${language(opts.to)?.name ?? opts.to} isn't available.`);
  const parts = [opts.title || "", ...opts.paragraphs];
  // Translate in pieces (title rides with the first), a few at a time.
  const groups = batches(parts, provider === "deepl" ? 20000 : 6000);
  const out: string[][] = new Array(groups.length);
  const run = provider === "deepl" ? deepl : provider === "demo" ? demo : provider === "anthropic" ? anthropic : openai;
  for (let i = 0; i < groups.length; i += 3) {
    await Promise.all(
      groups.slice(i, i + 3).map(async (g, j) => {
        out[i + j] = await withRetry(() => run(g, opts.from, opts.to));
      }),
    );
  }
  const flat = out.flat();
  if (flat.length !== parts.length) throw new Error("The translation came back incomplete. Please try again.");
  return { title: flat[0], paragraphs: flat.slice(1), provider };
}

async function withRetry<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

const instructions = (from: string, to: string) =>
  `You are a literary translator for a web fiction site. Translate each string in the JSON array from ${language(from)?.name ?? from} to ${language(to)?.name ?? to}. ` +
  "Keep the author's voice, tone, tense and paragraphing; translate dialogue naturally; keep character and place names as they are unless they have a common translation; keep line breaks inside a string. " +
  "Return only a JSON array of strings with exactly the same number of items, in the same order. Empty strings stay empty.";

function parseArray(text: string, n: number): string[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("Unreadable translation response.");
  const arr = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(arr) || arr.length !== n || arr.some((s) => typeof s !== "string")) {
    throw new Error("The translation came back incomplete.");
  }
  return arr;
}

async function deepl(texts: string[], from: string, to: string): Promise<string[]> {
  const key = process.env.DEEPL_API_KEY!;
  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const src = language(from)?.deepl?.split("-")[0];
  // DeepL rejects empty strings; send a placeholder and restore it.
  const res = await fetch(`${host}/v2/translate`, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: texts.map((t) => t || "​"),
      target_lang: language(to)!.deepl,
      ...(src ? { source_lang: src } : {}),
      preserve_formatting: true,
    }),
  });
  const json = (await res.json().catch(() => null)) as { translations?: { text: string }[]; message?: string } | null;
  if (!res.ok || !json?.translations) throw new Error(`Translation service error (${res.status}). ${json?.message ?? ""}`.trim());
  return json.translations.map((t, i) => (texts[i] ? t.text : ""));
}

async function anthropic(texts: string[], from: string, to: string): Promise<string[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_TRANSLATION_MODEL || "claude-haiku-5-5",
      max_tokens: 16000,
      system: instructions(from, to),
      messages: [{ role: "user", content: JSON.stringify(texts) }],
    }),
  });
  const json = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[]; error?: { message?: string } } | null;
  if (!res.ok || !json?.content) throw new Error(`Translation service error (${res.status}). ${json?.error?.message ?? ""}`.trim());
  return parseArray(json.content.filter((c) => c.type === "text").map((c) => c.text).join(""), texts.length);
}

async function openai(texts: string[], from: string, to: string): Promise<string[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: instructions(from, to) },
        { role: "user", content: JSON.stringify(texts) },
      ],
    }),
  });
  const json = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;
  const text = json?.choices?.[0]?.message?.content;
  if (!res.ok || !text) throw new Error(`Translation service error (${res.status}). ${json?.error?.message ?? ""}`.trim());
  return parseArray(text, texts.length);
}

// Local testing only: marks each paragraph with the target language instead of translating it.
async function demo(texts: string[], _from: string, to: string): Promise<string[]> {
  await new Promise((r) => setTimeout(r, 300));
  return texts.map((t) => (t ? `[${to}] ${t}` : ""));
}
