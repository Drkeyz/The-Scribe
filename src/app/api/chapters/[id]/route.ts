import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Grounding = { stories?: string[]; scriptures?: string[] };

/**
 * PATCH /api/chapters/[id]
 * Saves manuscript content. Used by both "generation finished" (with
 * grounding) and the editor's debounced auto-save (without).
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content, grounding, fromGeneration } = (await request.json()) as {
    content: string;
    grounding?: Grounding;
    fromGeneration?: boolean;
  };
  if (typeof content !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const wordCount = content.trim() === "" ? 0 : content.trim().split(/\s+/).length;

  const { data: existing } = await supabase
    .from("chapters")
    .select("status, grounding")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Status transitions: generation completes -> drafted;
  // human edits a drafted/final chapter -> edited; otherwise keep.
  let status = existing.status;
  if (fromGeneration) status = "drafted";
  else if (existing.status === "drafted" || existing.status === "final")
    status = "edited";
  else if (existing.status === "generating") status = "drafted";

  const update: Record<string, unknown> = {
    content,
    word_count: wordCount,
    status,
  };
  if (grounding) update.grounding = grounding;

  await supabase.from("chapters").update(update).eq("id", id);

  // Story usage accounting — only on generation, only once per story.
  if (fromGeneration && grounding?.stories?.length) {
    for (const title of grounding.stories) {
      const { data: story } = await supabase
        .from("stories")
        .select("id, used_count")
        .ilike("title", title)
        .maybeSingle();
      if (story) {
        await supabase
          .from("stories")
          .update({ used_count: (story.used_count ?? 0) + 1 })
          .eq("id", story.id);
      }
    }
  }

  return NextResponse.json({ ok: true, wordCount, status });
}
