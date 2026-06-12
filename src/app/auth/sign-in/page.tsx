"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="chapter-eyebrow mb-2 text-center">The Scribe</p>
        <h1 className="font-display text-center text-3xl font-medium text-ink-900">
          Enter the writing room
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-ink-400">
          We&apos;ll send a link to your inbox. No password to remember.
        </p>

        {status === "sent" ? (
          <div className="mt-8 rounded-lg border border-vellum-300 bg-vellum-50 p-5 text-center shadow-margin-note">
            <p className="text-sm text-ink-600">
              A sign-in link is on its way to{" "}
              <span className="font-medium text-ink-900">{email}</span>. Open
              it on this device to continue.
            </p>
          </div>
        ) : (
          <form onSubmit={sendLink} className="mt-8 space-y-3">
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ministry.org"
              className="w-full rounded-lg border border-vellum-300 bg-vellum-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-vellum-400"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-oxblood-600 px-4 py-3 text-sm font-medium text-vellum-50 transition-colors hover:bg-oxblood-500 disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {status === "error" && (
              <p className="text-center text-sm text-error-600">
                {errorMessage}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
