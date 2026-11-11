"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  BACKGROUNDS,
  DEFAULT_SETTINGS,
  FONTS,
  LINE_HEIGHTS,
  MIN_BRIGHTNESS,
  SIZES,
  TEXTURES,
  WIDTHS,
  palette,
  textureImage,
  type BackgroundId,
  type FontId,
  type ReaderSettings,
  type Texture,
  type Width,
} from "./settings";

const chip = (on: boolean) =>
  `rounded-md border px-3 py-1.5 text-sm ${on ? "border-accent bg-accent/15 text-foreground" : "border-border text-muted hover:text-foreground"}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-2 text-xs uppercase tracking-wider text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Reading settings as a side sheet. It uses the site's own colours (not the reader's) so it stays
 * legible whatever background is chosen, and sits above the brightness dimmer.
 */
export function ReaderSettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: ReaderSettings;
  onChange: (s: ReaderSettings) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<ReaderSettings>) => onChange({ ...settings, ...patch });

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sizeIndex = SIZES.indexOf(settings.size);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label="Reading settings"
      className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-xl border border-border bg-surface p-5 text-foreground shadow-2xl outline-none sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-auto sm:max-h-[calc(100vh-6rem)] sm:w-[22rem] sm:rounded-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-lg">Reading settings</h2>
        <button onClick={onClose} aria-label="Close settings" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <Section title="Brightness">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-muted">☾</span>
            <input
              type="range"
              min={MIN_BRIGHTNESS}
              max={100}
              step={5}
              value={settings.brightness}
              onChange={(e) => set({ brightness: Number(e.target.value) })}
              aria-label="Brightness"
              className="flex-1 accent-[var(--accent-strong)]"
            />
            <span className="w-10 text-right text-sm tabular-nums">{settings.brightness}%</span>
          </div>
        </Section>

        <Section title="Background">
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(BACKGROUNDS) as Exclude<BackgroundId, "custom">[]).map((id) => {
              const p = palette({ ...settings, background: id });
              const on = settings.background === id;
              return (
                <button
                  key={id}
                  onClick={() => set({ background: id })}
                  aria-pressed={on}
                  title={BACKGROUNDS[id].label}
                  aria-label={`${BACKGROUNDS[id].label} background`}
                  className={`flex aspect-square items-center justify-center rounded-lg border-2 font-serif text-sm ${on ? "border-accent" : "border-border"}`}
                  style={{ background: p.bg, backgroundImage: textureImage(settings.texture, p.dark), color: p.fg }}
                >
                  Aa
                </button>
              );
            })}
            <label
              title="Custom colour"
              className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 text-xs ${settings.background === "custom" ? "border-accent" : "border-dashed border-border"}`}
              style={
                settings.background === "custom"
                  ? { background: settings.customBg, color: palette(settings).fg }
                  : { background: "conic-gradient(#f3e9d2, #e2eadc, #232a33, #2b2530, #f3e9d2)" }
              }
            >
              <span className="rounded bg-black/40 px-1 text-white">Own</span>
              <input
                type="color"
                value={settings.customBg}
                onChange={(e) => set({ background: "custom", customBg: e.target.value })}
                onClick={() => settings.background !== "custom" && set({ background: "custom" })}
                aria-label="Custom background colour"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">
            {settings.background === "custom" ? "Your colour. " : `${BACKGROUNDS[settings.background].label}. `}
            Text colour adjusts to stay readable.
          </p>
        </Section>

        <Section title="Background type">
          <div className="flex gap-2">
            {(Object.keys(TEXTURES) as Texture[]).map((tx) => (
              <button key={tx} onClick={() => set({ texture: tx })} aria-pressed={settings.texture === tx} className={chip(settings.texture === tx)}>
                {TEXTURES[tx]}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Font">
          <div className="grid gap-1">
            {(Object.keys(FONTS) as FontId[]).map((f) => (
              <button
                key={f}
                onClick={() => set({ font: f })}
                aria-pressed={settings.font === f}
                className={`flex items-baseline justify-between rounded-md px-3 py-2 text-left ${settings.font === f ? "bg-accent/15 ring-1 ring-accent" : "hover:bg-surface-2"}`}
              >
                <span style={{ fontFamily: FONTS[f].stack }} className="text-base">
                  {FONTS[f].label}
                </span>
                {FONTS[f].note && <span className="ml-2 text-xs text-muted">{FONTS[f].note}</span>}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Text size">
          <div className="flex items-center gap-2">
            <button
              aria-label="Smaller text"
              disabled={sizeIndex <= 0}
              onClick={() => set({ size: SIZES[sizeIndex - 1] })}
              className="inline-flex h-9 min-w-10 items-center justify-center rounded-lg border border-border-strong px-3 disabled:opacity-40"
            >
              A−
            </button>
            <span className="w-14 text-center text-sm tabular-nums">{settings.size}px</span>
            <button
              aria-label="Larger text"
              disabled={sizeIndex >= SIZES.length - 1}
              onClick={() => set({ size: SIZES[sizeIndex + 1] })}
              className="inline-flex h-9 min-w-10 items-center justify-center rounded-lg border border-border-strong px-3 disabled:opacity-40"
            >
              A+
            </button>
          </div>
        </Section>

        <Section title="Line spacing">
          <div className="flex gap-2">
            {LINE_HEIGHTS.map((lh, i) => (
              <button key={lh} onClick={() => set({ lineHeight: lh })} aria-pressed={settings.lineHeight === lh} className={chip(settings.lineHeight === lh)}>
                {["Tight", "Normal", "Loose"][i]}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Page width">
          <div className="flex gap-2">
            {(Object.keys(WIDTHS) as Width[]).map((w) => (
              <button key={w} onClick={() => set({ width: w })} aria-pressed={settings.width === w} className={`${chip(settings.width === w)} capitalize`}>
                {w}
              </button>
            ))}
          </div>
        </Section>

        <div className="border-t border-border pt-4">
          <button onClick={() => onChange(DEFAULT_SETTINGS)} className="text-sm text-muted hover:text-foreground">
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
