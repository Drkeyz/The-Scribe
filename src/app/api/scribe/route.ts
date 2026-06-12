import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/ai/anthropic";
import { buildScribePrompt, type ScribeAction } from "@/lib/ai/prompts/scribe";
import { buildVoiceContext } from "@/lib/ai/voiceContext";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chapterId, action, selection, instruction, content } =
    (await request.json()) as {
      chapterId: string;
      action: ScribeAction;
      selection?: string;
      instruction?: string;
      content: string;
    };

  if (!chapterId || !action || typeof content !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const voiceContext = await buildVoiceContext(supabase);

  const userMessage = [
    `ACTION: ${action}`,
    selection ? `SELECTED PASSAGE:\n"""\n${selection}\n"""` : `(no selection — whole chapter)`,
    instruction ? `AUTHOR'S INSTRUCTION: ${instruction}` : null,
    `CHAPTER TEXT:\n"""\n${content.slice(0, 12000)}\n"""`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: buildScribePrompt(voiceContext),
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = completion.content.find((b) => b.type === "text")?.text ?? "{}";
  let reply = "I lost the thread — try that again.";
  let proposal: string | null = null;
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (typeof parsed.reply === "string") reply = parsed.reply;
    if (typeof parsed.proposal === "string" && parsed.proposal.trim() !== "")
      proposal = parsed.proposal.trim();
  } catch (err) {
    console.error("Scribe parse error:", err, raw.slice(0, 300));
  }

  // Persist the exchange as a margin thread anchored to the selection.
  const { data: thread } = await supabase
    .from("assistant_threads")
    .insert({
      user_id: user.id,
      chapter_id: chapterId,
      anchor: selection ? { quote: selection.slice(0, 240) } : null,
    })
    .select("id")
    .single();

  if (thread) {
    await supabase.from("assistant_messages").insert([
      {
        thread_id: thread.id,
        user_id: user.id,
        role: "author",
        content: instruction
          ? `${action}: ${instruction}`
          : `${action}${selection ? ` — "${selection.slice(0, 120)}"` : ""}`,
      },
      {
        thread_id: thread.id,
        user_id: user.id,
        role: "scribe",
        content: reply,
        proposal: proposal
          ? { original: selection ?? null, proposed: proposal, applied: false }
          : null,
      },
    ]);
  }

  return NextResponse.json({ reply, proposal, threadId: thread?.id ?? null });
}
