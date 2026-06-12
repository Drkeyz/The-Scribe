"use server";

import { redirect } from "next/navigation";
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
