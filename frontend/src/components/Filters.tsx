import { Filters } from "../types";

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const EMPTY: Filters = {
  search: "", min_score: "", status: "", location: "", source: "", role_type: [], deadline_filter: "",
};

const DEADLINE_OPTIONS = [
  { value: "",     label: "Any deadline" },
  { value: "7",    label: "Closing in 7 days" },
  { value: "14",   label: "Closing in 14 days" },
  { value: "30",   label: "Closing in 30 days" },
  { value: "none", label: "No deadline shown" },
];

const ROLE_TYPES = [
  { label: "Placement",       value: "placement" },
  { label: "Internship",      value: "internship" },
  { label: "Graduate Scheme", value: "graduate" },
  { label: "Apprenticeship",  value: "apprenticeship" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "new",          label: "New" },
  { value: "applied",      label: "Applied" },
  { value: "interview",    label: "Interviewing" },
  { value: "rejected",     label: "Rejected" },
  { value: "offer",        label: "Offer" },
];

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
      {text}
    </p>
  );
}

const inputCls =
  "h-9 w-full px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 " +
  "placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all";

export default function FilterBar({ filters, onChange }: Props) {
  function set(field: keyof Filters, value: string) {
    onChange({ ...filters, [field]: value });
  }

  function toggleRoleType(value: string) {
    const next = filters.role_type.includes(value)
      ? filters.role_type.filter((v) => v !== value)
      : [...filters.role_type, value];
    onChange({ ...filters, role_type: next });
  }

  const hasFilters = Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));

  return (
    <aside className="flex flex-col h-full w-full bg-white border-r border-slate-200 overflow-hidden">

      {/* header — aligns with job-list header height */}
      <div className="shrink-0 px-6 h-[73px] flex items-center justify-between border-b border-slate-100">
        <span className="text-sm font-bold text-slate-900">Filters</span>
        {hasFilters && (
          <button
            onClick={() => onChange(EMPTY)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 uppercase tracking-wide"
          >
            Clear all
          </button>
        )}
      </div>

      {/* scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-8">

        {/* Role type */}
        <div>
          <SectionLabel text="Role type" />
          <div className="flex flex-col gap-2.5">
            {ROLE_TYPES.map(({ label, value }) => {
              const checked = filters.role_type.includes(value);
              return (
                <label
                  key={value}
                  className="flex items-center gap-2.5 cursor-pointer group"
                  onClick={() => toggleRoleType(value)}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      checked
                        ? "bg-[#003fa3] border-[#003fa3]"
                        : "border-slate-300 group-hover:border-blue-400"
                    }`}
                  >
                    {checked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 10 10">
                        <polyline points="1.5,5.5 3.5,8 8.5,2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm select-none ${checked ? "text-slate-900 font-semibold" : "text-slate-600"}`}>
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Source */}
        <div>
          <SectionLabel text="Source" />
          <select
            value={filters.source}
            onChange={(e) => set("source", e.target.value)}
            className={inputCls}
          >
            <option value="">All sources</option>
            <option value="ratemyplacement">RateMyPlacement</option>
            <option value="gradcracker">Gradcracker</option>
            <option value="brightnetwork">Bright Network</option>
            <option value="prospects">Prospects</option>
          </select>
        </div>

        {/* Location */}
        <div>
          <SectionLabel text="Location contains" />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Manchester, Remote, London..."
              value={filters.location}
              onChange={(e) => set("location", e.target.value)}
              className={`${inputCls} pl-9`}
            />
          </div>
        </div>

        {/* Deadline */}
        <div>
          <SectionLabel text="Deadline" />
          <select
            value={filters.deadline_filter}
            onChange={(e) => set("deadline_filter", e.target.value)}
            className={inputCls}
          >
            {DEADLINE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Min score */}
        <div>
          <SectionLabel text="Min score" />
          <input
            type="number"
            placeholder="0 – 100"
            min={0} max={100}
            value={filters.min_score}
            onChange={(e) => set("min_score", e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Status */}
        <div>
          <SectionLabel text="Status" />
          <select
            value={filters.status}
            onChange={(e) => set("status", e.target.value)}
            className={inputCls}
          >
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

      </div>
    </aside>
  );
}
