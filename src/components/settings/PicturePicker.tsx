"use client";

/* eslint-disable @next/next/no-img-element -- the image being cropped is a local object URL */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { removeProfilePicture, setProfilePicture } from "@/app/settings/actions";
import { Avatar } from "@/components/Avatar";
import { btn } from "@/components/ui/styles";

const OUT = 640; // pixels sent to the server, which shrinks to 320

/** Profile picture on the settings page: choose a photo, crop it to a circle, save. */
export function PicturePicker({ url, name, username }: { url: string | null; name: string; username: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(url);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setMessage(null);
    if (!file.type.startsWith("image/")) return setError("That file isn't a picture.");
    if (file.size > 25 * 1024 * 1024) return setError("That picture is too large.");
    setSource(URL.createObjectURL(file));
  }

  function closeCrop() {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
  }

  async function save(blob: Blob) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("picture", blob, "picture.jpg");
    const r = await setProfilePicture(form).catch(() => ({ ok: false as const, error: "You seem to be offline.", url: undefined }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setCurrent(r.url ?? null);
    setMessage("Picture saved.");
    closeCrop();
    router.refresh();
  }

  async function remove() {
    if (!confirm("Remove your profile picture?")) return;
    setBusy(true);
    setError(null);
    const r = await removeProfilePicture().catch(() => ({ ok: false as const, error: "You seem to be offline." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setCurrent(null);
    setMessage("Picture removed.");
    router.refresh();
  }

  return (
    <div className="mt-5 flex items-center gap-4">
      <button onClick={() => input.current?.click()} disabled={busy} aria-label="Change profile picture" className="group relative shrink-0 rounded-full">
        <Avatar url={current} name={name} seed={username} size={80} className="ring-2 ring-border" />
        <span className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-accent-strong text-white transition group-hover:scale-110">
          <Camera className="h-3.5 w-3.5" />
        </span>
      </button>
      <div className="min-w-0">
        <p className="text-sm font-medium">Profile picture</p>
        <p className="text-xs text-muted">Shown next to your name on comments, your profile and your stories.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => input.current?.click()} disabled={busy} className={btn.small}>
            {busy && !source ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {current ? "Change" : "Add a picture"}
          </button>
          {current && (
            <button onClick={remove} disabled={busy} className={`${btn.small} text-muted`}>
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
        </div>
        {message && <p role="status" className="mt-1.5 text-xs text-success">{message}</p>}
        {error && !source && <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/*" onChange={pick} className="hidden" />
      {source && <CropDialog source={source} busy={busy} error={error} onCancel={closeCrop} onSave={save} onFail={(m) => { closeCrop(); setError(m); }} />}
    </div>
  );
}

function CropDialog({
  source,
  busy,
  error,
  onCancel,
  onSave,
  onFail,
}: {
  source: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  onFail: (message: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [frame, setFrame] = useState(280);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const fit = () => setFrame(Math.min(280, window.innerWidth - 80));
    fit();
    window.addEventListener("resize", fit);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  const scale = natural ? (frame / Math.min(natural.w, natural.h)) * zoom : 1;
  const w = natural ? natural.w * scale : frame;
  const h = natural ? natural.h * scale : frame;
  const clamp = (p: { x: number; y: number }, s = scale) => {
    if (!natural) return p;
    const mx = (natural.w * s - frame) / 2;
    const my = (natural.h * s - frame) / 2;
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };

  function setZoomTo(z: number) {
    const nz = Math.max(1, Math.min(4, z));
    setZoom(nz);
    if (natural) setPos((p) => clamp(p, (frame / Math.min(natural.w, natural.h)) * nz));
  }

  function onDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }));
  }

  function save() {
    const img = imgRef.current;
    if (!img || !natural) return;
    const size = frame / scale; // the square of the original image inside the frame
    const sx = natural.w / 2 - (frame / 2 + pos.x) / scale;
    const sy = natural.h / 2 - (frame / 2 + pos.y) / scale;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(OUT, Math.round(size));
    const ctx = canvas.getContext("2d");
    if (!ctx) return onFail("Your browser couldn't crop that picture.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => (b ? onSave(b) : onFail("Your browser couldn't crop that picture.")), "image/jpeg", 0.9);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={busy ? undefined : onCancel} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="crop-title" className="relative w-full max-w-sm rounded-t-3xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <button onClick={onCancel} disabled={busy} aria-label="Close" className="absolute top-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2">
          <X className="h-5 w-5" />
        </button>
        <h2 id="crop-title" className="text-lg font-semibold">Position your picture</h2>
        <p className="mt-1 text-sm text-muted">Drag to move it, and zoom to fit.</p>

        <div
          className="relative mx-auto mt-5 touch-none overflow-hidden rounded-2xl bg-black select-none"
          style={{ width: frame, height: frame, cursor: "grab" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(e) => setZoomTo(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        >
          <img
            ref={imgRef}
            src={source}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const i = e.currentTarget;
              if (!i.naturalWidth || !i.naturalHeight) return onFail("We couldn't read that picture. Try a JPG or PNG.");
              setNatural({ w: i.naturalWidth, h: i.naturalHeight });
            }}
            onError={() => onFail("We couldn't read that picture. Try a JPG or PNG.")}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
            style={{ width: w, height: h, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`, opacity: natural ? 1 : 0 }}
          />
          {/* Dim everything outside the circle. */}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(0,0,0,0.55)] ring-2 ring-white/70" />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={() => setZoomTo(zoom / 1.2)} aria-label="Zoom out" className={btn.icon}>
            <ZoomOut className="h-5 w-5" />
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomTo(Number(e.target.value))}
            aria-label="Zoom"
            className="min-w-0 flex-1 accent-[#8f6bff]"
          />
          <button onClick={() => setZoomTo(zoom * 1.2)} aria-label="Zoom in" className={btn.icon}>
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className={btn.ghost}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || !natural} className={btn.primary}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Saving…" : "Save picture"}
          </button>
        </div>
      </div>
    </div>
  );
}
