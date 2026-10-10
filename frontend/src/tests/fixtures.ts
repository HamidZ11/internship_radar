import { FitBreakdown, FitRule, Job, RoleCategory, RuleKey } from "../types";

// Jobs shaped exactly like GET /jobs/ responses (JobResponse + fit_breakdown).

const GAINS: [RuleKey, string, number][] = [
  ["role", "Role type", 30], ["tech", "Tech keywords", 30], ["location", "Location", 20],
  ["requirements", "States requirements", 10], ["stack", "Modern stack", 10],
];
const PENALTIES: [RuleKey, string][] = [["graduate", "Graduate role"], ["unpaid", "Unpaid or volunteer"], ["off_target", "Off-target department"]];

/** A breakdown in the backend's shape from rule points, e.g. { role: 30, graduate: -40 }. */
export function breakdown(points: Partial<Record<RuleKey, number>>, category: RoleCategory = "placement"): FitBreakdown {
  const rule = (key: RuleKey, label: string, kind: "gain" | "penalty", max: number | null): FitRule => {
    const p = points[key] ?? 0;
    return {
      key, label, rule: `${label} rule`, kind, max, points: p,
      state: p === 0 ? "unmatched" : kind === "gain" ? "matched" : "penalty",
      evidence: p === 0 ? [] : [{ term: key, matched: key, word: key }],
    };
  };
  const rules = [
    ...GAINS.map(([k, l, max]) => rule(k, l, "gain", max)),
    ...PENALTIES.map(([k, l]) => rule(k, l, "penalty", null)),
  ];
  const raw = rules.reduce((s, r) => s + r.points, 0);
  return { score: Math.max(0, Math.min(100, raw)), raw, category, rules };
}

let nextId = 1;

export function job(over: Partial<Job> & { points?: Partial<Record<RuleKey, number>>; category?: RoleCategory } = {}): Job {
  const { points = { role: 30, requirements: 10 }, category = "placement", ...rest } = over;
  const fit_breakdown = rest.fit_breakdown ?? breakdown(points, category);
  const id = rest.id ?? nextId++;
  return {
    id,
    title: `Role ${id}`,
    company: "Acme",
    location: "London",
    url: `https://example.com/jobs/${id}`,
    source: "ratemyplacement",
    description: "Placement for students. Requirements: skills in Python.",
    role_type: category,
    posted_date: null,
    deadline: null,
    status: "new",
    is_saved: false,
    created_at: "2026-04-28T17:07:00",
    updated_at: "2026-05-03T00:00:00",
    ...rest,
    fit_score: rest.fit_score ?? fit_breakdown.score,
    fit_breakdown,
  };
}
