import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ProtoJob, RoleGroup, Status, STATUS_LABEL, TRACKED } from "./data";
import { deadlineState } from "./extract";

// Prototype state is local only: save / status changes never PATCH the API,
// so exploring the directions cannot alter the real database.

export type View = "dashboard" | "saved" | "applied";

export interface ProtoFilters {
  search: string;
  roles: RoleGroup[];          // same four groups as the current role-type checkboxes
  location: string;
  deadline: "" | "7" | "14" | "30" | "none"; // same options as the current filter
  minScore: number;
  status: "" | Status;
  source: string;
}

export const EMPTY_FILTERS: ProtoFilters = {
  search: "", roles: [], location: "", deadline: "", minScore: 0, status: "", source: "",
};

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface Store {
  jobs: ProtoJob[];
  hiddenPlaceholders: number;
  view: View;
  setView: (v: View) => void;
  selectedId: number | null;
  select: (id: number) => void;
  filters: ProtoFilters;
  setFilters: (f: ProtoFilters) => void;
  activeFilterCount: number;
  filtered: ProtoJob[];
  saved: ProtoJob[];
  tracked: ProtoJob[];
  topUnapplied: ProtoJob[];
  toggleSaved: (id: number) => void;
  setStatus: (id: number, status: Status) => void;
  flashId: number | null;
  toasts: Toast[];
  toast: (message: string, action?: Toast["action"]) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<Store | null>(null);

export function useProto(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useProto outside provider");
  return s;
}

function matchesFilters(j: ProtoJob, f: ProtoFilters): boolean {
  if (f.search) {
    const q = f.search.toLowerCase();
    const hay = `${j.title} ${j.company} ${j.description} ${j.location}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.roles.length > 0 && !f.roles.includes(j.role_group)) return false;
  if (f.location && !j.location.toLowerCase().includes(f.location.toLowerCase())) return false;
  if (f.source && j.source !== f.source) return false;
  if (f.status && j.status !== f.status) return false;
  if (f.minScore && j.score < f.minScore) return false;
  if (f.deadline === "none" && j.deadline) return false;
  if (f.deadline && f.deadline !== "none") {
    const { state, days } = deadlineState(j.deadline);
    if (state === "none" || state === "closed" || days === null || days > Number(f.deadline)) return false;
  }
  return true;
}

function readUrl(): { view: View; job: number | null } {
  const p = new URLSearchParams(location.search);
  const v = p.get("view");
  const job = Number(p.get("job"));
  return {
    view: v === "saved" || v === "applied" ? v : "dashboard",
    job: Number.isFinite(job) && job > 0 ? job : null,
  };
}

export function ProtoProvider({
  initialJobs, hiddenPlaceholders, children,
}: { initialJobs: ProtoJob[]; hiddenPlaceholders: number; children: ReactNode }) {
  const initial = useMemo(readUrl, []);
  const [jobs, setJobs] = useState(initialJobs);
  const [view, setViewState] = useState<View>(initial.view);
  const [selectedId, setSelectedId] = useState<number | null>(initial.job ?? initialJobs[0]?.id ?? null);
  const [filters, setFilters] = useState<ProtoFilters>(EMPTY_FILTERS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flashId, setFlashId] = useState<number | null>(null);
  const toastSeq = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    if (selectedId) url.searchParams.set("job", String(selectedId));
    history.replaceState(null, "", url);
  }, [view, selectedId]);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((message: string, action?: Toast["action"]) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t.slice(-2), { id, message, action }]);
    setTimeout(() => dismissToast(id), 4500);
  }, [dismissToast]);

  const flash = useCallback((id: number) => {
    setFlashId(id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 900);
  }, []);

  const patch = useCallback((id: number, changes: Partial<ProtoJob>) => {
    setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...changes } : j)));
  }, []);

  const toggleSaved = useCallback((id: number) => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    const before = { is_saved: job.is_saved, updated_at: job.updated_at };
    patch(id, { is_saved: !job.is_saved, updated_at: new Date().toISOString() });
    toast(job.is_saved ? "Removed from saved" : "Saved to your shortlist", {
      label: "Undo", run: () => patch(id, before),
    });
  }, [jobs, patch, toast]);

  const setStatus = useCallback((id: number, status: Status) => {
    const job = jobs.find((j) => j.id === id);
    if (!job || job.status === status) return;
    const before = { status: job.status, updated_at: job.updated_at };
    patch(id, { status, updated_at: new Date().toISOString() });
    flash(id);
    const message = status === "new" ? "Removed from tracking" : `Marked as ${STATUS_LABEL[status].toLowerCase()}`;
    toast(message, { label: "Undo", run: () => { patch(id, before); flash(id); } });
  }, [jobs, patch, toast, flash]);

  const value = useMemo<Store>(() => {
    const filtered = jobs.filter((j) => matchesFilters(j, filters));
    const tracked = jobs
      .filter((j) => TRACKED.includes(j.status))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const activeFilterCount =
      (filters.roles.length > 0 ? 1 : 0) + (filters.location ? 1 : 0) + (filters.deadline ? 1 : 0) +
      (filters.minScore ? 1 : 0) + (filters.status ? 1 : 0) + (filters.source ? 1 : 0);
    return {
      jobs, hiddenPlaceholders, view, setView: setViewState, selectedId, select: setSelectedId,
      filters, setFilters, activeFilterCount, filtered,
      saved: jobs.filter((j) => j.is_saved),
      tracked,
      topUnapplied: jobs.filter((j) => j.status === "new" && j.deadline_state !== "closed").slice(0, 4),
      toggleSaved, setStatus, flashId, toasts, toast, dismissToast,
    };
  }, [jobs, hiddenPlaceholders, view, selectedId, filters, toggleSaved, setStatus, flashId, toasts, toast, dismissToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The selected job if it is in `list`, otherwise the first item. */
export function pickSelected(list: ProtoJob[], selectedId: number | null): ProtoJob | null {
  return list.find((j) => j.id === selectedId) ?? list[0] ?? null;
}
