import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/books/[id]/export
 * Typesets the whole book as a .docx manuscript: title page, then each
 * chapter parsed from our constrained manuscript format (paragraphs,
 * "> " scripture blocks, ":: " declarations, "## " subheads).
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [bookRes, chaptersRes, personRes] = await Promise.all([
    supabase
      .from("books")
      .select("title, subtitle")
      .eq("id", id)
      .single(),
    supabase
      .from("chapters")
      .select("number, title, content, status")
      .eq("book_id", id)
      .order("number", { ascending: true }),
    supabase.from("profiles").select("full_name, pen_name").single(),
  ]);

  const book = bookRes.data;
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const author =
    personRes.data?.pen_name || personRes.data?.full_name || "";
  const chapters = (chaptersRes.data ?? []).filter(
    (c: { number: number; title: string; content: string | null; status: string }) =>
      (c.content ?? "").trim() !== ""
  );

  const children: Paragraph[] = [
    // ---- Title page ----
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 4800, after: 240 },
      children: [new TextRun({ text: book.title, size: 56, font: "Georgia" })],
    }),
    ...(book.subtitle
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 },
            children: [
              new TextRun({
                text: book.subtitle,
                italics: true,
                size: 28,
                font: "Georgia",
                color: "595959",
              }),
            ],
          }),
        ]
      : []),
    ...(author
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 720 },
            children: [
              new TextRun({ text: author, size: 26, font: "Georgia" }),
            ],
          }),
        ]
      : []),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  chapters.forEach((chapter, idx) => {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1440, after: 120 },
        children: [
          new TextRun({
            text: `CHAPTER ${chapter.number}`,
            size: 20,
            color: "8C7C5E",
            font: "Georgia",
            characterSpacing: 40,
          }),
        ],
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: chapter.title })],
      })
    );

    const blocks = (chapter.content ?? "")
      .split(/\n\s*\n/)
      .filter((b: string) => b.trim() !== "");

    for (const block of blocks) {
      const trimmed = block.trim();

      if (trimmed.startsWith("## ")) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 360, after: 180 },
            children: [new TextRun({ text: trimmed.slice(3) })],
          })
        );
        continue;
      }

      if (trimmed.startsWith("> ")) {
        const lines = trimmed
          .split("\n")
          .map((l: string) => l.replace(/^>\s?/, "").trim())
          .filter(Boolean);
        const citeIdx = lines.findIndex((l: string) => l.startsWith("—"));
        const quote = (citeIdx === -1 ? lines : lines.slice(0, citeIdx)).join(" ");
        const cite = citeIdx === -1 ? null : lines[citeIdx];

        children.push(
          new Paragraph({
            indent: { left: 720, right: 720 },
            spacing: { before: 240, after: cite ? 60 : 240 },
            children: [
              new TextRun({ text: quote, italics: true, font: "Georgia" }),
            ],
          })
        );
        if (cite) {
          children.push(
            new Paragraph({
              indent: { left: 720, right: 720 },
              spacing: { after: 240 },
              children: [
                new TextRun({
                  text: cite,
                  size: 20,
                  color: "8C7C5E",
                  font: "Georgia",
                }),
              ],
            })
          );
        }
        continue;
      }

      if (trimmed.startsWith(":: ")) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 300 },
            children: [
              new TextRun({
                text: trimmed
                  .split("\n")
                  .map((l: string) => l.replace(/^::\s?/, ""))
                  .join(" "),
                italics: true,
                font: "Georgia",
              }),
            ],
          })
        );
        continue;
      }

      children.push(
        new Paragraph({
          spacing: { after: 200, line: 360 },
          children: [new TextRun({ text: trimmed, font: "Georgia" })],
        })
      );
    }

    if (idx < chapters.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Georgia", size: 24 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 40, font: "Georgia" },
          paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: "Georgia" },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // US Letter
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `${book.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "manuscript"}.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
