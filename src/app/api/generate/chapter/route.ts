import { NextRequest } from "next/server";
import { anthropic, MODEL } from "@/lib/ai/anthropic";
import { buildChapterPrompt } from "@/lib/ai/prompts/chapter";
import { buildVoiceContext } from "@/lib/ai/voiceContext";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { chapterId } = (await request.json()) as { chapterId: string };
  if (!chapterId) return new Response("Bad request", { status: 400 });

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, number, title, synopsis, book_id")
    .eq("id", chapterId)
    .single();
  if (!chapter) return new Response("Chapter not found", { status: 404 });

  const { data: book } = await supabase
    .from("books")
    .select("title, subtitle, premise, target_reader, outline")
    .eq("id", chapter.book_id)
    .single();

  const voiceContext = await buildVoiceContext(supabase);

  // Neighboring chapter titles give the model arc-awareness without
  // blowing the context budget.
  const outline = (book?.outline ?? []) as {
    number: number;
    title: string;
    synopsis: string;
  }[];
  const arc = outline
    .map((c) =>
      c.number === chapter.number
        ? `${c.number}. ${c.title}  <-- YOU ARE WRITING THIS ONE`
        : `${c.number}. ${c.title}`
    )
    .join("\n");

  await supabase
    .from("chapters")
    .update({ status: "generating" })
    .eq("id", chapterId);

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    system: buildChapterPrompt(voiceContext),
    messages: [
      {
        role: "user",
        content: `BOOK: ${book?.title ?? ""}${book?.subtitle ? ` — ${book.subtitle}` : ""}
PREMISE: ${book?.premise ?? ""}
${book?.target_reader ? `READER: ${book.target_reader}\n` : ""}
THE FULL ARC:
${arc}

WRITE CHAPTER ${chapter.number}: "${chapter.title}"
SYNOPSIS TO FULFILL: ${chapter.synopsis ?? "(none — write from the title and the arc)"}`,
      },
    ],
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
        console.error("Chapter stream error:", err);
        controller.enqueue(
          encoder.encode("\n\n[[error: the Scribe lost the thread — generate again]]")
        );
        // Roll the status back so the chapter isn't stuck on "generating".
        await supabase
          .from("chapters")
          .update({ status: "outlined" })
          .eq("id", chapterId);
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
