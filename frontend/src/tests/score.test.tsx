import { describe, expect, it } from "vitest";
import { breakdown } from "./fixtures";
import { fakeApi } from "./fakeApi";
import { job } from "./fixtures";
import { renderApp } from "./render";

/** What the detail page shows for the fit score, read from the rendered DOM. */
function shownScore(c: HTMLElement) {
  const section = c.querySelector("section[aria-labelledby=breakdown-h]")!;
  const rows = [...section.querySelectorAll("ul > li")];
  const total = rows[rows.length - 1];
  const points = rows.slice(0, -1).map((li) => Number(li.children[3].textContent!.replace("−", "-").replace("+", "")));
  return {
    heading: Number(section.querySelector("h2")!.textContent!.match(/(\d+)$/)![1]),
    chip: Number(c.querySelector("article header button[aria-label^='Fit ']")!.getAttribute("aria-label")!.match(/^Fit (\d+)/)![1]),
    feed: Number(c.querySelector("[data-row][aria-current] span[aria-hidden].tabular-nums")!.textContent),
    total: Number(total.children[3].textContent),
    totalNote: total.children[2].textContent,
    ruleNames: rows.slice(0, -1).map((li) => li.children[1].textContent),
    points,
    stale: section.querySelector(".bg-\\[\\#FDF6E7\\]")?.textContent ?? null,
  };
}

describe("Score display", () => {
  it.each([
    ["all gains", { role: 30, tech: 30, location: 20, requirements: 10, stack: 10 }, 100],
    ["some gains", { role: 30, tech: 10, requirements: 10, stack: 10 }, 60],
    ["a penalty", { role: 30, requirements: 10, off_target: -30 }, 10],
  ])("with %s, every place shows fit_score and the rule points add up to it", async (_, points, expected) => {
    fakeApi([job({ id: 7, points })]);
    const c = await renderApp("/?job=7");
    const s = shownScore(c);
    expect([s.heading, s.chip, s.feed, s.total]).toEqual([expected, expected, expected, expected]);
    expect(s.points.reduce((a, b) => a + b, 0)).toBe(expected);
    expect(s.totalNote).toBe("");
  });

  it("shows the five rules and only the penalties that fired", async () => {
    fakeApi([job({ id: 7, points: { role: 30, graduate: -40 } })]);
    const s = shownScore(await renderApp("/?job=7"));
    expect(s.ruleNames).toEqual(["Role type", "Tech keywords", "Location", "States requirements", "Modern stack", "Graduate role"]);
    expect(s.points).toEqual([30, 0, 0, 0, 0, -40]);
  });

  it("a score clamped to zero explains the unclamped total", async () => {
    fakeApi([job({ id: 7, points: { tech: 10, location: 10, graduate: -40, off_target: -30 } })]);
    const s = shownScore(await renderApp("/?job=7"));
    expect(s.points.reduce((a, b) => a + b, 0)).toBe(-50);
    expect([s.heading, s.chip, s.feed, s.total]).toEqual([0, 0, 0, 0]);
    expect(s.totalNote).toBe("Rules add up to -50; scores are kept between 0 and 100");
  });

  it("the persisted fit_score is what is shown; a stale breakdown is flagged, not substituted", async () => {
    fakeApi([job({ id: 7, fit_score: 55, fit_breakdown: breakdown({ role: 30, requirements: 10 }) })]);
    const s = shownScore(await renderApp("/?job=7"));
    expect([s.heading, s.chip, s.feed]).toEqual([55, 55, 55]);
    expect(s.total).toBe(40); // the breakdown's own total
    expect(s.stale).toContain("The stored score is 55, but the current scoring rules give 40");
  });
});
