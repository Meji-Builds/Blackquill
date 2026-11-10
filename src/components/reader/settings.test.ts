import { test } from "node:test";
import assert from "node:assert/strict";
import { BACKGROUNDS, DEFAULT_SETTINGS, contrast, palette, parseSettings } from "./settings.ts";

test("parseSettings falls back safely", () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings("not json"), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('"a string"'), DEFAULT_SETTINGS);
  const s = parseSettings(JSON.stringify({ font: "wingdings", size: 999, brightness: 5, customBg: "red" }));
  assert.equal(s.font, DEFAULT_SETTINGS.font);
  assert.equal(s.size, DEFAULT_SETTINGS.size);
  assert.equal(s.brightness, 40);
  assert.equal(s.customBg, DEFAULT_SETTINGS.customBg);
});

test("parseSettings migrates the earlier theme/font format", () => {
  const s = parseSettings(JSON.stringify({ theme: "sepia", font: "sans", size: 21 }));
  assert.equal(s.background, "sepia");
  assert.equal(s.font, "system-sans");
  assert.equal(s.size, 21);
});

test("every preset background has strong text contrast (WCAG AAA, 7:1)", () => {
  for (const id of Object.keys(BACKGROUNDS)) {
    const p = palette({ ...DEFAULT_SETTINGS, background: id as keyof typeof BACKGROUNDS });
    assert.ok(contrast(p.fg, p.bg) >= 7, `${id}: ${contrast(p.fg, p.bg).toFixed(2)}`);
  }
});

test("any custom background keeps text readable (at least 4.5:1)", () => {
  for (let i = 0; i < 4096; i++) {
    const hex = "#" + [i >> 8, (i >> 4) & 15, i & 15].map((n) => (n * 17).toString(16).padStart(2, "0")).join("");
    const p = palette({ ...DEFAULT_SETTINGS, background: "custom", customBg: hex });
    assert.ok(contrast(p.fg, p.bg) >= 4.5, `${hex}: ${contrast(p.fg, p.bg).toFixed(2)}`);
  }
});
