import { describe, expect, it } from "vitest";
import { countActiveFilters, EMPTY_FILTERS, filterJobs, Filters, filterTokens } from "../lib/filters";
import { decorate } from "../lib/jobs";
import { job } from "./fixtures";

// "Today" is 10 Oct 2026 (see env.ts).
const jobs = () => [
  job({ id: 1, title: "Software Engineering Placement", company: "Acme", location: "Manchester", category: "placement",
    points: { role: 30, tech: 20, location: 20 }, deadline: "2026-10-15" }),                          // fit 70, closes in 5 days
  job({ id: 2, title: "AI Internship", company: "G-Research", location: "London", category: "internship",
    points: { role: 30, tech: 10, requirements: 10 }, deadline: "2026-10-22", status: "applied" }),   // fit 50, 12 days
  job({ id: 3, title: "Data Analyst Apprenticeship", company: "QA Limited", location: "Leeds", category: "apprenticeship",
    points: { tech: 10, stack: 10 }, deadline: "2026-11-05", source: "manual", status: "interview" }), // fit 20, 26 days
  job({ id: 4, title: "Technical Graduate Programme", company: "CGI", location: "Remote, UK", category: "graduate",
    points: { tech: 20, location: 10, graduate: -40 }, deadline: "2026-09-01", status: "rejected" }),  // fit 0, closed
  job({ id: 5, title: "Audit Placement", company: "EY", location: "Birmingham", category: "placement",
    points: { role: 30, off_target: -30 }, description: "Join our audit team in Manchester.", status: "offer" }), // fit 0, no deadline
].map(decorate);

const ids = (f: Partial<Filters>) => filterJobs(jobs(), { ...EMPTY_FILTERS, ...f }).map((j) => j.id);

describe("Radar filters", () => {
  it("search matches title, company, location and listing text, case-insensitively and trimmed", () => {
    expect(ids({ search: "graduate" })).toEqual([4]);
    expect(ids({ search: "  G-RESEARCH " })).toEqual([2]);
    expect(ids({ search: "manchester" })).toEqual([1, 5]); // location of 1, description of 5
    expect(ids({ search: "   " })).toEqual([1, 2, 3, 4, 5]);
  });

  it("role type uses the scorer's category and combines selected types with OR", () => {
    expect(ids({ roles: ["placement"] })).toEqual([1, 5]);
    expect(ids({ roles: ["placement", "internship"] })).toEqual([1, 2, 5]);
    expect(ids({ roles: ["graduate"] })).toEqual([4]);
  });

  it("minimum fit compares the persisted fit_score", () => {
    expect(ids({ minScore: 60 })).toEqual([1]);
    expect(ids({ minScore: 40 })).toEqual([1, 2]);
    expect(ids({ minScore: 20 })).toEqual([1, 2, 3]);
  });

  it("status matches exactly", () => {
    expect(ids({ status: "new" })).toEqual([1]);
    expect(ids({ status: "applied" })).toEqual([2]);
    expect(ids({ status: "rejected" })).toEqual([4]);
  });

  it("source matches exactly", () => {
    expect(ids({ source: "manual" })).toEqual([3]);
    expect(ids({ source: "ratemyplacement" })).toEqual([1, 2, 4, 5]);
  });

  it("deadline windows include only open roles closing within the window", () => {
    expect(ids({ deadline: "7" })).toEqual([1]);
    expect(ids({ deadline: "14" })).toEqual([1, 2]);
    expect(ids({ deadline: "30" })).toEqual([1, 2, 3]);
    expect(ids({ deadline: "none" })).toEqual([5]);
    // The closed role (4) is never inside a window.
    expect(ids({ deadline: "30", search: "graduate" })).toEqual([]);
  });

  it("multiple active filters must all match", () => {
    expect(ids({ roles: ["placement", "internship"], minScore: 40 })).toEqual([1, 2]);
    expect(ids({ roles: ["placement", "internship"], minScore: 40, deadline: "7" })).toEqual([1]);
    expect(ids({ roles: ["placement"], location: "birmingham", status: "offer" })).toEqual([5]);
  });

  it("clearing: no filters returns every role, and each token clears only its own filter", () => {
    expect(ids({})).toEqual([1, 2, 3, 4, 5]);
    const f: Filters = { ...EMPTY_FILTERS, search: "placement", roles: ["placement"], minScore: 40, status: "new" };
    expect(countActiveFilters(f)).toBe(3); // search is not counted as a filter
    const tokens = filterTokens(f);
    expect(tokens.map((t) => t.label)).toEqual(["Placement", "Fit 40+", "Not applied"]);
    const withoutStatus = { ...f, ...tokens.find((t) => t.key === "status")!.clear };
    expect(withoutStatus).toEqual({ ...f, status: "" });
    expect(countActiveFilters(withoutStatus)).toBe(2);
  });

  it("no matching roles returns an empty list", () => {
    expect(ids({ status: "offer", minScore: 60 })).toEqual([]);
    expect(ids({ search: "astronaut" })).toEqual([]);
  });
});
