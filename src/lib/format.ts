/**
 * Display-layer text hygiene. Titles are formatted at render time so the
 * fix applies to every title everywhere, regardless of how old data was
 * stored. Divine names always capitalize.
 */

const ALWAYS_CAPITALIZE = new Set([
  "god",
  "jesus",
  "christ",
  "lord",
  "holy",
  "spirit",
  "father",
  "savior",
  "saviour",
  "i",
  "i'm",
  "i've",
  "i'll",
]);

function capFirst(word: string): string {
  const idx = word.search(/[a-zA-Z]/);
  if (idx === -1) return word;
  return (
    word.slice(0, idx) +
    word.charAt(idx).toUpperCase() +
    word.slice(idx + 1)
  );
}

/** Sentence-case a title and force-capitalize divine names and "I". */
export function formatTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  const words = raw.trim().split(/\s+/);
  return words
    .map((word, i) => {
      const bare = word.replace(/[^a-zA-Z']/g, "").toLowerCase();
      if (i === 0 || ALWAYS_CAPITALIZE.has(bare)) return capFirst(word);
      return word;
    })
    .join(" ");
}

/**
 * The chapter prompt forbids writing the heading into the manuscript, but
 * models occasionally do it anyway. Strip a leading "Chapter N ..." block
 * or a leading block that's just the title.
 */
export function stripChapterHeading(
  content: string,
  chapterNumber: number,
  title: string
): string {
  const blocks = content.split(/\n\s*\n/);
  if (blocks.length === 0) return content;

  const normalize = (s: string) =>
    s
      .replace(/^##\s*/, "")
      .replace(/[^a-z0-9 ]/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const first = normalize(blocks[0]);
  const t = normalize(title);

  const isHeading =
    first.startsWith(`chapter ${chapterNumber}`) ||
    first === t ||
    first === `chapter ${chapterNumber} ${t}`;

  // Only strip short blocks — never a real paragraph that happens to
  // mention the chapter.
  if (isHeading && blocks[0].trim().length <= title.length + 24) {
    return blocks.slice(1).join("\n\n").trim();
  }
  return content;
}
