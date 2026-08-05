import { useEffect, useRef, useState } from "react";
import { Filters, Job } from "./types";
import FilterBar from "./components/Filters";
import JobList from "./components/JobList";
import JobDetail from "./components/JobDetail";
import AppliedDashboard from "./components/AppliedDashboard";
import AddJobModal from "./components/AddJobModal";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const DEBOUNCE_MS = 300;

const EMPTY_FILTERS: Filters = {
  search: "", min_score: "", status: "", location: "", source: "", role_type: [], deadline_filter: "",
};

function applyDeadlineFilter(jobs: Job[], filter: string): Job[] {
  if (!filter) return jobs;
  if (filter === "none") return jobs.filter((j) => !j.deadline);
  const days = parseInt(filter, 10);
  if (isNaN(days)) return jobs;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);
  return jobs.filter((j) => {
    if (!j.deadline) return false;
    const d = new Date(j.deadline);
    return d >= today && d <= cutoff;
  });
}

function applyRoleTypeFilter(jobs: Job[], roleTypes: string[]): Job[] {
  if (roleTypes.length === 0) return jobs;
  return jobs.filter((j) =>
    roleTypes.some((rt) => j.role_type.toLowerCase().includes(rt.toLowerCase()))
  );
}

type Tab = "dashboard" | "saved" | "applied";

