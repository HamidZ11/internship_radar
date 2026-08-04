import { useEffect, useRef, useState } from "react";
import { Job } from "../types";
import CompanyLogo from "./CompanyLogo";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const ICON_COLORS = [
  "bg-slate-800", "bg-indigo-700", "bg-gray-900",
  "bg-blue-800", "bg-violet-800", "bg-emerald-800",
];

function iconColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return ICON_COLORS[Math.abs(h) % ICON_COLORS.length];
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  applied:   { label: "Applied",             cls: "bg-amber-50 border-amber-200 text-amber-700" },
  interview: { label: "Interview Scheduled", cls: "bg-blue-50 border-blue-100 text-blue-600" },
  rejected:  { label: "Rejected",            cls: "bg-red-50 border-red-200 text-red-600" },
  offer:     { label: "Offer Received",      cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
};

const TRACKED = new Set(["applied", "interview", "rejected", "offer"]);
const STATUS_ORDER = ["applied", "interview", "offer", "rejected"] as const;

export default function AppliedDashboard() {
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function fetchAll() {
    setLoading(true);
    fetch(`${API}/jobs?limit=200`)
      .then((r) => r.json() as Promise<Job[]>)
      .then((jobs) => { setAllJobs(jobs); setLoading(false); })
      .catch(() => setLoading(false));
  }

  function patchStatus(job: Job, newStatus: string) {
    setOpenMenu(null);
    fetch(`${API}/jobs/${job.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
      .then((r) => r.json() as Promise<Job>)
      .then((updated) => setAllJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j))))
      .catch(() => {});
  }

  const trackedJobs = allJobs
    .filter((j) => TRACKED.has(j.status))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const recommended = allJobs.filter((j) => j.status === "new").slice(0, 4);

  const totalApplications = trackedJobs.length;
  const inReview   = trackedJobs.filter((j) => j.status === "applied").length;
  const interviews = trackedJobs.filter((j) => j.status === "interview").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-10 py-10">

      {/* Heading */}
      <header className="mb-10">
        <h1 className="text-[40px] font-extrabold text-slate-900 tracking-tight leading-tight mb-2">
          My Applications
        </h1>
        <p className="text-slate-500 text-sm max-w-2xl">
          Track and manage your internship journey.{" "}
          {totalApplications > 0
            ? `You've tracked ${totalApplications} role${totalApplications !== 1 ? "s" : ""} — keep the momentum going.`
            : "Mark jobs as applied to start tracking your progress."}
        </p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-6 mb-12">
        {([
          {
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 0 0 2.25 2.25h.75m0-3.75h3.75M9 12h3.75" /></svg>,
            iconBg: "bg-blue-50 text-blue-600",
            tag: "Growth", tagCls: "text-slate-400",
            count: totalApplications, name: "Total Applications",
          },
          {
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
            iconBg: "bg-orange-50 text-orange-500",
            tag: "Pending", tagCls: "text-orange-500",
            count: inReview, name: "In Review",
          },
          {
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>,
            iconBg: "bg-emerald-50 text-emerald-600",
            tag: "Active", tagCls: "text-emerald-600",
            count: interviews, name: "Interviews",
          },
        ] as const).map(({ icon, iconBg, tag, tagCls, count, name }) => (
          <div key={name} className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm hover:border-blue-200 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${tagCls}`}>{tag}</span>
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{count}</p>
            <p className="text-slate-500 font-medium text-sm mt-0.5">{name}</p>
          </div>
        ))}
      </section>

      {/* Recent Activity */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Recent Activity</h2>

        {trackedJobs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <p className="text-sm text-slate-500 font-medium">No applications tracked yet.</p>
            <p className="text-xs text-slate-400 mt-1">Open a job and click "Mark as applied" to start tracking.</p>
          </div>
        ) : (
          <div className="space-y-3" ref={containerRef}>
            {trackedJobs.map((job) => {
              const cfg = STATUS_CONFIG[job.status] ?? { label: job.status, cls: "bg-slate-100 border-slate-200 text-slate-600" };
              return (
                <div key={job.id} className="bg-white p-5 border border-slate-200 rounded-xl flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 min-w-0">
                    <CompanyLogo company={job.company} size={44} rounded="rounded-lg" textSize="text-sm" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 leading-tight truncate">{job.title}</h4>
                      <p className="text-slate-500 text-xs mt-0.5">{job.company} · {job.location}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Applied</span>
                      <span className="text-sm font-medium text-slate-700">{formatDate(job.updated_at)}</span>
                    </div>

                    {/* ⋮ menu */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === job.id ? null : job.id)}
                        className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                      {openMenu === job.id && (
                        <div className="absolute right-0 top-9 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20 min-w-[190px]">
                          <p className="px-4 pt-1 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Update Status</p>
                          {STATUS_ORDER.map((s) => (
                            <button
                              key={s}
                              onClick={() => patchStatus(job, s)}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                                job.status === s ? "font-bold text-[#003fa3]" : "text-slate-600"
                              }`}
                            >
                              {STATUS_CONFIG[s].label}
                            </button>
                          ))}
                          <div className="border-t border-slate-100 mt-1 pt-1">
                            <button
                              onClick={() => patchStatus(job, "new")}
                              className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                            >
                              Remove from tracking
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recommended */}
      {recommended.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-6">Recommended for You</h2>
          <div className="grid grid-cols-2 gap-6">
            {recommended.map((job) => {
              const bg = iconColor(job.company);
              return (
                <div key={job.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
                  <div className={`h-32 w-full flex items-end p-4 relative overflow-hidden ${bg}`}>
                    <span className="absolute -right-2 -top-3 text-[7rem] font-black text-white/10 select-none leading-none">
                      {job.company.charAt(0)}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    <div className="relative flex items-center gap-2 z-10">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-xs font-bold text-slate-800">{job.company.charAt(0)}</span>
                      </div>
                      <span className="text-white font-bold text-sm drop-shadow">{job.company}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-sm font-semibold text-slate-900 mb-1 line-clamp-1">{job.title}</h3>
                    <p className="text-slate-500 text-xs mb-4 truncate">{job.location} · {job.role_type || "Role"}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#003fa3]">Score: {job.fit_score}</span>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-[#003fa3] text-white text-xs font-bold rounded-lg hover:bg-[#002d7a] transition-colors"
                      >
                        View Role
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
