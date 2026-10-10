import { Job } from "../types";
import { DeadlineState, deadlineState, extractFacts, Fact } from "./listing";

/** A job from the API plus what the UI derives from its text and deadline. */
export interface RadarJob extends Job {
  facts: Fact[];
  deadline_state: DeadlineState;
}

const factsCache = new Map<string, Fact[]>();

export function decorate(job: Job): RadarJob {
  let facts = factsCache.get(job.description);
  if (!facts) {
    facts = extractFacts(job.description);
    factsCache.set(job.description, facts);
  }
  return { ...job, facts, deadline_state: deadlineState(job.deadline).state };
}
