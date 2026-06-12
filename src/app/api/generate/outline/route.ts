import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/ai/anthropic";
import { buildOutlinePrompt } from "@/lib/ai/prompts/outline";
import { buildVoiceContext } from "@/lib/ai/voiceContext";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type OutlineChapter = { number: number; title: string; synopsis: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookId } = (await request.json()) as { bookId: string };
  if (!bookId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { data: book } = await supabase
    .from("books")
    .select("id, title, subtitle, premise, target_reader")
    .eq("id", bookId)
    .single();
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  // Refuse to clobber real work: regeneration only while nothing is drafted.
  const { count: draftedCount } = await supabase
    .from("chapters")
    .select("*", { count: "exact", head: true })
    .eq("book_id", bookId)
    .neq("status", "outlined");
  if ((draftedCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Chapters have already been drafted — outline is locked." },
      { status: 409 }
    );
  }

  const voiceContext = await buildVoiceContext(supabase);

  const completion = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: buildOutlinePrompt(voiceContext),
    messages: [
      {
        role: "user",
        content: `BOOK TITLE: ${book.title}${book.subtitle ? `\nSUBTITLE: ${book.subtitle}` : ""}\nPREMISE: ${book.premise ?? "(none given — infer from the title and the author's calling)"}${book.target_reader ? `\nTARGET READER: ${book.target_reader}` : ""}`,
      },
    ],
  });

  const raw = completion.content.find((b) => b.type === "text")?.text ?? "{}";
  let chapters: OutlineChapter[] = [];
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (Array.isArray(parsed.chapters)) {
      chapters = parsed.chapters
        .filter(
          (c: OutlineChapter) =>
            typeof c?.number === "number" &&
            typeof c?.title === "string" &&
            typeof c?.synopsis === "string"
        )
        .slice(0, 14);
    }
  } catch (err) {
    console.error("Outline parse error:", err, raw.slice(0, 400));
  }

  if (chapters.length === 0) {
    return NextResponse.json(
      { error: "The Scribe couldn't shape an outline — try again." },
      { status: 502 }
    );
  }

  // Persist: snapshot on the book, then replace the outlined chapter rows.
  await supabase.from("books").update({ outline: chapters }).eq("id", bookId);
  await supabase
    .from("chapters")
    .delete()
    .eq("book_id", bookId)
    .eq("status", "outlined");
  await supabase.from("chapters").insert(
    chapters.map((c) => ({
      book_id: bookId,
      user_id: user.id,
      number: c.number,
      title: c.title,
      synopsis: c.synopsis,
      status: "outlined" as const,
    }))
  );

  return NextResponse.json({ chapters });
}
