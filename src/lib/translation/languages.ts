// Languages a story can be written in or translated into. `deepl` is DeepL's target code where it has one.
export interface Language {
  code: string;
  name: string; // in English
  native: string; // in the language itself
  deepl?: string;
  rtl?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", native: "English", deepl: "EN-US" },
  { code: "es", name: "Spanish", native: "Español", deepl: "ES" },
  { code: "pt", name: "Portuguese", native: "Português", deepl: "PT-BR" },
  { code: "fr", name: "French", native: "Français", deepl: "FR" },
  { code: "de", name: "German", native: "Deutsch", deepl: "DE" },
  { code: "it", name: "Italian", native: "Italiano", deepl: "IT" },
  { code: "nl", name: "Dutch", native: "Nederlands", deepl: "NL" },
  { code: "pl", name: "Polish", native: "Polski", deepl: "PL" },
  { code: "ru", name: "Russian", native: "Русский", deepl: "RU" },
  { code: "uk", name: "Ukrainian", native: "Українська", deepl: "UK" },
  { code: "tr", name: "Turkish", native: "Türkçe", deepl: "TR" },
  { code: "ar", name: "Arabic", native: "العربية", deepl: "AR", rtl: true },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", deepl: "ID" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "fil", name: "Filipino", native: "Filipino" },
  { code: "ja", name: "Japanese", native: "日本語", deepl: "JA" },
  { code: "ko", name: "Korean", native: "한국어", deepl: "KO" },
  { code: "zh", name: "Chinese (Simplified)", native: "简体中文", deepl: "ZH-HANS" },
  { code: "zh-Hant", name: "Chinese (Traditional)", native: "繁體中文", deepl: "ZH-HANT" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "yo", name: "Yoruba", native: "Yorùbá" },
  { code: "ig", name: "Igbo", native: "Igbo" },
  { code: "ha", name: "Hausa", native: "Hausa" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "fa", name: "Persian", native: "فارسی", rtl: true },
  { code: "he", name: "Hebrew", native: "עברית", rtl: true },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

export function language(code: string | null | undefined): Language | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

export const isLanguage = (code: unknown): code is string => typeof code === "string" && BY_CODE.has(code);

/** "Español (Spanish)", or just "English" when both are the same. */
export function languageLabel(code: string): string {
  const l = BY_CODE.get(code);
  if (!l) return code;
  return l.native === l.name ? l.name : `${l.native} (${l.name})`;
}

/** The reader's chosen language per story lives in one cookie: {"<storyId>": "es", ...}, most recent last. */
export const LANG_COOKIE = "oq_langs";
const MAX_REMEMBERED = 40;

export function parseLangCookie(raw: string | undefined | null): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).filter(([k, l]) => /^[0-9a-f-]{36}$/i.test(k) && isLanguage(l))) as Record<string, string>;
  } catch {
    return {};
  }
}

export function withStoryLanguage(map: Record<string, string>, storyId: string, lang: string | null): Record<string, string> {
  const next = { ...map };
  delete next[storyId];
  if (lang) next[storyId] = lang;
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_REMEMBERED))) delete next[k];
  return next;
}

/** Paragraphs exactly as the reader splits them, so a translation keeps the same paragraph numbers. */
export { toParagraphs as splitParagraphs } from "../reader/text.ts";

/** Groups paragraphs into batches of roughly `maxChars`, so long chapters translate in pieces. */
export function batches(paragraphs: string[], maxChars = 6000): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let size = 0;
  for (const p of paragraphs) {
    if (cur.length && size + p.length > maxChars) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(p);
    size += p.length;
  }
  if (cur.length) out.push(cur);
  return out;
}
