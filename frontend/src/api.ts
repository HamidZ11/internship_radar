import { Job, JobCreate, Status } from "./types";

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const PAGE = 200; // the API's maximum page size

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("Couldn't reach the server. Check that the API is running.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : Array.isArray(body.detail) ? body.detail.map((d: { msg: string }) => d.msg).join("; ") : "";
    } catch { /* no JSON body */ }
    throw new ApiError(detail || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Every job, best fit first (the API's order), across as many pages as it takes. */
export async function fetchAllJobs(signal?: AbortSignal): Promise<Job[]> {
  const all: Job[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await request<Job[]>(`/jobs/?limit=${PAGE}&offset=${offset}`, { signal });
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

export const saveJob = (id: number, isSaved: boolean) =>
  request<Job>(`/jobs/${id}/saved`, { method: "PATCH", body: JSON.stringify({ is_saved: isSaved }) });

export const setJobStatus = (id: number, status: Status) =>
  request<Job>(`/jobs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });

export const createJob = (job: JobCreate) =>
  request<Job>("/jobs/", { method: "POST", body: JSON.stringify(job) });
