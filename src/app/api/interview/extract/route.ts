import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/ai/anthropic";
import {
  EXTRACTOR_PROMPT,
  parseExtraction,
  type Extraction,
} from "@/lib/ai/prompts/extractor";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Called after each completed exchange. Does four things:
 * 1. Persists both messages (scribe question + author answer)
 * 2. Runs the extraction pass on the exchange
 * 3. Writes extracted items to the normalized tables / merges JSONB profile fields
 * 4. Recomputes completeness and returns everything the UI needs to animate
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, scribeQuestion, authorAnswer } = (await request.json()) as {
    sessionId: string;
    scribeQuestion: string;
    authorAnswer: string;
  };
  if (!sessionId || !authorAnswer) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // ---- 1. Run extraction ----
  const completion = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: EXTRACTOR_PROMPT,
    messages: [
      {
        role: "user",
        content: `INTERVIEWER ASKED:\n${scribeQuestion}\n\nAUTHOR ANSWERED:\n${authorAnswer}`,
      },
    ],
  });
  const rawText =
    completion.content.find((b) => b.type === "text")?.text ?? "{}";
  const extraction = parseExtraction(rawText);

  // ---- 2. Persist the exchange ----
  await supabase.from("interview_messages").insert([
    { session_id: sessionId, user_id: user.id, role: "scribe", content: scribeQuestion },
    {
      session_id: sessionId,
      user_id: user.id,
      role: "author",
      content: authorAnswer,
      extracted: extraction as unknown as Record<string, unknown>,
    },
  ]);

  // ---- 3. Write extracted items, skipping duplicates ----
  const inserted = await writeExtraction(supabase, user.id, extraction);

  // ---- 4. Merge profile JSONB + identity, recompute completeness ----
  const { data: profile } = await supabase
    .from("voice_profiles")
    .select("*")
    .single();

  const merged = {
    framework: { ...(profile?.framework ?? {}), ...extraction.framework },
    tone: { ...(profile?.tone ?? {}), ...extraction.tone },
    habits: { ...(profile?.habits ?? {}), ...extraction.habits },
    primary_lean: profile?.primary_lean ?? extraction.identity.primary_lean,
    secondary_lean: profile?.secondary_lean ?? extraction.identity.secondary_lean,
    audience: profile?.audience ?? extraction.identity.audience,
    calling_summary:
      profile?.calling_summary ?? extraction.identity.calling_summary,
  };

  const [{ count: phrases }, { count: scriptures }, { count: stories }] =
    await Promise.all([
      supabase.from("signature_phrases").select("*", { count: "exact", head: true }),
      supabase.from("anchor_scriptures").select("*", { count: "exact", head: true }),
      supabase.from("stories").select("*", { count: "exact", head: true }),
    ]);

  const completeness = computeCompleteness({
    phrases: phrases ?? 0,
    scriptures: scriptures ?? 0,
    stories: stories ?? 0,
    frameworkKeys: Object.keys(merged.framework).length,
    toneKeys: Object.keys(merged.tone).length,
    habitKeys: Object.keys(merged.habits).length,
    hasCalling: Boolean(merged.calling_summary),
    hasAudience: Boolean(merged.audience),
  });

  await supabase
    .from("voice_profiles")
    .update({ ...merged, completeness })
    .eq("user_id", user.id);

  await supabase
    .from("interview_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  return NextResponse.json({ inserted, merged, completeness });
}

/** Insert phrases/scriptures/stories, skipping near-duplicates. Returns what was actually new. */
async function writeExtraction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  ex: Extraction
) {
  const inserted: {
    phrases: typeof ex.phrases;
    scriptures: typeof ex.scriptures;
    stories: typeof ex.stories;
  } = { phrases: [], scriptures: [], stories: [] };

  for (const item of ex.phrases) {
    if (!item?.phrase) continue;
    const { count } = await supabase
      .from("signature_phrases")
      .select("*", { count: "exact", head: true })
      .ilike("phrase", item.phrase.trim());
    if ((count ?? 0) === 0) {
      const { error } = await supabase.from("signature_phrases").insert({
        user_id: userId,
        phrase: item.phrase.trim(),
        context: item.context ?? null,
        source: "interview",
      });
      if (!error) inserted.phrases.push(item);
    }
  }

  for (const item of ex.scriptures) {
    if (!item?.reference) continue;
    const { count } = await supabase
      .from("anchor_scriptures")
      .select("*", { count: "exact", head: true })
      .ilike("reference", item.reference.trim());
    if ((count ?? 0) === 0) {
      const { error } = await supabase.from("anchor_scriptures").insert({
        user_id: userId,
        reference: item.reference.trim(),
        translation: item.translation,
        significance: item.significance ?? null,
        themes: item.themes ?? [],
      });
      if (!error) inserted.scriptures.push(item);
    }
  }

  for (const item of ex.stories) {
    if (!item?.title || !item?.summary) continue;
    const { count } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true })
      .ilike("title", item.title.trim());
    if ((count ?? 0) === 0) {
      const { error } = await supabase.from("stories").insert({
        user_id: userId,
        title: item.title.trim(),
        summary: item.summary,
        year_or_era: item.year_or_era,
        themes: item.themes ?? [],
        emotional_register: item.emotional_register ?? null,
      });
      if (!error) inserted.stories.push(item);
    }
  }

  return inserted;
}

function computeCompleteness(c: {
  phrases: number;
  scriptures: number;
  stories: number;
  frameworkKeys: number;
  toneKeys: number;
  habitKeys: number;
  hasCalling: boolean;
  hasAudience: boolean;
}): number {
  let score = 0;
  score += Math.min(c.phrases / 4, 1) * 15;      // 4+ phrases = full marks
  score += Math.min(c.scriptures / 4, 1) * 15;   // 4+ scriptures
  score += Math.min(c.stories / 3, 1) * 20;      // 3+ stories — weighted heaviest with framework
  score += Math.min(c.frameworkKeys / 4, 1) * 20;
  score += Math.min(c.toneKeys / 3, 1) * 10;
  score += Math.min(c.habitKeys / 3, 1) * 10;
  score += c.hasCalling ? 5 : 0;
  score += c.hasAudience ? 5 : 0;
  return Math.round(Math.min(score, 100));
}
