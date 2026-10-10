import { RoleCategory, Status } from "../types";
import { RadarJob } from "./jobs";
import { CATEGORY_LABEL, deadlineState, sourceLabel, STATUS_LABEL } from "./listing";

// Radar's filters. Text matching follows the API's own filters (case-insensitive
// substring on title, company, description and location); role type uses the
// backend scorer's category.

export interface Filters {
  search: string;
  roles: RoleCategory[];
  location: string;
  deadline: "" | "7" | "14" | "30" | "none";
  minScore: number;
  status: "" | Status;
  source: string;
}

export const EMPTY_FILTERS: Filters = {
  search: "", roles: [], location: "", deadline: "", minScore: 0, status: "", source: "",
};

export function matchesFilters(j: RadarJob, f: Filters): boolean {
  const q = f.search.trim().toLowerCase();
  if (q && !`${j.title} ${j.company} ${j.description} ${j.location}`.toLowerCase().includes(q)) return false;
  if (f.roles.length > 0 && !f.roles.includes(j.fit_breakdown.category)) return false;
  if (f.location.trim() && !j.location.toLowerCase().includes(f.location.trim().toLowerCase())) return false;
  if (f.source && j.source !== f.source) return false;
  if (f.status && j.status !== f.status) return false;
  if (f.minScore && j.fit_score < f.minScore) return false;
  if (f.deadline === "none" && j.deadline) return false;
  if (f.deadline && f.deadline !== "none") {
    const { state, days } = deadlineState(j.deadline);
    if (state === "none" || state === "closed" || days === null || days > Number(f.deadline)) return false;
  }
  return true;
}

export const filterJobs = (jobs: RadarJob[], f: Filters) => jobs.filter((j) => matchesFilters(j, f));

/** Filters set in the panel (search is shown separately and not counted). */
export function countActiveFilters(f: Filters): number {
  return (f.roles.length > 0 ? 1 : 0) + (f.location.trim() ? 1 : 0) + (f.deadline ? 1 : 0) +
    (f.minScore ? 1 : 0) + (f.status ? 1 : 0) + (f.source ? 1 : 0);
}

/** One removable token per active filter; `clear` is the change that removes it. */
export function filterTokens(f: Filters): { key: string; label: string; clear: Partial<Filters> }[] {
  const out: { key: string; label: string; clear: Partial<Filters> }[] = [];
  if (f.roles.length) out.push({ key: "roles", label: f.roles.map((r) => CATEGORY_LABEL[r]).join(", "), clear: { roles: [] } });
  if (f.location.trim()) out.push({ key: "location", label: `In “${f.location.trim()}”`, clear: { location: "" } });
  if (f.deadline) out.push({ key: "deadline", label: f.deadline === "none" ? "No deadline" : `Closes within ${f.deadline} days`, clear: { deadline: "" } });
  if (f.minScore) out.push({ key: "fit", label: `Fit ${f.minScore}+`, clear: { minScore: 0 } });
  if (f.status) out.push({ key: "status", label: STATUS_LABEL[f.status], clear: { status: "" } });
  if (f.source) out.push({ key: "source", label: sourceLabel(f.source), clear: { source: "" } });
  return out;
}
