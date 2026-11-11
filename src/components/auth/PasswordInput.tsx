"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { input } from "@/components/ui/styles";

/** Password field with a show/hide toggle that keeps focus and cursor position. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
  invalid?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={`${input} pr-12 ${invalid ? "border-danger/70" : ""}`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        onMouseDown={(e) => e.preventDefault()}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted hover:text-foreground"
      >
        {shown ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

/** A gentle strength hint for new passwords: length first, then variety. */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (pw.length === 0) return { score: 0, label: "" };
  if (pw.length < 8) return { score: 0, label: `${8 - pw.length} more character${8 - pw.length === 1 ? "" : "s"} needed` };
  let variety = 0;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) variety++;
  if (/\d/.test(pw)) variety++;
  if (/[^A-Za-z0-9]/.test(pw)) variety++;
  if (pw.length >= 14) variety++;
  if (variety >= 3) return { score: 3, label: "Strong password" };
  if (variety >= 1) return { score: 2, label: "Good password" };
  return { score: 1, label: "Okay. Adding numbers or symbols makes it stronger" };
}

export function StrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;
  const colors = ["bg-danger", "bg-warning", "bg-success", "bg-success"];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${score >= i ? colors[score] : "bg-surface-3"}`} />
        ))}
      </div>
      <p className={`mt-1.5 text-xs ${score === 0 ? "text-danger" : "text-muted"}`}>{label}</p>
    </div>
  );
}
