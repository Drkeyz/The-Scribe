"use client";

import { useRef, useState, useTransition } from "react";
import {
  deletePhrase,
  deleteScripture,
  deleteStory,
  saveWritingSample,
} from "@/app/voice/actions";

const ACTIONS = {
  phrase: deletePhrase,
  scripture: deleteScripture,
  story: deleteStory,
} as const;

/** Small, quiet remove control — appears on hover, oxblood on intent. */
export function RemoveButton(props: {
  id: string;
  kind: keyof typeof ACTIONS;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Remove ${props.label}`}
      disabled={pending}
      onClick={() => startTransition(() => ACTIONS[props.kind](props.id))}
      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-vellum-300 bg-vellum-50 text-[11px] leading-none text-ink-400 shadow-margin-note transition-colors hover:border-oxblood-500 hover:text-oxblood-600 group-hover:flex disabled:opacity-50"
    >
      ×
    </button>
  );
}

/** The writing sample editor — few-shot grounding for generation. */
export function WritingSampleEditor(props: { initial: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await saveWritingSample(formData);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        })
      }
    >
      <textarea
        name="sample"
        defaultValue={props.initial}
        rows={9}
        placeholder="Paste a passage you have written — a chapter opening, a newsletter, a sermon transcript. 300–800 words is ideal. The Scribe studies it for rhythm and cadence, the things an interview can't fully capture…"
        className="font-manuscript w-full resize-y rounded-lg border border-vellum-300 bg-vellum-50 px-4 py-3 text-[15px] leading-[1.8] text-ink-800 placeholder:font-sans placeholder:text-sm placeholder:text-ink-300 focus:border-vellum-400"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-oxblood-600 px-4 py-2 text-sm font-medium text-vellum-50 transition-colors hover:bg-oxblood-500 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save sample"}
        </button>
        <span
          aria-live="polite"
          className={`text-xs text-bless-600 transition-opacity duration-300 ${saved ? "opacity-100" : "opacity-0"}`}
        >
          Saved — the Scribe will study it.
        </span>
      </div>
    </form>
  );
}
