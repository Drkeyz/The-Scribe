import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChapterEditor } from "@/components/editor/ChapterEditor";
import { formatTitle } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChapterPage(props: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const { id, chapterId } = await props.params;
  const supabase = await createClient();

  const [chapterRes, bookRes, chaptersRes] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, number, title, synopsis, content, status, word_count")
      .eq("id", chapterId)
      .single(),
    supabase.from("books").select("id, title").eq("id", id).single(),
    supabase
      .from("chapters")
      .select("id, number, title")
      .eq("book_id", id)
      .order("number", { ascending: true }),
  ]);

  const chapter = chapterRes.data;
  const book = bookRes.data;
  if (!chapter || !book) notFound();

  const siblings = chaptersRes.data ?? [];
  const idx = siblings.findIndex((c) => c.id === chapter.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <ChapterEditor
      bookId={book.id}
      bookTitle={book.title}
      chapter={{
        id: chapter.id,
        number: chapter.number,
        title: formatTitle(chapter.title),
        synopsis: chapter.synopsis,
        content: chapter.content ?? "",
        status: chapter.status,
        wordCount: chapter.word_count ?? 0,
      }}
      prev={prev ? { id: prev.id, title: prev.title } : null}
      next={next ? { id: next.id, title: next.title } : null}
    />
  );
}
