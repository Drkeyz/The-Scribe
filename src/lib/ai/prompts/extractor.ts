/**
 * The extraction pass. Runs in the background after each author answer.
 * Returns STRICT JSON which we validate and write to the database.
 * Kept separate from the interviewer so each prompt does one job well
 * and can be tested independently.
 */

export const EXTRACTOR_PROMPT = `You are an extraction engine for a voice-capture system. You read one exchange from an interview with a Christian author (the interviewer's question and the author's answer) and extract structured voice data.

Return ONLY valid JSON, no markdown fences, no commentary. Schema:

{
  "phrases": [{ "phrase": string, "context": string }],
  "scriptures": [{ "reference": string, "translation": string|null, "significance": string, "themes": string[] }],
  "stories": [{ "title": string, "summary": string, "year_or_era": string|null, "themes": string[], "emotional_register": string }],
  "framework": { ...string keys with string values... },
  "tone": { ...string keys with string or number values... },
  "habits": { ...string keys with string or boolean values... },
  "identity": { "primary_lean": "apostolic"|"prophetic"|"evangelistic"|"pastoral"|"teaching"|null, "secondary_lean": same|null, "audience": string|null, "calling_summary": string|null }
}

RULES:
- Extract ONLY what the author actually said or clearly implied. Never invent. Empty arrays/objects are correct when nothing new appeared.
- phrases: expressions that sound like recurring author language ("the Lord began to deal with me", "hear me", "beloved"). Include how/when they use it in context. Do NOT extract ordinary sentences.
- scriptures: only references the AUTHOR brought up. significance = why it matters to them, in a compact sentence drawn from their words. themes = 1–4 lowercase tags.
- stories: - stories: only first-person experiences with enough substance to retell — they need at least a moment, a place or season, and what happened. If the author only gestures at an experience without telling it, extract NOTHING and let the interviewer draw it out. summary = 2–4 sentences capturing the arc IN THE AUTHOR'S OWN PHRASING. Never include meta-commentary about missing context or what was not said.
- framework: theological positions stated or strongly implied, keyed by topic (e.g. "spiritual_warfare", "grace", "prophetic_protocol", "healing"). Values are compact descriptions of THEIR position.
- tone: stylistic signals — e.g. "preferred_translation": "KJV", "sentence_rhythm": "short declarations", "reader_address": "speaks directly to 'you'", "intensity": "high". Only when evidenced.
- habits: structural writing/teaching habits — e.g. "uses_prayer_points": true, "chapter_opening": "starts with a story". Only when evidenced.
- identity fields: null unless this exchange revealed them. calling_summary should be one sentence in near-author language.
- Translations: if the author quotes KJV-style English ("thee", "shall"), you may set translation to "KJV"; otherwise null unless stated.`;

/** The shape we expect back. Used for defensive parsing. */
export type Extraction = {
  phrases: { phrase: string; context: string }[];
  scriptures: {
    reference: string;
    translation: string | null;
    significance: string;
    themes: string[];
  }[];
  stories: {
    title: string;
    summary: string;
    year_or_era: string | null;
    themes: string[];
    emotional_register: string;
  }[];
  framework: Record<string, string>;
  tone: Record<string, string | number>;
  habits: Record<string, string | boolean>;
  identity: {
    primary_lean: string | null;
    secondary_lean: string | null;
    audience: string | null;
    calling_summary: string | null;
  };
};

export function emptyExtraction(): Extraction {
  return {
    phrases: [],
    scriptures: [],
    stories: [],
    framework: {},
    tone: {},
    habits: {},
    identity: {
      primary_lean: null,
      secondary_lean: null,
      audience: null,
      calling_summary: null,
    },
  };
}

/** Parse the model's JSON defensively — never let a bad parse break the interview. */
export function parseExtraction(raw: string): Extraction {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const base = emptyExtraction();
    return {
      phrases: Array.isArray(parsed.phrases) ? parsed.phrases : base.phrases,
      scriptures: Array.isArray(parsed.scriptures)
        ? parsed.scriptures
        : base.scriptures,
      stories: Array.isArray(parsed.stories) ? parsed.stories : base.stories,
      framework:
        parsed.framework && typeof parsed.framework === "object"
          ? parsed.framework
          : base.framework,
      tone:
        parsed.tone && typeof parsed.tone === "object" ? parsed.tone : base.tone,
      habits:
        parsed.habits && typeof parsed.habits === "object"
          ? parsed.habits
          : base.habits,
      identity:
        parsed.identity && typeof parsed.identity === "object"
          ? { ...base.identity, ...parsed.identity }
          : base.identity,
    };
  } catch {
    return emptyExtraction();
  }
}
