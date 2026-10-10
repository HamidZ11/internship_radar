import { ReactNode, useMemo, useRef, useState } from "react";
import {
  ProtoJob, ROLE_GROUP_LABEL, RoleGroup, roleLabel, sourceLabel, isManual, Status, STATUS_LABEL,
} from "../data";
import { deadlineLabel, formatDescription, relativeAge, shortDate } from "../extract";
import { Factor } from "../scoring";
import { EMPTY_FILTERS, pickSelected, ProtoFilters, useProto, View } from "../store";
import { BookmarkSwap, Icon, Logo, menuKeys, Popover, Toaster, useListKeys } from "../primitives";

// Direction A — Refined product.
// Same IA as today, made quieter and more precise: separators over cards,
// one accent, a composed detail page, and an explainable score.

const STATUS_DOT: Record<Status, string> = {
  new: "bg-[#B4B8C0]",
  applied: "bg-[#C47A12]",
  interview: "bg-[#6D4BC4]",
  offer: "bg-[#1A8A5F]",
  rejected: "bg-[#C2412D]",
};

const ROLE_GROUPS: RoleGroup[] = ["placement", "internship", "graduate", "apprenticeship"];

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[#0A47B8]/40 focus-visible:ring-offset-1";

export default function Refined() {
  const { view, setView, saved, tracked, toast } = useProto();

  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "saved", label: "Saved", count: saved.length },
    { id: "applied", label: "Applied", count: tracked.length },
  ];

  return (
    <div className="font-refined flex h-screen flex-col bg-[#F7F7F8] text-[13px] text-[#15171C]">
      <header className="flex h-12 shrink-0 items-stretch border-b border-[#E8E9EC] bg-white px-5">
        <div className="mr-8 flex items-center gap-2">
          <RadarMark />
          <span className="text-[14px] font-semibold tracking-[-0.01em]">Internship Radar</span>
        </div>
        <nav className="flex items-stretch gap-1" aria-label="Main">
          {tabs.map((t) => {
            const active = t.id === view;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-1.5 px-2.5 text-[13px] font-medium transition-colors duration-150 ${focusRing} ${
                  active ? "text-[#15171C]" : "text-[#6E737E] hover:text-[#15171C]"
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={`tabular-nums text-[12px] ${active ? "text-[#6E737E]" : "text-[#9A9EA7]"}`}>{t.count}</span>
                )}
                {active && <span className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full bg-[#15171C]" />}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => toast("Manual entry uses the existing Add Job form (unchanged in this pass)")}
            className={`proto-press flex h-7 items-center gap-1.5 rounded-md border border-[#E2E4E8] bg-white px-2.5 text-[13px] font-medium text-[#2B2F37] hover:bg-[#F7F7F8] ${focusRing}`}
          >
            <Icon name="plus" size={14} stroke={2} />
            Add job
          </button>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#EDEEF1] text-[11px] font-semibold text-[#4A4F5A]">H</span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        {view === "dashboard" && <DashboardView />}
        {view === "saved" && <SavedView />}
        {view === "applied" && <AppliedView />}
      </main>

      <Toaster
        className="bottom-6 right-6 w-[340px]"
        toastClassName="rounded-lg bg-[#15171C] px-3.5 py-2.5 text-[13px] text-white shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
        actionClassName="proto-press rounded px-1.5 py-0.5 text-[13px] font-medium text-[#9EC0FF] hover:text-white"
      />
    </div>
  );
}

function RadarMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle cx="4" cy="14" r="1.75" fill="#0A47B8" />
      <path d="M4 8.5a5.5 5.5 0 0 1 5.5 5.5" fill="none" stroke="#0A47B8" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 3.5A10.5 10.5 0 0 1 14.5 14" fill="none" stroke="#0A47B8" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView() {
  const { filtered, selectedId, filters, setFilters, activeFilterCount } = useProto();
  const selected = pickSelected(filtered, selectedId);

  return (
    <>
      <aside className="hidden w-[232px] shrink-0 overflow-y-auto border-r border-[#E8E9EC] xl:block">
        <FilterPanel />
      </aside>

      <section className="flex w-[380px] shrink-0 flex-col border-r border-[#E8E9EC] bg-white 2xl:w-[400px]">
        <div className="shrink-0 border-b border-[#EEEFF2] px-4 pb-2.5 pt-3">
          <div className="flex gap-2">
            <SearchInput value={filters.search} onChange={(search) => setFilters({ ...filters, search })} />
            <div className="xl:hidden">
              <Popover
                label="Filters"
                align="start"
                panelClassName="w-[260px] max-h-[70vh] overflow-y-auto rounded-[10px] border border-[#E2E4E8] bg-[#F7F7F8] shadow-[0_12px_32px_rgb(0_0_0/0.12)]"
                trigger={(p) => (
                  <button {...p} className={`proto-press flex h-8 items-center gap-1.5 rounded-md border border-[#E2E4E8] bg-white px-2.5 text-[13px] font-medium text-[#2B2F37] hover:bg-[#F7F7F8] ${focusRing}`}>
                    <Icon name="sliders" size={14} />
                    Filters
                    {activeFilterCount > 0 && <span className="tabular-nums text-[#0A47B8]">{activeFilterCount}</span>}
                  </button>
                )}
              >
                {() => <FilterPanel />}
              </Popover>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[12px] text-[#6E737E]">
            <span><span className="tabular-nums font-medium text-[#2B2F37]">{filtered.length}</span> roles</span>
            <span>Sorted by fit</span>
          </div>
        </div>
        <JobList jobs={filtered} empty={<EmptyList onClear={() => setFilters(EMPTY_FILTERS)} />} />
      </section>

      <Detail job={selected} />
    </>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative block flex-1">
      <span className="sr-only">Search roles</span>
      <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9A9EA7]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search roles, companies, keywords"
        className="h-8 w-full rounded-md border border-[#E2E4E8] bg-[#FAFAFB] pl-8 pr-2.5 text-[13px] text-[#15171C] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[#9A9EA7] hover:border-[#D3D6DB] focus:border-[#0A47B8]/50 focus:bg-white focus:shadow-[0_0_0_3px_rgb(10_71_184/0.10)]"
      />
    </label>
  );
}

function FilterPanel() {
  const { jobs, filters, setFilters, activeFilterCount } = useProto();
  const set = (f: Partial<ProtoFilters>) => setFilters({ ...filters, ...f });
  const count = (pred: (j: ProtoJob) => boolean) => jobs.filter(pred).length;
  const sources = [...new Set(jobs.map((j) => j.source))];
  const deadlineCount = (days: number) =>
    count((j) => j.deadline !== null && j.deadline_state !== "closed" && j.deadline_state !== "none" &&
      (new Date(j.deadline).getTime() - Date.now()) / 86_400_000 <= days);

  return (
    <div className="px-4 pb-6 pt-3 text-[13px]">
      <div className="flex h-7 items-center justify-between">
        <span className="font-semibold text-[#15171C]">Filters</span>
        {activeFilterCount > 0 && (
          <button onClick={() => setFilters({ ...EMPTY_FILTERS, search: filters.search })} className={`rounded px-1 text-[12px] font-medium text-[#0A47B8] hover:underline ${focusRing}`}>
            Clear all
          </button>
        )}
      </div>

      <FilterGroup label="Role type">
        {ROLE_GROUPS.map((g) => {
          const checked = filters.roles.includes(g);
          return (
            <OptionRow
              key={g}
              kind="checkbox"
              checked={checked}
              label={ROLE_GROUP_LABEL[g]}
              count={count((j) => j.role_group === g)}
              onChange={() => set({ roles: checked ? filters.roles.filter((r) => r !== g) : [...filters.roles, g] })}
            />
          );
        })}
      </FilterGroup>

      <FilterGroup label="Location">
        <input
          value={filters.location}
          onChange={(e) => set({ location: e.target.value })}
          placeholder="Any location"
          className="h-8 w-full rounded-md border border-[#E2E4E8] bg-white px-2.5 text-[13px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#9A9EA7] hover:border-[#D3D6DB] focus:border-[#0A47B8]/50 focus:shadow-[0_0_0_3px_rgb(10_71_184/0.10)]"
        />
      </FilterGroup>

      <FilterGroup label="Fit score">
        <div className="grid grid-cols-4 rounded-md border border-[#E2E4E8] bg-white p-0.5" role="radiogroup" aria-label="Minimum fit score">
          {[0, 20, 40, 60].map((n) => {
            const on = filters.minScore === n;
            return (
              <button
                key={n}
                role="radio"
                aria-checked={on}
                onClick={() => set({ minScore: n })}
                className={`h-6 rounded-[5px] text-[12px] font-medium tabular-nums transition-colors duration-150 ${focusRing} ${
                  on ? "bg-[#15171C] text-white" : "text-[#4A4F5A] hover:bg-[#F2F3F5]"
                }`}
              >
                {n === 0 ? "Any" : `${n}+`}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup label="Deadline">
        {([["", "Any deadline", jobs.length], ["7", "Within 7 days", deadlineCount(7)], ["14", "Within 14 days", deadlineCount(14)], ["30", "Within 30 days", deadlineCount(30)], ["none", "No deadline listed", count((j) => !j.deadline)]] as const).map(([v, l, c]) => (
          <OptionRow key={v} kind="radio" checked={filters.deadline === v} label={l} count={c} onChange={() => set({ deadline: v })} />
        ))}
      </FilterGroup>

      <FilterGroup label="Status">
        {(["", "new", "applied", "interview", "offer", "rejected"] as const).map((s) => (
          <OptionRow
            key={s}
            kind="radio"
            checked={filters.status === s}
            label={s ? STATUS_LABEL[s] : "Any status"}
            count={s ? count((j) => j.status === s) : jobs.length}
            onChange={() => set({ status: s })}
          />
        ))}
      </FilterGroup>

      {sources.length > 1 ? (
        <FilterGroup label="Source">
          <OptionRow kind="radio" checked={!filters.source} label="All sources" count={jobs.length} onChange={() => set({ source: "" })} />
          {sources.map((s) => (
            <OptionRow key={s} kind="radio" checked={filters.source === s} label={sourceLabel(s)} count={count((j) => j.source === s)} onChange={() => set({ source: s })} />
          ))}
        </FilterGroup>
      ) : (
        <p className="mt-5 text-[12px] leading-[1.5] text-[#6E737E]">All roles come from {sourceLabel(sources[0] ?? "")}. Source filtering appears once a second source is added.</p>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="mt-5">
      <legend className="mb-1.5 text-[12px] font-medium text-[#5F6470]">{label}</legend>
      <div className="flex flex-col">{children}</div>
    </fieldset>
  );
}

function OptionRow({
  kind, checked, label, count, onChange,
}: { kind: "checkbox" | "radio"; checked: boolean; label: string; count: number; onChange: () => void }) {
  return (
    <label className={`group -mx-1.5 flex h-7 cursor-pointer items-center gap-2 rounded-md px-1.5 hover:bg-black/[0.035] ${count === 0 && !checked ? "opacity-55" : ""}`}>
      <input type={kind} checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden
        className={`grid h-3.5 w-3.5 shrink-0 place-items-center border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[#0A47B8]/40 ${
          kind === "radio" ? "rounded-full" : "rounded-[4px]"
        } ${checked ? "border-[#0A47B8] bg-[#0A47B8]" : "border-[#C9CCD2] bg-white group-hover:border-[#9A9EA7]"}`}
      >
        {checked && (kind === "radio"
          ? <span className="h-1.5 w-1.5 rounded-full bg-white" />
          : <Icon name="check" size={10} stroke={3} className="text-white" />)}
      </span>
      <span className={`flex-1 truncate ${checked ? "font-medium text-[#15171C]" : "text-[#3A3F49]"}`}>{label}</span>
      <span className="tabular-nums text-[12px] text-[#6E737E]">{count}</span>
    </label>
  );
}

function EmptyList({ onClear }: { onClear: () => void }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[13px] font-medium text-[#15171C]">No roles match these filters</p>
      <p className="mt-1 text-[13px] text-[#6E737E]">Every listed deadline in the current data has passed, so deadline windows return nothing.</p>
      <button onClick={onClear} className={`mt-3 rounded px-1 text-[13px] font-medium text-[#0A47B8] hover:underline ${focusRing}`}>Clear filters</button>
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

function JobList({ jobs, empty, grouped }: {
  jobs: ProtoJob[];
  empty: ReactNode;
  grouped?: { label: string; jobs: ProtoJob[] }[];
}) {
  const { selectedId, select } = useProto();
  const listRef = useRef<HTMLDivElement>(null);
  const selected = pickSelected(jobs, selectedId);
  const order = grouped ? grouped.flatMap((g) => g.jobs) : jobs;
  const onKeyDown = useListKeys(listRef, order.map((j) => j.id), selected?.id ?? null, select);

  if (jobs.length === 0) return <div className="flex-1 overflow-y-auto">{empty}</div>;

  const rows = (list: ProtoJob[]) => list.map((j) => <JobRow key={j.id} job={j} active={j.id === selected?.id} />);

  return (
    <div ref={listRef} onKeyDown={onKeyDown} className="flex-1 overflow-y-auto" role="list">
      {grouped
        ? grouped.map((g) => (
            <div key={g.label} role="presentation">
              <div className="sticky top-0 z-10 flex h-8 items-center gap-1.5 border-b border-[#EEEFF2] bg-white/95 px-4 text-[12px] font-medium text-[#6E737E] backdrop-blur-sm">
                {g.label}<span className="tabular-nums text-[#9A9EA7]">{g.jobs.length}</span>
              </div>
              {rows(g.jobs)}
            </div>
          ))
        : rows(jobs)}
    </div>
  );
}

function JobRow({ job, active }: { job: ProtoJob; active: boolean }) {
  const { select, flashId, toggleSaved, setStatus, view } = useProto();
  const dl = deadlineLabel(job.deadline);

  return (
    <div role="listitem" className={`group relative border-b border-[#F0F1F3] ${flashId === job.id ? "proto-flash" : ""}`}>
      <button
        data-row={job.id}
        onClick={() => select(job.id)}
        aria-current={active ? "true" : undefined}
        className={`flex w-full gap-3 px-4 py-3 text-left transition-colors duration-100 outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(10_71_184/0.45)] ${
          active ? "bg-[#F2F5FC]" : "hover:bg-[#FAFAFB]"
        }`}
      >
        {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-[#0A47B8]" />}
        <Logo company={job.company} size={32} className="rounded-[6px] outline outline-1 -outline-offset-1 outline-black/[0.08]" fallbackClassName="bg-[#F1F2F4] text-[#5B616E]" />
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-3">
            <span className="line-clamp-2 min-w-0 flex-1 text-[14px] font-medium leading-5 text-[#15171C]">{job.title}</span>
            <span className="tabular-nums text-[14px] font-semibold leading-5 text-[#15171C]">{job.score}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-[#4A4F5A]">{job.company} · {job.location}</span>
          {view === "saved" ? (
            <span className={`mt-1 block text-[12px] leading-4 ${nextStep(job).tone}`}>{nextStep(job).text}</span>
          ) : (
          <span className="mt-1 flex items-center gap-1.5 text-[12px] leading-4 text-[#6E737E]">
            <span>{roleLabel(job.role_type)}</span>
            <span aria-hidden>·</span>
            <span className={job.deadline_state === "soon" ? "font-medium text-[#B45309]" : ""}>{dl}</span>
            {job.status !== "new" && (
              <>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-1 text-[#3A3F49]"><span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[job.status]}`} />{STATUS_LABEL[job.status]}</span>
              </>
            )}
            {job.is_saved && <Icon name="bookmark" size={12} filled className="ml-auto text-[#0A47B8]" />}
          </span>
          )}
        </span>
      </button>
      {view === "saved" && (
        <div className={`flex items-center gap-1.5 pb-3 pl-[60px] pr-4 ${active ? "bg-[#F2F5FC]" : ""}`}>
          {job.status === "new" && job.deadline_state !== "closed" && (
            <button
              onClick={() => setStatus(job.id, "applied")}
              className={`proto-press h-7 rounded-md border border-[#E2E4E8] bg-white px-2.5 text-[12px] font-medium text-[#2B2F37] hover:bg-[#F7F7F8] ${focusRing}`}
            >
              Mark as applied
            </button>
          )}
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-[#4A4F5A] hover:bg-black/[0.05] hover:text-[#15171C] ${focusRing}`}
          >
            Listing <Icon name="external" size={12} />
          </a>
          <button
            onClick={() => toggleSaved(job.id)}
            className={`proto-press ml-auto h-7 rounded-md px-2 text-[12px] font-medium text-[#6E737E] hover:bg-black/[0.05] hover:text-[#15171C] ${focusRing}`}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function nextStep(job: ProtoJob): { text: string; tone: string } {
  const since = `since ${shortDate(job.updated_at)}`;
  if (job.status === "offer") return { text: `Offer received · ${since}`, tone: "font-medium text-[#1A8A5F]" };
  if (job.status === "interview") return { text: `Interviewing · ${since}`, tone: "text-[#3A3F49]" };
  if (job.status === "applied") return { text: `Applied · no update ${since}`, tone: "text-[#3A3F49]" };
  if (job.status === "rejected") return { text: "Rejected", tone: "text-[#6E737E]" };
  if (job.deadline_state === "closed" && job.deadline) return { text: `Deadline passed ${shortDate(job.deadline)}`, tone: "text-[#6E737E]" };
  if (job.deadline_state === "soon") return { text: `Apply soon · ${deadlineLabel(job.deadline).toLowerCase()}`, tone: "font-medium text-[#B45309]" };
  if (job.deadline_state === "open" && job.deadline) return { text: `Apply by ${shortDate(job.deadline, true)}`, tone: "text-[#3A3F49]" };
  return { text: "Apply · no deadline listed", tone: "text-[#3A3F49]" };
}

// ── Detail ───────────────────────────────────────────────────────────────────

function Detail({ job }: { job: ProtoJob | null }) {
  const [explainOpen, setExplainOpen] = useState(false);
  const [fullDesc, setFullDesc] = useState(false);
  const { toggleSaved, setStatus } = useProto();

  if (!job) {
    return (
      <section className="grid flex-1 place-items-center bg-white text-center">
        <div>
          <p className="text-[13px] font-medium">No role selected</p>
          <p className="mt-1 text-[13px] text-[#6E737E]">Choose a role from the list to see its details.</p>
        </div>
      </section>
    );
  }

  const blocks = formatDescription(job.description, job.title);

  return (
    <section className="min-w-0 flex-1 overflow-y-auto bg-white" aria-label="Role details">
      <article className="max-w-[820px] px-6 pb-24 pt-8 xl:px-10">
        <header className="flex gap-4">
          <Logo company={job.company} size={44} className="rounded-[10px] outline outline-1 -outline-offset-1 outline-black/[0.08]" fallbackClassName="bg-[#F1F2F4] text-[#5B616E]" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#4A4F5A]">{job.company}</p>
            <h1 className="mt-0.5 text-[22px] font-semibold leading-[1.25] tracking-[-0.015em] text-[#15171C] [text-wrap:balance]">{job.title}</h1>
            <p className="mt-1.5 text-[13px] text-[#6E737E]">{job.location} · {roleLabel(job.role_type)}</p>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`proto-press flex h-8 items-center gap-1.5 rounded-md bg-[#0A47B8] px-3 text-[13px] font-medium text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_1px_2px_rgb(10_71_184/0.3)] hover:bg-[#083C9C] ${focusRing}`}
          >
            Open listing
            <Icon name="external" size={14} stroke={2} />
          </a>
          {job.status === "new" ? (
            <button
              onClick={() => setStatus(job.id, "applied")}
              className={`proto-press h-8 rounded-md border border-[#E2E4E8] bg-white px-3 text-[13px] font-medium text-[#2B2F37] hover:bg-[#F7F7F8] ${focusRing}`}
            >
              Mark as applied
            </button>
          ) : (
            <StatusMenu job={job} />
          )}
          <button
            onClick={() => toggleSaved(job.id)}
            aria-pressed={job.is_saved}
            className={`proto-press flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium ${focusRing} ${
              job.is_saved ? "border-[#C9D8F5] bg-[#EEF3FC] text-[#0A47B8]" : "border-[#E2E4E8] bg-white text-[#2B2F37] hover:bg-[#F7F7F8]"
            }`}
          >
            <BookmarkSwap on={job.is_saved} size={14} />
            {job.is_saved ? "Saved" : "Save"}
          </button>
          {job.status !== "new" && <span className="ml-1 text-[12px] text-[#6E737E]">Last change {shortDate(job.updated_at)}</span>}
        </div>

        {/* One composed strip instead of four cards */}
        <div className="mt-7 border-y border-[#E8E9EC]">
          <dl className="grid grid-cols-3 divide-x divide-[#EEEFF2]">
            <div className="py-3 pr-4">
              <dt className="text-[12px] text-[#6E737E]">Fit score</dt>
              <dd className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-[18px] font-semibold tabular-nums tracking-[-0.01em]">{job.score}</span>
                <span className="text-[12px] text-[#9A9EA7]">/ 100</span>
              </dd>
            </div>
            <StripCell
              label="Deadline"
              value={deadlineLabel(job.deadline)}
              sub={job.deadline_state === "closed" || !job.deadline ? undefined : shortDate(job.deadline, true)}
            />
            <StripCell
              label="Source"
              value={sourceLabel(job.source)}
              sub={`${isManual(job.source) ? "Added manually" : "Collected"} ${relativeAge(job.created_at)}`}
            />
          </dl>
          <button
            onClick={() => setExplainOpen((o) => !o)}
            aria-expanded={explainOpen}
            aria-controls="refined-explain"
            className={`flex h-9 w-full items-center gap-1.5 border-t border-[#EEEFF2] px-0 text-left text-[13px] transition-colors duration-150 hover:bg-[#FAFAFB] ${focusRing} ${explainOpen ? "bg-[#FAFAFB]" : ""}`}
          >
            <span className="font-medium text-[#0A47B8]">Why {job.score}?</span>
            <span className="text-[#6E737E]">
              {job.breakdown.gains.filter((f) => f.points > 0).length} of 5 rules matched
              {job.breakdown.penalties.length > 0 && `, ${job.breakdown.penalties.length} penalt${job.breakdown.penalties.length === 1 ? "y" : "ies"}`}
            </span>
            <Icon name="chevronDown" size={13} stroke={2} className={`ml-auto text-[#9A9EA7] transition-transform duration-200 ${explainOpen ? "rotate-180" : ""}`} />
          </button>
          {explainOpen && <ScoreExplanation job={job} />}
        </div>

        <section className="mt-9">
          <SectionHeading title="At a glance" note="Matched in the listing text" />
          {job.facts.length > 0 ? (
            <dl className="mt-3 grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
              {job.facts.map((f) => (
                <div key={f.label} className="flex items-baseline gap-4 border-b border-[#F0F1F3] pb-2.5" title={f.excerpt}>
                  <dt className="w-[110px] shrink-0 text-[13px] text-[#6E737E]">{f.label}</dt>
                  <dd className="text-[14px] text-[#15171C]">{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-[13px] text-[#6E737E]">No dates, eligibility or salary details were found in this listing.</p>
          )}
        </section>

        <section className="mt-9">
          <SectionHeading title="Description" />
          <div className={`relative mt-3 ${fullDesc ? "" : "max-h-[340px] overflow-hidden"}`}>
            <div className="max-w-[68ch] space-y-3 text-[14px] leading-[1.65] text-[#3A3F49]">
              {blocks.map((b, i) => (
                <div key={i}>
                  {b.heading && <h3 className="mb-1 mt-5 text-[13px] font-semibold text-[#15171C] first:mt-0">{b.heading}</h3>}
                  {b.paragraphs.map((para, k) => <p key={k} className="mt-3 first:mt-0">{para}</p>)}
                </div>
              ))}
            </div>
            {!fullDesc && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-white/0" />}
          </div>
          <button
            onClick={() => setFullDesc((v) => !v)}
            className={`mt-2 rounded px-1 text-[13px] font-medium text-[#0A47B8] hover:underline ${focusRing}`}
          >
            {fullDesc ? "Show less" : "Show full description"}
          </button>
        </section>
      </article>
    </section>
  );
}

function StripCell({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[12px] text-[#6E737E]">{label}</dt>
      <dd className="mt-1 text-[14px] font-medium leading-6 text-[#15171C]">{value}</dd>
      {sub && <dd className="text-[12px] text-[#6E737E]">{sub}</dd>}
    </div>
  );
}

function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#15171C]">{title}</h2>
      {note && <span className="text-[12px] text-[#9A9EA7]">{note}</span>}
    </div>
  );
}

function ScoreExplanation({ job }: { job: ProtoJob }) {
  const { gains, penalties, raw, score } = job.breakdown;
  return (
    <div id="refined-explain" className="proto-reveal border-t border-[#EEEFF2] pb-4 pt-1">
      <ul className="divide-y divide-[#EEEFF2]">
        {[...gains, ...penalties].map((f) => <FactorRow key={f.key} f={f} />)}
      </ul>
      <div className="mt-1 flex items-baseline justify-between border-t border-[#DCDEE2] pt-2.5">
        <span className="text-[13px] text-[#6E737E]">
          {raw !== score ? `Raw total ${raw}, clamped to 0–100` : "Total"}
        </span>
        <span className="text-[14px] font-semibold tabular-nums">{score}</span>
      </div>
      <p className="mt-2 text-[12px] leading-[1.5] text-[#6E737E]">
        These are all the rules the scorer uses. Keywords match anywhere in the text, including inside longer words.
      </p>
    </div>
  );
}

function FactorRow({ f }: { f: Factor }) {
  const earned = f.points !== 0;
  const pct = f.penalty ? 100 : (f.points / f.max) * 100;
  return (
    <li className="grid grid-cols-[1fr_64px_44px] items-center gap-4 py-2">
      <div className="min-w-0">
        <p className={`text-[13px] font-medium ${earned ? "text-[#15171C]" : "text-[#6E737E]"}`}>{f.label}</p>
        <p className="text-[12px] leading-[1.45] text-[#6E737E]">
          {f.evidence.length > 0
            ? f.evidence.map((e, i) => (
                <span key={e.term}>
                  {i > 0 && ", "}
                  <span className="text-[#2B2F37]">{e.term}</span>
                  {e.word !== e.term && <span> in “{e.word}”</span>}
                </span>
              ))
            : f.rule}
        </p>
      </div>
      <span aria-hidden className="h-[3px] overflow-hidden rounded-full bg-[#E8E9EC]">
        <span className={`block h-full rounded-full ${f.penalty ? "bg-[#C2412D]" : "bg-[#0A47B8]"}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={`text-right text-[13px] font-medium tabular-nums ${f.penalty ? "text-[#B42318]" : earned ? "text-[#15171C]" : "text-[#9A9EA7]"}`}>
        {f.points > 0 ? `+${f.points}` : f.points === 0 ? "0" : `−${Math.abs(f.points)}`}
        {!f.penalty && <span className="text-[11px] font-normal text-[#9A9EA7]">/{f.max}</span>}
      </span>
    </li>
  );
}

function StatusMenu({ job, compact = false, moveLabel = false }: { job: ProtoJob; compact?: boolean; moveLabel?: boolean }) {
  const { setStatus } = useProto();
  const options: Status[] = ["applied", "interview", "offer", "rejected"];
  return (
    <Popover
      label="Change status"
      kind="menu"
      align={compact ? "end" : "start"}
      panelClassName="w-[200px] rounded-[10px] border border-[#E2E4E8] bg-white p-1 shadow-[0_12px_32px_rgb(0_0_0/0.12)]"
      trigger={(p) => (
        <button
          {...p}
          className={`proto-press flex items-center gap-1.5 rounded-md border border-[#E2E4E8] bg-white text-[13px] font-medium text-[#2B2F37] hover:bg-[#F7F7F8] ${compact ? "h-7 px-2" : "h-8 px-3"} ${focusRing}`}
        >
          {moveLabel ? "Move to" : (
            <>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[job.status]}`} />
              {STATUS_LABEL[job.status]}
            </>
          )}
          <Icon name="chevronDown" size={12} stroke={2} className="text-[#9A9EA7]" />
        </button>
      )}
    >
      {(close) => (
        <div onKeyDown={menuKeys}>
          {options.map((s) => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={job.status === s}
              onClick={() => { setStatus(job.id, s); close(); }}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-[#2B2F37] outline-none hover:bg-[#F4F5F7] focus-visible:bg-[#F4F5F7]"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s]}`} />
              <span className="flex-1">{STATUS_LABEL[s]}</span>
              {job.status === s && <Icon name="check" size={14} stroke={2} className="text-[#0A47B8]" />}
            </button>
          ))}
          <div className="my-1 h-px bg-[#EEEFF2]" />
          <button
            role="menuitem"
            onClick={() => { setStatus(job.id, "new"); close(); }}
            className="flex h-8 w-full items-center rounded-md px-2 text-left text-[13px] text-[#6E737E] outline-none hover:bg-[#F4F5F7] hover:text-[#15171C] focus-visible:bg-[#F4F5F7]"
          >
            Remove from tracking
          </button>
        </div>
      )}
    </Popover>
  );
}

// ── Saved: a shortlist grouped by what to do next ────────────────────────────

function SavedView() {
  const { saved, selectedId, setView } = useProto();
  const groups = useMemo(() => {
    const toApply = saved.filter((j) => j.status === "new" && j.deadline_state !== "closed");
    const inProgress = saved.filter((j) => ["applied", "interview", "offer"].includes(j.status));
    const closed = saved.filter((j) => j.status === "rejected" || (j.status === "new" && j.deadline_state === "closed"));
    return [
      { label: "To apply", jobs: toApply },
      { label: "In progress", jobs: inProgress },
      { label: "Closed", jobs: closed },
    ].filter((g) => g.jobs.length > 0);
  }, [saved]);
  const ordered = groups.flatMap((g) => g.jobs);
  const selected = pickSelected(ordered, selectedId);

  return (
    <>
      <section className="flex w-[400px] shrink-0 flex-col border-r border-[#E8E9EC] bg-white">
        <div className="shrink-0 border-b border-[#EEEFF2] px-4 pb-3 pt-4">
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Saved</h1>
          <p className="mt-0.5 text-[13px] text-[#6E737E]">
            <span className="tabular-nums">{saved.length}</span> roles, grouped by what to do next
          </p>
        </div>
        <JobList
          jobs={ordered}
          grouped={groups}
          empty={
            <div className="px-6 py-14 text-center">
              <p className="text-[13px] font-medium">Nothing saved yet</p>
              <p className="mt-1 text-[13px] text-[#6E737E]">Save roles from the dashboard to build a shortlist.</p>
              <button onClick={() => setView("dashboard")} className={`mt-3 rounded px-1 text-[13px] font-medium text-[#0A47B8] hover:underline ${focusRing}`}>Browse roles</button>
            </div>
          }
        />
      </section>
      <Detail job={selected} />
    </>
  );
}

// ── Applied: the application list is the page ───────────────────────────────

const STAGE_ORDER: Status[] = ["offer", "interview", "applied", "rejected"];

function AppliedView() {
  const { tracked, topUnapplied, select, setView, flashId } = useProto();
  const counts = STAGE_ORDER.map((s) => [s, tracked.filter((j) => j.status === s).length] as const);

  const open = (id: number) => { select(id); setView("dashboard"); };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-6 pb-24 pt-8 xl:px-8">
        <header className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <h1 className="text-[20px] font-semibold tracking-[-0.015em]">Applied</h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#4A4F5A]">
            <span><span className="font-medium tabular-nums text-[#15171C]">{tracked.length}</span> tracked</span>
            {counts.map(([s, n]) => (
              <span key={s} className={`flex items-center gap-1.5 ${n === 0 ? "text-[#9A9EA7]" : ""}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s]} ${n === 0 ? "opacity-40" : ""}`} />
                <span className="tabular-nums">{n}</span> {STATUS_LABEL[s].toLowerCase()}
              </span>
            ))}
          </p>
        </header>

        <div className="mt-5 overflow-hidden rounded-[10px] border border-[#E8E9EC] bg-white">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_140px_44px_110px_32px] items-center gap-4 border-b border-[#EEEFF2] px-4 py-2 text-[12px] text-[#6E737E]">
            <span>Role</span><span>Last change</span><span>Deadline</span><span className="text-right">Fit</span><span /><span />
          </div>
          {tracked.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-[13px] font-medium">No applications tracked yet</p>
              <p className="mt-1 text-[13px] text-[#6E737E]">Use “Mark as applied” on a role to start tracking it here.</p>
            </div>
          )}
          {STAGE_ORDER.map((stage) => {
            const rows = tracked.filter((j) => j.status === stage);
            if (rows.length === 0) return null;
            return (
              <div key={stage}>
                <div className="flex h-8 items-center gap-1.5 border-b border-[#EEEFF2] bg-[#FAFAFB] px-4 text-[12px] font-medium text-[#4A4F5A]">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[stage]}`} />
                  {STATUS_LABEL[stage]}
                  <span className="tabular-nums text-[#9A9EA7]">{rows.length}</span>
                </div>
                {rows.map((j) => (
                  <div
                    key={j.id}
                    className={`grid grid-cols-[minmax(0,1fr)_110px_140px_44px_110px_32px] items-center gap-4 border-b border-[#F0F1F3] px-4 py-3 last:border-b-0 hover:bg-[#FAFAFB] ${flashId === j.id ? "proto-flash" : ""}`}
                  >
                    <button onClick={() => open(j.id)} className={`flex min-w-0 items-center gap-3 rounded text-left ${focusRing}`}>
                      <Logo company={j.company} size={28} className="rounded-[6px] outline outline-1 -outline-offset-1 outline-black/[0.08]" fallbackClassName="bg-[#F1F2F4] text-[#5B616E]" />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium hover:underline">{j.title}</span>
                        <span className="block truncate text-[13px] text-[#6E737E]">{j.company} · {j.location}</span>
                      </span>
                    </button>
                    <span className="text-[13px] tabular-nums text-[#4A4F5A]" title="Most recent status or save change">{shortDate(j.updated_at)}</span>
                    <span className={`text-[13px] ${j.deadline_state === "closed" ? "text-[#9A9EA7]" : "text-[#4A4F5A]"}`}>{deadlineLabel(j.deadline)}</span>
                    <span className="text-right text-[13px] font-semibold tabular-nums">{j.score}</span>
                    <div className="flex justify-end"><StatusMenu job={j} compact moveLabel /></div>
                    <a href={j.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${j.title} listing`} className={`grid h-7 w-7 place-items-center rounded-md text-[#9A9EA7] hover:bg-black/[0.05] hover:text-[#15171C] ${focusRing}`}>
                      <Icon name="external" size={14} />
                    </a>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <section className="mt-10">
          <SectionHeading title="Top unapplied matches" note="Highest fit among roles you haven't applied to" />
          <ul className="mt-3 divide-y divide-[#EEEFF2] rounded-[10px] border border-[#E8E9EC] bg-white">
            {topUnapplied.map((j) => (
              <li key={j.id}>
                <button onClick={() => open(j.id)} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#FAFAFB] ${focusRing}`}>
                  <span className="w-7 text-[13px] font-semibold tabular-nums">{j.score}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    <span className="font-medium">{j.title}</span>
                    <span className="text-[#6E737E]"> · {j.company}</span>
                  </span>
                  <span className="text-[12px] text-[#6E737E]">{deadlineLabel(j.deadline)}</span>
                  <Icon name="chevronRight" size={14} className="text-[#C9CCD2]" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
