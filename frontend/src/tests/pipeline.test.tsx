import { describe, expect, it } from "vitest";
import { Status } from "../types";
import { fakeApi } from "./fakeApi";
import { job } from "./fixtures";
import { byLabel, byText, click, reload, renderApp } from "./render";

const T = "Software Engineering Placement";

/** Card titles in each Pipeline column. */
function board(c: HTMLElement): Record<string, string[]> {
  return Object.fromEntries((["applied", "interview", "offer", "rejected"] as Status[]).map((s) => [
    s, [...c.querySelectorAll(`section[aria-labelledby=col-${s}] article`)].map((a) => a.getAttribute("aria-label")!),
  ]));
}

const readyToApply = (c: HTMLElement) =>
  [...c.querySelectorAll("section[aria-labelledby=ready-h] li button.truncate")].map((b) => b.textContent!.split(" · ")[0]);

async function chooseFromCardMenu(c: HTMLElement, item: string) {
  await click(byLabel(c, `More actions for ${T}`));
  await click(byText(c, "[role=menu] [role^=menuitem]", item));
}

describe("Pipeline with the API", () => {
  const data = () => [
    job({ id: 1, title: T, deadline: "2026-11-05", points: { role: 30, tech: 30 } }),
    job({ id: 2, title: "Already Applied Internship", category: "internship", status: "applied" }),
  ];

  it("walks a role through every stage, persisting each move", async () => {
    const api = fakeApi(data());
    const c = await renderApp("/?view=pipeline");
    const lastPatch = () => api.patches().slice(-1)[0];
    expect(readyToApply(c)).toContain(T);

    // Applied
    await click(byLabel(c, `Mark ${T} as applied`));
    expect(lastPatch()).toEqual({ method: "PATCH", path: "/jobs/1/status", body: { status: "applied" } });
    expect(board(c).applied).toContain(T);
    expect(readyToApply(c)).not.toContain(T);

    // Interviewing
    await click(byLabel(c, `Move to interviewing: ${T}`));
    expect(lastPatch()!.body).toEqual({ status: "interview" });
    expect(board(c).interview).toEqual([T]);

    // Offer
    await click(byLabel(c, `Move to offer: ${T}`));
    expect(lastPatch()!.body).toEqual({ status: "offer" });
    expect(board(c).offer).toEqual([T]);
    expect(c.querySelector(`section[aria-labelledby=col-offer] article`)!.textContent).toContain("Offer received");

    // Rejected
    await chooseFromCardMenu(c, "Rejected");
    expect(lastPatch()!.body).toEqual({ status: "rejected" });
    expect(board(c).rejected).toEqual([T]);

    // Reopen as applied
    await click(byLabel(c, `Reopen as applied: ${T}`));
    expect(lastPatch()!.body).toEqual({ status: "applied" });
    expect(board(c).applied).toContain(T);
    expect(board(c).rejected).toEqual([]);

    // Remove from tracking
    await chooseFromCardMenu(c, "Remove from tracking");
    expect(lastPatch()!.body).toEqual({ status: "new" });
    expect(Object.values(board(c)).flat()).not.toContain(T);
    expect(readyToApply(c)).toContain(T);

    expect(api.patches().map((p) => (p.body as { status: string }).status))
      .toEqual(["applied", "interview", "offer", "rejected", "applied", "new"]);
    expect(api.db.get(1)!.status).toBe("new");
  });

  it("the board after a reload reflects the persisted stages", async () => {
    const api = fakeApi(data());
    const c = await renderApp("/?view=pipeline");
    await click(byLabel(c, `Mark ${T} as applied`));
    await click(byLabel(c, `Move to interviewing: ${T}`));
    expect(api.db.get(1)!.status).toBe("interview");

    const again = await reload();
    expect(board(again)).toEqual({ applied: ["Already Applied Internship"], interview: [T], offer: [], rejected: [] });
  });

  it("the detail tracker's stage buttons use the same status API", async () => {
    const api = fakeApi(data());
    const c = await renderApp("/?view=radar&job=1");
    await click(byLabel(c, "Interviewing"));
    expect(api.db.get(1)!.status).toBe("interview");
    expect(c.querySelector("[aria-current=step]")!.getAttribute("aria-label")).toBe("Interviewing, current stage");
  });

  it("a failed move rolls back and says so; nothing is persisted", async () => {
    const api = fakeApi(data());
    const c = await renderApp("/?view=pipeline");
    api.failNextWrite();
    await click(byLabel(c, "Move to interviewing: Already Applied Internship"));
    expect(board(c).applied).toEqual(["Already Applied Internship"]);
    expect(board(c).interview).toEqual([]);
    expect(api.db.get(2)!.status).toBe("applied");
    expect(c.ownerDocument.querySelector("[role=status][aria-live]")!.textContent).toContain("Couldn't update the application");
  });

  it("Undo sends the reverse change", async () => {
    const api = fakeApi(data());
    const c = await renderApp("/?view=pipeline");
    await click(byLabel(c, "Move to interviewing: Already Applied Internship"));
    await click(byText(c, "[role=status] button", "Undo"));
    expect(api.patches().map((p) => (p.body as { status: string }).status)).toEqual(["interview", "applied"]);
    expect(api.db.get(2)!.status).toBe("applied");
    expect(board(c).applied).toContain("Already Applied Internship");
  });
});
