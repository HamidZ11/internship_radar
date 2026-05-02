import { Job } from "../types";

interface Props {
  jobs: Job[];
  selectedId: number | null;
  onSelect: (job: Job) => void;
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

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : score >= 60
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-500 bg-slate-50 border-slate-200";
  return (
    <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded border ${cls}`}>
      {score}
    </span>
  );
}

export default function JobList({ jobs, selectedId, onSelect }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-1">
        <p className="text-sm text-slate-500 font-medium">No roles found</p>
        <p className="text-xs text-slate-400">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {jobs.map((job) => {
        const active = job.id === selectedId;
        const bg = iconColor(job.company);

        return (
          <li
            key={job.id}
            onClick={() => onSelect(job)}
            className={`relative rounded-xl border cursor-pointer transition-all p-4 ${
              active
                ? "bg-blue-50/50 border-blue-200 ring-1 ring-blue-100 shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
                <span className="text-xs font-bold text-white select-none">
                  {job.company.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-semibold leading-snug line-clamp-1 ${active ? "text-[#003fa3]" : "text-slate-900"}`}>
                    {job.title}
                  </p>
                  <ScoreBadge score={job.fit_score} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500 truncate">
                  {job.company} · {job.location}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  {job.role_type && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">
                      {job.role_type}
                    </span>
                  )}
                  {job.status === "new" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#003fa3]/10 text-[#003fa3] uppercase tracking-wide">
                      New
                    </span>
                  )}
                  {job.status === "applied" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 capitalize">
                      Applied
                    </span>
                  )}
                  {job.status === "interview" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 capitalize">
                      Interview
                    </span>
                  )}
                  {job.status === "rejected" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 capitalize">
                      Rejected
                    </span>
                  )}
                  {job.status === "offer" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 capitalize">
                      Offer
                    </span>
                  )}
                  {job.is_saved && (
                    <svg className="w-3 h-3 text-rose-400 shrink-0 ml-auto" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
