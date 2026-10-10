import { describe, expect, it } from "vitest";
import { decorate } from "../lib/jobs";
import { shortlistGroups } from "../lib/shortlist";
import { fakeApi } from "./fakeApi";
import { job } from "./fixtures";
import { byLabel, byText, click, reload, renderApp } from "./render";

const ids = (list: { id: number }[]) => list.map((j) => j.id);

/** The roles listed under a Shortlist group heading. */
function group(container: HTMLElement, heading: string): string[] {
  const h = byText(container, "main h2", heading);
  if (!h) return [];
  return [...h.closest("section")!.querySelectorAll<HTMLElement>("button[title]:not([aria-label]), button.truncate:not([aria-label])")]
    .map((b) => (b.title || b.textContent || "").split(" · ")[0].trim());
}

describe("Shortlist grouping", () => {
  it("places saved, tracked and expired roles in the right groups", () => {
    const g = shortlistGroups([
      job({ id: 12, is_saved: true, points: { role: 30, tech: 30, location: 10 } }),        // no deadline
      job({ id: 10, is_saved: true, deadline: "2026-11-05" }),                               // open, 26 days
      job({ id: 11, is_saved: true, deadline: "2026-10-15" }),                               // closes in 5 days
      job({ id: 13, is_saved: true, deadline: "2026-09-01" }),                               // closed
      job({ id: 14, is_saved: true, status: "applied" }),
      job({ id: 15, is_saved: true, status: "interview", deadline: "2026-09-01" }),
      job({ id: 16, points: { role: 30, tech: 20 } }),                                       // not saved, open
      job({ id: 17, status: "applied" }),
      job({ id: 18, deadline: "2026-09-01" }),                                               // not saved, closed
    ].map(decorate));

    expect(ids(g.considering)).toEqual([11, 10, 12]); // soonest deadline first, no deadline last
    expect(g.closingSoon).toBe(1);
    expect(ids(g.deadlinePassed)).toEqual([13]);
    expect(ids(g.inPipeline)).toEqual([14, 15]);
    expect(ids(g.worthConsidering)).toEqual([16]); // never saved, tracked or closed roles
  });
});

describe("Shortlist with the API", () => {
  const data = () => [
    job({ id: 1, title: "Kept Placement", is_saved: true, deadline: "2026-11-05" }),
    job({ id: 2, title: "Lapsed Placement", is_saved: true, deadline: "2026-09-01" }),
    job({ id: 3, title: "Unsaved Internship", category: "internship", points: { role: 30, tech: 30 } }),
  ];

  it("a role shortlisted in Radar appears in Considering and stays there after reload", async () => {
    const api = fakeApi(data());
    const c = await renderApp("/?view=radar&job=3");
    await click(c.querySelector("article button[aria-pressed=false]"));
    expect(api.patches()).toEqual([{ method: "PATCH", path: "/jobs/3/saved", body: { is_saved: true } }]);
    expect(api.db.get(3)!.is_saved).toBe(true);

    await click(byText(c, "nav[aria-label=Main] button", /Shortlist/));
    expect(group(c, "Considering")).toEqual(["Kept Placement", "Unsaved Internship"]);

    const again = await reload();
    expect(group(again, "Considering")).toContain("Unsaved Internship");
  });

  it("unsaving removes the role from the Shortlist and persists", async () => {
    const api = fakeApi(data());
    const c = await renderApp("/?view=shortlist");
    expect(group(c, "Considering")).toEqual(["Kept Placement"]);
    expect(byText(c, "nav[aria-label=Main] button", /Shortlist/)!.textContent).toMatch(/2/);

    await click(byLabel(c, "Remove Kept Placement from shortlist"));
    expect(api.patches()).toEqual([{ method: "PATCH", path: "/jobs/1/saved", body: { is_saved: false } }]);
    expect(api.db.get(1)!.is_saved).toBe(false);
    expect(group(c, "Considering")).toEqual([]);
    expect(byText(c, "nav[aria-label=Main] button", /Shortlist/)!.textContent).toMatch(/1/);
  });

  it("marking a shortlisted role as applied moves it to “Already in your pipeline”", async () => {
    const api = fakeApi(data());
    const c = await renderApp("/?view=shortlist");
    await click(byLabel(c, "Mark Kept Placement as applied"));
    expect(api.db.get(1)!.status).toBe("applied");
    expect(group(c, "Considering")).toEqual([]);
    expect(group(c, "Already in your pipeline")).toEqual(["Kept Placement"]);
  });

  it("a saved role whose deadline has passed is listed under “Deadline passed”", async () => {
    fakeApi(data());
    const c = await renderApp("/?view=shortlist");
    expect(group(c, "Deadline passed")).toEqual(["Lapsed Placement"]);
    expect(group(c, "Considering")).not.toContain("Lapsed Placement");
  });
});
