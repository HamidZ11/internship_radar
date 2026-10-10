import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchAllJobs, saveJob, setJobStatus } from "./api";
import { countActiveFilters, EMPTY_FILTERS, filterJobs, Filters } from "./lib/filters";
import { decorate, RadarJob } from "./lib/jobs";
import { STATUS_LABEL, TRACKED } from "./lib/listing";
import { Job, Status } from "./types";

export type { RadarJob } from "./lib/jobs";

// App state. Jobs come from the API; saving and status changes are PATCHed to it
// and shown optimistically, then replaced by the server's copy (or rolled back).

export type View = "radar" | "shortlist" | "pipeline";
const VIEWS: View[] = ["radar", "shortlist", "pipeline"];

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
}

type Load = { state: "loading" } | { state: "ready" } | { state: "error"; message: string };

interface Store {
  load: Load;
  reload: () => void;
  jobs: RadarJob[];
  view: View;
  setView: (v: View) => void;
  wide: boolean;                 // two-pane layout (≥1024px)
  selectedId: number | null;
  select: (id: number) => void;
  detailOpen: boolean;           // narrow screens: detail replaces the list
  detailFrom: View;              // where the detail's Back returns to
  openDetail: (id: number, from?: View) => void;
  closeDetail: () => void;
  openJob: (id: number) => void; // from Shortlist / Pipeline into Radar
  addJob: (job: Job) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  activeFilterCount: number;
  filtered: RadarJob[];
  saved: RadarJob[];
  tracked: RadarJob[];
  topUnapplied: RadarJob[];
  setSaved: (id: number, isSaved: boolean, opts?: { undo?: boolean }) => void;
  setStatus: (id: number, status: Status, opts?: { undo?: boolean }) => void;
  flashId: number | null;
  toasts: Toast[];
  toast: (message: string, opts?: { action?: Toast["action"]; tone?: Toast["tone"] }) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

// ── Derivations ──────────────────────────────────────────────────────────────

/** The selected job if it is in `list`, otherwise the first item. */
export function pickSelected<T extends { id: number }>(list: T[], selectedId: number | null): T | null {
  return list.find((j) => j.id === selectedId) ?? list[0] ?? null;
}

// ── URL ──────────────────────────────────────────────────────────────────────

function readUrl(): { view: View; job: number | null; detail: boolean } {
  const p = new URLSearchParams(location.search);
  const v = p.get("view") as View;
  const job = Number(p.get("job"));
  return {
    view: VIEWS.includes(v) ? v : "radar",
    job: Number.isInteger(job) && job > 0 ? job : null,
    detail: p.get("detail") === "1",
  };
}

const WIDE = "(min-width: 1024px)";

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const update = () => setOn(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return on;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(readUrl, []);
  const [jobs, setJobs] = useState<RadarJob[]>([]);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [loadKey, setLoadKey] = useState(0);
  const [view, setView] = useState<View>(initial.view);
  const [selectedId, setSelectedId] = useState<number | null>(initial.job);
  const [detailOpen, setDetailOpen] = useState(initial.detail);
  const [detailFrom, setDetailFrom] = useState<View>(() => (history.state?.from as View) ?? "radar");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flashId, setFlashId] = useState<number | null>(null);
  const wide = useMedia(WIDE);

  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const seq = useRef(new Map<number, number>());
  const toastSeq = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ state: "loading" });
    fetchAllJobs(ctrl.signal)
      .then((all) => {
        setJobs(all.map(decorate));
        setLoad({ state: "ready" });
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setLoad({ state: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => ctrl.abort();
  }, [loadKey]);

  // View, selection and (narrow screens) the open detail live in the URL.
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    if (selectedId) url.searchParams.set("job", String(selectedId));
    else url.searchParams.delete("job");
    if (detailOpen && view === "radar") url.searchParams.set("detail", "1");
    else url.searchParams.delete("detail");
    history.replaceState(history.state, "", url);
  }, [view, selectedId, detailOpen]);

  useEffect(() => {
    // Only opening a detail (narrow screens) adds history entries. Going back keeps the
    // role just viewed selected, so the list returns to where the reader was.
    function onPop() {
      const u = readUrl();
      setView(u.view);
      if (u.detail && u.job) setSelectedId(u.job);
      setDetailOpen(u.detail);
      setDetailFrom((history.state?.from as View) ?? "radar");
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<Store["toast"]>((message, opts = {}) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone: opts.tone ?? "info", action: opts.action }]);
    setTimeout(() => dismissToast(id), opts.tone === "error" ? 8000 : 4500);
  }, [dismissToast]);

  const flash = useCallback((id: number) => {
    setFlashId(id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 900);
  }, []);

  const patchLocal = useCallback((id: number, changes: Partial<Job>) => {
    setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...changes } : j)));
  }, []);

  /**
   * Apply `optimistic` now, PATCH, then take the server's copy. Only the latest
   * request per job may write back, so out-of-order responses can't win. On
   * failure the job returns to its state before this change.
   */
  const mutate = useCallback(async (
    id: number, optimistic: Partial<Job>, revert: Partial<Job>, call: () => Promise<Job>, failure: string,
  ): Promise<boolean> => {
    const n = (seq.current.get(id) ?? 0) + 1;
    seq.current.set(id, n);
    patchLocal(id, optimistic);
    try {
      const updated = await call();
      if (seq.current.get(id) === n) setJobs((all) => all.map((j) => (j.id === id ? decorate(updated) : j)));
      return true;
    } catch (e) {
      if (seq.current.get(id) === n) patchLocal(id, revert);
      toast(`${failure}. ${e instanceof Error ? e.message : ""}`.trim(), { tone: "error" });
      return false;
    }
  }, [patchLocal, toast]);

  const setSaved = useCallback<Store["setSaved"]>(async (id, isSaved, { undo = true } = {}) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (!job || job.is_saved === isSaved) return;
    const before = { is_saved: job.is_saved, updated_at: job.updated_at };
    const ok = await mutate(
      id, { is_saved: isSaved, updated_at: new Date().toISOString() }, before,
      () => saveJob(id, isSaved), "Couldn't update your shortlist",
    );
    if (ok && undo) {
      toast(isSaved ? "Added to your shortlist" : "Removed from your shortlist", {
        action: { label: "Undo", run: () => setSaved(id, !isSaved, { undo: false }) },
      });
    }
  }, [mutate, toast]);

  const setStatus = useCallback<Store["setStatus"]>(async (id, status, { undo = true } = {}) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (!job || job.status === status) return;
    const previous = job.status;
    flash(id);
    const ok = await mutate(
      id, { status, updated_at: new Date().toISOString() }, { status: previous, updated_at: job.updated_at },
      () => setJobStatus(id, status), "Couldn't update the application",
    );
    if (ok && undo) {
      toast(status === "new" ? "Removed from tracking" : `Marked as ${STATUS_LABEL[status].toLowerCase()}`, {
        action: { label: "Undo", run: () => { flash(id); setStatus(id, previous, { undo: false }); } },
      });
    }
  }, [mutate, toast, flash]);

  const filtered = useMemo(() => filterJobs(jobs, filters), [jobs, filters]);

  const openDetail = useCallback((id: number, from: View = "radar") => {
    setSelectedId(id);
    if (!detailOpen) {
      history.pushState({ radarDetail: true, from }, "", location.href);
      setDetailFrom(from);
    }
    setDetailOpen(true);
  }, [detailOpen]);

  const closeDetail = useCallback(() => {
    if (history.state?.radarDetail) history.back(); // popstate closes it
    else setDetailOpen(false);
  }, []);

  const openJob = useCallback((id: number) => {
    if (!filtered.some((j) => j.id === id)) {
      setFilters(EMPTY_FILTERS);
      toast("Filters cleared to show this role");
    }
    setView("radar");
    if (wide) setSelectedId(id);
    else openDetail(id, view);
  }, [filtered, toast, wide, openDetail, view]);

  const addJob = useCallback((job: Job) => {
    setJobs((all) => [...all, decorate(job)].sort((a, b) => b.fit_score - a.fit_score || b.created_at.localeCompare(a.created_at)));
    setFilters(EMPTY_FILTERS);
    setView("radar");
    if (wide) setSelectedId(job.id);
    else openDetail(job.id);
    toast(`Added ${job.title} · fit ${job.fit_score}`);
  }, [toast, wide, openDetail]);

  const value = useMemo<Store>(() => {
    const tracked = jobs
      .filter((j) => TRACKED.includes(j.status))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return {
      load, reload: () => setLoadKey((k) => k + 1),
      jobs, view, setView, wide,
      selectedId, select: setSelectedId, detailOpen, detailFrom, openDetail, closeDetail, openJob, addJob,
      filters, setFilters, activeFilterCount: countActiveFilters(filters), filtered,
      saved: jobs.filter((j) => j.is_saved),
      tracked,
      topUnapplied: jobs.filter((j) => j.status === "new" && j.deadline_state !== "closed").slice(0, 4),
      setSaved, setStatus, flashId, toasts, toast, dismissToast,
    };
  }, [load, jobs, view, wide, selectedId, detailOpen, detailFrom, openDetail, closeDetail, openJob, addJob, filters, filtered,
    setSaved, setStatus, flashId, toasts, toast, dismissToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
