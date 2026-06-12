import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudioNav } from "@/components/ui/StudioNav";
import { OutlineGenerator } from "@/components/books/OutlineGenerator";
import { formatTitle } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  outlined: "Outlined",
  generating: "Writing…",
  drafted: "Drafted",
  edited: "Edited",
  final: "Final",
};

export default async function BookPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [bookRes, chaptersRes] = await Promise.all([
    supabase
      .from("books")
      .select("id, title, subtitle, premise, target_reader, outline")
      .eq("id", id)
      .single(),
    supabase
      .from("chapters")
      .select("id, number, title, synopsis, status, word_count")
      .eq("book_id", id)
      .order("number", { ascending: true }),
  ]);

  const book = bookRes.data;
  if (!book) notFound();

  const chapters = chaptersRes.data ?? [];
  const hasOutline = chapters.length > 0;
  const anyDrafted = chapters.some((c) => c.status !== "outlined");
  const totalWords = chapters.reduce((sum, c) => sum + (c.word_count ?? 0), 0);

  return (
    <>
      <StudioNav active="books" />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-6 text-sm">
          <Link href="/books" className="text-ink-400 hover:text-ink-900">
            ← The shelf
          </Link>
        </p>

        <header className="mb-10">
          <p className="chapter-eyebrow mb-2">Book</p>
          <h1 className="chapter-title">{book.title}</h1>
          {book.subtitle && (
            <p className="font-manuscript mt-1 text-lg italic text-ink-600">
              {book.subtitle}
            </p>
          )}
          {book.premise && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-600">
              {book.premise}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-400">
            {book.target_reader && <span>{book.target_reader}</span>}
            {hasOutline && <span>{chapters.length} chapters</span>}
            {totalWords > 0 && (
              <span>{totalWords.toLocaleString()} words drafted</span>
            )}
          </div>
          {totalWords > 0 && (
            <a
              href={`/api/books/${book.id}/export`}
              className="mt-5 inline-block rounded-lg border border-vellum-300 px-4 py-2 text-sm text-ink-600 transition-colors hover:border-vellum-400 hover:text-ink-900"
            >
              ↓ Export manuscript (.docx)
            </a>
          )}
        </header>

        {!hasOutline ? (
          <section className="rounded-lg border border-vellum-300 bg-vellum-50 p-10 text-center shadow-page">
            <p className="font-display text-xl text-ink-900">
              This book is waiting for its shape.
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-400">
              The Scribe will read your voice profile — your scriptures, your
              stories, your cadence — and propose a chapter arc that sounds
              like you wrote it.
            </p>
            <div className="mt-6 flex justify-center">
              <OutlineGenerator bookId={book.id} hasOutline={false} />
            </div>
          </section>
        ) : (
          <section>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-medium text-ink-900">
                The arc
              </h2>
              {!anyDrafted && (
                <OutlineGenerator bookId={book.id} hasOutline={true} />
              )}
            </div>

            <ol className="space-y-3">
              {chapters.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/books/${book.id}/chapters/${c.id}`}
                    className="flex gap-5 rounded-lg border border-vellum-300 bg-vellum-50 p-5 shadow-margin-note transition-colors hover:border-vellum-400"
                  >
                    <span className="font-display pt-0.5 text-2xl font-medium text-vellum-400">
                      {String(c.number).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-[16px] font-medium text-ink-900">
                          {formatTitle(c.title)}
                        </h3>
                        <span
                          className={
                            c.status === "outlined"
                              ? "shrink-0 rounded-full bg-vellum-200 px-2.5 py-0.5 text-[11px] text-ink-400"
                              : "shrink-0 rounded-full bg-gilt-100 px-2.5 py-0.5 text-[11px] text-gilt-600"
                          }
                        >
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </div>
                      {c.synopsis && (
                        <p className="mt-1 text-sm leading-relaxed text-ink-600">
                          {c.synopsis}
                        </p>
                      )}
                      {(c.word_count ?? 0) > 0 && (
                        <p className="mt-1.5 text-xs text-ink-400">
                          {c.word_count.toLocaleString()} words
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>

            <p className="mt-6 text-center text-xs text-ink-300">
              Open any chapter — the Scribe writes the first draft, you stay
              the editor.
            </p>
          </section>
        )}
      </main>
    </>
  );
}
