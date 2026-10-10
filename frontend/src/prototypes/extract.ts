// Factual, rule-based extraction from listing text. Nothing here generates
// prose: every value is a literal match from the description, or it is omitted.

// Mirror of is_placeholder_listing() in backend/app/collectors/ratemyplacement.py
const PLACEHOLDER_TITLE_PATTERNS = [
  "register your interest",
  "expression of interest",
  "talent pool",
  "register interest",
];

export function isPlaceholderListing(title: string): boolean {
  const lower = (title || "").toLowerCase();
  return PLACEHOLDER_TITLE_PATTERNS.some((p) => lower.includes(p));
}

export interface Fact {
  label: string;
  value: string;
  excerpt: string; // the surrounding listing text the value came from
}

function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + length + 80);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

interface Rule {
  label: string;
  re: RegExp;
  format: (m: RegExpExecArray) => string;
}

const ORDINAL_DATE = String.raw`\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d\d`;
const MONTH_YEAR = String.raw`(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d\d`;

const RULES: Rule[] = [
  {
    label: "Duration",
    re: /\b(\d{1,2})[\s-]?(month|week)s?\b(?!\s+(?:ago|notice))/i,
    format: (m) => `${m[1]} ${m[2].toLowerCase()}${m[1] === "1" ? "" : "s"}`,
  },
  {
    label: "Starts",
    re: new RegExp(String.raw`start(?:ing)?\s+date\s*:?\s*(?:is\s+)?(${ORDINAL_DATE}|${MONTH_YEAR})`, "i"),
    format: (m) => m[1],
  },
  {
    label: "Working pattern",
    re: /\b(hybrid|fully remote|remote-first|office-based|on-site)\b(?:[^.]{0,80}?\b(\d)\s+days?\s+(?:per|a)\s+week)?/i,
    format: (m) => {
      const mode = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      return m[2] ? `${mode}, ${m[2]} days a week in office` : mode;
    },
  },
  {
    label: "Year of study",
    re: /\b(penultimate[- ]year|final[- ]year|(?:2nd|second|3rd|third)[- ]year)\b/i,
    format: (m) => m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase().replace("-", " "),
  },
  {
    label: "Grade",
    re: /\b(2:1|2\.1|2:2|first[- ]class|\d{2,3}\s+UCAS\s+points)\b/i,
    format: (m) => m[1],
  },
  {
    label: "Right to work",
    re: /\b(eligible to work in the UK|right to work in the UK)\b/i,
    format: () => "UK right to work required",
  },
  {
    label: "Salary",
    re: /£\s?(\d{1,3}(?:,\d{3})+|\d{2,3}k)(?:\s*(?:-|–|to)\s*£?\s?(\d{1,3}(?:,\d{3})+|\d{2,3}k))?/i,
    format: (m) => (m[2] ? `£${m[1]}–£${m[2]}` : `£${m[1]}`),
  },
];

export function extractFacts(description: string): Fact[] {
  const text = (description || "").replace(/\s+/g, " ");
  const facts: Fact[] = [];
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    facts.push({ label: rule.label, value: rule.format(m), excerpt: excerptAround(text, m.index, m[0].length) });
  }
  return facts;
}

// ── Description formatting ───────────────────────────────────────────────────
// Scraped descriptions arrive as one run-on paragraph with inline headings.
// We only insert breaks at recognisable headings; wording is never changed.

const HEADINGS = [
  "What you'll do", "What you’ll do", "What you will do",
  "What you'll need", "What you’ll need", "What you will need",
  "What we're looking for", "What we’re looking for", "What we are looking for",
  "Job purpose", "Knowledge and Skills", "Key responsibilities", "Responsibilities",
  "Requirements", "About you", "About the role", "The role", "Your role", "Role overview",
  "How to apply", "Who we are", "What we offer", "Benefits", "Skills and experience",
  "Essential criteria", "Desirable criteria", "Entry requirements", "Key skills",
];

export interface DescriptionBlock {
  heading: string | null;
  text: string;
  paragraphs: string[]; // `text` split every few sentences for readability
}

function toParagraphs(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z“"‘(])/);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) out.push(sentences.slice(i, i + 3).join(" "));
  return out;
}

export function formatDescription(description: string, title: string): DescriptionBlock[] {
  let text = (description || "").replace(/\s+/g, " ").trim();
  // Listings repeat the title as their first words.
  if (title && text.toLowerCase().startsWith(title.toLowerCase())) text = text.slice(title.length).trim();
  text = text.replace(/^Description\s+/i, "");

  const escaped = HEADINGS.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(?:^|\\s)(${escaped})\\s*:?\\s+(?=[A-Z])`, "g");

  const blocks: DescriptionBlock[] = [];
  let last = 0;
  let heading: string | null = null;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const body = text.slice(last, m.index).trim();
    if (body) blocks.push({ heading, text: body, paragraphs: toParagraphs(body) });
    heading = m[1];
    last = m.index + m[0].length;
  }
  const tail = text.slice(last).trim();
  if (tail) blocks.push({ heading, text: tail, paragraphs: toParagraphs(tail) });
  return blocks;
}

// ── Dates ─────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function shortDate(iso: string, withYear = false): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}),
  });
}

export function relativeAge(iso: string): string {
  const days = Math.floor((startOfToday().getTime() - new Date(iso).getTime()) / DAY);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export type DeadlineState = "none" | "closed" | "soon" | "open";

export function deadlineState(deadline: string | null): { state: DeadlineState; days: number | null } {
  if (!deadline) return { state: "none", days: null };
  const days = Math.round((new Date(deadline).getTime() - startOfToday().getTime()) / DAY);
  if (days < 0) return { state: "closed", days };
  if (days <= 14) return { state: "soon", days };
  return { state: "open", days };
}

export function deadlineLabel(deadline: string | null): string {
  const { state, days } = deadlineState(deadline);
  if (state === "none" || !deadline) return "No deadline listed";
  if (state === "closed") return `Closed ${shortDate(deadline)}`;
  if (state === "soon") return days === 0 ? "Closes today" : `Closes in ${days} day${days === 1 ? "" : "s"}`;
  return `Closes ${shortDate(deadline)}`;
}
