// Mirror of backend/app/services/scoring.py that also records *why* each
// signal fired. Weights, keyword lists, the matcher and the evidence each rule
// reads are copied exactly — this must never drift from the backend
// (see backend/tests/test_matching.py and test_rule_semantics.py).
//
// Matching, as in the backend: whole terms only (no letters/digits glued on
// either edge that is itself a letter/digit), literal punctuation inside a
// term, phrases across any whitespace, plural folding for words of 6+ letters,
// and capitalised acronyms inside mixed-case words (RESTful, PostgreSQL, APIs).
//
// Evidence, as in the backend: rules about what the role IS (role type,
// graduate, unpaid, off-target) read role_type and the role part of the title;
// rules about what it INVOLVES read the description. Plural aliases in one
// keyword list (api/apis) count once.

const TECH_KEYWORDS = ["python", "java", "javascript", "typescript", "react", "sql", "api", "apis"];
const QUALITY_STACK_KEYWORDS = [
  "git", "linux", "docker", "aws", "azure", "cloud",
  "agile", "scrum", "rest", "ci/cd", "kubernetes",
];
const IRRELEVANT_KEYWORDS = [
  "marketing", "finance", "accounting", "legal", "sales",
  "human resources", " hr ", "procurement", "actuary",
  "business development", "presales", "audit", "tax", "actuarial", "key account",
];
// Role names that make a title a technical role whatever its domain; they only stop the off-target penalty.
const TECHNICAL_ROLE_TERMS = [
  "software", "developer", "programmer", "engineer", "engineering",
  "data", "ai", "machine learning", "cyber",
];
const LOCATION_PRIMARY_TERMS = ["manchester"];
const LOCATION_SECONDARY_TERMS = ["uk", "remote", "hybrid", "united kingdom"];
const REQUIREMENT_TERMS = ["requirements", "skills", "experience"];
const GRADUATE_ONLY_TERMS = ["graduate only"];
const UNPAID_TERMS = ["unpaid", "volunteer"];

export type RoleCategory = "placement" | "internship" | "graduate" | "apprenticeship" | "other";
const ROLE_CATEGORIES: [Exclude<RoleCategory, "other">, string[]][] = [
  ["placement", ["placement"]],
  ["internship", ["internship"]],
  ["graduate", ["graduate"]],
  ["apprenticeship", ["apprenticeship"]],
];
const TARGET_CATEGORIES = new Set<RoleCategory>(["placement", "internship"]);
const ROLE_NOUNS = [
  "role", "roles", "position", "post", "posts", "job", "jobs",
  "vacancy", "vacancies", "placement", "internship", "apprenticeship",
];
const TITLE_SEPARATOR = /\s+[-–—|]\s+/;

const PLURAL_MIN_LETTERS = 6;
const LETTER_OR_DIGIT = String.raw`[\p{L}\p{N}]`;
const WORD_CHAR = String.raw`[\p{L}\p{N}_]`; // Python's \w

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

type Match = { index: number; text: string };
type Finder = (text: string, term: string) => Match | null;

/** Where `term` matches in `text`, or null. Same rules as find_term() in the backend. */
export const findTerm: Finder = (text, term) => {
  if (!text) return null;
  const { whole, acronym } = termPatterns(term);
  const m = whole.exec(text) ?? acronym?.exec(text) ?? null;
  return m ? { index: m.index, text: m[0] } : null;
};

const describesRoleCache = new Map<string, RegExp>();

/** Like findTerm, but only where the term describes a role ("an unpaid role"), not a benefit. */
export const findTermDescribingRole: Finder = (text, term) => {
  if (!text) return null;
  let re = describesRoleCache.get(term);
  if (!re) {
    const t = termPatterns(term).whole.source;
    const nouns = ROLE_NOUNS.map((n) => termPatterns(n).whole.source).join("|");
    const gap = `(?:[^${WORD_CHAR.slice(1, -1)}.!?;]+${WORD_CHAR}+){0,2}[^${WORD_CHAR.slice(1, -1)}.!?;]+`;
    re = new RegExp(`(?:${t})${gap}(?:${nouns})|(?:${nouns})${gap}(?:${t})`, "iu");
    describesRoleCache.set(term, re);
  }
  const m = re.exec(text);
  return m ? { index: m.index, text: m[0] } : null;
};

