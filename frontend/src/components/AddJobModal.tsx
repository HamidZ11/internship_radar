import { useEffect, useRef, useState } from "react";
import { Job } from "../types";

interface Props {
  onClose: () => void;
  onAdded: (job: Job) => void;
}

const ROLE_TYPES = [
  { label: "Placement",        value: "placement" },
  { label: "Internship",       value: "internship" },
  { label: "Graduate Scheme",  value: "graduate" },
  { label: "Apprenticeship",   value: "apprenticeship" },
  { label: "Work Experience",  value: "work experience" },
  { label: "Other",            value: "other" },
];

const SOURCES = [
  { label: "Manual",            value: "manual" },
  { label: "RateMyPlacement",   value: "ratemyplacement" },
  { label: "Gradcracker",       value: "gradcracker" },
  { label: "Bright Network",    value: "brightnetwork" },
  { label: "Prospects",         value: "prospects" },
  { label: "Other",             value: "other" },
];

const inputCls =
  "h-9 w-full px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 " +
  "placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all";

const labelCls = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";

type FormState = {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  role_type: string;
  description: string;
  deadline: string;
};

const EMPTY: FormState = {
  title: "", company: "", location: "", url: "",
  source: "manual", role_type: "placement",
  description: "", deadline: "",
};

export default function AddJobModal({ onClose, onAdded }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.company || !form.url) {
      setError("Title, company, and URL are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = {
        ...form,
        deadline: form.deadline || null,
        posted_date: null,
      };
      const res = await fetch("http://localhost:8000/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      const job = await res.json() as Job;
      onAdded(job);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add job.");
      setLoading(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Add Job Manually</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* form */}
        <form onSubmit={submit} className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Title *</label>
              <input type="text" placeholder="Software Engineer Placement" value={form.title}
                onChange={(e) => set("title", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Company *</label>
              <input type="text" placeholder="Acme Corp" value={form.company}
                onChange={(e) => set("company", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input type="text" placeholder="Manchester, UK" value={form.location}
                onChange={(e) => set("location", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>URL *</label>
              <input type="url" placeholder="https://..." value={form.url}
                onChange={(e) => set("url", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Role Type</label>
              <select value={form.role_type} onChange={(e) => set("role_type", e.target.value)} className={inputCls}>
                {ROLE_TYPES.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <select value={form.source} onChange={(e) => set("source", e.target.value)} className={inputCls}>
                {SOURCES.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Deadline</label>
              <input type="date" value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              placeholder="Paste the job description here…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={5}
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all resize-none"
            />
          </div>

        </form>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-5 h-9 rounded-lg bg-[#003fa3] hover:bg-[#002d7a] text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add Job"}
          </button>
        </div>

      </div>
    </div>
  );
}
