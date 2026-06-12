"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { stripChapterHeading } from "@/lib/format";

type ChapterData = {
  id: string;
  number: number;
  title: string;
  synopsis: string | null;
  content: string;
  status: string;
  wordCount: number;
};

type ScribeAction = "rewrite" | "scripture" | "drift" | "ask";

type MarginNote = {
  id: string;
  action: ScribeAction;
  anchor: string | null;
  selection: string | null;
  reply: string;
  proposal: string | null;
  state: "loading" | "ready" | "applied" | "apply-failed" | "dismissed";
};

const GROUNDING_RE = /\[\[grounding:\s*(\{[\s\S]*?\})\s*\]\]\s*$/;
const ERROR_RE = /\[\[error:[\s\S]*?\]\]\s*$/;

const ACTION_LABEL: Record<ScribeAction, string> = {
  rewrite: "Rewrite in my voice",
  scripture: "Suggest a scripture",
  drift: "Voice drift",
  ask: "Ask the Scribe",
};

export function ChapterEditor(props: {
  bookId: string;
  bookTitle: string;
  chapter: ChapterData;
  prev: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}) {
  const [content, setContent] = useState(() =>
    stripChapterHeading(
      props.chapter.content,
      props.chapter.number,
      props.chapter.title
    )
  );
  const [status, setStatus] = useState(props.chapter.status);
  const [mode, setMode] = useState<"read" | "write">("read");
  const [generating, setGenerating] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [genError, setGenError] = useState<string | null>(null);

  // ---- margin scribe state ----
  const [notes, setNotes] = useState<MarginNote[]>([]);
  const [toolbar, setToolbar] = useState<{
    x: number;
    y: number;
    text: string;
    asking: boolean;
  } | null>(null);
  const [askDraft, setAskDraft] = useState("");
  const articleRef = useRef<HTMLDivElement>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const wordCount =
    content.trim() === "" ? 0 : content.trim().split(/\s+/).length;

  /* ---------- saving ---------- */
  const save = useCallback(
    async (body: {
      content: string;
      grounding?: { stories: string[]; scriptures: string[] };
      fromGeneration?: boolean;
    }) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/chapters/${props.chapter.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (data?.status) setStatus(data.status);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("idle");
      }
    },
    [props.chapter.id]
  );

  function onEdit(value: string) {
    setContent(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save({ content: contentRef.current });
    }, 1200);
  }

  /* ---------- generation ---------- */
  async function generate() {
    setGenerating(true);
    setGenError(null);
    setMode("read");
    setContent("");
    try {
      const res = await fetch("/api/generate/chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: props.chapter.id }),
      });
      if (!res.ok || !res.body) throw new Error("generation failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setContent(
          full.replace(GROUNDING_RE, "").replace(/\[\[groundi?n?g?:?[\s\S]*$/, "")
        );
      }

      if (ERROR_RE.test(full)) {
        setGenError("The Scribe lost the thread mid-chapter — generate again.");
        setContent(full.replace(ERROR_RE, "").trim());
        return;
      }

      let grounding = { stories: [] as string[], scriptures: [] as string[] };
      const match = full.match(GROUNDING_RE);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          grounding = {
            stories: Array.isArray(parsed.stories) ? parsed.stories : [],
            scriptures: Array.isArray(parsed.scriptures) ? parsed.scriptures : [],
          };
        } catch {
          /* manifest malformed — save without it */
        }
      }
      const manuscript = stripChapterHeading(
        full.replace(GROUNDING_RE, "").trim(),
        props.chapter.number,
        props.chapter.title
      );
      setContent(manuscript);
      await save({ content: manuscript, grounding, fromGeneration: true });
    } catch {
      setGenError("Couldn't reach the Scribe — check the terminal and try again.");
    } finally {
      setGenerating(false);
    }
  }

  /* ---------- the margin scribe ---------- */
  function onMouseUpInManuscript() {
    if (mode !== "read" || generating) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || text.length < 12 || text.length > 2000) {
      setToolbar(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setToolbar({
      x: Math.max(12, rect.left + rect.width / 2),
      y: Math.max(12, rect.top - 10),
      text,
      asking: false,
    });
  }

  async function callScribe(
    action: ScribeAction,
    selection: string | null,
    instruction?: string
  ) {
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
    const noteId = `${Date.now()}`;
    setNotes((n) => [
      {
        id: noteId,
        action,
        anchor: selection ? selection.slice(0, 160) : null,
        selection: selection ?? null,
        reply: "",
        proposal: null,
        state: "loading",
      },
      ...n,
    ]);
    try {
      const res = await fetch("/api/scribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: props.chapter.id,
          action,
          selection: selection ?? undefined,
          instruction,
          content: contentRef.current,
        }),
      });
      const data = await res.json().catch(() => null);
      setNotes((n) =>
        n.map((note) =>
          note.id === noteId
            ? {
                ...note,
                reply: data?.reply ?? "Something went wrong — try again.",
                proposal: data?.proposal ?? null,
                state: "ready",
              }
            : note
        )
      );
    } catch {
      setNotes((n) =>
        n.map((note) =>
          note.id === noteId
            ? { ...note, reply: "Couldn't reach the Scribe.", state: "ready" }
            : note
        )
      );
    }
  }

  function applyProposal(note: MarginNote) {
    if (!note.proposal || !note.selection) return;
    // Replace the FULL selected passage. If the manuscript changed since
    // the note was created and the passage no longer exists verbatim,
    // fail gracefully rather than corrupt the text.
    const current = contentRef.current;
    const idx = current.indexOf(note.selection);
    if (idx === -1) {
      setNotes((n) =>
        n.map((x) => (x.id === note.id ? { ...x, state: "apply-failed" } : x))
      );
      return;
    }
    const next =
      current.slice(0, idx) +
      note.proposal +
      current.slice(idx + note.selection.length);
    setContent(next);
    save({ content: next });
    setNotes((n) =>
      n.map((x) => (x.id === note.id ? { ...x, state: "applied" } : x))
    );
  }

  const visibleNotes = notes.filter((n) => n.state !== "dismissed");

  /* ---------- layout ---------- */
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-vellum-300 bg-vellum-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0">
            <Link
              href={`/books/${props.bookId}`}
              className="text-xs text-ink-400 hover:text-ink-900"
            >
              ← {props.bookTitle}
            </Link>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-400">
            <span aria-live="polite">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : `${wordCount.toLocaleString()} words`}
            </span>
            <span className="rounded-full bg-vellum-200 px-2.5 py-0.5 capitalize">
              {status}
            </span>
            {content && !generating && (
              <div className="flex rounded-lg border border-vellum-300 p-0.5">
                <ModeButton active={mode === "read"} onClick={() => setMode("read")}>
                  Read
                </ModeButton>
                <ModeButton active={mode === "write"} onClick={() => setMode("write")}>
                  Write
                </ModeButton>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ============ The manuscript column ============ */}
        <main className="min-w-0">
          <p className="chapter-eyebrow mb-2">Chapter {props.chapter.number}</p>
          <h1 className="chapter-title mb-10">{props.chapter.title}</h1>

          {!content && !generating && (
            <div className="rounded-lg border border-vellum-300 bg-vellum-50 p-10 text-center shadow-page">
              {props.chapter.synopsis && (
                <p className="font-manuscript mx-auto max-w-lg text-[15px] italic leading-relaxed text-ink-600">
                  {props.chapter.synopsis}
                </p>
              )}
              <button
                onClick={generate}
                className="mt-6 rounded-lg bg-oxblood-600 px-6 py-3 text-sm font-medium text-vellum-50 transition-colors hover:bg-oxblood-500"
              >
                Let the Scribe write this chapter
              </button>
              <p className="mt-3 text-xs text-ink-300">
                It writes from your voice profile — you remain the editor.
              </p>
            </div>
          )}

          {genError && (
            <div className="mb-6 rounded-lg border border-oxblood-500/40 bg-oxblood-100 px-4 py-3 text-sm text-oxblood-700">
              {genError}{" "}
              <button onClick={generate} className="font-medium underline">
                Retry
              </button>
            </div>
          )}

          {(content || generating) &&
            (mode === "write" && !generating ? (
              <textarea
                value={content}
                onChange={(e) => onEdit(e.target.value)}
                rows={Math.max(20, content.split("\n").length + 4)}
                className="font-manuscript w-full resize-y rounded-lg border border-vellum-300 bg-vellum-50 px-6 py-5 text-[17px] leading-[1.85] text-ink-800 focus:border-vellum-400"
                aria-label="Chapter manuscript"
              />
            ) : (
              <div ref={articleRef} onMouseUp={onMouseUpInManuscript}>
                <article className="rounded-lg border border-vellum-300 bg-vellum-50 px-8 py-10 shadow-page md:px-12">
                  <Manuscript content={content} />
                  {generating && (
                    <p className="mt-6 animate-pulse text-xs text-gilt-600">
                      ✦ The Scribe is writing in your voice…
                    </p>
                  )}
                </article>
                {content && !generating && (
                  <p className="mt-3 text-center text-xs text-ink-300">
                    Select any passage to call the Scribe to the margin.
                  </p>
                )}
              </div>
            ))}

          {content && !generating && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Regenerate this chapter? The current draft will be replaced."
                    )
                  )
                    generate();
                }}
                className="rounded-lg border border-vellum-300 px-4 py-2 text-sm text-ink-600 transition-colors hover:border-vellum-400 hover:text-ink-900"
              >
                Regenerate chapter
              </button>
              <div className="flex gap-2">
                {props.prev && (
                  <Link
                    href={`/books/${props.bookId}/chapters/${props.prev.id}`}
                    className="rounded-lg border border-vellum-300 px-4 py-2 text-sm text-ink-600 transition-colors hover:border-vellum-400 hover:text-ink-900"
                  >
                    ← Ch. {props.chapter.number - 1}
                  </Link>
                )}
                {props.next && (
                  <Link
                    href={`/books/${props.bookId}/chapters/${props.next.id}`}
                    className="rounded-lg bg-oxblood-600 px-4 py-2 text-sm font-medium text-vellum-50 transition-colors hover:bg-oxblood-500"
                  >
                    Ch. {props.chapter.number + 1} →
                  </Link>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ============ The margin ============ */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">
            <p className="chapter-eyebrow">In the margin</p>

            {content && !generating && (
              <button
                onClick={() => callScribe("drift", null)}
                className="w-full rounded-lg border border-gilt-500/50 bg-gilt-100 px-3 py-2 text-xs font-medium text-gilt-600 transition-colors hover:border-gilt-500"
              >
                ✦ Check the whole chapter for voice drift
              </button>
            )}

            {visibleNotes.length === 0 && (
              <p className="text-xs leading-relaxed text-ink-300">
                Select a passage in the manuscript and the Scribe will meet
                you here — to rewrite it in your voice, find a scripture, or
                tell you honestly if it doesn't sound like you.
              </p>
            )}

            {visibleNotes.map((note) => (
              <div key={note.id} className="margin-note animate-rise">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gilt-600">
                  {ACTION_LABEL[note.action]}
                </p>
                {note.anchor && (
                  <p className="mt-1 border-l-2 border-vellum-300 pl-2 text-[11px] italic leading-snug text-ink-400">
                    "{note.anchor}
                    {note.anchor.length >= 160 ? "…" : ""}"
                  </p>
                )}
                {note.state === "loading" ? (
                  <p className="mt-2 animate-pulse text-xs text-gilt-600">
                    ✦ The Scribe is considering…
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-xs leading-relaxed text-ink-600">
                      {note.reply}
                    </p>
                    {note.proposal && (
                      <div className="mt-2 rounded-md border border-gilt-500/40 bg-gilt-100 p-2">
                        <p className="font-manuscript max-h-40 overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-ink-800">
                          {note.proposal}
                        </p>
                        {note.state === "applied" ? (
                          <p className="mt-1.5 text-[11px] font-medium text-bless-600">
                            Applied to the manuscript.
                          </p>
                        ) : note.state === "apply-failed" ? (
                          <p className="mt-1.5 text-[11px] text-oxblood-600">
                            Couldn't auto-apply (the passage changed) — copy it
                            in Write mode.
                          </p>
                        ) : (
                          <button
                            onClick={() => applyProposal(note)}
                            className="mt-1.5 rounded-md bg-oxblood-600 px-2.5 py-1 text-[11px] font-medium text-vellum-50 transition-colors hover:bg-oxblood-500"
                          >
                            Apply to manuscript
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="scribe-byline">✦ The Scribe</span>
                  {note.state !== "loading" && (
                    <button
                      onClick={() =>
                        setNotes((n) =>
                          n.map((x) =>
                            x.id === note.id ? { ...x, state: "dismissed" } : x
                          )
                        )
                      }
                      className="text-[11px] text-ink-300 hover:text-ink-600"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ============ Floating selection toolbar ============ */}
      {toolbar && (
        <div
          className="fixed z-20 -translate-x-1/2 -translate-y-full"
          style={{ left: toolbar.x, top: toolbar.y }}
        >
          <div className="flex items-center gap-1 rounded-lg border border-vellum-300 bg-vellum-50 p-1 shadow-page">
            {toolbar.asking ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (askDraft.trim()) {
                    callScribe("ask", toolbar.text, askDraft.trim());
                    setAskDraft("");
                  }
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={askDraft}
                  onChange={(e) => setAskDraft(e.target.value)}
                  placeholder="Ask the Scribe about this passage…"
                  className="w-64 rounded-md border border-vellum-300 bg-vellum-100 px-2.5 py-1.5 text-xs text-ink-900 placeholder:text-ink-300"
                />
                <button
                  type="submit"
                  className="rounded-md bg-oxblood-600 px-2.5 py-1.5 text-xs font-medium text-vellum-50"
                >
                  Ask
                </button>
              </form>
            ) : (
              <>
                <ToolbarButton onClick={() => callScribe("rewrite", toolbar.text)}>
                  Rewrite in my voice
                </ToolbarButton>
                <ToolbarButton onClick={() => callScribe("scripture", toolbar.text)}>
                  Suggest a scripture
                </ToolbarButton>
                <ToolbarButton onClick={() => callScribe("drift", toolbar.text)}>
                  Voice drift
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => setToolbar({ ...toolbar, asking: true })}
                >
                  Ask…
                </ToolbarButton>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- the manuscript renderer ---------- */
function Manuscript({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim() !== "");
  return (
    <div className="manuscript">
      {blocks.map((block, i) => {
        const trimmed = block.trim();

        if (trimmed.startsWith("## ")) {
          return (
            <h2
              key={i}
              className="font-display mb-3 mt-8 text-lg font-medium text-ink-900"
            >
              {trimmed.slice(3)}
            </h2>
          );
        }

        if (trimmed.startsWith("> ")) {
          const lines = trimmed
            .split("\n")
            .map((l) => l.replace(/^>\s?/, "").trim())
            .filter(Boolean);
          const citeIdx = lines.findIndex((l) => l.startsWith("—"));
          const quote = (citeIdx === -1 ? lines : lines.slice(0, citeIdx)).join(" ");
          const cite = citeIdx === -1 ? null : lines[citeIdx].replace(/^—\s*/, "");
          return (
            <blockquote key={i}>
              {quote}
              {cite && <cite>{cite}</cite>}
            </blockquote>
          );
        }

        if (trimmed.startsWith(":: ")) {
          return (
            <p key={i} className="declaration">
              {trimmed
                .split("\n")
                .map((l) => l.replace(/^::\s?/, ""))
                .join(" ")}
            </p>
          );
        }

        return <p key={i}>{trimmed}</p>;
      })}
    </div>
  );
}

function ModeButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      className={
        props.active
          ? "rounded-md bg-vellum-200 px-3 py-1 text-xs font-medium text-ink-900"
          : "rounded-md px-3 py-1 text-xs text-ink-400 hover:text-ink-900"
      }
    >
      {props.children}
    </button>
  );
}

function ToolbarButton(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs text-ink-600 transition-colors hover:bg-gilt-100 hover:text-ink-900"
    >
      {props.children}
    </button>
  );
}