function buildQuery(filters: Filters, tab: Tab): string {
  const params = new URLSearchParams();
  if (filters.search)      params.set("search", filters.search);
  if (filters.min_score)   params.set("min_score", filters.min_score);
  if (filters.location)    params.set("location", filters.location);
  if (filters.source)      params.set("source", filters.source);
  // status filter from sidebar only applies on Dashboard tab
  if (tab === "dashboard" && filters.status) params.set("status", filters.status);
  if (tab === "saved")     params.set("is_saved", "true");
  if (tab === "applied")   params.set("status", "applied");
  params.set("limit", "200");
  return params.toString();
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddJob, setShowAddJob] = useState(false);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeTab === "applied") return; // AppliedDashboard manages its own data
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const url = `${API}/jobs?${buildQuery(filters, activeTab)}`;
      setLoading(true);
      setError(null);

      fetch(url)
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
          }
          return res.json() as Promise<Job[]>;
        })
        .then((data) => {
          setJobs(data);
          setSelectedJob((prev) =>
            prev ? (data.find((j) => j.id === prev.id) ?? data[0] ?? null) : (data[0] ?? null)
          );
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, activeTab]);

  function toggleSaved(job: Job) {
    const next = !job.is_saved;
    fetch(`${API}/jobs/${job.id}/saved`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_saved: next }),
    })
      .then((res) => res.json() as Promise<Job>)
      .then((updated) => {
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        setSelectedJob((prev) => (prev?.id === updated.id ? updated : prev));
        // If we're on the Saved tab and just un-saved a job, remove it from the list
        if (activeTab === "saved" && !updated.is_saved) {
          setJobs((prev) => {
            const next = prev.filter((j) => j.id !== updated.id);
            setSelectedJob(next[0] ?? null);
            return next;
          });
        }
      })
      .catch(() => {});
  }

  function updateStatus(job: Job, newStatus: string) {
    fetch(`${API}/jobs/${job.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
      .then((res) => res.json() as Promise<Job>)
      .then((updated) => {
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        setSelectedJob((prev) => (prev?.id === updated.id ? updated : prev));
      })
      .catch(() => {});
  }

  const visibleJobs = applyRoleTypeFilter(applyDeadlineFilter(jobs, filters.deadline_filter), filters.role_type);

  const NAV_TABS: { label: string; value: Tab }[] = [
    { label: "Dashboard", value: "dashboard" },
    { label: "Saved",     value: "saved" },
    { label: "Applied",   value: "applied" },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f9f9ff]">

      {/* ── Top nav ── 64px */}
      <header className="shrink-0 h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-8 z-10">
        {/* brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#003fa3] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-900 tracking-tight">Internship Radar</span>
        </div>

        {/* nav links — desktop only, mobile uses the bottom tab bar */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_TABS.map(({ label, value }) => {
            const active = value === activeTab;
            return (
              <button
                key={label}
                onClick={() => value && setActiveTab(value)}
                className={`px-3 h-8 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* spacer + right side */}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setShowAddJob(true)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            + Add Job
          </button>
          <div className="w-8 h-8 rounded-full bg-[#003fa3] flex items-center justify-center">
            <span className="text-xs font-bold text-white select-none">H</span>
          </div>
        </div>
      </header>

      {/* ── Body ── fills remaining height */}
      <div className="flex-1 flex overflow-hidden">

        {activeTab === "applied" ? (
          <div className="flex-1 overflow-y-auto bg-[#f9f9ff]">
            <AppliedDashboard />
          </div>
        ) : (
          <>
            {/* Sidebar — 280px on desktop, mobile drawer otherwise */}
            <div className="hidden lg:block w-[280px] shrink-0 h-full">
              <FilterBar filters={filters} onChange={setFilters} />
            </div>

            {showFiltersMobile && (
              <div
                onClick={(e) => { if (e.target === e.currentTarget) setShowFiltersMobile(false); }}
                className="lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              >
                <div className="h-full w-[85%] max-w-[320px] bg-white shadow-2xl">
                  <FilterBar filters={filters} onChange={setFilters} onClose={() => setShowFiltersMobile(false)} />
                </div>
              </div>
            )}

            {/* Job list — 400px on desktop, full width on mobile; hidden on mobile once a job is selected */}
            <div className={`w-full lg:w-[400px] shrink-0 flex-col bg-[#f9f9ff] lg:border-x border-slate-200 ${selectedJob ? "hidden lg:flex" : "flex"}`}>

              {/* column header */}
              <div className="shrink-0 bg-white border-b border-slate-200 px-5 pt-4 pb-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h1 className="text-sm font-bold text-slate-900">
                    {loading ? "Loading…" : `${visibleJobs.length} ${activeTab === "saved" ? "Saved" : "Roles found"}`}
                  </h1>
                  <button
                    onClick={() => setShowFiltersMobile(true)}
                    className="lg:hidden shrink-0 text-xs font-semibold text-slate-500 px-2.5 h-7 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    Filters
                  </button>
                  <span className="hidden lg:inline text-[11px] text-slate-400 font-medium">Sorted by fit score</span>
                </div>

                <div className="relative mt-2.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search roles or companies…"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="h-9 w-full pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs shrink-0">
                  {error}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-sm text-slate-400">Loading…</p>
                  </div>
                ) : (
                  <JobList jobs={visibleJobs} selectedId={selectedJob?.id ?? null} onSelect={setSelectedJob} />
                )}
              </div>
            </div>

            {/* Job detail — fills rest on desktop, full width on mobile once a job is selected */}
            <div className={`w-full lg:flex-1 overflow-hidden ${selectedJob ? "block" : "hidden lg:block"}`}>
              <JobDetail
                job={selectedJob}
                onToggleSaved={toggleSaved}
                onUpdateStatus={updateStatus}
                onBack={() => setSelectedJob(null)}
              />
            </div>
          </>
        )}

      </div>

      {/* ── Footer ── */}
      <footer className="shrink-0 h-7 bg-white border-t border-slate-200 items-center justify-center hidden lg:flex">
        <a
          href="https://logo.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-slate-400 hover:text-slate-500 transition-colors"
        >
          Logos by Logo.dev
        </a>
      </footer>

      {/* ── Bottom tab bar — mobile only ── */}
      <nav className="lg:hidden shrink-0 h-14 bg-white border-t border-slate-200 flex items-stretch">
        {NAV_TABS.map(({ label, value }) => {
          const active = value === activeTab;
          return (
            <button
              key={label}
              onClick={() => { setActiveTab(value); setSelectedJob(null); }}
              className={`flex-1 text-sm font-medium transition-colors ${
                active ? "text-[#003fa3] font-semibold" : "text-slate-500"
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {showAddJob && (
        <AddJobModal
          onClose={() => setShowAddJob(false)}
          onAdded={(job) => {
            setJobs((prev) => [job, ...prev]);
            setSelectedJob(job);
            setActiveTab("dashboard");
          }}
        />
      )}
    </div>
  );
}
