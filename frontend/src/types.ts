// Shapes returned by the API (JobResponse in backend/app/models/schemas.py).

export type Status = "new" | "applied" | "interview" | "offer" | "rejected";

export type RoleCategory = "placement" | "internship" | "graduate" | "apprenticeship" | "other";

export type RuleKey =
  | "role" | "tech" | "location" | "requirements" | "stack"
  | "graduate" | "unpaid" | "off_target";

export interface FitEvidence {
  term: string;    // the configured keyword
  matched: string; // the listing text it matched
  word: string;    // the word or phrase that text sits in, e.g. "RESTful" for "rest"
}

export interface FitRule {
  key: RuleKey;
  label: string;
  rule: string;
  kind: "gain" | "penalty";
  state: "matched" | "unmatched" | "penalty";
  points: number;
  max: number | null; // most a gain can add; null for penalties
  evidence: FitEvidence[];
}

/** explain_fit_score() from the backend scorer. The browser never scores listings itself. */
export interface FitBreakdown {
  score: number;
  raw: number;
  category: RoleCategory;
  rules: FitRule[];
}

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  description: string;
  role_type: string;
  posted_date: string | null;
  deadline: string | null;
  fit_score: number; // persisted score: what the app shows
  fit_breakdown: FitBreakdown;
  status: Status;
  is_saved: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobCreate {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  role_type: string;
  description: string;
  deadline: string | null;
  posted_date: null;
}
