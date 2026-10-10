import { describe, expect, it } from "vitest";
import { setViewport } from "./env";
import { fakeApi } from "./fakeApi";
import { job } from "./fixtures";
import { byLabel, byText, click, detailTitle, press, reload, renderApp, settle } from "./render";

// Best fit first: 1 (60), 2 (50), 3 (40).
const data = () => [
  job({ id: 1, title: "First Placement", points: { role: 30, tech: 20, requirements: 10 } }),
  job({ id: 2, title: "Second Internship", category: "internship", points: { role: 30, tech: 10, requirements: 10 } }),
  job({ id: 3, title: "Third Placement", points: { role: 30, requirements: 10 } }),
];

const currentTab = (c: HTMLElement) => c.querySelector("nav[aria-label=Main] [aria-current=page]")?.textContent?.replace(/\d+|roles/g, "").trim();
const selectedRow = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-row][aria-current]")?.dataset.row;
const params = () => Object.fromEntries(new URLSearchParams(location.search));

describe("URL and selection", () => {
  it("?view= opens that view", async () => {
    fakeApi(data());
    let c = await renderApp("/?view=pipeline");
    expect(currentTab(c)).toBe("Pipeline");
    expect(c.querySelector("main h1")!.textContent).toBe("Pipeline");

    c = await renderApp("/?view=shortlist");
    expect(c.querySelector("main h1")!.textContent).toBe("Shortlist");
  });

  it("?job= selects that role in Radar", async () => {
    fakeApi(data());
    const c = await renderApp("/?view=radar&job=3");
    expect(detailTitle(c)).toBe("Third Placement");
    expect(selectedRow(c)).toBe("3");
  });

  it("selection and view are written to the URL, and a reload restores them", async () => {
    fakeApi(data());
    let c = await renderApp("/");
    await click(c.querySelector('[data-row="2"]'));
    expect(params()).toMatchObject({ view: "radar", job: "2" });

    c = await reload();
    expect(detailTitle(c)).toBe("Second Internship");

    await click(byText(c, "nav[aria-label=Main] button", /Pipeline/));
    expect(params()).toMatchObject({ view: "pipeline", job: "2" });
    c = await reload();
    expect(currentTab(c)).toBe("Pipeline");
    await click(byText(c, "nav[aria-label=Main] button", /Radar/));
    expect(detailTitle(c)).toBe("Second Internship");
  });

  it.each([
    ["an unknown job id", "/?view=radar&job=999"],
    ["a non-numeric job id", "/?view=radar&job=abc"],
    ["an unknown view", "/?view=dashboard"],
    ["no parameters", "/"],
  ])("%s falls back to Radar and the best-fit role", async (_, url) => {
    fakeApi(data());
    const c = await renderApp(url);
    expect(currentTab(c)).toBe("Radar");
    expect(detailTitle(c)).toBe("First Placement");
  });
});

describe("Keyboard", () => {
  it("j / k move between roles, but not while typing in a field", async () => {
    fakeApi(data());
    const c = await renderApp("/?job=1");
    await press("j");
    expect(detailTitle(c)).toBe("Second Internship");
    await press("k");
    expect(detailTitle(c)).toBe("First Placement");

    const search = c.querySelector<HTMLInputElement>("input[type=search]")!;
    search.focus();
    await press("j", search);
    expect(detailTitle(c)).toBe("First Placement");
    await press("j", search);
    expect(detailTitle(c)).toBe("First Placement");
  });
});

describe("Role list collapse", () => {
  it("the hidden-list preference survives a reload and keeps the list out of reach", async () => {
    fakeApi(data());
    let c = await renderApp("/");
    await click(byLabel(c, "Hide role list"));
    expect(c.querySelector("section[aria-label=Roles]")!.hasAttribute("inert")).toBe(true);

    c = await reload();
    expect(byLabel(c, "Show role list")).not.toBeNull();
    expect(c.querySelector("section[aria-label=Roles]")!.hasAttribute("inert")).toBe(true);

    await click(byLabel(c, "Show role list"));
    c = await reload();
    expect(c.querySelector("section[aria-label=Roles]")!.hasAttribute("inert")).toBe(false);
  });
});

describe("Narrow screens", () => {
  it("the list comes first; a role opens on its own screen and Back returns to the list", async () => {
    setViewport(375);
    fakeApi(data());
    const c = await renderApp("/?view=radar");
    expect(c.querySelector("section[aria-label='Role details']")).toBeNull();

    await click(c.querySelector('[data-row="3"]'));
    expect(detailTitle(c)).toBe("Third Placement");
    expect(params()).toMatchObject({ job: "3", detail: "1" });
    expect(history.state).toMatchObject({ radarDetail: true });
    expect(document.activeElement?.tagName).toBe("H1");

    await click(byText(c, "button", /Back to results/));
    await settle();
    expect(c.querySelector("section[aria-label='Role details']")).toBeNull();
    expect(params().detail).toBeUndefined();
    expect(selectedRow(c)).toBe("3");
    expect((document.activeElement as HTMLElement)?.dataset.row).toBe("3");
  });

  it("opening a role from Pipeline returns to Pipeline", async () => {
    setViewport(375);
    fakeApi([...data(), job({ id: 4, title: "Tracked Role", status: "applied" })]);
    const c = await renderApp("/?view=pipeline");
    await click(c.querySelector('[data-flip="4"] button[title]'));
    expect(detailTitle(c)).toBe("Tracked Role");
    const back = byText(c, "button", /Back to Pipeline/);
    expect(back).toBeDefined();
    await click(back);
    await settle();
    expect(c.querySelector("main h1")!.textContent).toBe("Pipeline");
  });
});
