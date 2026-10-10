import { RadarJob } from "./jobs";
import { deadlineState } from "./listing";

// Shortlist groups. "Considering" is exactly the saved roles that are still open
// and not yet applied to; "Worth considering" is a plain ranking of the highest
// stored fit scores among open, unsaved, unapplied roles (jobs arrive best fit first).

function urgency(j: RadarJob): number {
  const { state, days } = deadlineState(j.deadline);
  if (state === "soon" || state === "open") return days ?? 0;
  if (state === "none") return 10_000;
  return 20_000;
}

export function shortlistGroups(jobs: RadarJob[]) {
  const saved = jobs.filter((j) => j.is_saved);
  const considering = saved
    .filter((j) => j.status === "new" && j.deadline_state !== "closed")
    .sort((a, b) => urgency(a) - urgency(b) || b.fit_score - a.fit_score);
  return {
    considering,
    worthConsidering: jobs.filter((j) => !j.is_saved && j.status === "new" && j.deadline_state !== "closed").slice(0, 3),
    deadlinePassed: saved.filter((j) => j.status === "new" && j.deadline_state === "closed"),
    inPipeline: saved.filter((j) => j.status !== "new"),
    closingSoon: considering.filter((j) => j.deadline_state === "soon").length,
  };
}
