import { NextRequest } from "next/server";
import { anthropic, MODEL } from "@/lib/ai/anthropic";
import { buildInterviewerPrompt } from "@/lib/ai/prompts/interviewer";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "scribe" | "author"; content: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { messages } = (await request.json()) as { messages: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Bad request", { status: 400 });
  }

  // Build a coverage summary from what's already in the database so the
  // interviewer knows which territories are thin. Cheap counts only.
  const [{ count: phraseCount }, { count: scriptureCount }, { count: storyCount }, profileRes] =
    await Promise.all([
      supabase.from("signature_phrases").select("*", { count: "exact", head: true }),
      supabase.from("anchor_scriptures").select("*", { count: "exact", head: true }),
      supabase.from("stories").select("*", { count: "exact", head: true }),
      supabase
        .from("voice_profiles")
        .select("primary_lean, audience, calling_summary, framework, tone, habits")
        .single(),
    ]);

  const p = profileRes.data;
  const coverage = [
    `identity: ${p?.calling_summary ? "captured" : "MISSING"} (lean: ${p?.primary_lean ?? "unknown"})`,
    `audience: ${p?.audience ? `"${p.audience}"` : "MISSING"}`,
    `framework: ${Object.keys(p?.framework ?? {}).length} positions captured (${Object.keys(p?.framework ?? {}).join(", ") || "none"})`,
    `scriptures: ${scriptureCount ?? 0} captured`,
    `stories: ${storyCount ?? 0} captured`,
    `phrases: ${phraseCount ?? 0} captured`,
    `habits: ${Object.keys(p?.habits ?? {}).length} captured (${Object.keys(p?.habits ?? {}).join(", ") || "none"})`,
    `tone signals: ${Object.keys(p?.tone ?? {}).length} captured`,
  ].join("\n");

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 400,
    system: buildInterviewerPrompt(coverage),
    messages: messages.map((m) => ({
      role: m.role === "scribe" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode("\n[The Scribe lost the thread — please try again.]")
        );
        console.error("Interview stream error:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
