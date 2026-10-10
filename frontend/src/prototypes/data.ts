import { explainScore, ScoreBreakdown } from "./scoring";
import { deadlineState, DeadlineState, extractFacts, Fact, isPlaceholderListing } from "./extract";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Shape returned by GET /jobs (JobResponse in backend/app/models/schemas.py)
interface ApiJob {
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
  fit_score: number;
  status: string;
  is_saved: boolean;
  created_at: string;
  updated_at: string;
}

export type Status = "new" | "applied" | "interview" | "offer" | "rejected";
export const TRACKED: Status[] = ["applied", "interview", "offer", "rejected"];

export const STATUS_LABEL: Record<Status, string> = {
  new: "Not applied",
  applied: "Applied",
  interview: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

export interface ProtoJob extends ApiJob {
  status: Status;
  breakdown: ScoreBreakdown;
  score: number;          // current scoring rules (see scoring.ts)
  facts: Fact[];
  deadline_state: DeadlineState;
  role_group: RoleGroup;
}

export type RoleGroup = "placement" | "internship" | "graduate" | "apprenticeship" | "other";

export const ROLE_GROUP_LABEL: Record<RoleGroup, string> = {
  placement: "Placement",
  internship: "Internship",
  graduate: "Graduate scheme",
  apprenticeship: "Apprenticeship",
  other: "Other",
};

function roleGroup(roleType: string): RoleGroup {
  const r = roleType.toLowerCase();
  if (r.includes("placement")) return "placement";
  if (r.includes("internship")) return "internship";
  if (r.includes("graduate")) return "graduate";
  if (r.includes("apprenticeship")) return "apprenticeship";
  return "other";
}

export function roleLabel(roleType: string): string {
  if (!roleType) return "Role";
  if (roleType.length > 24) return roleType.split(/[(/]/)[0].trim();
  return roleType.charAt(0).toUpperCase() + roleType.slice(1);
}

export const SOURCE_LABEL: Record<string, string> = {
  ratemyplacement: "RateMyPlacement",
  manual: "Manual entry",
  gradcracker: "Gradcracker",
  brightnetwork: "Bright Network",
  prospects: "Prospects",
  other: "Other",
};

export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s;
// RateMyPlacement is the only automated collector; anything else came through Add Job.
export const isManual = (s: string) => s !== "ratemyplacement";

export interface LoadResult {
  jobs: ProtoJob[];
  hiddenPlaceholders: number;
}

export async function loadJobs(): Promise<LoadResult> {
  const res = await fetch(`${API}/jobs/?limit=200`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = (await res.json()) as ApiJob[];

  const kept = raw.filter((j) => !isPlaceholderListing(j.title));
  const jobs = kept.map((j): ProtoJob => {
    const breakdown = explainScore(j);
    return {
      ...j,
      status: (["new", "applied", "interview", "offer", "rejected"].includes(j.status) ? j.status : "new") as Status,
      breakdown,
      score: breakdown.score,
      facts: extractFacts(j.description),
      deadline_state: deadlineState(j.deadline).state,
      role_group: roleGroup(j.role_type),
    };
  });

  jobs.sort((a, b) => b.score - a.score || b.created_at.localeCompare(a.created_at));
  return { jobs, hiddenPlaceholders: raw.length - kept.length };
}
