// Shared class names so buttons, inputs and cards look the same everywhere.

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50";

export const btn = {
  primary: `${base} h-11 px-5 bg-accent-strong text-white shadow-[0_8px_24px_-12px_rgba(143,107,255,0.8)] hover:bg-[#9c7dff] active:scale-[0.98]`,
  secondary: `${base} h-11 px-4 border border-border-strong bg-surface-2 text-foreground hover:bg-surface-3`,
  ghost: `${base} h-10 px-3 text-muted hover:bg-surface-2 hover:text-foreground`,
  danger: `${base} h-11 px-4 border border-danger/40 text-danger hover:bg-danger/10`,
  small: `${base} h-9 px-3 border border-border-strong bg-surface-2 text-foreground hover:bg-surface-3`,
  icon: "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
};

export const input =
  "h-11 w-full rounded-lg border border-border-strong bg-surface px-3.5 text-[15px] text-foreground outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20";

export const textarea =
  "w-full rounded-lg border border-border-strong bg-surface px-3.5 py-3 text-[15px] text-foreground outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20";

export const card = "rounded-2xl border border-border bg-surface";

export const label = "mb-1.5 block text-sm font-medium text-foreground";
