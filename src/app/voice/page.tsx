import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudioNav } from "@/components/ui/StudioNav";
import {
  RemoveButton,
  WritingSampleEditor,
} from "@/components/voice/VoiceControls";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const supabase = await createClient();

  const [profileRes, personRes, phrasesRes, scripturesRes, storiesRes] =
    await Promise.all([
      supabase.from("voice_profiles").select("*").single(),
      supabase.from("profiles").select("full_name, pen_name").single(),
      supabase
        .from("signature_phrases")
        .select("id, phrase, context")
        .order("created_at", { ascending: true }),
      supabase
        .from("anchor_scriptures")
        .select("id, reference, translation, significance, themes")
        .order("created_at", { ascending: true }),
      supabase
        .from("stories")
        .select("id, title, summary, year_or_era, themes, emotional_register")
        .order("created_at", { ascending: true }),
    ]);

  const profile = profileRes.data;
  const name =
    personRes.data?.pen_name || personRes.data?.full_name || "this author";
  const phrases = phrasesRes.data ?? [];
  const scriptures = scripturesRes.data ?? [];
  const stories = storiesRes.data ?? [];
  const framework = (profile?.framework ?? {}) as Record<string, string>;
  const habits = (profile?.habits ?? {}) as Record<string, string | boolean>;
  const completeness: number = profile?.completeness ?? 0;

  const isEmpty =
    completeness === 0 &&
    phrases.length === 0 &&
    scriptures.length === 0 &&
    stories.length === 0;

  return (
    <>
      <StudioNav active="voice" />
      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* ============ Hero ============ */}
        <header className="mb-14 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <p className="chapter-eyebrow mb-3">Voice profile</p>
            <h1 className="font-display text-5xl font-medium leading-[1.1] tracking-tight text-ink-900">
              The voice of
              <br />
              {name}
            </h1>
            {profile?.calling_summary && (
              <p className="font-manuscript mt-5 text-lg italic leading-relaxed text-ink-600">
                "{profile.calling_summary}"
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {profile?.primary_lean && (
                <span className="rounded-full border border-oxblood-500/30 bg-oxblood-100 px-3.5 py-1.5 text-xs font-medium capitalize text-oxblood-700">
                  {profile.primary_lean}
                </span>
              )}
              {profile?.secondary_lean && (
                <span className="rounded-full border border-vellum-300 bg-vellum-50 px-3.5 py-1.5 text-xs capitalize text-ink-600">
                  {profile.secondary_lean}
                </span>
              )}
              {profile?.audience && (
                <span className="rounded-full border border-vellum-300 bg-vellum-50 px-3.5 py-1.5 text-xs text-ink-600">
                  Writes for {profile.audience}
                </span>
              )}
            </div>
          </div>

          <figure className="flex shrink-0 items-center gap-4">
            <Ring value={completeness} />
            <figcaption className="max-w-[130px] text-sm leading-snug text-ink-400">
              {completeness >= 80
                ? "Rich enough to write from"
                : completeness >= 40
                  ? "Taking shape — keep talking"
                  : "Early days. Sit with the Scribe."}
            </figcaption>
          </figure>
        </header>

        {isEmpty ? (
          <div className="rounded-2xl border border-vellum-300 bg-vellum-50 p-12 text-center shadow-page">
            <p className="font-display text-xl text-ink-900">
              Your voice profile is an empty page.
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-400">
              Sit with the Scribe for fifteen minutes. Tell it about your
              calling, your scriptures, your stories — and watch this page
              fill with you.
            </p>
            <Link
              href="/interview"
              className="mt-6 inline-block rounded-lg bg-oxblood-500 px-5 py-2.5 text-sm font-medium text-vellum-50 transition-colors hover:bg-oxblood-600"
            >
              Begin the interview
            </Link>
          </div>
        ) : (
          <div className="space-y-16">
            {/* ============ Anchor scriptures ============ */}
            {scriptures.length > 0 && (
              <Section
                title="Anchor scriptures"
                note="The passages this voice lives in"
              >
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {scriptures.map((s) => (
                    <figure
                      key={s.id}
                      className="group relative rounded-2xl border border-vellum-300 bg-vellum-50 p-6 shadow-margin-note"
                    >
                      <RemoveButton id={s.id} kind="scripture" label={s.reference} />
                      <figcaption className="font-display text-lg font-medium text-ink-900">
                        {s.reference}
                        {s.translation && (
                          <span className="ml-2 text-xs font-normal text-ink-400">
                            {s.translation}
                          </span>
                        )}
                      </figcaption>
                      {s.significance && (
                        <p className="mt-2 text-sm leading-relaxed text-ink-600">
                          {s.significance}
                        </p>
                      )}
                      {(s.themes?.length ?? 0) > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {s.themes!.map((t: string) => (
                            <span key={t} className="text-[11px] text-gilt-600">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </figure>
                  ))}
                </div>
              </Section>
            )}

            {/* ============ Signature phrases — two-column lexicon ============ */}
            {phrases.length > 0 && (
              <Section
                title="Signature phrases"
                note="Language that is unmistakably yours"
              >
                <div className="grid gap-x-14 md:grid-cols-2">
                  {phrases.map((p) => (
                    <div
                      key={p.id}
                      className="group relative border-t border-vellum-300 py-5"
                    >
                      <RemoveButton id={p.id} kind="phrase" label={p.phrase} />
                      <p className="font-manuscript text-xl italic leading-snug text-ink-900">
                        "{p.phrase}"
                      </p>
                      {p.context && (
                        <p className="mt-2 text-sm leading-relaxed text-ink-600">
                          {p.context}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ============ Story bank ============ */}
            {stories.length > 0 && (
              <Section
                title="Story bank"
                note="Testimonies and turning points, ready to be retold"
              >
                <div className="grid gap-5 md:grid-cols-2">
                  {stories.map((s) => (
                    <article
                      key={s.id}
                      className="group relative rounded-2xl border border-vellum-300 bg-vellum-50 p-7 shadow-margin-note"
                    >
                      <RemoveButton id={s.id} kind="story" label={s.title} />
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-gilt-600">
                        Testimony
                      </p>
                      <h3 className="font-display mt-2 text-xl font-medium leading-snug text-ink-900">
                        {s.title}
                      </h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
                        {s.summary}
                      </p>
                      {(s.year_or_era || s.emotional_register) && (
                        <p className="mt-3 text-xs text-ink-400">
                          {[s.year_or_era, s.emotional_register]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </Section>
            )}

            {/* ============ Framework + habits ============ */}
            {(Object.keys(framework).length > 0 ||
              Object.keys(habits).length > 0) && (
              <div className="grid gap-14 md:grid-cols-2">
                {Object.keys(framework).length > 0 && (
                  <Section
                    title="Theological framework"
                    note="Positions every page must honor"
                  >
                    <dl>
                      {Object.entries(framework).map(([k, v]) => (
                        <div
                          key={k}
                          className="border-t border-vellum-300 py-4 first:border-t-0"
                        >
                          <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-gilt-600">
                            {k.replace(/_/g, " ")}
                          </dt>
                          <dd className="mt-1.5 text-[15px] leading-relaxed text-ink-800">
                            {String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Section>
                )}
                {Object.keys(habits).length > 0 && (
                  <Section
                    title="Structural habits"
                    note="How your chapters are built"
                  >
                    <ul>
                      {Object.entries(habits).map(([k, v]) => {
                        const isOff = v === false || v === "No" || v === "no";
                        return (
                          <li
                            key={k}
                            className="flex gap-3.5 border-t border-vellum-300 py-4 first:border-t-0"
                          >
                            <span
                              aria-hidden="true"
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] ${
                                isOff
                                  ? "bg-vellum-200 text-ink-300"
                                  : "bg-gilt-100 text-gilt-600"
                              }`}
                            >
                              {isOff ? "–" : "✓"}
                            </span>
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
                                {k.replace(/_/g, " ")}
                              </p>
                              <p className="mt-1 text-[15px] leading-relaxed text-ink-800">
                                {typeof v === "boolean"
                                  ? v
                                    ? "Yes"
                                    : "No"
                                  : String(v)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </Section>
                )}
              </div>
            )}

            {/* ============ Writing sample ============ */}
            <Section
              title="Writing sample"
              note="Optional, powerful — the Scribe studies your cadence directly"
            >
              <WritingSampleEditor initial={profile?.writing_sample ?? ""} />
            </Section>

            <footer className="border-t border-vellum-300 pt-8 text-center">
              <p className="text-sm text-ink-400">
                Something missing?{" "}
                <Link
                  href="/interview"
                  className="font-medium text-oxblood-600 hover:text-oxblood-500"
                >
                  Return to the interview
                </Link>{" "}
                — the Scribe will pick up where you left off.
              </p>
            </footer>
          </div>
        )}
      </main>
    </>
  );
}

/* ---------- pieces ---------- */

function Section(props: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-3xl font-medium text-ink-900">
          {props.title}
        </h2>
        {props.note && <p className="text-sm text-ink-400">{props.note}</p>}
      </div>
      {props.children}
    </section>
  );
}

function Ring(props: { value: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const filled = (props.value / 100) * c;
  return (
    <svg
      width="92"
      height="92"
      viewBox="0 0 92 92"
      role="img"
      aria-label={`Voice profile ${props.value}% complete`}
    >
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--color-vellum-200)" strokeWidth="6" />
      <circle
        cx="46"
        cy="46"
        r={r}
        fill="none"
        stroke="var(--color-gilt-500)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(-90 46 46)"
      />
      <text
        x="46"
        y="52"
        textAnchor="middle"
        fontSize="19"
        fontWeight="600"
        fill="var(--color-ink-900)"
      >
        {props.value}%
      </text>
    </svg>
  );
}
