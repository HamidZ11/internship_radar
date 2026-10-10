import { vi } from "vitest";
import { Job } from "../types";

/**
 * An in-memory stand-in for the FastAPI backend, installed as global fetch.
 * Implements the endpoints the app uses with the same paths, bodies and
 * responses, so tests exercise the real API client and store.
 */
export function fakeApi(jobs: Job[]) {
  const db = new Map(jobs.map((j) => [j.id, structuredClone(j)]));
  const requests: { method: string; path: string; body?: unknown }[] = [];
  let failNext = false;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, path: url.pathname + url.search, body });
    if (method !== "GET" && failNext) {
      failNext = false;
      throw new TypeError("Failed to fetch");
    }
    if (method === "GET" && url.pathname === "/jobs/") {
      const limit = Number(url.searchParams.get("limit") ?? 50);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const all = [...db.values()].sort((a, b) => b.fit_score - a.fit_score || b.created_at.localeCompare(a.created_at));
      return json(all.slice(offset, offset + limit));
    }
    const m = /^\/jobs\/(\d+)\/(saved|status)$/.exec(url.pathname);
    if (method === "PATCH" && m) {
      const j = db.get(Number(m[1]));
      if (!j) return json({ detail: "Job not found." }, 404);
      if (m[2] === "saved") j.is_saved = body.is_saved;
      else j.status = body.status;
      j.updated_at = new Date().toISOString().replace("Z", "");
      return json(j);
    }
    return json({ detail: "Not Found" }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);
  return {
    db,
    requests,
    patches: () => requests.filter((r) => r.method === "PATCH"),
    failNextWrite: () => { failNext = true; },
  };
}
