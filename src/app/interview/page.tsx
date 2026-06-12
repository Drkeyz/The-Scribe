import { createClient } from "@/lib/supabase/server";
import { InterviewRoom } from "@/components/interview/InterviewRoom";
import { StudioNav } from "@/components/ui/StudioNav";

export const dynamic = "force-dynamic";

export default async function InterviewPage() {
  const supabase = await createClient();

  // Find an in-progress session or open a new one.
  let { data: session } = await supabase
    .from("interview_sessions")
    .select("id")
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: created } = await supabase
      .from("interview_sessions")
      .insert({ user_id: user!.id })
      .select("id")
      .single();
    session = created;
  }

  // Load everything the room needs to resume where the author left off.
  const [messagesRes, profileRes, phrasesRes, scripturesRes, storiesRes] =
    await Promise.all([
      supabase
        .from("interview_messages")
        .select("role, content")
        .eq("session_id", session!.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("voice_profiles")
        .select(
          "completeness, primary_lean, audience, calling_summary, framework, tone, habits"
        )
        .single(),
      supabase
        .from("signature_phrases")
        .select("phrase, context")
        .order("created_at", { ascending: true }),
      supabase
        .from("anchor_scriptures")
        .select("reference, significance, themes")
        .order("created_at", { ascending: true }),
      supabase
        .from("stories")
        .select("title, summary, year_or_era, emotional_register")
        .order("created_at", { ascending: true }),
    ]);

  return (
    <>
      <StudioNav active="interview" />
      <InterviewRoom
        sessionId={session!.id}
        initialMessages={(messagesRes.data ?? []) as { role: "scribe" | "author"; content: string }[]}
        initialProfile={{
          completeness: profileRes.data?.completeness ?? 0,
          primaryLean: profileRes.data?.primary_lean ?? null,
          audience: profileRes.data?.audience ?? null,
          callingSummary: profileRes.data?.calling_summary ?? null,
          framework: profileRes.data?.framework ?? {},
          habits: profileRes.data?.habits ?? {},
        }}
        initialPhrases={phrasesRes.data ?? []}
        initialScriptures={scripturesRes.data ?? []}
        initialStories={storiesRes.data ?? []}
      />
    </>
  );
}