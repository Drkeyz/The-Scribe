"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Server actions for the Voice page. RLS guarantees a user can only
 * ever touch their own rows, so these stay deliberately thin.
 */

export async function deletePhrase(id: string) {
  const supabase = await createClient();
  await supabase.from("signature_phrases").delete().eq("id", id);
  revalidatePath("/voice");
}

export async function deleteScripture(id: string) {
  const supabase = await createClient();
  await supabase.from("anchor_scriptures").delete().eq("id", id);
  revalidatePath("/voice");
}

export async function deleteStory(id: string) {
  const supabase = await createClient();
  await supabase.from("stories").delete().eq("id", id);
  revalidatePath("/voice");
}

export async function saveWritingSample(formData: FormData) {
  const sample = String(formData.get("sample") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("voice_profiles")
    .update({ writing_sample: sample || null })
    .eq("user_id", user.id);
  revalidatePath("/voice");
}

/**
 * Sets the author's pen name — the name on title pages, the studio
 * greeting, and the dossier. Used by both /welcome (first run, with
 * redirect) and /voice (editable any time).
 */
export async function savePenName(formData: FormData) {
  const penName = String(formData.get("pen_name") ?? "").trim();
  if (!penName) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Keep full_name in step if it was never set.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  await supabase
    .from("profiles")
    .update({
      pen_name: penName,
      full_name: profile?.full_name || penName,
    })
    .eq("id", user.id);

  revalidatePath("/voice");
  revalidatePath("/studio");
  revalidatePath("/books");

  if (String(formData.get("from_welcome") ?? "") === "1") {
    redirect("/studio");
  }
}
