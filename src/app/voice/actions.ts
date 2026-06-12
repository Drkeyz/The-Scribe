"use server";

import { revalidatePath } from "next/cache";
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
