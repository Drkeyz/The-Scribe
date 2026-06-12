"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createBook(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const premise = String(formData.get("premise") ?? "").trim() || null;
  const targetReader = String(formData.get("target_reader") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: book } = await supabase
    .from("books")
    .insert({
      user_id: user.id,
      title,
      subtitle,
      premise,
      target_reader: targetReader,
    })
    .select("id")
    .single();

  if (book) redirect(`/books/${book.id}`);
}

/**
 * Deletes a book and everything beneath it: chapters, margin threads,
 * and messages. Deletes bottom-up so it works whether or not the
 * database has ON DELETE CASCADE. RLS scopes every statement to the
 * signed-in user — nobody can delete another author's book.
 */
export async function deleteBook(bookId: string) {
  if (!bookId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Confirm ownership before touching anything.
  const { data: book } = await supabase
    .from("books")
    .select("id")
    .eq("id", bookId)
    .eq("user_id", user.id)
    .single();
  if (!book) return;

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id")
    .eq("book_id", bookId);
  const chapterIds = (chapters ?? []).map((c: { id: string }) => c.id);

  if (chapterIds.length > 0) {
    const { data: threads } = await supabase
      .from("assistant_threads")
      .select("id")
      .in("chapter_id", chapterIds);
    const threadIds = (threads ?? []).map((t: { id: string }) => t.id);

    if (threadIds.length > 0) {
      await supabase.from("assistant_messages").delete().in("thread_id", threadIds);
      await supabase.from("assistant_threads").delete().in("id", threadIds);
    }
    await supabase.from("chapters").delete().eq("book_id", bookId);
  }

  await supabase.from("books").delete().eq("id", bookId);

  revalidatePath("/books");
  revalidatePath("/studio");
  redirect("/books");
}
