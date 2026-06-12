import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudioNav } from "@/components/ui/StudioNav";
import { createBook } from "./actions";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const supabase = await createClient();

  const [booksRes, profileRes] = await Promise.all([
    supabase
      .from("books")
      .select("id, title, subtitle, premise, created_at, chapters(status)")
      .order("created_at", { ascending: false }),
    supabase.from("voice_profiles").select("completeness").single(),
  ]);

  const books = booksRes.data ?? [];
  const completeness = profileRes.data?.completeness ?? 0;

  return (
    <>
      <StudioNav active="books" />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-12">
          <p className="chapter-eyebrow mb-3">Your books</p>
          <h1 className="font-display text-5xl font-medium tracking-tight text-ink-900">
            The shelf
          </h1>
        </header>

        {completeness < 30 && (
          <div className="mb-8 rounded-xl border border-gilt-500/40 bg-gilt-100 px-5 py-4 text-sm leading-relaxed text-ink-800">
            Your voice profile is at {completeness}% — the Scribe can write,
            but it writes truer the more it knows.{" "}
            <Link href="/interview" className="font-medium text-oxblood-600">
              Continue the interview
            </Link>{" "}
            before outlining if you can.
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          {/* ---- Existing books ---- */}
          <section className="space-y-5">
            {books.length === 0 ? (
              <div className="rounded-2xl border border-vellum-300 bg-vellum-50 p-10 text-center shadow-page">
                <p className="font-display text-lg text-ink-900">No books yet.</p>
                <p className="mt-1 text-sm text-ink-400">
                  Begin one — the Scribe is ready when you are.
                </p>
              </div>
            ) : (
              books.map((b) => {
                const chapters = (b.chapters ?? []) as { status: string }[];
                const total = chapters.length;
                const written = chapters.filter(
                  (c) => c.status !== "outlined"
                ).length;
                const statusText =
                  total === 0
                    ? "no outline yet"
                    : written === 0
                      ? "outlined"
                      : `${written} written`;
                return (
                  <article
                    key={b.id}
                    className="flex gap-6 rounded-2xl border border-vellum-300 bg-vellum-50 p-6 shadow-margin-note"
                  >
                    {/* Book spine */}
                    <div
                      aria-hidden="true"
                      className="flex h-44 w-[72px] shrink-0 items-end justify-center rounded-lg bg-gradient-to-b from-gilt-500 to-gilt-600 pb-4 shadow-margin-note"
                    >
                      <span
                        className="font-manuscript text-[13px] italic text-vellum-50/95"
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                        }}
                      >
                        {b.title.length > 26
                          ? b.title.slice(0, 26) + "…"
                          : b.title}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-2xl font-medium text-ink-900">
                        {b.title}
                      </h2>
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
                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-xs text-ink-400">
                          <span className="font-medium uppercase tracking-[0.12em]">
                            {total} chapters
                          </span>
                          <span className="mx-2 text-gilt-500">•</span>
                          {statusText}
                        </p>
                        <Link
                          href={`/books/${b.id}`}
                          className="text-sm font-medium text-oxblood-600 transition-colors hover:text-oxblood-500"
                        >
                          Open →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          {/* ---- Begin a new book ---- */}
          <aside>
            <form
              action={createBook}
              className="rounded-2xl border border-vellum-300 bg-vellum-50 p-8 shadow-page"
            >
              <h2 className="font-display text-3xl font-medium text-ink-900">
                Begin a new book
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-600">
                Give the Scribe the seed. The premise matters most — write it
                the way you'd describe the book to a friend.
              </p>

              <div className="mt-7 space-y-5">
                <Field label="Title" required>
                  <input
                    name="title"
                    required
                    placeholder="The Sound of Heaven"
                    className="w-full rounded-xl border border-vellum-300 bg-vellum-100 px-4 py-3.5 text-[15px] text-ink-900 placeholder:text-ink-300 focus:border-vellum-400"
                  />
                </Field>
                <Field label="Subtitle">
                  <input
                    name="subtitle"
                    placeholder="Learning to hear God in silent seasons"
                    className="w-full rounded-xl border border-vellum-300 bg-vellum-100 px-4 py-3.5 text-[15px] text-ink-900 placeholder:text-ink-300 focus:border-vellum-400"
                  />
                </Field>
                <Field label="Premise" required>
                  <textarea
                    name="premise"
                    required
                    rows={5}
                    placeholder="What is this book about? What do you want it to do in the reader's life?"
                    className="w-full resize-y rounded-xl border border-vellum-300 bg-vellum-100 px-4 py-3.5 text-[15px] leading-relaxed text-ink-900 placeholder:text-ink-300 focus:border-vellum-400"
                  />
                </Field>
              </div>

              <button
                type="submit"
                className="mt-7 w-full rounded-xl bg-oxblood-500 px-4 py-3.5 text-[15px] font-medium text-vellum-50 transition-colors hover:bg-oxblood-600"
              >
                Hand it to the Scribe →
              </button>
            </form>
          </aside>
        </div>
      </main>
    </>
  );
}

function Field(props: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-900">
        {props.label}
        {props.required && <span className="text-oxblood-600"> *</span>}
      </span>
      {props.children}
    </label>
  );
}