const LEGAL_SUFFIXES = new Set(["ltd", "limited", "plc", "llp", "inc", "group", "uk"]);
const PARENTHETICAL = /\(([^()]*)\)/g;
const ORGANISATION_CUES = [
  String.raw`(?<![\p{L}\p{N}_])about\s+{name}(?![\p{L}\p{N}])`,
  String.raw`(?<![\p{L}\p{N}]){name}\s+(?:is|are)\s+(?:a|an|the|one|part|proud|hiring|looking|seeking|recruiting)(?![\p{L}\p{N}_])`,
  String.raw`(?<![\p{L}\p{N}]){name}\s*[,–—]\s*(?:a|an|the|one)(?![\p{L}\p{N}_])`,
  String.raw`(?<![\p{L}\p{N}_])at\s+{name}\s*,?\s+(?:we|you|our)(?![\p{L}\p{N}_])`,
  String.raw`(?<![\p{L}\p{N}_])join(?:ing)?\s+{name}(?![\p{L}\p{N}])`,
];

const tokens = (text: string) => (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

function isLocation(part: string, location: string): boolean {
  const words = tokens(part).filter((t) => !/^\p{N}+$/u.test(t));
  const loc = new Set(tokens(location));
  return words.length > 0 && words.every((w) => loc.has(w));
}

function isCompany(part: string, company: string): boolean {
  const core = tokens(company.replace(PARENTHETICAL, " ")).filter((t) => !LEGAL_SUFFIXES.has(t));
  const seg = new Set(tokens(part));
  return core.length > 0 && core.every((t) => seg.has(t));
}

function isNamedOrganisation(part: string, description: string): boolean {
  const words = tokens(part);
  if (words.length && LEGAL_SUFFIXES.has(words[words.length - 1]) && words[words.length - 1] !== "uk") return true;
  if (!description) return false;
  for (const name of part.trim().split(/\s*[/&]\s*/)) {
    if (name.length < 2) continue;
    const escaped = escapeRe(name);
    if (ORGANISATION_CUES.some((cue) => new RegExp(cue.replace("{name}", () => escaped), "iu").test(description))) return true;
  }
  return false;
}

const isAnnotation = (part: string, location: string, company: string, description: string) =>
  isLocation(part, location) || isCompany(part, company) || isNamedOrganisation(part, description);

const namesRoleCategory = (text: string) => ROLE_CATEGORIES.some(([, terms]) => terms.some((t) => findTerm(text, t)));

/**
 * The part of a listing title that describes the role. Every part after a spaced dash/pipe, and every
 * bracket, is kept unless it matches the location or company, is introduced by the description as an
 * organisation, or (brackets only) is a date or duration. Parts naming a role category are always kept.
 */
export function roleTitle(title: string, ctx: { location?: string; company?: string; description?: string } = {}): string {
  const location = ctx.location ?? "";
  const company = ctx.company ?? "";
  const description = ctx.description ?? "";
  const kept: string[] = [];
  for (const raw of (title || "").split(TITLE_SEPARATOR)) {
    let segment = raw.trim();
    if (!segment) continue;
    segment = segment
      .replace(PARENTHETICAL, (whole, inner: string) =>
        /\p{N}/u.test(inner) || isAnnotation(inner.trim(), location, company, description) ? " " : whole)
      .replace(/\s+/g, " ")
      .trim();
    if (segment && (namesRoleCategory(segment) || !isAnnotation(segment, location, company, description))) kept.push(segment);
  }
  return kept.length ? kept.join(" · ") : title || "";
}

/** Category from the structured role_type first, then the role part of the title. */
export function classifyRole(title: string, roleType: string, roleText?: string): { category: RoleCategory; text: string | null } {
  for (const source of [roleType || "", roleText ?? roleTitle(title)]) {
    for (const [category, terms] of ROLE_CATEGORIES) {
      for (const term of terms) {
        const m = findTerm(source, term);
        if (m) return { category, text: m.text };
      }
    }
  }
  return { category: "other", text: null };
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

/** Plural aliases in one list share a concept: "apis" → "api" when both are configured. */
function concept(term: string, terms: string[]): string {
  const t = term.trim();
  const listed = new Set(terms.map((x) => x.trim()));
  for (const suffix of ["es", "s"]) {
    if (t.endsWith(suffix) && listed.has(t.slice(0, -suffix.length))) return t.slice(0, -suffix.length);
  }
  return t;
}

/** Configured terms found in `text`, one per concept, with the word each one sits in. */
function hits(text: string, terms: string[], find: Finder = findTerm): Evidence[] {
  const found: Evidence[] = [];
  const seen = new Set<string>();
  for (const raw of terms) {
    const c = concept(raw, terms);
    if (seen.has(c)) continue;
    const m = find(text, raw);
    if (!m) continue;
    seen.add(c);
    let a = m.index;
    let b = m.index + m.text.length;
    while (a > 0 && isLetterOrDigit(text[a - 1])) a--;
    while (b < text.length && isLetterOrDigit(text[b])) b++;
    const term = raw.trim();
    const multiWord = term.includes(" ") || find !== findTerm;
    found.push({ term, word: multiWord ? term : text.slice(a, b).toLowerCase() });
  }
  return found;
}

export interface ScoreBreakdown {
  score: number;       // clamped 0–100, identical to calculate_fit_score()
  raw: number;         // unclamped sum
  category: RoleCategory;
  gains: Factor[];     // always all five, in order
  penalties: Factor[]; // only the ones that fired
}

interface ScoreInput {
  title: string;
  company?: string;
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
  const rolePart = roleTitle(title, { location, company: job.company ?? "", description });
  const roleText = `${rolePart} · ${roleType}`;

  const { category, text: categoryText } = classifyRole(title, roleType, rolePart);
  const role: Evidence[] = TARGET_CATEGORIES.has(category) && categoryText ? [{ term: category, word: categoryText.toLowerCase() }] : [];
  const tech = hits(titleDesc, TECH_KEYWORDS);
  const primary = hits(location, LOCATION_PRIMARY_TERMS);
  const loc = primary.length > 0 ? primary : hits(location, LOCATION_SECONDARY_TERMS);
  const req = hits(description, REQUIREMENT_TERMS);
  const stack = hits(description, QUALITY_STACK_KEYWORDS);
  const grad: Evidence[] = category === "graduate"
    ? [{ term: "graduate", word: (categoryText ?? "graduate").toLowerCase() }]
    : hits(description, GRADUATE_ONLY_TERMS);
  const unpaid = hits(roleText, UNPAID_TERMS).length ? hits(roleText, UNPAID_TERMS) : hits(description, UNPAID_TERMS, findTermDescribingRole);
  const technical = TECHNICAL_ROLE_TERMS.some((t) => findTerm(roleText, t));
  const off = technical ? [] : hits(roleText, IRRELEVANT_KEYWORDS);

  const factor = (
    key: FactorKey, label: string, rule: string, points: number, max: number, evidence: Evidence[], penalty = false,
  ): Factor => ({ key, label, rule, points, max, matched: evidence.map((e) => e.term), evidence, penalty });

  const gains: Factor[] = [
    factor("role", "Role type", "Role type or title is a placement or internship", role.length ? 30 : 0, 30, role),
    factor("tech", "Tech keywords", "+5 per keyword in title or description, up to 30", Math.min(tech.length * 5, 30), 30, tech),
    factor("location", "Location", "Manchester +20 · UK, remote or hybrid +10", primary.length ? 20 : loc.length ? 10 : 0, 20, loc),
    factor("requirements", "States requirements", "Mentions requirements, skills or experience", req.length ? 10 : 0, 10, req),
    factor("stack", "Modern stack", "Mentions git, linux, docker, cloud, agile and similar", stack.length ? 10 : 0, 10, stack),
  ];

  const penalties: Factor[] = [];
  if (grad.length) penalties.push(factor("graduate", "Graduate role", "Role type or title is graduate, or the listing says “graduate only”", -40, -40, grad, true));
  if (unpaid.length) penalties.push(factor("unpaid", "Unpaid or volunteer", "Title or type says unpaid/volunteer, or the description calls the role unpaid", -50, -50, unpaid, true));
  if (off.length) penalties.push(factor("offTarget", "Off-target department", "Role title names marketing, finance, sales, legal and similar", -30, -30, off, true));

  const raw = [...gains, ...penalties].reduce((sum, f) => sum + f.points, 0);
  return { score: Math.max(0, Math.min(100, raw)), raw, category, gains, penalties };
}
