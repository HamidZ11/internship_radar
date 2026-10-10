// Mirror of backend/app/services/scoring.py that also records *why* each
// signal fired. Weights, keyword lists and the matcher are copied exactly —
// this must never drift from the backend (see backend/tests/test_matching.py).
//
// Matching, as in the backend: whole terms only (no letters/digits glued on
// either edge that is itself a letter/digit), literal punctuation inside a
// term, phrases across any whitespace, plural folding for words of 6+ letters,
// and capitalised acronyms inside mixed-case words (RESTful, PostgreSQL, APIs).

const TECH_KEYWORDS = ["python", "java", "javascript", "typescript", "react", "sql", "api", "apis"];
const QUALITY_STACK_KEYWORDS = [
  "git", "linux", "docker", "aws", "azure", "cloud",
  "agile", "scrum", "rest", "ci/cd", "kubernetes",
];
const IRRELEVANT_KEYWORDS = [
  "marketing", "finance", "accounting", "legal", "sales",
  "human resources", " hr ", "procurement", "actuary",
];
const ROLE_TERMS = ["placement", "internship"];
const LOCATION_PRIMARY_TERMS = ["manchester"];
const LOCATION_SECONDARY_TERMS = ["uk", "remote", "hybrid", "united kingdom"];
const REQUIREMENT_TERMS = ["requirements", "skills", "experience"];
const GRADUATE_TERMS = ["graduate scheme", "graduate only"];
const UNPAID_TERMS = ["unpaid", "volunteer"];

const PLURAL_MIN_LETTERS = 6;
const LETTER_OR_DIGIT = String.raw`[\p{L}\p{N}]`;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isLetterOrDigit = (ch: string) => /[\p{L}\p{N}]/u.test(ch);

const patternCache = new Map<string, { whole: RegExp; acronym: RegExp | null }>();

function termPatterns(term: string) {
  const cached = patternCache.get(term);
  if (cached) return cached;
  const t = term.trim().toLowerCase();
  const words = t.split(/\s+/);
  let body = words.map(escapeRe).join(String.raw`\s+`);
  const last = words[words.length - 1];
  if (/^\p{L}+$/u.test(last) && last.length >= PLURAL_MIN_LETTERS) body += "(?:e?s)?";
  const left = isLetterOrDigit(t[0]) ? `(?<!${LETTER_OR_DIGIT})` : "";
  const right = isLetterOrDigit(t[t.length - 1]) ? `(?!${LETTER_OR_DIGIT})` : "";
  const whole = new RegExp(left + body + right, "iu");
  const acronym = /^[\p{L}\p{N}]+$/u.test(t) && /\p{L}/u.test(t)
    ? new RegExp(`(?<![A-Z0-9])${escapeRe(t.toUpperCase())}(?![A-Z0-9])`, "u")
    : null;
  const patterns = { whole, acronym };
  patternCache.set(term, patterns);
  return patterns;
}

/** Where `term` matches in `text`, or null. Same rules as find_term() in the backend. */
export function findTerm(text: string, term: string): { index: number; text: string } | null {
  if (!text) return null;
  const { whole, acronym } = termPatterns(term);
  const m = whole.exec(text) ?? acronym?.exec(text) ?? null;
  return m ? { index: m.index, text: m[0] } : null;
}

export type FactorKey =
  | "role" | "tech" | "location" | "requirements" | "stack"
  | "graduate" | "unpaid" | "offTarget";

export interface Factor {
  key: FactorKey;
  label: string;
  rule: string;        // the rule as written in scoring.py, in plain words
  points: number;      // contribution (negative for penalties)
  max: number;         // best possible contribution (penalties: the penalty size)
  matched: string[];   // terms that triggered it
  evidence: Evidence[]; // where each term was found
  penalty: boolean;
}

export interface Evidence {
  term: string;
  word: string;        // the whole word containing the match, lowercased, e.g. "rest" → "restful"
}

/** Configured terms found in `text`, with the word each one sits in. */
function hits(text: string, terms: string[]): Evidence[] {
  const found: Evidence[] = [];
  for (const raw of terms) {
    const m = findTerm(text, raw);
    if (!m) continue;
    let a = m.index;
    let b = m.index + m.text.length;
    while (a > 0 && isLetterOrDigit(text[a - 1])) a--;
    while (b < text.length && isLetterOrDigit(text[b])) b++;
    const term = raw.trim();
    found.push({ term, word: term.includes(" ") ? term : text.slice(a, b).toLowerCase() });
  }
  return found;
}

export interface ScoreBreakdown {
  score: number;       // clamped 0–100, identical to calculate_fit_score()
  raw: number;         // unclamped sum
  gains: Factor[];     // always all five, in order
  penalties: Factor[]; // only the ones that fired
}

interface ScoreInput {
  title: string;
  location: string;
  description: string;
  role_type: string;
}

export function explainScore(job: ScoreInput): ScoreBreakdown {
  const title = job.title || "";
  const location = job.location || "";
  const description = job.description || "";
  const roleType = job.role_type || "";
  const titleDesc = `${title} ${description}`;

  const role = hits(`${title} ${roleType}`, ROLE_TERMS);
  const tech = hits(titleDesc, TECH_KEYWORDS);
  const primary = hits(location, LOCATION_PRIMARY_TERMS);
  const loc = primary.length > 0 ? primary : hits(location, LOCATION_SECONDARY_TERMS);
  const req = hits(description, REQUIREMENT_TERMS);
  const stack = hits(description, QUALITY_STACK_KEYWORDS);
  const grad = hits(titleDesc, GRADUATE_TERMS);
  const unpaid = hits(titleDesc, UNPAID_TERMS);
  const off = hits(titleDesc, IRRELEVANT_KEYWORDS);

  const factor = (
    key: FactorKey, label: string, rule: string, points: number, max: number, evidence: Evidence[], penalty = false,
  ): Factor => ({ key, label, rule, points, max, matched: evidence.map((e) => e.term), evidence, penalty });

  const gains: Factor[] = [
    factor("role", "Role type", "Title or type says placement or internship", role.length ? 30 : 0, 30, role),
    factor("tech", "Tech keywords", "+5 per keyword in title or description, up to 30", Math.min(tech.length * 5, 30), 30, tech),
    factor("location", "Location", "Manchester +20 · UK, remote or hybrid +10", primary.length ? 20 : loc.length ? 10 : 0, 20, loc),
    factor("requirements", "States requirements", "Mentions requirements, skills or experience", req.length ? 10 : 0, 10, req),
    factor("stack", "Modern stack", "Mentions git, linux, docker, cloud, agile and similar", stack.length ? 10 : 0, 10, stack),
  ];

  const penalties: Factor[] = [];
  if (grad.length) penalties.push(factor("graduate", "Graduate-scheme wording", "Says “graduate scheme” or “graduate only”", -40, -40, grad, true));
  if (unpaid.length) penalties.push(factor("unpaid", "Unpaid or volunteer", "Says unpaid or volunteer", -50, -50, unpaid, true));
  if (off.length) penalties.push(factor("offTarget", "Off-target department", "Mentions marketing, finance, sales, legal and similar", -30, -30, off, true));

  const raw = [...gains, ...penalties].reduce((sum, f) => sum + f.points, 0);
  return { score: Math.max(0, Math.min(100, raw)), raw, gains, penalties };
}
