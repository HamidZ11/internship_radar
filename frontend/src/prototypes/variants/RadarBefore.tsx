// Frozen copy of the first Radar pass, kept only for before/after review.
import { ReactNode, useMemo, useRef, useState } from "react";
import {
  isManual, ProtoJob, ROLE_GROUP_LABEL, RoleGroup, roleLabel, sourceLabel, Status, STATUS_LABEL,
} from "../data";
import { deadlineLabel, deadlineState, formatDescription, relativeAge, shortDate } from "../extract";
import { Factor, FactorKey } from "../scoring";
import { EMPTY_FILTERS, pickSelected, ProtoFilters, useProto, View } from "../store";
import { BookmarkSwap, Icon, Logo, menuKeys, Popover, Toaster, useFlip, useListKeys } from "../primitives";

// Direction C — Distinctive Internship Radar.
// The score becomes a signal: five concentric rings, one per real scoring
// rule. Feed and detail are joined at the selected row; status is a track you
// move along rather than a label.

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[#2452D6]/45 focus-visible:ring-offset-1";
const mono = "font-radar-mono";
const label = `${mono} text-[11px] uppercase tracking-[0.06em] text-[#6B717C]`;
const ACCENT = "#2452D6";

const STATUS_COLOR: Record<Status, string> = {
  new: "#9AA0AA",
  applied: "#C98512",
  interview: "#6B4FD0",
  offer: "#16936A",
  rejected: "#C8412C",
};

const ROLE_GROUPS: RoleGroup[] = ["apprenticeship", "graduate", "placement", "internship"];
const RING_ORDER: FactorKey[] = ["role", "tech", "location", "requirements", "stack"];

export default function RadarBefore() {
  const { view, setView, saved, tracked, toast, filters, setFilters } = useProto();
  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "dashboard", label: "Radar" },
    { id: "saved", label: "Shortlist", count: saved.length },
    { id: "applied", label: "Pipeline", count: tracked.length },
  ];
  const index = tabs.findIndex((t) => t.id === view);

  return (
    <div className="font-radar flex h-screen flex-col bg-[#F3F4F6] text-[13.5px] text-[#0E1116]">
      <header className="relative flex h-[52px] shrink-0 items-center border-b border-[#E3E5E9] bg-white px-5">
        <div className="flex items-center gap-2.5">
          <RadarMark />
          <span className="text-[14px] font-semibold tracking-[-0.01em]">Internship Radar</span>
        </div>

        <nav aria-label="Main" className="absolute left-1/2 grid -translate-x-1/2 grid-cols-3 rounded-lg bg-[#EEF0F3] p-0.5">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-md bg-white shadow-[0_1px_2px_rgb(14_17_22/0.08),0_0_0_1px_rgb(14_17_22/0.04)] transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
          {tabs.map((t) => {
            const active = t.id === view;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-7 w-[120px] items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors duration-150 ${focusRing} ${
                  active ? "text-[#0E1116]" : "text-[#6B717C] hover:text-[#0E1116]"
                }`}
              >
                {t.label}
                {t.count !== undefined && <span className={`${mono} text-[11px] text-[#9AA0AA]`}>{t.count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {view === "dashboard" && (
            <label className="relative">
              <span className="sr-only">Search roles</span>
              <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AA0AA]" />
              <input
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search roles"
                className="h-8 w-[170px] rounded-md border xl:w-[220px] border-[#E3E5E9] bg-[#F7F8FA] pl-8 pr-2.5 text-[13px] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[#9AA0AA] focus:border-[#2452D6]/50 focus:bg-white focus:shadow-[0_0_0_3px_rgb(36_82_214/0.12)]"
              />
            </label>
          )}
          <button
            onClick={() => toast("Manual entry uses the existing Add Job form (unchanged in this pass)")}
            aria-label="Add a job manually"
            title="Add a job manually"
            className={`proto-press grid h-8 w-8 place-items-center rounded-md border border-[#E3E5E9] bg-white text-[#474D57] hover:bg-[#F7F8FA] ${focusRing}`}
          >
            <Icon name="plus" size={15} stroke={2} />
          </button>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0E1116] text-[11.5px] font-semibold text-white">H</span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        {view === "dashboard" && <RadarView />}
        {view === "saved" && <ShortlistView />}
        {view === "applied" && <PipelineView />}
      </main>

      <Toaster
        className="bottom-6 right-6 w-[340px]"
        toastClassName="rounded-lg border border-white/10 bg-[#0E1116] px-3.5 py-2.5 text-[13px] text-white shadow-[0_10px_30px_rgb(14_17_22/0.22)]"
        actionClassName={`proto-press ${mono} rounded px-1.5 text-[11.5px] uppercase tracking-[0.06em] text-[#8FB0FF] hover:text-white`}
      />
    </div>
  );
}

function RadarMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="8.5" fill="none" stroke={ACCENT} strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="5" fill="none" stroke={ACCENT} strokeOpacity="0.5" strokeWidth="1.5" />
      <path d="M10 1.5A8.5 8.5 0 0 1 18.5 10" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="10" r="1.75" fill={ACCENT} />
    </svg>
  );
}

// ── The signal glyph ─────────────────────────────────────────────────────────

