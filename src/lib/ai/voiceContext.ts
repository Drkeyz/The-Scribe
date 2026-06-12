import { createClient } from "@/lib/supabase/server";

/**
 * Assembles the author's complete Voice Profile into the grounding block
 * used by EVERY generation call (outlines, chapters, the margin Scribe).
 * One source of truth for "who is this author" — if generation ever
 * sounds off, this is the first place to look.
 */
export async function buildVoiceContext(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const [profileRes, personRes, phrasesRes, scripturesRes, storiesRes] =
    await Promise.all([
      supabase.from("voice_profiles").select("*").single(),
      supabase.from("profiles").select("full_name, pen_name").single(),
      supabase.from("signature_phrases").select("phrase, context"),
      supabase
        .from("anchor_scriptures")
        .select("reference, translation, significance, themes"),
      supabase
        .from("stories")
        .select("id, title, summary, year_or_era, themes, emotional_register, used_count"),
    ]);

  const p = profileRes.data;
  const name =
    personRes.data?.pen_name || personRes.data?.full_name || "the author";
  const phrases = phrasesRes.data ?? [];
  const scriptures = scripturesRes.data ?? [];
  const stories = storiesRes.data ?? [];

  const sections: string[] = [];

  sections.push(`AUTHOR: ${name}`);
  if (p?.primary_lean || p?.secondary_lean) {
    sections.push(
      `MINISTRY LEAN: ${[p?.primary_lean, p?.secondary_lean].filter(Boolean).join(", ")}`
    );
  }
  if (p?.calling_summary) sections.push(`CALLING: ${p.calling_summary}`);
  if (p?.audience) sections.push(`WRITES FOR: ${p.audience}`);

  const framework = Object.entries(p?.framework ?? {});
  if (framework.length > 0) {
    sections.push(
      `THEOLOGICAL FRAMEWORK (every page must honor these positions):\n` +
        framework.map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`).join("\n")
    );
  }

  const tone = Object.entries(p?.tone ?? {});
  if (tone.length > 0) {
    sections.push(
      `TONE & STYLE SIGNALS:\n` +
        tone.map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`).join("\n")
    );
  }

  const habits = Object.entries(p?.habits ?? {});
  if (habits.length > 0) {
    sections.push(
      `STRUCTURAL HABITS:\n` +
        habits.map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`).join("\n")
    );
  }

  if (phrases.length > 0) {
    sections.push(
      `SIGNATURE PHRASES (weave naturally, never force):\n` +
        phrases
          .map((x) => `- "${x.phrase}"${x.context ? ` — ${x.context}` : ""}`)
          .join("\n")
    );
  }

  if (scriptures.length > 0) {
    sections.push(
      `ANCHOR SCRIPTURES (their home passages; prefer these over generic verses):\n` +
        scriptures
          .map(
            (s) =>
              `- ${s.reference}${s.translation ? ` (${s.translation})` : ""}${s.significance ? ` — ${s.significance}` : ""}${(s.themes?.length ?? 0) > 0 ? ` [themes: ${s.themes!.join(", ")}]` : ""}`
          )
          .join("\n")
    );
  }

  if (stories.length > 0) {
    sections.push(
      `STORY BANK (personal testimonies available to retell; use sparingly and only where themes fit; used_count shows prior usage — prefer less-used stories):\n` +
        stories
          .map(
            (s) =>
              `- [${s.id}] "${s.title}" (${s.year_or_era ?? "undated"}, register: ${s.emotional_register ?? "n/a"}, used ${s.used_count}x)${(s.themes?.length ?? 0) > 0 ? ` [themes: ${s.themes!.join(", ")}]` : ""}\n  ${s.summary}`
          )
          .join("\n")
    );
  }

  if (p?.writing_sample) {
    const sample = String(p.writing_sample).slice(0, 2400);
    sections.push(
      `WRITING SAMPLE (study the cadence, sentence rhythm, and how they address the reader — this is the truest signal of voice):\n"""\n${sample}\n"""`
    );
  }

  return sections.join("\n\n");
}
