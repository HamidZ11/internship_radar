import { useState } from "react";
import { Job } from "../types";
import CompanyLogo from "./CompanyLogo";

interface Props {
  job: Job | null;
  onToggleSaved: (job: Job) => void;
  onUpdateStatus: (job: Job, status: string) => void;
  onBack?: () => void;
}

const ICON_COLORS = [
  "bg-slate-800", "bg-indigo-700", "bg-gray-900",
  "bg-blue-800", "bg-violet-800", "bg-emerald-800",
];

function iconColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return ICON_COLORS[Math.abs(h) % ICON_COLORS.length];
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function scoreColor(s: number) {
  if (s >= 80) return "text-emerald-600";
  if (s >= 60) return "text-amber-600";
  return "text-slate-500";
}

// ── Summary helper ────────────────────────────────────────────────────────────

const HIGH_VALUE   = ["develop", "build", "engineer", "design", "system", "project", "technology", "responsible", "work", "team"];
const MEDIUM_VALUE = ["experience", "skills", "requirements", "support", "collaborate", "analysis"];
const LOW_VALUE    = ["welcome", "diversity", "about", "company"];

const BOILERPLATE_RE = /we welcome|equal opportunity|about the company|about us|no agencies|please note/i;
const CLEANUP_RE = [
  /\[.*?\]/g,
  /\(.*?\)/g,
  /^(description|about the role|about this role|the role|overview)[:\s]*/im,
] as const;