function SignalGlyph({
  job, size, stroke, gap, focus, onFocusRing, center,
}: {
  job: ProtoJob;
  size: number;
  stroke: number;
  gap: number;
  focus?: FactorKey | null;
  onFocusRing?: (k: FactorKey | null) => void;
  center?: ReactNode;
}) {
  const factors = Object.fromEntries(job.breakdown.gains.map((f) => [f.key, f])) as Record<FactorKey, Factor>;
  const penalty = job.breakdown.penalties.reduce((s, f) => s + Math.abs(f.points), 0);
  const c = size / 2;
  const penStroke = stroke * 0.6;
  const outer = c - stroke / 2 - (penalty ? penStroke + gap : 0);
  // Fit five rings inside the space left (a penalty arc takes the outer edge):
  // shrink the ring pitch, then the stroke, so the innermost ring never collapses.
  const inner = Math.max(stroke, size * 0.1);
  const step = Math.min(stroke + gap, (outer - inner) / (RING_ORDER.length - 1));
  stroke = Math.min(stroke, step * 0.62);
  const focusedIsPenalty = focus === "graduate" || focus === "unpaid" || focus === "offTarget";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`Fit ${job.score} of 100`}>
      {penalty > 0 && (() => {
        const r = c - penStroke / 2;
        const circ = 2 * Math.PI * r;
        return (
          <circle
            cx={c} cy={c} r={r} fill="none" stroke="#C8412C" strokeWidth={penStroke} strokeLinecap="round"
            strokeDasharray={`${(Math.min(penalty, 100) / 100) * circ} ${circ}`}
            transform={`rotate(-90 ${c} ${c}) scale(1 -1) translate(0 ${-size})`}
            opacity={focus && !focusedIsPenalty ? 0.2 : 1}
            className="transition-[stroke-dasharray,opacity] duration-200 ease-out"
          />
        );
      })()}
      {RING_ORDER.map((key, i) => {
        const f = factors[key];
        const r = outer - i * step;
        const circ = 2 * Math.PI * r;
        const frac = f.points / f.max;
        const dim = focus != null && focus !== key;
        return (
          <g
            key={key}
            onMouseEnter={onFocusRing ? () => onFocusRing(key) : undefined}
            onMouseLeave={onFocusRing ? () => onFocusRing(null) : undefined}
          >
            <circle cx={c} cy={c} r={r} fill="none" stroke="#E6E8EC" strokeWidth={stroke} opacity={dim ? 0.5 : 1} />
            <circle
              cx={c} cy={c} r={r} fill="none" stroke={ACCENT} strokeWidth={stroke}
              strokeLinecap={frac > 0 ? "round" : "butt"}
              strokeDasharray={`${frac * circ} ${circ}`}
              transform={`rotate(-90 ${c} ${c})`}
              opacity={dim ? 0.18 : 0.55 + 0.45 * (1 - i / RING_ORDER.length)}
              className="transition-[stroke-dasharray,opacity] duration-200 ease-out motion-reduce:transition-none"
            />
          </g>
        );
      })}
      {center}
    </svg>
  );
}

/** Five bars, one per scoring rule in ring order; fill = points / max. A red base marks a penalty. */
function SignalBars({ job, height = 16 }: { job: ProtoJob; height?: number }) {
  const gains = Object.fromEntries(job.breakdown.gains.map((f) => [f.key, f])) as Record<FactorKey, Factor>;
  const penalised = job.breakdown.penalties.length > 0;
  return (
    <span className="inline-flex flex-col items-center gap-[3px]" role="img" aria-label={`Fit ${job.score} of 100`}>
      <span className="flex items-end gap-[2px]" style={{ height }}>
        {RING_ORDER.map((key, i) => {
          const f = gains[key];
          const h = Math.round(height * (0.45 + 0.55 * ((i + 1) / RING_ORDER.length)));
          return (
            <span key={key} className="relative w-[3px] overflow-hidden rounded-[1px] bg-[#DDE0E5]" style={{ height: h }}>
              <span className="absolute inset-x-0 bottom-0 bg-[#0E1116]/75" style={{ height: `${(f.points / f.max) * 100}%` }} />
            </span>
          );
        })}
      </span>
      <span className={`h-[2px] w-full rounded-full ${penalised ? "bg-[#C8412C]" : "bg-transparent"}`} />
    </span>
  );
}

// ── Radar (dashboard) ────────────────────────────────────────────────────────

