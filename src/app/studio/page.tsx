import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudioNav } from "@/components/ui/StudioNav";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const supabase = await createClient();

  const [personRes, profileRes, phrasesRes, scripturesRes, storiesRes, booksRes] =
    await Promise.all([
      supabase.from("profiles").select("full_name, pen_name").single(),
      supabase
        .from("voice_profiles")
        .select("completeness, calling_summary")
        .single(),
      supabase.from("signature_phrases").select("*", { count: "exact", head: true }),
      supabase.from("anchor_scriptures").select("*", { count: "exact", head: true }),
      supabase.from("stories").select("*", { count: "exact", head: true }),
      supabase
        .from("books")
        .select("id, title, subtitle, premise, chapters(status)")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  const fullName =
    personRes.data?.pen_name || personRes.data?.full_name || "";
  if (!fullName) redirect("/welcome");
  const firstName = fullName.split(" ")[0];
  const completeness = profileRes.data?.completeness ?? 0;
  const calling = profileRes.data?.calling_summary ?? null;
  const books = booksRes.data ?? [];

  const headline = completeness < 40 ? "Early days" : "Taking shape";
  const subline =
    completeness >= 80
      ? "Rich enough to write from"
      : "Keep talking to the Scribe";

  return (
    <>
      <StudioNav active="studio" />
      <main className="mx-auto max-w-6xl px-6 py-14">
        {/* ============ Hero: greeting + voice card ============ */}
        <section className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start">
          <div>
            <p className="chapter-eyebrow mb-4">The desk</p>
            <h1 className="font-display text-5xl font-medium leading-[1.08] tracking-tight text-ink-900 md:text-6xl">
              Welcome back,
              <br />
              {firstName}.
            </h1>
            {calling && (
              <p className="font-manuscript mt-7 max-w-xl text-xl italic leading-relaxed text-ink-600">
                "{calling}"
              </p>
            )}
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/interview"
                className="rounded-lg bg-oxblood-500 px-5 py-3 text-sm font-medium text-vellum-50 transition-colors hover:bg-oxblood-600"
              >
                Continue the interview →
              </Link>
              <Link
                href="/voice"
                className="rounded-lg border border-vellum-300 bg-vellum-50 px-5 py-3 text-sm text-ink-900 transition-colors hover:border-vellum-400"
              >
                View your voice
              </Link>
            </div>
          </div>

          {/* ---- Voice profile card ---- */}
          <aside className="rounded-2xl border border-vellum-300 bg-vellum-50 p-8 shadow-page">
            <div className="flex items-center gap-5">
              <Ring value={completeness} />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-gilt-600">
                  Voice profile
                </p>
                <p className="font-display mt-0.5 text-2xl font-medium text-ink-900">
                  {headline}
                </p>
                <p className="text-sm text-ink-400">{subline}</p>
              </div>
            </div>

            <dl className="mt-7">
              <StatRow label="Calling" value={calling ? "Set" : "—"} />
              <StatRow
                label="Signature phrases"
                value={String(phrasesRes.count ?? 0)}
              />
              <StatRow
                label="Anchor scriptures"
                value={String(scripturesRes.count ?? 0)}
              />
              <StatRow
                label="Stories banked"
                value={String(storiesRes.count ?? 0)}
              />
            </dl>

            <Link
              href="/interview"
              className="mt-6 inline-block text-sm font-medium text-oxblood-600 transition-colors hover:text-oxblood-500"
            >
              Keep building your voice →
            </Link>
          </aside>
        </section>

        {/* ============ On the desk ============ */}
        <section className="mt-20 border-t border-vellum-300 pt-12">
          <div className="mb-7 flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-medium text-ink-900">
              On the desk
            </h2>
            <Link
              href="/books"
              className="text-sm font-medium text-oxblood-600 transition-colors hover:text-oxblood-500"
            >
              All books →
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {books.map((b) => {
              const chapters = (b.chapters ?? []) as { status: string }[];
              const total = chapters.length;
              const written = chapters.filter(
                (c) => c.status !== "outlined"
              ).length;
              return (
                <article
                  key={b.id}
                  className="rounded-2xl border border-vellum-300 bg-vellum-50 p-7 shadow-margin-note"
                >
                  <h3 className="font-display text-2xl font-medium text-ink-900">
                    {b.title}
                  </h3>
                  {b.subtitle && (
                    <p className="font-manuscript mt-0.5 italic text-ink-400">
                      {b.subtitle}
                    </p>
                  )}
                  {b.premise && (
                    <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-ink-600">
                      {b.premise}
                    </p>
                  )}

                  {total > 0 && (
                    <div className="mt-6">
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
                          Chapters
                        </span>
                        <span className="text-sm text-ink-400">
                          {written === 0
                            ? `${total} outlined`
                            : `${written} of ${total} written`}
                        </span>
                      </div>
                      <div
                        className="flex gap-1.5"
                        role="progressbar"
                        aria-valuenow={written}
                        aria-valuemin={0}
                        aria-valuemax={total}
                      >
                        {Array.from({ length: total }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-3.5 flex-1 rounded ${
                              i < written ? "bg-gilt-500" : "bg-vellum-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/books/${b.id}`}
                    className="mt-6 inline-block text-sm font-medium text-oxblood-600 transition-colors hover:text-oxblood-500"
                  >
                    Open book →
                  </Link>
                </article>
              );
            })}

            {/* ---- Begin a new book ---- */}
            <Link
              href="/books"
              className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-vellum-400 p-7 text-center transition-colors hover:border-ink-400"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gilt-100 text-xl text-gilt-600">
                +
              </span>
              <span className="font-display mt-4 text-2xl font-medium text-ink-900">
                Begin a new book
              </span>
              <span className="mt-1.5 max-w-[220px] text-sm leading-relaxed text-ink-400">
                Give the Scribe a premise and it writes in your voice
              </span>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

/* ---------- pieces ---------- */

function StatRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-vellum-200 py-3.5 first:border-t-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
        {props.label}
      </dt>
      <dd className="font-display text-xl font-medium text-ink-900">
        {props.value}
      </dd>
    </div>
  );
}

function Ring(props: { value: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const filled = (props.value / 100) * c;
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      role="img"
      aria-label={`Voice profile ${props.value}% complete`}
      className="shrink-0"
    >
      <circle cx="48" cy="48" r={r} fill="none" stroke="var(--color-vellum-200)" strokeWidth="7" />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke="var(--color-gilt-500)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(-90 48 48)"
      />
      <text
        x="48"
        y="54"
        textAnchor="middle"
        fontSize="20"
        fontWeight="600"
        fill="var(--color-ink-900)"
      >
        {props.value}%
      </text>
    </svg>
  );
}