function createJobSummary(description: string): string[] {
  if (!description.trim()) return ["No description available"];

  // Step 1 — clean
  let text = description;
  for (const re of CLEANUP_RE) text = text.replace(re, " ");
  text = text.replace(/\s+/g, " ").trim();

  // Step 2 — split on sentence boundaries
  const raw = text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.replace(/^[-–•*]\s*/, "").trim())
    .filter(Boolean);

  // Step 3 — score
  const scored = raw.map((s) => {
    const lower = s.toLowerCase();
    if (BOILERPLATE_RE.test(lower)) return { s, score: -99 };
    let score = 0;
    HIGH_VALUE.forEach((kw)   => { if (lower.includes(kw)) score += 3; });
    MEDIUM_VALUE.forEach((kw) => { if (lower.includes(kw)) score += 1; });
    LOW_VALUE.forEach((kw)    => { if (lower.includes(kw)) score -= 3; });
    if (s.length < 40)  score -= 2;
    if (s.length > 200) score -= 2;
    return { s, score };
  });

  // Step 4 — rank, deduplicate, take top 4–5
  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const selected: string[] = [];
  for (const { s, score } of scored) {
    if (selected.length >= 5 || score < -3) break;
    const key = s.toLowerCase().split(/\s+/).slice(0, 6).join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(s);
  }

  if (selected.length === 0) return ["No description available"];

  // Step 5 — clean output: truncate at word boundary ≤ 120 chars, capitalise
  return selected.map((s) => {
    let out = s;
    if (out.length > 120) {
      out = out.slice(0, 120);
      const cut = out.lastIndexOf(" ");
      if (cut > 60) out = out.slice(0, cut);
    }
    out = out.replace(/[,;:\s]+$/, "");
    return out.charAt(0).toUpperCase() + out.slice(1);
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">{label}</p>
        <p className="text-xs font-semibold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function DescriptionBody({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;

  function flushBullets() {
    if (bullets.length === 0) return;
    nodes.push(
      <ul key={key++} className="list-disc list-outside ml-4 flex flex-col gap-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="text-xs text-slate-600 leading-relaxed pl-0.5">{b}</li>
        ))}
      </ul>
    );
    bullets = [];
  }

  for (const line of lines) {
    const isBullet = /^[•\-–*]\s+/.test(line);
    if (isBullet) {
      bullets.push(line.replace(/^[•\-–*]\s+/, ""));
    } else {
      flushBullets();
      const isSubhead = line.length < 80 && !line.endsWith(".") && nodes.length > 0;
      nodes.push(
        isSubhead
          ? <p key={key++} className="text-xs font-bold text-slate-800 mt-2">{line}</p>
          : <p key={key++} className="text-xs text-slate-600 leading-relaxed">{line}</p>
      );
    }
  }
  flushBullets();

  return <div className="flex flex-col gap-2.5">{nodes}</div>;
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full bg-slate-50">
      <div className="text-center max-w-xs px-6">
        <div className="w-12 h-12 rounded-2xl bg-[#003fa3]/10 border border-[#003fa3]/20 mx-auto flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-[#003fa3]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.073a2.25 2.25 0 0 1-2.25 2.25h-12a2.25 2.25 0 0 1-2.25-2.25v-4.073M15.75 9.75V6a3.75 3.75 0 1 0-7.5 0v3.75" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-700">No role selected</p>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">Select a role from the list to view full details.</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function JobDetail({ job, onToggleSaved, onUpdateStatus, onBack }: Props) {
  const [showFullDesc, setShowFullDesc] = useState(false);

  if (!job) return <EmptyState />;

  const bg = iconColor(job.company);
  const summary = createJobSummary(job.description);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 md:p-8">

        {onBack && (
          <button
            onClick={onBack}
            className="lg:hidden mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back to list
          </button>
        )}

        {/* ── Summary card ── */}
        <div className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="p-5 md:p-8">

            {/* hero row */}
            <div className="flex items-start gap-4 flex-wrap">
              <CompanyLogo company={job.company} size={56} rounded="rounded-2xl" textSize="text-xl" />

              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-slate-900 leading-tight">{job.title}</h2>
                <p className="mt-0.5 text-sm font-semibold text-[#003fa3]">{job.company}</p>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                  <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  {job.location}
                </div>
              </div>

              {/* action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onToggleSaved(job)}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
                    job.is_saved
                      ? "border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100"
                      : "border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill={job.is_saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                  </svg>
                </button>
                {job.status === "applied" ? (
                  <span className="px-4 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Applied
                  </span>
                ) : (
                  <button
                    onClick={() => onUpdateStatus(job, "applied")}
                    className="px-4 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-700 transition-colors"
                  >
                    Mark as applied
                  </button>
                )}
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 h-9 rounded-xl bg-[#003fa3] hover:bg-[#002d7a] text-sm font-semibold text-white flex items-center gap-2 transition-colors shadow-sm"
                >
                  Open job
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
            </div>

            {/* metadata grid */}
            <dl className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex flex-col gap-0.5">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Fit Score</dt>
                <dd className={`text-sm font-semibold ${scoreColor(job.fit_score)}`}>{job.fit_score} / 100</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Role Type</dt>
                <dd className="text-sm font-semibold text-slate-900">{job.role_type || "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Status</dt>
                <dd className="text-sm font-semibold text-slate-900 capitalize">{job.status}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Deadline</dt>
                <dd className="text-sm font-semibold text-slate-900">{formatDate(job.deadline)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ── Content row ── */}
        <div className="mt-5 flex flex-col md:flex-row items-start gap-5">

          {/* ── Left: description sections ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* Quick Summary */}
            <div className="rounded-2xl border border-slate-200 shadow-sm bg-white p-6">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Quick Summary</h3>
              <ul className="flex flex-col gap-2.5">
                {summary.map((point, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#003fa3] mt-[7px] shrink-0" />
                    <span className="text-sm text-slate-600 leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Key Details */}
            <div className="rounded-2xl border border-slate-200 shadow-sm bg-white p-6">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Key Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <DetailChip
                  label="Company"
                  value={job.company}
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>}
                />
                <DetailChip
                  label="Location"
                  value={job.location}
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>}
                />
                <DetailChip
                  label="Role Type"
                  value={job.role_type || "—"}
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.073a2.25 2.25 0 0 1-2.25 2.25h-12a2.25 2.25 0 0 1-2.25-2.25v-4.073M15.75 9.75V6a3.75 3.75 0 1 0-7.5 0v3.75m10.5 0h-15" /></svg>}
                />
                <DetailChip
                  label="Deadline"
                  value={formatDate(job.deadline)}
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>}
                />
                <DetailChip
                  label="Source"
                  value={job.source}
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253" /></svg>}
                />
                <DetailChip
                  label="Fit Score"
                  value={`${job.fit_score} / 100`}
                  icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>}
                />
              </div>
            </div>

            {/* Full Description (collapsible) */}
            <div className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
              <button
                onClick={() => setShowFullDesc((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4 text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors"
              >
                Full Description
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${showFullDesc ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showFullDesc && (
                <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                  {job.description
                    ? <DescriptionBody text={job.description} />
                    : <p className="text-xs text-slate-400 italic">No description available.</p>
                  }
                </div>
              )}
            </div>

          </div>

          {/* ── Right: company card ── */}
          <div className="w-full md:w-[185px] md:shrink-0 rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
            <div className={`h-28 flex items-end p-3 ${bg}`}>
              <span className="text-5xl font-black text-white/20 select-none leading-none">
                {job.company.charAt(0)}
              </span>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                About {job.company.split(" ")[0]}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-5">
                {job.description
                  ? job.description.split(". ").slice(0, 3).join(". ") + "."
                  : `${job.company} is hiring for a ${job.role_type || "role"} position.`}
              </p>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-xs font-bold text-[#003fa3] hover:text-[#002d7a] uppercase tracking-wide transition-colors"
              >
                View Listing →
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
