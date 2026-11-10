"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { publishChapter, saveChapterDraft, scheduleChapter, unpublishChapter } from "@/app/studio/actions";
import { countWords } from "@/lib/studio/text";
import type { ChapterRow } from "@/lib/studio/types";
import { StatusBadge } from "./StatusBadge";

const AUTOSAVE_MS = 1500;

type SaveState = "saved" | "dirty" | "saving" | "error";

function backupKey(id: string) {
  return `oq:chapter-backup:${id}`;
}

function readBackup(id: string): { title: string; body: string; at: number } | null {
  try {
    const raw = localStorage.getItem(backupKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeBackup(id: string, title: string, body: string) {
  try {
    localStorage.setItem(backupKey(id), JSON.stringify({ title, body, at: Date.now() }));
  } catch {
    /* storage unavailable: the server save is the source of truth */
  }
}

function clearBackup(id: string) {
  try {
    localStorage.removeItem(backupKey(id));
  } catch {
    /* ignore */
  }
}

/** A datetime-local value for one hour from now, in the writer's own time zone. */
function defaultScheduleValue() {
  const d = new Date(Date.now() + 3600_000);
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function ChapterEditor({
  chapter,
  storyTitle,
  storyStatus,
}: {
  chapter: ChapterRow;
  storyTitle: string;
  storyStatus: string;
}) {
  const [title, setTitle] = useState(chapter.title);
  const [body, setBody] = useState(chapter.body);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(chapter.updated_at);
  const [focus, setFocus] = useState(false);
  const [status, setStatus] = useState(chapter.status);
  const [publishAt, setPublishAt] = useState(chapter.publish_at);
  const [scheduleValue, setScheduleValue] = useState(defaultScheduleValue);
  const [publishMsg, setPublishMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [restore, setRestore] = useState<{ title: string; body: string } | null>(null);
  const [publishing, startPublish] = useTransition();

  // Refs carry the latest values into timers and event handlers without re-subscribing.
  const latest = useRef({ title, body });
  const saved = useRef({ title: chapter.title, body: chapter.body });
  const version = useRef<string | null>(chapter.updated_at);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false); // set after a conflict so autosave stops overwriting

  latest.current = { title, body };
  const dirty = title !== saved.current.title || body !== saved.current.body;

  // Offer to restore an unsaved local copy from a previous session.
  useEffect(() => {
    const b = readBackup(chapter.id);
    if (b && (b.title !== chapter.title || b.body !== chapter.body) && b.at > Date.parse(chapter.updated_at)) {
      setRestore({ title: b.title, body: b.body });
    } else if (b) {
      clearBackup(chapter.id);
    }
  }, [chapter.id, chapter.title, chapter.body, chapter.updated_at]);

  const doSave = useCallback(async (): Promise<boolean> => {
    if (blocked.current) return false;
    const snapshot = { ...latest.current };
    if (snapshot.title === saved.current.title && snapshot.body === saved.current.body) {
      setSaveState("saved");
      return true;
    }
    setSaveState("saving");
    try {
      const r = await saveChapterDraft(chapter.id, snapshot.title, snapshot.body, version.current);
      if (!r.ok) {
        if (r.conflict) blocked.current = true;
        setSaveError(r.error ?? "Save failed.");
        setSaveState("error");
        return false;
      }
      saved.current = snapshot;
      version.current = r.savedAt ?? version.current;
      setSavedAt(r.savedAt ?? null);
      setSaveError(null);
      const stillDirty = latest.current.title !== snapshot.title || latest.current.body !== snapshot.body;
      setSaveState(stillDirty ? "dirty" : "saved");
      if (!stillDirty) clearBackup(chapter.id);
      return true;
    } catch {
      setSaveError("Could not reach the server. Your text is kept on this device; it will retry.");
      setSaveState("error");
      return false;
    }
  }, [chapter.id]);

  // Saves run one at a time, in order, so each one carries the version the previous one returned.
  const save = useCallback((): Promise<boolean> => {
    const next = queue.current.then(doSave, doSave);
    queue.current = next;
    return next;
  }, [doSave]);

  // Debounced autosave + local backup on every change.
  useEffect(() => {
    if (!dirty) return;
    writeBackup(chapter.id, title, body);
    if (saveState !== "saving") setSaveState(blocked.current ? "error" : "dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveState is read, not a trigger
  }, [title, body, dirty, save, chapter.id]);

  // Retry failed (non-conflict) saves every 10 seconds.
  useEffect(() => {
    if (saveState !== "error" || blocked.current) return;
    const t = setInterval(() => void save(), 10_000);
    return () => clearInterval(t);
  }, [saveState, save]);

  // Ctrl/Cmd+S saves now; Escape leaves focus mode; warn before leaving with unsaved text.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
      if (e.key === "Escape") setFocus(false);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") void save();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      const l = latest.current;
      if (l.title !== saved.current.title || l.body !== saved.current.body) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [save]);

  function runPublish(kind: "publish" | "schedule" | "unpublish") {
    setPublishMsg(null);
    startPublish(async () => {
      if (!(await save()) && dirty) {
        setPublishMsg({ ok: false, text: "Save your changes first." });
        return;
      }
      let r;
      if (kind === "publish") r = await publishChapter(chapter.id);
      else if (kind === "unpublish") r = await unpublishChapter(chapter.id);
      else r = await scheduleChapter(chapter.id, new Date(scheduleValue).toISOString());
      if (!r.ok) {
        setPublishMsg({ ok: false, text: r.error });
        return;
      }
      setPublishMsg({ ok: true, text: r.message ?? "Done." });
      if (kind === "publish") {
        setStatus("published");
        setPublishAt(null);
      } else if (kind === "unpublish") {
        setStatus("draft");
        setPublishAt(null);
      } else {
        setStatus("scheduled");
        setPublishAt(new Date(scheduleValue).toISOString());
      }
      // Publishing touches updated_at; carry the new version so the next autosave is not seen as a conflict.
      if (r.updatedAt) version.current = r.updatedAt;
    });
  }

  const words = countWords(body);
  const saveLabel: Record<SaveState, string> = {
    saved: savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Saved",
    dirty: "Unsaved changes",
    saving: "Saving…",
    error: "Not saved",
  };

  return (
    <div className={focus ? "fixed inset-0 z-30 overflow-y-auto bg-background" : ""}>
      <div className={`sticky ${focus ? "top-0" : "top-14"} z-10 border-b border-border bg-background/90 backdrop-blur`}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
          {!focus && (
            <Link href={`/studio/${chapter.story_id}`} className="truncate text-muted hover:text-foreground">
              ← {storyTitle}
            </Link>
          )}
          <span className="font-mono text-muted">Ch. {chapter.number}</span>
          <StatusBadge status={status} />
          <span className="ml-auto text-muted">{words.toLocaleString()} words</span>
          <span
            role="status"
            className={saveState === "error" ? "text-danger" : saveState === "saved" ? "text-muted" : "text-amber-300"}
          >
            {saveLabel[saveState]}
          </span>
          <button
            onClick={() => setFocus((f) => !f)}
            className="rounded border border-border px-2 py-1 hover:bg-surface-2"
            title="Focus mode (Esc to leave)"
          >
            {focus ? "Exit focus" : "Focus"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-24">
        {restore && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-400/40 bg-amber-400/5 p-3 text-sm">
            <span className="flex-1">This device has unsaved text from an earlier session.</span>
            <button
              className="rounded border border-border px-3 py-1 hover:bg-surface-2"
              onClick={() => {
                setTitle(restore.title);
                setBody(restore.body);
                setRestore(null);
              }}
            >
              Restore it
            </button>
            <button
              className="text-muted hover:text-foreground"
              onClick={() => {
                clearBackup(chapter.id);
                setRestore(null);
              }}
            >
              Discard
            </button>
          </div>
        )}
        {saveError && <p className="mt-4 rounded-md border border-danger/40 p-3 text-sm text-danger">{saveError}</p>}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder={`Chapter ${chapter.number} title`}
          aria-label="Chapter title"
          className="mt-8 w-full bg-transparent font-serif text-3xl outline-none placeholder:text-muted/60"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Begin writing. Leave a blank line between paragraphs."
          aria-label="Chapter text"
          spellCheck
          style={{ fieldSizing: "content" } as React.CSSProperties}
          className="mt-6 min-h-[60vh] w-full resize-none bg-transparent font-serif text-lg leading-8 outline-none placeholder:text-muted/60"
        />

        {!focus && (
          <section className="mt-10 rounded-lg border border-border bg-surface p-5">
            <h2 className="font-serif text-xl">Publishing</h2>
            <p className="mt-1 text-sm text-muted">
              {status === "published" && "This chapter is live. Edits go live as they save."}
              {status === "scheduled" &&
                publishAt &&
                `Scheduled for ${new Date(publishAt).toLocaleString()}. Edits are saved until then.`}
              {status === "draft" && "This chapter is a draft. Only you can see it."}
              {storyStatus === "draft" && " The story itself is still a draft, so readers cannot see it yet."}
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              {status !== "published" && (
                <button
                  disabled={publishing}
                  onClick={() => runPublish("publish")}
                  className="rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-60"
                >
                  Publish now
                </button>
              )}
              {status !== "published" && (
                <div className="flex items-end gap-2">
                  <label className="text-sm">
                    <span className="block text-muted">Or schedule for</span>
                    <input
                      type="datetime-local"
                      value={scheduleValue}
                      onChange={(e) => setScheduleValue(e.target.value)}
                      className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 [color-scheme:dark]"
                    />
                  </label>
                  <button
                    disabled={publishing || !scheduleValue}
                    onClick={() => runPublish("schedule")}
                    className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-60"
                  >
                    {status === "scheduled" ? "Reschedule" : "Schedule"}
                  </button>
                </div>
              )}
              {status !== "draft" && (
                <button
                  disabled={publishing}
                  onClick={() => runPublish("unpublish")}
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
                >
                  {status === "scheduled" ? "Cancel schedule" : "Unpublish"}
                </button>
              )}
            </div>
            {publishMsg && (
              <p className={`mt-3 text-sm ${publishMsg.ok ? "text-emerald-300" : "text-danger"}`}>{publishMsg.text}</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
