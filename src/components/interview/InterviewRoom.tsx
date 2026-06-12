"use client";

import { useEffect, useRef, useState } from "react";

type Role = "scribe" | "author";
type Message = { role: Role; content: string };

type Phrase = { phrase: string; context: string | null };
type Scripture = { reference: string; significance: string | null; themes?: string[] };
type Story = {
  title: string;
  summary: string;
  year_or_era: string | null;
  emotional_register: string | null;
};

type Profile = {
  completeness: number;
  primaryLean: string | null;
  audience: string | null;
  callingSummary: string | null;
  framework: Record<string, string>;
  habits: Record<string, string | boolean>;
};

const OPENING_MESSAGE: Message = {
  role: "scribe",
  content:
    "Welcome — I'm glad you're here. Before we ever write a page together, I want to learn how God has shaped your voice. There are no wrong answers in this room; speak the way you'd speak to someone you trust.\n\nLet's begin at the root: how would you describe the calling on your life — and when did you first know it was there?",
};

export function InterviewRoom(props: {
  sessionId: string;
  initialMessages: Message[];
  initialProfile: Profile;
  initialPhrases: Phrase[];
  initialScriptures: Scripture[];
  initialStories: Story[];
}) {
  const [messages, setMessages] = useState<Message[]>(
    props.initialMessages.length > 0 ? props.initialMessages : [OPENING_MESSAGE]
  );
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [profile, setProfile] = useState<Profile>(props.initialProfile);
  const [phrases, setPhrases] = useState<Phrase[]>(props.initialPhrases);
  const [scriptures, setScriptures] = useState<Scripture[]>(props.initialScriptures);
  const [stories, setStories] = useState<Story[]>(props.initialStories);

  // ---- voice input (Web Speech API — Chrome) ----
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const baseDraftRef = useRef("");

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => recognitionRef.current?.stop();
  }, []);

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    baseDraftRef.current = draft.trim() ? draft.trim() + " " : "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          baseDraftRef.current += transcript.trim() + " ";
        } else {
          interim += transcript;
        }
      }
      setDraft((baseDraftRef.current + interim).trimStart());
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function send() {
    const answer = draft.trim();
    if (!answer || streaming) return;

    recognitionRef.current?.stop();
    baseDraftRef.current = "";

    const scribeQuestion = messages[messages.length - 1]?.content ?? "";
    const withAnswer: Message[] = [...messages, { role: "author", content: answer }];
    setMessages(withAnswer);
    setDraft("");
    setStreaming(true);

    setExtracting(true);
    fetch("/api/interview/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: props.sessionId,
        scribeQuestion,
        authorAnswer: answer,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.inserted) {
          if (data.inserted.phrases?.length)
            setPhrases((p) => [...p, ...data.inserted.phrases]);
          if (data.inserted.scriptures?.length)
            setScriptures((s) => [...s, ...data.inserted.scriptures]);
          if (data.inserted.stories?.length)
            setStories((s) => [...s, ...data.inserted.stories]);
        }
        if (data.merged) {
          setProfile((prev) => ({
            ...prev,
            completeness: data.completeness ?? prev.completeness,
            primaryLean: data.merged.primary_lean ?? prev.primaryLean,
            audience: data.merged.audience ?? prev.audience,
            callingSummary: data.merged.calling_summary ?? prev.callingSummary,
            framework: data.merged.framework ?? prev.framework,
            habits: data.merged.habits ?? prev.habits,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setExtracting(false));

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: withAnswer }),
      });
      if (!res.ok || !res.body) throw new Error("stream failed");

      setMessages((m) => [...m, { role: "scribe", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "scribe",
            content: next[next.length - 1].content + chunk,
          };
          return next;
        });
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "scribe",
          content:
            "I lost the thread for a moment — would you mind sending that again?",
        },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* ============ Left: the conversation ============ */}
      <section className="flex min-h-[80vh] flex-col">
        <header className="mb-8">
          <p className="chapter-eyebrow mb-2">The interview</p>
          <h1 className="font-display text-5xl font-medium tracking-tight text-ink-900">
            Sit with the Scribe
          </h1>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto pb-6" aria-live="polite">
          {messages.map((m, i) =>
            m.role === "scribe" ? (
              <ScribeMessage
                key={i}
                content={m.content}
                streaming={streaming && i === messages.length - 1}
              />
            ) : (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-vellum-200 px-5 py-3.5 text-[15px] leading-relaxed text-ink-800">
                  {m.content}
                </div>
              </div>
            )
          )}
          <div ref={chatEndRef} />
        </div>

        {/* ---- Composer card ---- */}
        <div className="sticky bottom-0 bg-vellum-100 pb-6 pt-2">
          <div
            className={`rounded-2xl border bg-vellum-50 p-4 shadow-page transition-colors ${
              recording ? "border-gilt-500" : "border-vellum-300"
            }`}
          >
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (!recording) baseDraftRef.current = "";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={3}
              placeholder={
                recording
                  ? "Listening — speak the way you preach…"
                  : "Answer in your own words — the more you tell, the truer your voice profile…"
              }
              className="font-manuscript w-full resize-none bg-transparent text-[16px] leading-relaxed text-ink-900 placeholder:text-ink-300 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              {speechSupported ? (
                <button
                  onClick={toggleRecording}
                  disabled={streaming}
                  aria-label={recording ? "Stop recording" : "Speak your answer"}
                  aria-pressed={recording}
                  title={recording ? "Stop recording" : "Speak your answer"}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
                    recording
                      ? "animate-pulse border-gilt-500 bg-gilt-100 text-gilt-600"
                      : "border-vellum-300 bg-vellum-100 text-ink-400 hover:border-vellum-400 hover:text-ink-900"
                  }`}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                  </svg>
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={send}
                disabled={streaming || !draft.trim()}
                className="rounded-lg bg-oxblood-500 px-6 py-2.5 text-sm font-medium text-vellum-50 transition-colors hover:bg-oxblood-600 disabled:opacity-50"
              >
                {streaming ? "Listening…" : "Send"}
              </button>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-ink-300">
            {recording
              ? "✦ Recording — click the mic again to stop, review, then send"
              : speechSupported
                ? "Enter to send · Shift+Enter for a new line · or speak with the mic"
                : "Enter to send · Shift+Enter for a new line"}
          </p>
        </div>
      </section>

      {/* ============ Right: the living Voice Profile ============ */}
      <aside className="hidden lg:block">
        <div className="sticky top-8 space-y-7 rounded-2xl border border-vellum-300 bg-vellum-200/60 p-7">
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-gilt-600">
              Your voice, taking shape
            </p>
            <div className="flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-vellum-300"
                role="progressbar"
                aria-valuenow={profile.completeness}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-gilt-500 transition-all duration-700"
                  style={{ width: `${profile.completeness}%` }}
                />
              </div>
              <span className="text-sm font-medium text-ink-600">
                {profile.completeness}%
              </span>
            </div>
            {extracting && (
              <p className="mt-2 animate-pulse text-xs text-gilt-600">
                ✦ The Scribe is taking notes…
              </p>
            )}
          </div>

          {(profile.callingSummary || profile.primaryLean || profile.audience) && (
            <PanelSection title="Calling">
              {profile.callingSummary && (
                <p className="font-manuscript text-[15px] italic leading-relaxed text-ink-900">
                  "{profile.callingSummary}"
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.primaryLean && (
                  <span className="rounded-full border border-oxblood-500/30 bg-oxblood-100 px-3 py-1.5 text-xs capitalize text-oxblood-700">
                    {profile.primaryLean}
                  </span>
                )}
                {profile.audience && <Chip>for {profile.audience}</Chip>}
              </div>
            </PanelSection>
          )}

          {phrases.length > 0 && (
            <PanelSection title={`Signature phrases · ${phrases.length}`}>
              <div className="flex flex-wrap gap-2">
                {phrases.map((p, i) => (
                  <Chip key={i} title={p.context ?? undefined}>
                    "{p.phrase}"
                  </Chip>
                ))}
              </div>
            </PanelSection>
          )}

          {scriptures.length > 0 && (
            <PanelSection title={`Anchor scriptures · ${scriptures.length}`}>
              <ul className="space-y-2">
                {scriptures.map((s, i) => (
                  <li
                    key={i}
                    className="animate-rise rounded-xl border border-vellum-300 bg-vellum-50 px-3.5 py-3"
                  >
                    <span className="text-sm font-medium text-ink-900">
                      {s.reference}
                    </span>
                    {s.significance && (
                      <span className="block text-xs leading-relaxed text-ink-400">
                        {s.significance}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </PanelSection>
          )}

          {stories.length > 0 && (
            <PanelSection title={`Story bank · ${stories.length}`}>
              <ul className="space-y-2">
                {stories.map((s, i) => (
                  <li
                    key={i}
                    className="animate-rise rounded-xl border border-vellum-300 bg-vellum-50 px-3.5 py-3"
                  >
                    <span className="text-sm font-medium text-ink-900">
                      {s.title}
                    </span>
                    <span className="block text-xs leading-relaxed text-ink-400">
                      {s.summary}
                    </span>
                  </li>
                ))}
              </ul>
            </PanelSection>
          )}

          {Object.keys(profile.framework).length > 0 && (
            <PanelSection
              title={`Theological framework · ${Object.keys(profile.framework).length}`}
            >
              <ul className="space-y-2">
                {Object.entries(profile.framework).map(([k, v]) => (
                  <li key={k} className="text-xs leading-relaxed text-ink-600">
                    <span className="font-medium capitalize text-ink-900">
                      {k.replace(/_/g, " ")}:
                    </span>{" "}
                    {String(v)}
                  </li>
                ))}
              </ul>
            </PanelSection>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ---------- pieces ---------- */

/** Scribe messages render prose paragraphs, with the final paragraph —
 *  the question — set apart as a bordered italic block, per the design. */
function ScribeMessage(props: { content: string; streaming: boolean }) {
  const paragraphs = props.content.split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <div className="max-w-[88%]">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-gilt-600">
        ✦ The Scribe
      </p>
      {paragraphs.map((p, i) => {
        const isQuestion = i === paragraphs.length - 1 && !props.streaming;
        const isLast = i === paragraphs.length - 1;
        if (isQuestion || (isLast && props.streaming && paragraphs.length > 1)) {
          return (
            <p
              key={i}
              className="font-manuscript mt-4 border-l-2 border-gilt-500 pl-4 text-[17px] italic leading-relaxed text-ink-900"
            >
              {p.trim()}
              {props.streaming && <Cursor />}
            </p>
          );
        }
        return (
          <p
            key={i}
            className="font-manuscript mb-3 text-[17px] leading-relaxed text-ink-800"
          >
            {p.trim()}
            {props.streaming && isLast && <Cursor />}
          </p>
        );
      })}
    </div>
  );
}

function Cursor() {
  return (
    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-gilt-500 align-middle" />
  );
}

function PanelSection(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="animate-rise">
      <h2 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-gilt-600">
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function Chip(props: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={props.title}
      className="animate-rise inline-block rounded-full border border-vellum-300 bg-vellum-50 px-3 py-1.5 text-xs text-ink-800"
    >
      {props.children}
    </span>
  );
}
