"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OutlineGenerator(props: {
  bookId: string;
  hasOutline: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: props.bookId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong — try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the Scribe — check your connection and try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={working}
        className="rounded-lg bg-oxblood-600 px-5 py-2.5 text-sm font-medium text-vellum-50 transition-colors hover:bg-oxblood-500 disabled:opacity-60"
      >
        {working
          ? "The Scribe is shaping the arc…"
          : props.hasOutline
            ? "Reshape the outline"
            : "Ask the Scribe for an outline"}
      </button>
      {working && (
        <p className="mt-2 animate-pulse text-xs text-gilt-600">
          ✦ Reading your voice profile, matching stories to chapters…
        </p>
      )}
      {error && <p className="mt-2 text-xs text-error-600">{error}</p>}
    </div>
  );
}