function RadarView() {
  const { filtered, selectedId, setFilters, filters } = useProto();
  const selected = pickSelected(filtered, selectedId);

  return (
    <>
      <section className="relative flex w-[440px] shrink-0 flex-col bg-[#F7F8FA]">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[#E3E5E9]" />
        <ScopeBar />
        <Feed jobs={filtered} selectedId={selected?.id ?? null} onClear={() => setFilters({ ...EMPTY_FILTERS, search: filters.search })} />
      </section>
      <section className="min-w-0 flex-1 overflow-y-auto bg-white" aria-label="Role details">
        {selected ? <Detail job={selected} /> : (
          <div className="grid h-full place-items-center text-center">
            <p className="text-[13px] text-[#6B717C]">No role selected</p>
          </div>
        )}
      </section>
    </>
  );
}

function ScopeBar() {
  const { jobs, filtered, filters, setFilters, activeFilterCount } = useProto();
  const set = (f: Partial<ProtoFilters>) => setFilters({ ...filters, ...f });
  const count = (g: RoleGroup) => jobs.filter((j) => j.role_group === g).length;
  const extra = activeFilterCount - (filters.roles.length > 0 ? 1 : 0);

  return (
    <div className="shrink-0 border-b border-[#E3E5E9] px-4 pb-3 pt-3.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Role type">
        <Chip active={filters.roles.length === 0} onClick={() => set({ roles: [] })}>
          All <span className={`${mono} text-[11px] opacity-60`}>{jobs.length}</span>
        </Chip>
        {ROLE_GROUPS.map((g) => {
          const on = filters.roles.includes(g);
          return (
            <Chip key={g} active={on} pressed={on} onClick={() => set({ roles: on ? filters.roles.filter((r) => r !== g) : [...filters.roles, g] })}>
              {ROLE_GROUP_LABEL[g]} <span className={`${mono} text-[11px] opacity-60`}>{count(g)}</span>
            </Chip>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Popover
          label="More filters"
          panelClassName="w-[300px] rounded-[10px] border border-[#E3E5E9] bg-white p-3.5 shadow-[0_16px_40px_rgb(14_17_22/0.14)]"
          trigger={(p, open) => (
            <button {...p} className={`proto-press flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium ${focusRing} ${open || extra > 0 ? "bg-[#EAF0FD] text-[#2452D6]" : "text-[#474D57] hover:bg-[#EEF0F3]"}`}>
              <Icon name="sliders" size={14} />
              Filters
              {extra > 0 && <span className={`${mono} text-[11px]`}>{extra}</span>}
            </button>
          )}
        >
          {() => <MoreFilters />}
        </Popover>
        <span className={label}>
          <span className="text-[#0E1116]">{filtered.length}</span> roles · by fit ↓
        </span>
      </div>
    </div>
  );
}

function Chip({ active, pressed, onClick, children }: { active: boolean; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      className={`proto-press flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium ${focusRing} ${
        active ? "border-[#0E1116] bg-[#0E1116] text-white" : "border-[#E3E5E9] bg-white text-[#474D57] hover:border-[#CDD1D7] hover:text-[#0E1116]"
      }`}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string | number>({
  value, options, onChange, ariaLabel,
}: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid rounded-md bg-[#EEF0F3] p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`h-6 rounded-[5px] text-[12px] font-medium transition-colors duration-150 ${focusRing} ${
            value === o.v ? "bg-white text-[#0E1116] shadow-[0_1px_2px_rgb(14_17_22/0.1)]" : "text-[#6B717C] hover:text-[#0E1116]"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function MoreFilters() {
  const { jobs, filters, setFilters } = useProto();
  const set = (f: Partial<ProtoFilters>) => setFilters({ ...filters, ...f });
  const sources = [...new Set(jobs.map((j) => j.source))];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className={label}>Location contains</p>
        <input
          data-autofocus
          value={filters.location}
          onChange={(e) => set({ location: e.target.value })}
          placeholder="Any location"
          className="mt-1.5 h-8 w-full rounded-md border border-[#E3E5E9] px-2.5 text-[13px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#9AA0AA] focus:border-[#2452D6]/50 focus:shadow-[0_0_0_3px_rgb(36_82_214/0.12)]"
        />
      </div>
      <div>
        <p className={`${label} mb-1.5`}>Closing within</p>
        <Segmented ariaLabel="Deadline" value={filters.deadline} onChange={(v) => set({ deadline: v })}
          options={[{ v: "", l: "Any" }, { v: "7", l: "7 days" }, { v: "14", l: "14 days" }, { v: "30", l: "30 days" }, { v: "none", l: "No date" }]} />
      </div>
      <div>
        <p className={`${label} mb-1.5`}>Minimum fit</p>
        <Segmented ariaLabel="Minimum fit" value={filters.minScore} onChange={(v) => set({ minScore: v })}
          options={[{ v: 0, l: "Any" }, { v: 20, l: "20+" }, { v: 40, l: "40+" }, { v: 60, l: "60+" }]} />
      </div>
      <div>
        <p className={`${label} mb-1.5`}>Status</p>
        <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 gap-1">
          {(["", "new", "applied", "interview", "offer", "rejected"] as const).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={filters.status === v}
              onClick={() => set({ status: v })}
              className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-[12.5px] transition-colors duration-150 ${focusRing} ${
                filters.status === v ? "bg-[#0E1116] text-white" : "text-[#474D57] hover:bg-[#EEF0F3]"
              }`}
            >
              {v && <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[v] }} />}
              {v ? STATUS_LABEL[v] : "Any status"}
            </button>
          ))}
        </div>
      </div>
      {sources.length > 1 ? (
        <div>
          <p className={`${label} mb-1.5`}>Source</p>
          <Segmented ariaLabel="Source" value={filters.source} onChange={(v) => set({ source: v })}
            options={[{ v: "", l: "All" }, ...sources.map((s) => ({ v: s, l: sourceLabel(s) }))]} />
        </div>
      ) : (
        <p className="text-[12px] text-[#6B717C]">All roles come from {sourceLabel(sources[0] ?? "")}.</p>
      )}
      <button onClick={() => setFilters({ ...EMPTY_FILTERS, search: filters.search, roles: filters.roles })} className={`self-start rounded px-1 text-[12.5px] font-medium text-[#2452D6] hover:underline ${focusRing}`}>
        Reset these filters
      </button>
    </div>
  );
}

function Feed({ jobs, selectedId, onClear }: { jobs: ProtoJob[]; selectedId: number | null; onClear: () => void }) {
  const { select, flashId } = useProto();
  const listRef = useRef<HTMLUListElement>(null);
  const onKeyDown = useListKeys(listRef, jobs.map((j) => j.id), selectedId, select);

  if (jobs.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-[13.5px] font-medium">No roles match</p>
        <p className="mt-1 text-[12.5px] text-[#6B717C]">Every listed deadline in the current data has passed, so deadline windows return nothing.</p>
        <button onClick={onClear} className={`mt-3 rounded px-1 text-[12.5px] font-medium text-[#2452D6] hover:underline ${focusRing}`}>Reset filters</button>
      </div>
    );
  }

  return (
    <ul ref={listRef} onKeyDown={onKeyDown} className="proto-noscrollbar flex-1 overflow-y-auto">
      {jobs.map((j) => {
        const active = j.id === selectedId;
        return (
          <li key={j.id} className={`relative ${active ? "z-10 bg-white" : ""} ${flashId === j.id ? "proto-flash" : ""}`}>
            <button
              data-row={j.id}
              onClick={() => select(j.id)}
              aria-current={active ? "true" : undefined}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b px-4 py-3 text-left transition-colors duration-100 outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(36_82_214/0.45)] ${
                active ? "border-[#E3E5E9] bg-white" : "border-[#ECEEF1] hover:bg-white/70"
              }`}
            >
              {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-[#2452D6]" />}
              <span className="min-w-0">
                <span className="line-clamp-2 text-[14px] font-medium leading-5">{j.title}</span>
                <span className="mt-1 flex items-center gap-1.5 text-[13px] text-[#474D57]">
                  <Logo company={j.company} size={16} className="rounded-[4px] outline outline-1 -outline-offset-1 outline-black/[0.08]" fallbackClassName="bg-[#E9EBEF] text-[#474D57]" />
                  <span className="truncate">{j.company} · {j.location}</span>
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[12px] text-[#6B717C]">
                  <span>{roleShort(j)}</span>
                  <span aria-hidden>·</span>
                  <span className={j.deadline_state === "soon" ? "font-medium text-[#9A5B00]" : ""}>{deadlineLabel(j.deadline)}</span>
                  {j.status !== "new" && <StatusText status={j.status} />}
                  {j.is_saved && <Icon name="bookmark" size={12} filled className="ml-auto text-[#2452D6]" />}
                </span>
              </span>
              <span className="flex items-start gap-2.5 pt-0.5">
                <SignalBars job={j} />
                <span className={`${mono} w-6 text-right text-[14px] font-medium leading-4`}>{j.score}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StatusText({ status }: { status: Status }) {
  return (
    <>
      <span aria-hidden>·</span>
      <span className="flex items-center gap-1 text-[#2E333B]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
        {STATUS_LABEL[status]}
      </span>
    </>
  );
}

function roleShort(j: ProtoJob): string {
  return j.role_group === "other" ? roleLabel(j.role_type) : ROLE_GROUP_LABEL[j.role_group];
}

// ── Detail ───────────────────────────────────────────────────────────────────

function Detail({ job }: { job: ProtoJob }) {
  const { toggleSaved } = useProto();
  const [focus, setFocus] = useState<FactorKey | null>(null);
  const [fullDesc, setFullDesc] = useState(false);
  const blocks = formatDescription(job.description, job.title);
  const factors = [...job.breakdown.gains, ...job.breakdown.penalties];
  const dl = deadlineState(job.deadline);

  return (
    <article className="mx-auto max-w-[860px] px-8 pb-28 pt-7 2xl:px-12">
      <header className="flex items-start gap-6">
        <SignalGlyph
          job={job} size={112} stroke={5} gap={3} focus={focus} onFocusRing={setFocus}
          center={
            <text x="56" y="56" textAnchor="middle" dominantBaseline="central" className={mono} style={{ fontSize: 24, fontWeight: 500, fill: "#0E1116" }}>
              {job.score}
            </text>
          }
        />
        <div className="min-w-0 flex-1 pt-1">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#474D57]">
            <Logo company={job.company} size={18} className="rounded-[4px] outline outline-1 -outline-offset-1 outline-black/[0.08]" fallbackClassName="bg-[#E9EBEF] text-[#474D57]" />
            {job.company}
          </p>
          <h1 className="mt-1.5 text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] [text-wrap:balance]">{job.title}</h1>
          <p className="mt-1.5 text-[13px] text-[#6B717C]">{job.location}</p>
          <div className="mt-4 flex items-center gap-2">
            <a href={job.url} target="_blank" rel="noopener noreferrer" className={`proto-press flex h-9 items-center gap-1.5 rounded-md bg-[#2452D6] px-3.5 text-[13px] font-medium text-white hover:bg-[#1D44B5] ${focusRing}`}>
              Open listing <Icon name="external" size={14} stroke={2} />
            </a>
            <button
              onClick={() => toggleSaved(job.id)}
              aria-pressed={job.is_saved}
              aria-label={job.is_saved ? "Remove from shortlist" : "Add to shortlist"}
              title={job.is_saved ? "Remove from shortlist" : "Add to shortlist"}
              className={`proto-press grid h-9 w-9 place-items-center rounded-md border ${focusRing} ${
                job.is_saved ? "border-[#C8D6F7] bg-[#EAF0FD] text-[#2452D6]" : "border-[#E3E5E9] text-[#474D57] hover:bg-[#F7F8FA]"
              }`}
            >
              <BookmarkSwap on={job.is_saved} size={16} />
            </button>
          </div>
        </div>
      </header>

      <StageTrack job={job} />

      <section className="mt-7 rounded-xl border border-[#E3E5E9]" aria-label="Fit signal">
        <div className="flex items-center justify-between border-b border-[#ECEEF1] px-5 py-2.5">
          <span className={label}>Fit signal</span>
          <span className="text-[12px] text-[#6B717C]">Hover a rule to find its ring</span>
        </div>
        <div className="px-3 py-3">
          <ul className="min-w-0" onMouseLeave={() => setFocus(null)}>
            {factors.map((f) => {
              const ring = RING_ORDER.indexOf(f.key);
              const on = focus === f.key;
              return (
                <li key={f.key}>
                  <button
                    onMouseEnter={() => setFocus(f.key)}
                    onFocus={() => setFocus(f.key)}
                    onBlur={() => setFocus(null)}
                    className={`grid w-full grid-cols-[18px_190px_minmax(0,1fr)_60px] items-center gap-3 rounded-md px-2 py-2 text-left transition-[background-color,opacity] duration-150 ${focusRing} ${
                      on ? "bg-[#F3F6FE]" : focus ? "opacity-55" : ""
                    }`}
                  >
                    <RingKey index={ring} penalty={f.penalty} />
                    <span className={`text-[13px] font-medium ${f.points === 0 ? "text-[#6B717C]" : ""}`}>{f.label}</span>
                    <span className="min-w-0 text-[12px] leading-[1.45] text-[#6B717C]">
                      {f.evidence.length > 0
                        ? f.evidence.map((e, i) => (
                            <span key={e.term}>
                              {i > 0 && ", "}
                              <span className="text-[#2E333B]">{e.term}</span>
                              {e.word !== e.term && ` in “${e.word}”`}
                            </span>
                          ))
                        : `Not matched · ${f.rule.toLowerCase()}`}
                    </span>
                    <span className={`${mono} text-right text-[13px] ${f.penalty ? "text-[#C8412C]" : f.points === 0 ? "text-[#9AA0AA]" : ""}`}>
                      {f.points > 0 ? `+${f.points}` : f.points === 0 ? "0" : `−${Math.abs(f.points)}`}
                      {!f.penalty && <span className="text-[#9AA0AA]">/{f.max}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
            <li className={`mt-1 flex items-center justify-between border-t border-[#ECEEF1] px-2 pt-2.5 text-[12.5px] text-[#6B717C]`}>
              <span>{job.breakdown.raw !== job.score ? `Total (raw ${job.breakdown.raw}, clamped to 0–100)` : "Total"}</span>
              <span className="text-[14px] font-medium text-[#0E1116]">{job.score}</span>
            </li>
          </ul>
        </div>
        <p className="border-t border-[#ECEEF1] px-5 py-2.5 text-[12px] text-[#6B717C]">
          Rings run outer to inner in this order; a red outer arc is a penalty. These are every rule the scorer uses, and keywords match inside longer words.
        </p>
      </section>

      <section className="mt-7 grid grid-cols-3 gap-x-6 gap-y-5 border-y border-[#ECEEF1] py-5">
        <Datum k="Deadline" v={deadlineLabel(job.deadline)} sub={job.deadline && dl.state !== "closed" ? shortDate(job.deadline, true) : undefined} warn={dl.state === "soon"} />
        <Datum k="Type" v={roleLabel(job.role_type)} />
        <Datum k={isManual(job.source) ? "Added" : "Collected"} v={sourceLabel(job.source)} sub={`${shortDate(job.created_at, true)} · ${relativeAge(job.created_at)}`} />
        {job.facts.map((f) => <Datum key={f.label} k={f.label} v={f.value} title={f.excerpt} />)}
      </section>
      {job.facts.length === 0 && <p className="mt-3 text-[12.5px] text-[#6B717C]">No dates, eligibility or salary details were found in the listing text.</p>}

      <section className="mt-7">
        <p className={label}>Listing text</p>
        <div className={`relative mt-3 ${fullDesc ? "" : "max-h-[300px] overflow-hidden"}`}>
          <div className="max-w-[70ch] text-[14px] leading-[1.65] text-[#2E333B]">
            {blocks.map((b, i) => (
              <div key={i}>
                {b.heading && <h3 className="mb-1 mt-5 text-[13px] font-semibold text-[#0E1116] first:mt-0">{b.heading}</h3>}
                {b.paragraphs.map((p, k) => <p key={k} className="mt-3 first:mt-0">{p}</p>)}
              </div>
            ))}
          </div>
          {!fullDesc && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-white/0" />}
        </div>
        <button onClick={() => setFullDesc((v) => !v)} className={`mt-2 rounded px-1 text-[12.5px] font-medium text-[#2452D6] hover:underline ${focusRing}`}>
          {fullDesc ? "Show less" : "Show full listing"}
        </button>
      </section>
    </article>
  );
}

function RingKey({ index, penalty }: { index: number; penalty: boolean }) {
  const size = 18;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {penalty
        ? <circle cx={c} cy={c} r={7.5} fill="none" stroke="#C8412C" strokeWidth={2} />
        : [0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={c} cy={c} r={8 - i * 1.6} fill="none" stroke={i === index ? ACCENT : "#DDE0E5"} strokeWidth={i === index ? 1.6 : 0.9} />
          ))}
    </svg>
  );
}

function Datum({ k, v, sub, title, warn }: { k: string; v: string; sub?: string; title?: string; warn?: boolean }) {
  return (
    <div title={title} className="min-w-0">
      <p className={label}>{k}</p>
      <p className={`mt-1 truncate text-[14px] font-medium ${warn ? "text-[#B36A00]" : ""}`}>{v}</p>
      {sub && <p className="truncate text-[12px] text-[#6B717C]">{sub}</p>}
    </div>
  );
}

// ── Stage track: status as a position you move along ─────────────────────────

const TRACK: Status[] = ["new", "applied", "interview", "offer"];
const TRACK_LABEL: Record<Status, string> = { new: "Not applied", applied: "Applied", interview: "Interview", offer: "Offer", rejected: "Rejected" };

function StageTrack({ job, compact = false, beforeChange }: { job: ProtoJob; compact?: boolean; beforeChange?: () => void }) {
  const { setStatus } = useProto();
  const rejected = job.status === "rejected";
  const pos = rejected ? 0 : TRACK.indexOf(job.status);
  const color = rejected ? STATUS_COLOR.rejected : STATUS_COLOR[job.status];
  const move = (s: Status) => { beforeChange?.(); setStatus(job.id, s); };

  if (compact) {
    return (
      <div className="flex items-center gap-2" role="group" aria-label={`Stage: ${STATUS_LABEL[job.status]}`}>
        <div className="relative flex items-center">
          <span aria-hidden className="absolute left-[7px] right-[7px] top-1/2 h-px -translate-y-1/2 bg-[#DDE0E5]" />
          <span
            aria-hidden
            className="absolute left-[7px] top-1/2 h-px origin-left -translate-y-1/2 transition-transform duration-[260ms] ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
            style={{ width: "calc(100% - 14px)", transform: `scaleX(${pos / (TRACK.length - 1)})`, background: color }}
          />
          {TRACK.map((s, i) => (
            <button
              key={s}
              onClick={() => move(s)}
              aria-label={`Set stage to ${TRACK_LABEL[s]}`}
              title={TRACK_LABEL[s]}
              className={`relative grid h-6 w-[30px] place-items-center first:w-[14px] first:justify-items-start last:w-[14px] last:justify-items-end ${focusRing} rounded`}
            >
              <span
                className="h-2 w-2 rounded-full border transition-colors duration-200"
                style={{
                  background: !rejected && i <= pos ? color : "#fff",
                  borderColor: !rejected && i <= pos ? color : "#C3C7CE",
                  boxShadow: !rejected && i === pos ? `0 0 0 3px ${color}22` : undefined,
                }}
              />
            </button>
          ))}
        </div>
        <span className="whitespace-nowrap text-[12px] font-medium text-[#2E333B]">{TRACK_LABEL[job.status]}</span>
      </div>
    );
  }

  return (
    <section className="mt-6 flex items-center gap-6 rounded-xl bg-[#F7F8FA] px-5 py-3.5" aria-label="Application stage">
      <div className="relative flex-1">
        <span aria-hidden className="absolute left-[6px] right-[6px] top-[6px] h-[2px] rounded-full bg-[#E1E4E8]" />
        <span
          aria-hidden
          className="absolute left-[6px] top-[6px] h-[2px] origin-left rounded-full transition-transform duration-[260ms] ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
          style={{ width: "calc(100% - 12px)", transform: `scaleX(${pos / (TRACK.length - 1)})`, background: color }}
        />
        <div className="relative flex justify-between">
          {TRACK.map((s, i) => {
            const reached = !rejected && i <= pos;
            const current = !rejected && i === pos;
            return (
              <button
                key={s}
                onClick={() => move(s)}
                aria-pressed={current}
                className={`group flex flex-col items-center gap-1.5 rounded first:items-start last:items-end ${focusRing}`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border-2 bg-white transition-[border-color,background-color,box-shadow] duration-200 group-hover:border-[#9AA0AA]"
                  style={{
                    borderColor: reached ? color : undefined,
                    background: current ? color : "#fff",
                    boxShadow: current ? `0 0 0 4px ${color}26` : undefined,
                  }}
                />
                <span className={`text-[12px] ${current ? "font-semibold text-[#0E1116]" : reached ? "text-[#474D57]" : "text-[#9AA0AA] group-hover:text-[#474D57]"}`}>
                  {TRACK_LABEL[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex w-[150px] shrink-0 flex-col items-end gap-1 border-l border-[#E3E5E9] pl-5 text-right">
        {rejected ? (
          <>
            <span className="rounded-md bg-[#FBEAE7] px-2 py-1 text-[12px] font-medium text-[#A8331F]">Rejected</span>
            <span className="text-[11.5px] text-[#6B717C]">Pick a stage to reopen</span>
          </>
        ) : job.status === "new" ? (
          <span className="text-[12px] text-[#6B717C]">Not tracked yet</span>
        ) : (
          <>
            <button
              onClick={() => move("rejected")}
              className={`proto-press rounded-md px-2 py-1 text-[12px] font-medium text-[#6B717C] hover:bg-[#EEF0F3] hover:text-[#0E1116] ${focusRing}`}
            >
              Mark rejected
            </button>
            <span className="text-[11.5px] text-[#6B717C]">Changed {shortDate(job.updated_at)}</span>
          </>
        )}
      </div>
    </section>
  );
}

// ── Shortlist: saved roles ordered by urgency, advanced in place ─────────────

function urgency(j: ProtoJob): number {
  const { state, days } = deadlineState(j.deadline);
  if (state === "soon" || state === "open") return days ?? 0;
  if (state === "none") return 10_000;
  return 20_000; // closed last
}

function ShortlistView() {
  const { saved, toggleSaved, select, setView, flashId } = useProto();
  const rows = useMemo(() => [...saved].sort((a, b) => urgency(a) - urgency(b) || b.score - a.score), [saved]);
  const soon = saved.filter((j) => j.deadline_state === "soon").length;
  const closed = saved.filter((j) => j.deadline_state === "closed").length;
  const open = (id: number) => { select(id); setView("dashboard"); };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-8 pb-28 pt-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Shortlist</h1>
            <p className="mt-1 text-[13px] text-[#6B717C]">Saved roles, soonest deadline first. Move one along its track to start tracking it.</p>
          </div>
          <p className="text-[12.5px] text-[#6B717C]">
            <span className={`${mono} text-[#0E1116]`}>{saved.length}</span> saved · <span className={soon ? "font-medium text-[#9A5B00]" : ""}>{soon} closing within 14 days</span> · {closed} closed
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#D5D9DF] px-6 py-14 text-center">
            <p className="text-[13.5px] font-medium">Nothing on your shortlist</p>
            <p className="mt-1 text-[12.5px] text-[#6B717C]">Use the bookmark on any role to keep it here.</p>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-[#ECEEF1] overflow-hidden rounded-xl border border-[#E3E5E9] bg-white">
            {rows.map((j) => (
              <li key={j.id} className={`grid grid-cols-[24px_28px_minmax(0,1fr)_170px_230px_72px] items-center gap-4 px-5 py-4 ${j.deadline_state === "closed" ? "bg-[#FBFBFC]" : ""} ${flashId === j.id ? "proto-flash" : ""}`}>
                <SignalBars job={j} />
                <span className={`${mono} text-[15px] font-medium`}>{j.score}</span>
                <button onClick={() => open(j.id)} className={`min-w-0 rounded text-left ${focusRing}`}>
                  <span className="block truncate text-[14px] font-medium hover:underline">{j.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[#474D57]">
                    <Logo company={j.company} size={16} className="rounded-[4px] outline outline-1 -outline-offset-1 outline-black/[0.08]" fallbackClassName="bg-[#E9EBEF] text-[#474D57]" />
                    <span className="truncate">{j.company} · {j.location}</span>
                  </span>
                </button>
                <div>
                  <p className={label}>Deadline</p>
                  <p className={`mt-0.5 text-[13px] font-medium ${j.deadline_state === "closed" ? "text-[#9AA0AA]" : j.deadline_state === "soon" ? "text-[#B36A00]" : ""}`}>{deadlineLabel(j.deadline)}</p>
                </div>
                <StageTrack job={j} compact />
                <div className="flex justify-end gap-1">
                  <a href={j.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${j.title} listing`} title="Open listing" className={`grid h-8 w-8 place-items-center rounded-md text-[#6B717C] hover:bg-[#EEF0F3] hover:text-[#0E1116] ${focusRing}`}>
                    <Icon name="external" size={15} />
                  </a>
                  <button onClick={() => toggleSaved(j.id)} aria-label={`Remove ${j.title} from shortlist`} title="Remove from shortlist" className={`proto-press grid h-8 w-8 place-items-center rounded-md text-[#6B717C] hover:bg-[#EEF0F3] hover:text-[#0E1116] ${focusRing}`}>
                    <Icon name="x" size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Pipeline: tracked applications by stage ──────────────────────────────────

const COLUMNS: Status[] = ["applied", "interview", "offer", "rejected"];

function PipelineView() {
  const { tracked, topUnapplied, setStatus, select, setView, flashId } = useProto();
  const boardRef = useRef<HTMLDivElement>(null);
  const capture = useFlip(boardRef);
  const open = (id: number) => { select(id); setView("dashboard"); };
  const move = (id: number, s: Status) => { capture(); setStatus(id, s); };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-8 pb-28 pt-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Pipeline</h1>
            <p className="mt-1 text-[13px] text-[#6B717C]">Every tracked application, by stage.</p>
          </div>
          <p className="text-[12.5px] text-[#6B717C]"><span className={`${mono} text-[#0E1116]`}>{tracked.length}</span> tracked</p>
        </div>

        <div ref={boardRef} className="mt-5 grid grid-cols-4 gap-3">
          {COLUMNS.map((col) => {
            const items = tracked.filter((j) => j.status === col);
            return (
              <section key={col} className="flex min-h-[220px] flex-col rounded-xl bg-[#EBEDF0]/70 p-2" aria-label={STATUS_LABEL[col]}>
                <header className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[col] }} />
                  <span className="text-[12.5px] font-semibold">{STATUS_LABEL[col]}</span>
                  <span className={`${mono} text-[11px] text-[#9AA0AA]`}>{items.length}</span>
                </header>
                <div className="flex flex-1 flex-col gap-2">
                  {items.length === 0 && (
                    <p className="px-2 pt-1 text-[12px] text-[#6B717C]">No applications at this stage</p>
                  )}
                  {items.map((j) => {
                    const i = COLUMNS.indexOf(col);
                    const prev = col === "rejected" ? "applied" : COLUMNS[i - 1];
                    const next = col === "rejected" || col === "offer" ? null : COLUMNS[i + 1];
                    return (
                      <article key={j.id} data-flip={j.id} className={`rounded-lg border border-[#E3E5E9] bg-white p-3 shadow-[0_1px_2px_rgb(14_17_22/0.04)] ${flashId === j.id ? "proto-flash" : ""}`}>
                        <div className="flex items-center gap-2">
                          <Logo company={j.company} size={18} className="rounded-[4px] outline outline-1 -outline-offset-1 outline-black/[0.08]" fallbackClassName="bg-[#E9EBEF] text-[#474D57]" />
                          <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#474D57]">{j.company}</span>
                          <SignalBars job={j} height={12} />
                        </div>
                        <button onClick={() => open(j.id)} className={`mt-2 line-clamp-2 rounded text-left text-[13.5px] font-medium leading-[1.35] hover:underline ${focusRing}`}>{j.title}</button>
                        <p className="mt-2 text-[12px] text-[#6B717C]">Changed {shortDate(j.updated_at)} · fit <span className={`${mono} text-[#0E1116]`}>{j.score}</span></p>
                        <div className="mt-3 flex items-center gap-1 border-t border-[#F0F1F3] pt-2.5">
                          {prev && (
                            <button onClick={() => move(j.id, prev)} className={`proto-press flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] text-[#6B717C] hover:bg-[#F3F4F6] hover:text-[#0E1116] ${focusRing}`}>
                              <Icon name="arrowLeft" size={12} stroke={2} />{STATUS_LABEL[prev]}
                            </button>
                          )}
                          <span className="flex-1" />
                          {next && (
                            <button onClick={() => move(j.id, next)} className={`proto-press flex h-7 items-center gap-1 rounded-md bg-[#0E1116] px-2 text-[12px] font-medium text-white hover:bg-[#262A31] ${focusRing}`}>
                              {STATUS_LABEL[next]}<Icon name="chevronRight" size={12} stroke={2} />
                            </button>
                          )}
                          <CardMenu job={j} onMove={(s) => move(j.id, s)} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">On your radar</h2>
            <p className="text-[12px] text-[#6B717C]">Highest fit, not applied, still open or undated</p>
          </div>
          <ul className="mt-3 divide-y divide-[#ECEEF1] overflow-hidden rounded-xl border border-[#E3E5E9] bg-white">
            {topUnapplied.map((j) => (
              <li key={j.id} className="flex items-center gap-4 px-4 py-3">
                <SignalBars job={j} />
                <button onClick={() => open(j.id)} className={`min-w-0 flex-1 rounded text-left ${focusRing}`}>
                  <span className="block truncate text-[13.5px] font-medium hover:underline">{j.title}</span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-[#6B717C]">{j.company} · {deadlineLabel(j.deadline)}</span>
                </button>
                <span className={`${mono} text-[14px] font-medium`}>{j.score}</span>
                <button onClick={() => move(j.id, "applied")} className={`proto-press h-7 rounded-md border border-[#E3E5E9] px-2 text-[12px] font-medium text-[#474D57] hover:bg-[#F7F8FA] hover:text-[#0E1116] ${focusRing}`}>
                  Mark applied
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function CardMenu({ job, onMove }: { job: ProtoJob; onMove: (s: Status) => void }) {
  return (
    <Popover
      label="Card actions"
      kind="menu"
      align="end"
      panelClassName="w-[200px] rounded-[10px] border border-[#E3E5E9] bg-white p-1 shadow-[0_16px_40px_rgb(14_17_22/0.14)]"
      trigger={(p) => (
        <button {...p} aria-label="More actions" className={`grid h-7 w-7 place-items-center rounded-md text-[#9AA0AA] hover:bg-[#F3F4F6] hover:text-[#0E1116] ${focusRing}`}>
          <Icon name="ellipsis" size={16} stroke={2} />
        </button>
      )}
    >
      {(close) => (
        <div onKeyDown={menuKeys}>
          {COLUMNS.map((s) => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={job.status === s}
              onClick={() => { close(); onMove(s); }}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none hover:bg-[#F3F4F6] focus-visible:bg-[#F3F4F6]"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
              <span className="flex-1">{STATUS_LABEL[s]}</span>
              {job.status === s && <Icon name="check" size={14} stroke={2} className="text-[#2452D6]" />}
            </button>
          ))}
          <div className="my-1 h-px bg-[#ECEEF1]" />
          <a href={job.url} target="_blank" rel="noopener noreferrer" role="menuitem" className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] outline-none hover:bg-[#F3F4F6] focus-visible:bg-[#F3F4F6]">
            Open listing <Icon name="external" size={13} className="ml-auto text-[#9AA0AA]" />
          </a>
          <button
            role="menuitem"
            onClick={() => { close(); onMove("new"); }}
            className="flex h-8 w-full items-center rounded-md px-2 text-left text-[13px] text-[#6B717C] outline-none hover:bg-[#F3F4F6] hover:text-[#0E1116] focus-visible:bg-[#F3F4F6]"
          >
            Remove from tracking
          </button>
        </div>
      )}
    </Popover>
  );
}
