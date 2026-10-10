import { ReactNode, RefObject, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  isManual, ProtoJob, ROLE_GROUP_LABEL, RoleGroup, roleLabel, sourceLabel, Status, STATUS_LABEL,
} from "../data";
import { deadlineLabel, deadlineState, formatDescription, relativeAge, shortDate } from "../extract";
import { Factor, FactorKey } from "../scoring";
import { EMPTY_FILTERS, pickSelected, ProtoFilters, useProto, View } from "../store";
import { BookmarkSwap, Icon, Logo, menuKeys, Popover, Toaster, useFlip, useListKeys } from "../primitives";

// Direction C — Radar, refined.
// The role is the object; the fit signal is a compact, explainable brand mark.
// Radar rings appear once (the score chip); rows carry a lighter five-bar signal.

const ACCENT = "#2B55D6";

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[#2B55D6]/40 focus-visible:ring-offset-1";
const btnSecondary = `proto-press inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#E3E6EA] bg-white px-3 text-[13px] font-medium text-[#2A2F37] hover:border-[#D3D7DD] hover:bg-[#F7F8F9] ${focusRing}`;
const btnPrimary = `proto-press inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[#2B55D6] px-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgb(43_85_214/0.25),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-[#2449BC] ${focusRing}`;
const btnGhost = `proto-press inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2 text-[13px] font-medium text-[#5F6570] hover:bg-[#F1F3F5] hover:text-[#0F1217] ${focusRing}`;
const logoCls = "outline outline-1 -outline-offset-1 outline-black/[0.08]";
const logoFallback = "bg-[#EEF0F3] text-[#454B56]";

const STATUS_DOT: Record<Status, string> = {
  new: "#A0A6B0",
  applied: "#D08A1E",
  interview: "#7056D6",
  offer: "#1F9A6B",
  rejected: "#D04A3A",
};

const ROLE_GROUPS: RoleGroup[] = ["apprenticeship", "graduate", "placement", "internship"];
const RING_ORDER: FactorKey[] = ["role", "tech", "location", "requirements", "stack"];
const STAGES: Status[] = ["new", "applied", "interview", "offer"];
const STAGE_LABEL: Record<Status, string> = { new: "Not applied", applied: "Applied", interview: "Interviewing", offer: "Offer", rejected: "Rejected" };

const matched = (j: ProtoJob) => j.breakdown.gains.filter((f) => f.points > 0).length;

/** Session-scoped UI preference; falls back to in-memory state when storage is unavailable. */
function useSessionFlag(key: string): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
  });
  const set = useCallback((v: boolean) => {
    setValue(v);
    try { sessionStorage.setItem(key, v ? "1" : "0"); } catch { /* keep the in-memory value */ }
  }, [key]);
  return [value, set];
}

// ── Shell ────────────────────────────────────────────────────────────────────

export default function Radar() {
  const { view, setView, saved, tracked, toast } = useProto();
  const [listHidden, setListHidden] = useSessionFlag("radar:role-list-hidden");
  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "dashboard", label: "Radar" },
    { id: "saved", label: "Shortlist", count: saved.length },
    { id: "applied", label: "Pipeline", count: tracked.length },
  ];
  const index = tabs.findIndex((t) => t.id === view);

  return (
    <div className="radar-root font-radar flex h-screen flex-col bg-[#F4F5F7] text-[13.5px] text-[#0F1217]">
      <header className="relative flex h-12 shrink-0 items-center border-b border-[#E3E6EA] bg-white px-4">
        <div className="flex items-center gap-2">
          <RadarMark />
          <span className="text-[14px] font-semibold tracking-[-0.01em]">Internship Radar</span>
        </div>

        <nav aria-label="Main" className="absolute left-1/2 grid -translate-x-1/2 grid-cols-3 rounded-[9px] bg-[#F0F1F4] p-[3px]">
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-[3px] left-[3px] top-[3px] w-[calc((100%-6px)/3)] rounded-[6px] bg-white shadow-[0_1px_2px_rgb(15_18_23/0.08),0_0_0_0.5px_rgb(15_18_23/0.06)] transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
          {tabs.map((t) => {
            const active = t.id === view;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-[26px] w-[112px] items-center justify-center gap-1.5 rounded-[6px] text-[13px] font-medium transition-colors duration-150 ${focusRing} ${
                  active ? "text-[#0F1217]" : "text-[#5F6570] hover:text-[#0F1217]"
                }`}
              >
                {t.label}
                {t.count !== undefined && <span className="text-[12px] tabular-nums text-[#9AA0AA]">{t.count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <button onClick={() => toast("Manual entry uses the existing Add Job form (unchanged in this pass)")} className={`${btnSecondary} pl-2.5`}>
            <Icon name="plus" size={14} stroke={2} />
            Add role
          </button>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0F1217] text-[11px] font-semibold text-white">H</span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        {view === "dashboard" && <RadarView listHidden={listHidden} onToggleList={() => setListHidden(!listHidden)} />}
        {view === "saved" && <ShortlistView />}
        {view === "applied" && <PipelineView />}
      </main>

      <Toaster
        className="bottom-6 right-6 w-[340px]"
        toastClassName="rounded-[9px] bg-[#0F1217] px-3.5 py-2.5 text-[13px] text-white shadow-[0_8px_24px_rgb(15_18_23/0.2)]"
        actionClassName="proto-press rounded-[5px] px-1.5 py-0.5 text-[12.5px] font-medium text-[#A9BFFF] hover:text-white"
      />
    </div>
  );
}

function RadarMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle cx="9" cy="9" r="7.6" fill="none" stroke={ACCENT} strokeOpacity="0.22" strokeWidth="1.4" />
      <circle cx="9" cy="9" r="4.4" fill="none" stroke={ACCENT} strokeOpacity="0.45" strokeWidth="1.4" />
      <path d="M9 1.4A7.6 7.6 0 0 1 16.6 9" fill="none" stroke={ACCENT} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="9" r="1.6" fill={ACCENT} />
    </svg>
  );
}

// ── Brand marks: rings (score chip only) and bars (everywhere else) ──────────

/** Five rings, one per scoring rule, outer to inner; a red outer arc marks a penalty. */
function SignalRings({ job, size, focus }: { job: ProtoJob; size: number; focus?: FactorKey | null }) {
  const gains = Object.fromEntries(job.breakdown.gains.map((f) => [f.key, f])) as Record<FactorKey, Factor>;
  const penalty = job.breakdown.penalties.reduce((s, f) => s + Math.abs(f.points), 0);
  const c = size / 2;
  const penStroke = Math.max(1.4, size * 0.035);
  const outer = c - penStroke - 1.5;
  const step = (outer - size * 0.12) / (RING_ORDER.length - 1);
  const stroke = step * 0.55;
  const focusIsPenalty = focus === "graduate" || focus === "unpaid" || focus === "offTarget";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      {penalty > 0 && (() => {
        const r = c - penStroke / 2;
        const circ = 2 * Math.PI * r;
        return (
          <circle
            cx={c} cy={c} r={r} fill="none" stroke="#D04A3A" strokeWidth={penStroke} strokeLinecap="round"
            strokeDasharray={`${(Math.min(penalty, 100) / 100) * circ} ${circ}`}
            transform={`rotate(-90 ${c} ${c}) scale(1 -1) translate(0 ${-size})`}
            opacity={focus && !focusIsPenalty ? 0.25 : 1}
            className="transition-[stroke-dasharray,opacity] duration-200 ease-out motion-reduce:transition-none"
          />
        );
      })()}
      {RING_ORDER.map((key, i) => {
        const f = gains[key];
        const r = outer - stroke / 2 - i * step;
        const circ = 2 * Math.PI * r;
        const dim = focus != null && focus !== key;
        return (
          <g key={key}>
            <circle cx={c} cy={c} r={r} fill="none" stroke="#E6E8EC" strokeWidth={stroke} />
            <circle
              cx={c} cy={c} r={r} fill="none" stroke={ACCENT} strokeWidth={stroke}
              strokeLinecap={f.points > 0 ? "round" : "butt"}
              strokeDasharray={`${(f.points / f.max) * circ} ${circ}`}
              transform={`rotate(-90 ${c} ${c})`}
              opacity={dim ? 0.15 : 0.9 - i * 0.1}
              className="transition-[stroke-dasharray,opacity] duration-200 ease-out motion-reduce:transition-none"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** The listing-level signal: five bars in ring order; fill = points / max. A red rule marks a penalty. */
function SignalBars({ job, height = 12 }: { job: ProtoJob; height?: number }) {
  const gains = Object.fromEntries(job.breakdown.gains.map((f) => [f.key, f])) as Record<FactorKey, Factor>;
  const penalised = job.breakdown.penalties.length > 0;
  return (
    <span className="inline-flex flex-col items-stretch gap-[2px]" aria-hidden title={penalised ? "Includes a penalty" : undefined}>
      <span className="inline-flex items-end gap-[2px]" style={{ height }}>
        {RING_ORDER.map((key, i) => {
          const f = gains[key];
          const h = Math.round(height * (0.4 + 0.6 * ((i + 1) / RING_ORDER.length)));
          return (
            <span key={key} className="relative w-[3px] overflow-hidden rounded-[1px] bg-[#E1E4E8]" style={{ height: h }}>
              <span className="absolute inset-x-0 bottom-0 bg-[#5F6570]" style={{ height: `${(f.points / f.max) * 100}%` }} />
            </span>
          );
        })}
      </span>
      <span className={`h-[1.5px] rounded-full ${penalised ? "bg-[#D04A3A]" : "bg-transparent"}`} />
    </span>
  );
}

function StatusDot({ status }: { status: Status }) {
  return <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_DOT[status] }} />;
}

// ── Radar: collapsible feed + detail ─────────────────────────────────────────

function RadarView({ listHidden, onToggleList }: { listHidden: boolean; onToggleList: () => void }) {
  const { filtered, selectedId, select } = useProto();
  const selected = pickSelected(filtered, selectedId);
  const position = selected ? filtered.findIndex((j) => j.id === selected.id) + 1 : 0;
  const paneRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const listId = useId();

  // The hidden list stays mounted, so its scroll position survives, but leaves the tab order.
  useEffect(() => {
    paneRef.current?.toggleAttribute("inert", listHidden);
  }, [listHidden]);

  // j / k move between roles from anywhere on the page, including while the list is hidden.
  // (Inside the focused list, useListKeys handles them first and marks the event handled.)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || (e.key !== "j" && e.key !== "k")) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]")) return;
      const ids = filtered.map((j) => j.id);
      const i = Math.max(0, ids.indexOf(selected?.id ?? -1));
      const next = ids[Math.min(ids.length - 1, Math.max(0, i + (e.key === "j" ? 1 : -1)))];
      if (next === undefined || next === selected?.id) return;
      e.preventDefault();
      select(next);
      if (!listHidden) {
        requestAnimationFrame(() => paneRef.current?.querySelector(`[data-row="${next}"]`)?.scrollIntoView({ block: "nearest" }));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filtered, selected?.id, select, listHidden]);

  // A newly selected role starts at the top of its detail.
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [selected?.id]);

  // Showing the list keeps its scroll position. The selected row is only brought into view
  // on first load, or if j/k changed the selection while the list was hidden.
  const selectedWhenHidden = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (listHidden) {
      selectedWhenHidden.current = selected?.id ?? null;
      return;
    }
    const firstLoad = selectedWhenHidden.current === undefined;
    const movedWhileHidden = !firstLoad && selectedWhenHidden.current !== (selected?.id ?? null);
    selectedWhenHidden.current = null;
    if ((firstLoad || movedWhileHidden) && selected) {
      paneRef.current?.querySelector(`[data-row="${selected.id}"]`)?.scrollIntoView({ block: "nearest" });
    }
    // Only on show/hide, not on every selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listHidden]);

  return (
    <>
      <div
        className={`relative shrink-0 bg-[#F4F5F7] transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
          listHidden ? "w-11" : "w-[360px] xl:w-[420px]"
        }`}
      >
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[#E3E6EA]" />
        <div className="h-full overflow-hidden">
          <section
            ref={paneRef}
            id={listId}
            aria-label="Roles"
            aria-hidden={listHidden || undefined}
            className={`flex h-full w-[360px] flex-col transition-opacity duration-150 motion-reduce:transition-none xl:w-[420px] ${listHidden ? "opacity-0" : "opacity-100"}`}
          >
            <FeedToolbar />
            <Feed jobs={filtered} selectedId={selected?.id ?? null} />
          </section>
        </div>
        <PanelToggle hidden={listHidden} onToggle={onToggleList} controls={listId} />
        {listHidden && position > 0 && (
          <p className="proto-reveal absolute inset-x-0 top-[52px] text-center text-[11px] leading-[14px] tabular-nums text-[#5F6570]" title="Use j and k to move between roles">
            <span className="block text-[12px] font-semibold text-[#0F1217]">{position}</span>
            of {filtered.length}
          </p>
        )}
      </div>
      <section ref={detailRef} className="min-w-0 flex-1 overflow-y-auto bg-white" aria-label="Role details">
        {selected ? <Detail job={selected} wide={listHidden} /> : <NoSelection />}
      </section>
    </>
  );
}

function PanelToggle({ hidden, onToggle, controls }: { hidden: boolean; onToggle: () => void; controls: string }) {
  const label = hidden ? "Show role list" : "Hide role list";
  return (
    <button
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!hidden}
      aria-controls={controls}
      className={`proto-press group absolute right-1.5 top-3 z-20 grid h-8 w-8 place-items-center rounded-[7px] text-[#5F6570] hover:bg-[#E8EAEE] hover:text-[#0F1217] ${focusRing}`}
    >
      <Icon name={hidden ? "panelOpen" : "panelClose"} size={16} />
      <span
        aria-hidden
        className={`pointer-events-none absolute top-full z-50 mt-1.5 whitespace-nowrap rounded-[6px] bg-[#0F1217] px-2 py-1 text-[12px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgb(15_18_23/0.18)] transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-500 group-focus-visible:opacity-100 group-focus-visible:delay-0 ${
          hidden ? "left-0" : "right-0"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function NoSelection() {
  return (
    <div className="grid h-full place-items-center px-8 text-center">
      <div>
        <p className="text-[14px] font-medium">No role selected</p>
        <p className="mt-1 text-[13px] text-[#5F6570]">Adjust the filters to bring roles back into range.</p>
      </div>
    </div>
  );
}

function FeedToolbar() {
  const { filtered, filters, setFilters, activeFilterCount } = useProto();
  const tokens = filterTokens(filters);

  return (
    <div className="shrink-0 border-b border-[#E3E6EA] pb-2 pl-3 pr-11 pt-3">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search roles</span>
          <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AA0AA]" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search roles or companies"
            className="h-8 w-full rounded-[7px] border border-[#E3E6EA] bg-white pl-8 pr-2.5 text-[13px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#9AA0AA] hover:border-[#D3D7DD] focus:border-[#2B55D6]/50 focus:shadow-[0_0_0_3px_rgb(43_85_214/0.12)]"
          />
        </label>
        <Popover
          label="Filters"
          align="end"
          panelClassName="w-[340px] rounded-[10px] border border-[#E3E6EA] bg-white shadow-[0_12px_32px_rgb(15_18_23/0.12),0_2px_6px_rgb(15_18_23/0.05)]"
          trigger={(p, open) => (
            <button
              {...p}
              aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} applied` : "Filters"}
              className={`proto-press inline-flex h-8 items-center gap-1.5 rounded-[7px] border pl-2.5 pr-2.5 text-[13px] font-medium ${focusRing} ${
                open || activeFilterCount > 0
                  ? "border-[#C9D5F6] bg-[#F1F5FE] text-[#2449BC]"
                  : "border-[#E3E6EA] bg-white text-[#2A2F37] hover:border-[#D3D7DD] hover:bg-[#F7F8F9]"
              }`}
            >
              <Icon name="sliders" size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-[4px] bg-[#2B55D6] px-1 text-[11px] font-semibold tabular-nums text-white">{activeFilterCount}</span>
              )}
            </button>
          )}
        >
          {(close) => <FilterPanel onDone={close} />}
        </Popover>
      </div>

      {tokens.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {tokens.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilters({ ...filters, ...t.clear })}
              aria-label={`Remove filter: ${t.label}`}
              className={`proto-press inline-flex h-6 max-w-full items-center gap-1 rounded-[6px] bg-[#E9ECF1] pl-2 pr-1 text-[12px] font-medium text-[#2A2F37] hover:bg-[#DFE3EA] ${focusRing}`}
            >
              <span className="truncate">{t.label}</span>
              <Icon name="x" size={12} stroke={2} className="text-[#5F6570]" />
            </button>
          ))}
          <button onClick={() => setFilters({ ...EMPTY_FILTERS, search: filters.search })} className={`ml-0.5 h-6 rounded-[5px] px-1.5 text-[12px] font-medium text-[#5F6570] hover:text-[#0F1217] ${focusRing}`}>
            Clear
          </button>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between px-1 text-[12px] text-[#5F6570]">
        <span><span className="font-semibold tabular-nums text-[#0F1217]">{filtered.length}</span> roles</span>
        <span>Best fit first</span>
      </div>
    </div>
  );
}

function filterTokens(f: ProtoFilters): { key: string; label: string; clear: Partial<ProtoFilters> }[] {
  const out: { key: string; label: string; clear: Partial<ProtoFilters> }[] = [];
  if (f.roles.length) out.push({ key: "roles", label: f.roles.map((r) => ROLE_GROUP_LABEL[r]).join(", "), clear: { roles: [] } });
  if (f.location) out.push({ key: "location", label: `In “${f.location}”`, clear: { location: "" } });
  if (f.deadline) out.push({ key: "deadline", label: f.deadline === "none" ? "No deadline" : `Closes within ${f.deadline} days`, clear: { deadline: "" } });
  if (f.minScore) out.push({ key: "fit", label: `Fit ${f.minScore}+`, clear: { minScore: 0 } });
  if (f.status) out.push({ key: "status", label: STATUS_LABEL[f.status], clear: { status: "" } });
  if (f.source) out.push({ key: "source", label: sourceLabel(f.source), clear: { source: "" } });
  return out;
}

function FilterPanel({ onDone }: { onDone: () => void }) {
  const { jobs, filtered, filters, setFilters, activeFilterCount } = useProto();
  const set = (f: Partial<ProtoFilters>) => setFilters({ ...filters, ...f });
  const count = (pred: (j: ProtoJob) => boolean) => jobs.filter(pred).length;
  const sources = [...new Set(jobs.map((j) => j.source))];

  return (
    <div>
      <div className="flex h-11 items-center justify-between border-b border-[#EDEFF2] px-4">
        <p className="text-[13.5px] font-semibold">
          Filters
          {activeFilterCount > 0 && <span className="ml-1.5 font-normal tabular-nums text-[#5F6570]">{activeFilterCount} applied</span>}
        </p>
        {activeFilterCount > 0 && (
          <button onClick={() => setFilters({ ...EMPTY_FILTERS, search: filters.search })} className={`h-7 rounded-[6px] px-2 text-[12.5px] font-medium text-[#5F6570] hover:bg-[#F1F3F5] hover:text-[#0F1217] ${focusRing}`}>
            Clear all
          </button>
        )}
      </div>
      <div className="flex max-h-[min(68vh,640px)] flex-col gap-4 overflow-y-auto px-4 py-3.5">
        <FilterField label="Role type">
          <div className="-mx-1.5 flex flex-col">
            {ROLE_GROUPS.map((g) => {
              const on = filters.roles.includes(g);
              return (
                <label key={g} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-[6px] px-1.5 hover:bg-[#F4F5F7]">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => set({ roles: on ? filters.roles.filter((r) => r !== g) : [...filters.roles, g] })}
                    className="peer sr-only"
                    data-autofocus={g === ROLE_GROUPS[0] ? "" : undefined}
                  />
                  <span aria-hidden className={`grid h-4 w-4 place-items-center rounded-[4px] border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[#2B55D6]/40 peer-focus-visible:ring-offset-1 ${on ? "border-[#2B55D6] bg-[#2B55D6]" : "border-[#C2C7CF] bg-white"}`}>
                    {on && <Icon name="check" size={11} stroke={3} className="text-white" />}
                  </span>
                  <span className={`flex-1 text-[13px] ${on ? "font-medium" : "text-[#2A2F37]"}`}>{ROLE_GROUP_LABEL[g]}</span>
                  <span className="text-[12px] tabular-nums text-[#5F6570]">{count((j) => j.role_group === g)}</span>
                </label>
              );
            })}
          </div>
        </FilterField>

        <FilterField label="Location">
          <input
            value={filters.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Any location"
            className="h-8 w-full rounded-[7px] border border-[#E3E6EA] px-2.5 text-[13px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#9AA0AA] hover:border-[#D3D7DD] focus:border-[#2B55D6]/50 focus:shadow-[0_0_0_3px_rgb(43_85_214/0.12)]"
          />
        </FilterField>

        <FilterField label="Deadline">
          <Segmented ariaLabel="Deadline" value={filters.deadline} onChange={(v) => set({ deadline: v })}
            options={[{ v: "", l: "Any" }, { v: "7", l: "7 days" }, { v: "14", l: "14 days" }, { v: "30", l: "30 days" }, { v: "none", l: "None" }]} />
        </FilterField>

        <FilterField label="Minimum fit">
          <Segmented ariaLabel="Minimum fit" value={filters.minScore} onChange={(v) => set({ minScore: v })}
            options={[{ v: 0, l: "Any" }, { v: 20, l: "20+" }, { v: 40, l: "40+" }, { v: 60, l: "60+" }]} />
        </FilterField>

        <FilterField label="Status">
          <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 gap-1">
            {(["", "new", "applied", "interview", "offer", "rejected"] as const).map((v) => {
              const on = filters.status === v;
              return (
                <button
                  key={v}
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ status: v })}
                  className={`flex h-8 items-center gap-2 rounded-[6px] border px-2.5 text-left text-[12.5px] transition-colors duration-150 ${focusRing} ${
                    on ? "border-[#C9D5F6] bg-[#F1F5FE] font-medium text-[#0F1217]" : "border-transparent text-[#454B56] hover:bg-[#F4F5F7]"
                  }`}
                >
                  {v ? <StatusDot status={v} /> : <span aria-hidden className="h-1.5 w-1.5 rounded-full border border-[#9AA0AA]" />}
                  {v ? STATUS_LABEL[v] : "Any status"}
                </button>
              );
            })}
          </div>
        </FilterField>

        {sources.length > 1 ? (
          <FilterField label="Source">
            <Segmented ariaLabel="Source" value={filters.source} onChange={(v) => set({ source: v })}
              options={[{ v: "", l: "All" }, ...sources.map((s) => ({ v: s, l: sourceLabel(s) }))]} />
          </FilterField>
        ) : (
          <p className="flex items-center gap-1.5 text-[12px] text-[#5F6570]">
            <Icon name="globe" size={13} />
            All roles are from {sourceLabel(sources[0] ?? "")}.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[#EDEFF2] py-2.5 pl-4 pr-3">
        <span className="text-[12.5px] text-[#5F6570]">
          <span className="font-semibold tabular-nums text-[#0F1217]">{filtered.length}</span> of <span className="tabular-nums">{jobs.length}</span> roles
        </span>
        {filtered.length > 0 ? (
          <button onClick={onDone} className={btnPrimary}>
            Show <span className="tabular-nums">{filtered.length}</span> {filtered.length === 1 ? "role" : "roles"}
          </button>
        ) : (
          <button onClick={() => setFilters({ ...EMPTY_FILTERS, search: filters.search })} className={btnSecondary}>
            No matches · clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-[#5F6570]">{label}</p>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  value, options, onChange, ariaLabel,
}: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid rounded-[7px] bg-[#F0F1F4] p-[2px]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`h-7 rounded-[5px] text-[12.5px] font-medium tabular-nums transition-colors duration-150 ${focusRing} ${
            value === o.v ? "bg-white text-[#0F1217] shadow-[0_1px_2px_rgb(15_18_23/0.1)]" : "text-[#5F6570] hover:text-[#0F1217]"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Feed({ jobs, selectedId }: { jobs: ProtoJob[]; selectedId: number | null }) {
  const { select, flashId, filters, setFilters } = useProto();
  const listRef = useRef<HTMLUListElement>(null);
  const onKeyDown = useListKeys(listRef, jobs.map((j) => j.id), selectedId, select);

  if (jobs.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-[13.5px] font-medium">No roles match these filters</p>
        <p className="mx-auto mt-1 max-w-[30ch] text-[12.5px] text-[#5F6570]">Every listed deadline in the current data has passed, so deadline windows return nothing.</p>
        <button onClick={() => setFilters({ ...EMPTY_FILTERS, search: filters.search })} className={`${btnSecondary} mt-4`}>Clear filters</button>
      </div>
    );
  }

  return (
    <ul ref={listRef} onKeyDown={onKeyDown} className="proto-noscrollbar flex-1 overflow-y-auto">
      {jobs.map((j) => {
        const active = j.id === selectedId;
        return (
          <li
            key={j.id}
            className={`relative border-b ${active ? "z-10 border-[#DCDFE4] bg-white shadow-[inset_0_1px_0_#DCDFE4]" : "border-[#E8EAEE]"} ${flashId === j.id ? "proto-flash" : ""}`}
          >
            <button
              data-row={j.id}
              onClick={() => select(j.id)}
              aria-current={active ? "true" : undefined}
              title={j.title}
              className={`grid w-full grid-cols-[28px_minmax(0,1fr)_auto] gap-3 py-3 pl-4 pr-4 text-left transition-colors duration-100 outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(43_85_214/0.4)] ${
                active ? "" : "hover:bg-[#FAFAFB]"
              }`}
            >
              <Logo company={j.company} size={28} className={`mt-0.5 rounded-[6px] ${logoCls}`} fallbackClassName={logoFallback} />
              <span className="min-w-0">
                <span className={`line-clamp-2 text-[14px] leading-5 text-[#0F1217] ${active ? "font-semibold" : "font-medium"}`}>{j.title}</span>
                <span className="mt-0.5 flex min-w-0 items-baseline gap-1 text-[13px] leading-[18px]">
                  <span className="max-w-[58%] shrink-0 truncate font-medium text-[#3F4550]">{j.company}</span>
                  <span aria-hidden className="text-[#9AA0AA]">·</span>
                  <span className="min-w-0 truncate text-[#5F6570]">{j.location}</span>
                </span>
                <span className="mt-1.5 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-[#5F6570]">
                  <span>{roleShort(j)}</span>
                  <span aria-hidden className="text-[#9AA0AA]">·</span>
                  <span className={`min-w-0 truncate ${j.deadline_state === "soon" ? "font-medium text-[#9A5B00]" : ""}`}>{deadlineLabel(j.deadline)}</span>
                  {j.status !== "new" && (
                    <span className="ml-1 inline-flex shrink-0 items-center gap-1 text-[#3F4550]"><StatusDot status={j.status} />{STATUS_LABEL[j.status]}</span>
                  )}
                  {j.is_saved && <Icon name="bookmark" size={12} filled className="ml-auto shrink-0 text-[#8A909A]" />}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1.5 pt-0.5" aria-label={`Fit ${j.score}`}>
                <span className="text-[14px] font-semibold leading-4 tabular-nums">{j.score}</span>
                <SignalBars job={j} height={11} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function roleShort(j: ProtoJob): string {
  return j.role_group === "other" ? roleLabel(j.role_type) : ROLE_GROUP_LABEL[j.role_group];
}

// ── Detail ───────────────────────────────────────────────────────────────────

function Detail({ job, wide }: { job: ProtoJob; wide: boolean }) {
  const { toggleSaved } = useProto();
  const [focus, setFocus] = useState<FactorKey | null>(null);
  const breakdownRef = useRef<HTMLElement>(null);
  const dl = deadlineState(job.deadline);
  const openBreakdown = () => breakdownRef.current?.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start",
  });
  // The chip sits beside the title only when there is room for both; otherwise it joins the action row.
  const chipBeside = wide ? "block" : "hidden xl:block";
  const chipInline = wide ? "hidden" : "ml-auto xl:hidden";

  return (
    // With the list hidden, the page widens and centres, but text keeps a reading measure.
    <article className={wide ? "mx-auto max-w-[1120px] px-10 pb-28 pt-8" : "max-w-[880px] px-6 pb-28 pt-7 xl:px-10"}>
      <header className="flex items-start gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Logo company={job.company} size={24} className={`rounded-[6px] ${logoCls}`} fallbackClassName={logoFallback} />
            <span className="truncate text-[13.5px] font-medium leading-6 text-[#3F4550]">{job.company}</span>
          </div>
          <h1 className={`mt-2.5 text-[26px] font-semibold leading-[1.18] tracking-[-0.02em] [text-wrap:balance] ${wide ? "max-w-[36ch]" : ""}`}>{job.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] leading-5 text-[#5F6570]">
            <span>{job.location}</span>
            <span aria-hidden className="text-[#9AA0AA]">·</span>
            <span>{roleLabel(job.role_type)}</span>
            <span aria-hidden className="text-[#9AA0AA]">·</span>
            <span className={dl.state === "soon" ? "font-medium text-[#9A5B00]" : ""}>{deadlineLabel(job.deadline)}</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a href={job.url} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} pr-2.5`}>
              Open listing
              <Icon name="external" size={13} stroke={2} />
            </a>
            <button
              onClick={() => toggleSaved(job.id)}
              aria-pressed={job.is_saved}
              className={job.is_saved
                ? `proto-press inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#D6DEF5] bg-[#F4F7FE] pl-2.5 pr-3 text-[13px] font-medium text-[#2449BC] ${focusRing}`
                : `${btnSecondary} pl-2.5`}
            >
              <BookmarkSwap on={job.is_saved} size={14} />
              {job.is_saved ? "Shortlisted" : "Shortlist"}
            </button>
            <span className={chipInline}><FitChip job={job} focus={focus} onOpen={openBreakdown} compact /></span>
          </div>
          <Provenance job={job} />
        </div>
        <div className={chipBeside}><FitChip job={job} focus={focus} onOpen={openBreakdown} /></div>
      </header>

      <ApplicationTracker job={job} />

      <FitBreakdown job={job} focus={focus} onFocus={setFocus} sectionRef={breakdownRef} wide={wide} />

      <Details job={job} wide={wide} />

      <Listing key={job.id} job={job} />
    </article>
  );
}

function Provenance({ job }: { job: ProtoJob }) {
  const manual = isManual(job.source);
  return (
    <p className="mt-3.5 flex items-center gap-1.5 text-[12.5px] text-[#5F6570]" title={`Added ${shortDate(job.created_at, true)}`}>
      <Icon name="globe" size={13} className="text-[#9AA0AA]" />
      {manual ? (
        <span>Added manually{job.source !== "manual" ? ` from ${sourceLabel(job.source)}` : ""} · {relativeAge(job.created_at)}</span>
      ) : (
        <span>Listed on <span className="font-medium text-[#3F4550]">{sourceLabel(job.source)}</span> · collected {relativeAge(job.created_at)}</span>
      )}
    </p>
  );
}

function FitChip({ job, focus, onOpen, compact }: { job: ProtoJob; focus: FactorKey | null; onOpen: () => void; compact?: boolean }) {
  const n = matched(job);
  const p = job.breakdown.penalties.length;
  const label = `Fit ${job.score} of 100, ${n} of 5 rules matched${p ? `, ${p} ${p === 1 ? "penalty" : "penalties"}` : ""}. Show breakdown.`;

  if (compact) {
    return (
      <button onClick={onOpen} aria-label={label} className={`proto-press inline-flex h-8 items-center gap-2 rounded-[7px] border border-[#E3E6EA] bg-white pl-1.5 pr-2.5 hover:border-[#D3D7DD] hover:bg-[#F7F8F9] ${focusRing}`}>
        <SignalRings job={job} size={22} focus={focus} />
        <span className="text-[13.5px] font-semibold tabular-nums">{job.score}</span>
        <span className="text-[12px] text-[#5F6570]">{n}/5 rules{p ? " · penalty" : ""}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      aria-label={label}
      className={`proto-press group flex shrink-0 items-center gap-2.5 rounded-[10px] border border-[#E6E8EC] bg-white py-2 pl-2 pr-3 text-left hover:border-[#D3D7DD] hover:bg-[#FAFBFC] ${focusRing}`}
    >
      <SignalRings job={job} size={36} focus={focus} />
      <span>
        <span className="flex items-baseline gap-0.5">
          <span className="text-[20px] font-semibold leading-none tabular-nums tracking-[-0.02em]">{job.score}</span>
          <span className="text-[11.5px] text-[#9AA0AA]">/100</span>
        </span>
        <span className="mt-1 block whitespace-nowrap text-[12px] text-[#5F6570] group-hover:text-[#2A2F37]">
          {n} of 5 rules{p > 0 ? ` · ${p} ${p === 1 ? "penalty" : "penalties"}` : ""}
        </span>
      </span>
    </button>
  );
}

// ── Application tracker ──────────────────────────────────────────────────────

function nextStage(s: Status): Status | null {
  if (s === "new") return "applied";
  if (s === "applied") return "interview";
  if (s === "interview") return "offer";
  return null;
}

function ApplicationTracker({ job }: { job: ProtoJob }) {
  const { setStatus } = useProto();
  const rejected = job.status === "rejected";
  const pos = rejected ? -1 : STAGES.indexOf(job.status);
  const next = nextStage(job.status);
  const tracked = job.status !== "new";

  const summary = rejected
    ? `Rejected ${shortDate(job.updated_at)} · choose a stage to reopen`
    : job.status === "new"
      ? "Not applied yet"
      : `${STAGE_LABEL[job.status]} · updated ${shortDate(job.updated_at)}`;

  return (
    <section className="mt-6 rounded-[10px] border border-[#E3E6EA]" aria-label="Application">
      <div className="flex h-11 items-center gap-2.5 pl-4 pr-1.5">
        <h2 className="text-[13.5px] font-semibold">Application</h2>
        <span aria-hidden className="h-3.5 w-px bg-[#E3E6EA]" />
        <p className={`flex min-w-0 items-center gap-1.5 truncate text-[12.5px] ${rejected ? "text-[#B23A2C]" : "text-[#5F6570]"}`}>
          <StatusDot status={job.status} />
          <span className="truncate">{summary}</span>
        </p>
        <span className="flex-1" />
        {tracked && (
          <Popover
            label="More application actions"
            kind="menu"
            align="end"
            panelClassName="w-[210px] rounded-[10px] border border-[#E3E6EA] bg-white p-1 shadow-[0_12px_32px_rgb(15_18_23/0.12)]"
            trigger={(p) => (
              <button {...p} aria-label="More application actions" className={`grid h-8 w-8 place-items-center rounded-[7px] text-[#5F6570] hover:bg-[#F1F3F5] hover:text-[#0F1217] ${focusRing}`}>
                <Icon name="ellipsis" size={16} stroke={2} />
              </button>
            )}
          >
            {(close) => (
              <div onKeyDown={menuKeys}>
                {!rejected && (
                  <MenuItem onClick={() => { setStatus(job.id, "rejected"); close(); }}>
                    <StatusDot status="rejected" /> Mark as rejected
                  </MenuItem>
                )}
                <MenuItem onClick={() => { setStatus(job.id, "new"); close(); }} muted>Remove from tracking</MenuItem>
              </div>
            )}
          </Popover>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-[#EDEFF2] py-2 pl-2.5 pr-2">
        <ol className="flex min-w-0 flex-1 items-center gap-1" aria-label="Stages">
          {STAGES.map((s, i) => {
            const done = !rejected && i < pos;
            const current = !rejected && i === pos;
            return (
              <li key={s} className={`flex min-w-0 items-center gap-1 ${i < STAGES.length - 1 ? "flex-1" : ""}`}>
                <button
                  onClick={() => setStatus(job.id, s)}
                  aria-current={current ? "step" : undefined}
                  aria-label={`${STAGE_LABEL[s]}${current ? ", current stage" : done ? ", completed" : ""}`}
                  className={`group flex h-8 shrink-0 items-center gap-2 rounded-[7px] pl-1.5 pr-2.5 transition-colors duration-150 ${focusRing} ${
                    current ? "bg-[#EEF3FE]" : "hover:bg-[#F4F5F7]"
                  }`}
                >
                  <StageMark done={done} current={current} />
                  <span className={`whitespace-nowrap text-[12.5px] ${current ? "font-semibold text-[#0F1217]" : "text-[#454B56] group-hover:text-[#0F1217]"}`}>
                    {STAGE_LABEL[s]}
                  </span>
                </button>
                {i < STAGES.length - 1 && (
                  <span aria-hidden className={`h-px min-w-3 flex-1 transition-colors duration-200 ${done ? "bg-[#AEB3BB]" : "bg-[#E3E6EA]"}`} />
                )}
              </li>
            );
          })}
        </ol>
        {next && (
          <>
            <span aria-hidden className="h-5 w-px shrink-0 bg-[#E3E6EA]" />
            <button onClick={() => setStatus(job.id, next)} className={`${btnSecondary} shrink-0 pr-2.5`}>
              {job.status === "new" ? "Mark as applied" : `Move to ${STAGE_LABEL[next].toLowerCase()}`}
              <Icon name="arrowRight" size={13} stroke={2} className="text-[#5F6570]" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function StageMark({ done, current }: { done: boolean; current: boolean }) {
  if (current) {
    return (
      <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-[#2B55D6] bg-white">
        <span className="h-1.5 w-1.5 rounded-full bg-[#2B55D6]" />
      </span>
    );
  }
  if (done) {
    return (
      <span className="grid h-4 w-4 place-items-center rounded-full bg-[#E3E6EA] text-[#454B56]">
        <Icon name="check" size={10} stroke={3} />
      </span>
    );
  }
  return <span className="h-4 w-4 rounded-full border-[1.5px] border-[#B5BAC2] bg-white transition-colors duration-150 group-hover:border-[#7D838D]" />;
}

function MenuItem({ children, onClick, muted }: { children: ReactNode; onClick: () => void; muted?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-left text-[13px] outline-none hover:bg-[#F4F5F7] focus-visible:bg-[#F4F5F7] ${muted ? "text-[#5F6570] hover:text-[#0F1217]" : "text-[#2A2F37]"}`}
    >
      {children}
    </button>
  );
}

// ── Fit breakdown ────────────────────────────────────────────────────────────

function FitBreakdown({
  job, focus, onFocus, sectionRef, wide,
}: { job: ProtoJob; focus: FactorKey | null; onFocus: (k: FactorKey | null) => void; sectionRef: RefObject<HTMLElement>; wide: boolean }) {
  const factors = [...job.breakdown.gains, ...job.breakdown.penalties];
  const cols = wide
    ? "grid-cols-[18px_200px_minmax(0,1fr)_40px_40px]"
    : "grid-cols-[18px_150px_minmax(0,1fr)_36px_36px] xl:grid-cols-[18px_170px_minmax(0,1fr)_40px_40px]";

  return (
    <section ref={sectionRef} className="mt-9 scroll-mt-6" aria-label="Fit breakdown">
      <div className="flex items-baseline justify-between gap-4 px-1">
        <h2 className="text-[13.5px] font-semibold">Why this scores {job.score}</h2>
        <span className="text-[12px] text-[#5F6570]">{matched(job)} of 5 rules matched</span>
      </div>
      <ul className="mt-2.5 border-t border-[#E3E6EA]" onMouseLeave={() => onFocus(null)}>
        {factors.map((f) => {
          const hit = f.points > 0;
          const on = focus === f.key;
          return (
            <li
              key={f.key}
              tabIndex={0}
              onMouseEnter={() => onFocus(f.key)}
              onFocus={() => onFocus(f.key)}
              onBlur={() => onFocus(null)}
              className={`grid ${cols} items-start gap-x-3 border-b border-[#EDEFF2] px-1 py-2 transition-colors duration-150 ${focusRing} ${on ? "bg-[#F6F8FE]" : ""}`}
            >
              <FactorIcon factor={f} />
              <span className={`text-[13px] leading-5 ${f.penalty ? "font-medium text-[#0F1217]" : hit ? "font-medium text-[#0F1217]" : "text-[#5F6570]"}`}>{f.label}</span>
              <span className="text-[12.5px] leading-5 text-[#5F6570]">
                {f.evidence.length > 0
                  ? f.evidence.map((e, i) => (
                      <span key={e.term}>
                        {i > 0 && ", "}
                        <span className="text-[#2A2F37]">{e.term}</span>
                        {e.word !== e.term && <span className="text-[#7D838D]"> in “{e.word}”</span>}
                      </span>
                    ))
                  : <span className="text-[#7D838D]">Not matched · {f.rule.toLowerCase()}</span>}
              </span>
              <span className={`text-right text-[13px] font-semibold leading-5 tabular-nums ${f.penalty ? "text-[#B23A2C]" : hit ? "text-[#0F1217]" : "font-normal text-[#9AA0AA]"}`}>
                {f.points > 0 ? `+${f.points}` : f.points === 0 ? "0" : `−${Math.abs(f.points)}`}
              </span>
              <span className="text-[12px] leading-5 tabular-nums text-[#9AA0AA]">{f.penalty ? "" : `/ ${f.max}`}</span>
            </li>
          );
        })}
        <li className={`grid ${cols} items-baseline gap-x-3 px-1 py-2`}>
          <span />
          <span className="text-[13px] font-semibold">Total</span>
          <span className="text-[12px] text-[#7D838D]">{job.breakdown.raw !== job.score ? `Rules add up to ${job.breakdown.raw}; scores are kept between 0 and 100` : ""}</span>
          <span className="text-right text-[13.5px] font-semibold tabular-nums">{job.score}</span>
          <span className="text-[12px] tabular-nums text-[#9AA0AA]">/ 100</span>
        </li>
      </ul>
      <p className="mt-1.5 px-1 text-[12px] leading-[1.5] text-[#7D838D]">
        Five keyword rules and three penalties make up the whole score. Keywords match as whole words, including plurals and capitalised acronyms such as RESTful.
      </p>
    </section>
  );
}

function FactorIcon({ factor }: { factor: Factor }) {
  if (factor.penalty) {
    return (
      <span role="img" aria-label="Penalty" className="mt-[1px] grid h-[18px] w-[18px] place-items-center rounded-full bg-[#FBE9E6] text-[#B23A2C]">
        <Icon name="minus" size={11} stroke={2.5} />
      </span>
    );
  }
  if (factor.points > 0) {
    return (
      <span role="img" aria-label="Matched" className="mt-[1px] grid h-[18px] w-[18px] place-items-center rounded-full bg-[#2B55D6] text-white">
        <Icon name="check" size={10} stroke={3} />
      </span>
    );
  }
  return <span role="img" aria-label="Not matched" className="mt-[1px] h-[18px] w-[18px] rounded-full border-[1.5px] border-[#D0D4DA]" />;
}

// ── Details and listing text ─────────────────────────────────────────────────

function Details({ job, wide }: { job: ProtoJob; wide: boolean }) {
  const dl = deadlineState(job.deadline);
  return (
    <section className="mt-9 px-1" aria-label="Details">
      <h2 className="text-[13.5px] font-semibold">Details</h2>
      <dl className={`mt-3 grid gap-x-8 gap-y-4 ${wide ? "grid-cols-4" : "grid-cols-2 lg:grid-cols-3"}`}>
        <Datum k="Deadline" v={deadlineLabel(job.deadline)} sub={job.deadline && dl.state !== "closed" ? shortDate(job.deadline, true) : undefined} warn={dl.state === "soon"} />
        <Datum k="Role type" v={roleLabel(job.role_type)} />
        {job.facts.map((f) => <Datum key={f.label} k={f.label} v={f.value} title={f.excerpt} />)}
      </dl>
      {job.facts.length === 0 && (
        <p className="mt-3 text-[12.5px] text-[#5F6570]">No dates, eligibility or salary details were found in the listing text.</p>
      )}
    </section>
  );
}

function Datum({ k, v, sub, title, warn }: { k: string; v: string; sub?: string; title?: string; warn?: boolean }) {
  return (
    <div title={title} className="min-w-0">
      <dt className="text-[12px] text-[#5F6570]">{k}</dt>
      <dd className={`mt-0.5 text-[13.5px] font-medium ${warn ? "text-[#9A5B00]" : ""}`}>{v}</dd>
      {sub && <dd className="text-[12px] text-[#5F6570]">{sub}</dd>}
    </div>
  );
}

function Listing({ job }: { job: ProtoJob }) {
  const [open, setOpen] = useState(false);
  const blocks = formatDescription(job.description, job.title);
  return (
    <section className="mt-9 px-1" aria-label="Listing text">
      <h2 className="text-[13.5px] font-semibold">Listing</h2>
      <div className={`relative mt-3 ${open ? "" : "max-h-[280px] overflow-hidden"}`}>
        {/* Reading measure holds even when the page widens. */}
        <div className="max-w-[68ch] text-[14px] leading-[1.65] text-[#2E333B]">
          {blocks.map((b, i) => (
            <div key={i}>
              {b.heading && <h3 className="mb-1 mt-5 text-[13.5px] font-semibold text-[#0F1217] first:mt-0">{b.heading}</h3>}
              {b.paragraphs.map((p, k) => <p key={k} className="mt-3 first:mt-0">{p}</p>)}
            </div>
          ))}
        </div>
        {!open && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-white/0" />}
      </div>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`${btnGhost} -ml-2 mt-1 text-[#2449BC] hover:text-[#1D3C9E]`}>
        {open ? "Show less" : "Show full listing"}
        <Icon name="chevronDown" size={13} stroke={2} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
    </section>
  );
}

// ── Shortlist: roles I'm considering ─────────────────────────────────────────

function urgency(j: ProtoJob): number {
  const { state, days } = deadlineState(j.deadline);
  if (state === "soon" || state === "open") return days ?? 0;
  if (state === "none") return 10_000;
  return 20_000;
}

function ShortlistView() {
  const { jobs, saved, select, setView } = useProto();
  const considering = useMemo(
    () => saved.filter((j) => j.status === "new" && j.deadline_state !== "closed").sort((a, b) => urgency(a) - urgency(b) || b.score - a.score),
    [saved],
  );
  const lapsed = saved.filter((j) => j.status === "new" && j.deadline_state === "closed");
  const inPipeline = saved.filter((j) => j.status !== "new");
  const suggestions = jobs.filter((j) => !j.is_saved && j.status === "new" && j.deadline_state !== "closed").slice(0, 3);
  const soon = considering.filter((j) => j.deadline_state === "soon").length;
  const open = (id: number) => { select(id); setView("dashboard"); };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-6 pb-28 pt-8 xl:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-[-0.015em]">Shortlist</h1>
            <p className="mt-1 text-[13.5px] text-[#5F6570]">Roles you're considering, soonest deadline first.</p>
          </div>
          <p className="text-[12.5px] text-[#5F6570]">
            <span className="font-semibold tabular-nums text-[#0F1217]">{considering.length}</span> considering
            {" · "}
            <span className={soon ? "font-medium text-[#9A5B00]" : ""}><span className="tabular-nums">{soon}</span> closing within 14 days</span>
          </p>
        </header>

        {/* Lead group: the roles being weighed up, on a raised surface. */}
        <section className="mt-6" aria-labelledby="considering-h">
          <div className="mb-2 flex items-baseline gap-2 px-1">
            <h2 id="considering-h" className="text-[14px] font-semibold">Considering</h2>
            <span className="text-[12.5px] tabular-nums text-[#5F6570]">{considering.length}</span>
          </div>
          <div className="divide-y divide-[#EDEFF2] overflow-hidden rounded-[10px] border border-[#E3E6EA] bg-white shadow-[0_1px_2px_rgb(15_18_23/0.03)]">
            {considering.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13.5px] font-medium">Nothing open on your shortlist</p>
                <p className="mx-auto mt-1 max-w-[46ch] text-[13px] text-[#5F6570]">
                  Shortlist roles from Radar to weigh them up here. Marking one as applied moves it into your pipeline.
                </p>
              </div>
            ) : (
              considering.map((j) => <ConsiderRow key={j.id} job={j} onOpen={() => open(j.id)} />)
            )}
          </div>
        </section>

        {/* Supporting groups: flat lists on the canvas, quieter headings. */}
        {suggestions.length > 0 && (
          <QuietGroup title="Worth considering" note="High fit, still open, not on your shortlist">
            {suggestions.map((j) => <ConsiderRow key={j.id} job={j} onOpen={() => open(j.id)} tone="suggestion" />)}
          </QuietGroup>
        )}

        {lapsed.length > 0 && (
          <QuietGroup title="Deadline passed" count={lapsed.length} note="Saved, but closed before you applied">
            {lapsed.map((j) => <ConsiderRow key={j.id} job={j} onOpen={() => open(j.id)} tone="lapsed" />)}
          </QuietGroup>
        )}

        {inPipeline.length > 0 && (
          <QuietGroup title="Already in your pipeline" count={inPipeline.length}>
            {inPipeline.map((j) => (
              <div key={j.id} className="flex items-center gap-3 py-2 pl-4 pr-3">
                <Logo company={j.company} size={20} className={`rounded-[5px] ${logoCls}`} fallbackClassName={logoFallback} />
                <button onClick={() => open(j.id)} className={`min-w-0 flex-1 truncate rounded-[4px] text-left text-[13px] font-medium text-[#2A2F37] hover:underline ${focusRing}`}>
                  {j.title} <span className="font-normal text-[#5F6570]">· {j.company}</span>
                </button>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#3F4550]"><StatusDot status={j.status} />{STATUS_LABEL[j.status]}</span>
                <button onClick={() => setView("applied")} className={`${btnGhost} h-7 pr-1.5 text-[12.5px]`}>
                  View in Pipeline <Icon name="arrowRight" size={12} stroke={2} />
                </button>
              </div>
            ))}
          </QuietGroup>
        )}
      </div>
    </div>
  );
}

function QuietGroup({ title, count, note, children }: { title: string; count?: number; note?: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-1 flex items-baseline gap-2 px-1">
        <h2 className="text-[12.5px] font-semibold text-[#454B56]">{title}</h2>
        {count !== undefined && <span className="text-[12px] tabular-nums text-[#7D838D]">{count}</span>}
        {note && <span className="text-[12px] text-[#7D838D]">· {note}</span>}
      </div>
      <div className="divide-y divide-[#E8EAEE] border-y border-[#E8EAEE]">{children}</div>
    </section>
  );
}

function ConsiderRow({ job, onOpen, tone = "lead" }: { job: ProtoJob; onOpen: () => void; tone?: "lead" | "suggestion" | "lapsed" }) {
  const { toggleSaved, setStatus, flashId } = useProto();
  const facts = job.facts.filter((f) => ["Duration", "Starts", "Working pattern", "Salary"].includes(f.label)).map((f) => f.value);
  const dl = deadlineState(job.deadline);
  const lead = tone === "lead";

  return (
    <div
      className={`grid items-center gap-4 transition-colors duration-100 ${flashId === job.id ? "proto-flash" : ""} ${
        // One column grid for every group, so fit and deadline line up down the page.
        lead ? "grid-cols-[32px_minmax(0,1fr)_64px_150px_196px] px-4 py-3.5 hover:bg-[#FAFBFC]" : "grid-cols-[32px_minmax(0,1fr)_64px_150px_196px] px-4 py-2.5"
      }`}
    >
      <Logo company={job.company} size={lead ? 32 : 24} className={`${lead ? "rounded-[7px]" : "rounded-[6px]"} ${logoCls} ${tone === "lapsed" ? "opacity-60" : ""}`} fallbackClassName={logoFallback} />
      <div className="min-w-0">
        <button
          onClick={onOpen}
          title={job.title}
          className={`block max-w-full truncate rounded-[4px] text-left hover:underline ${focusRing} ${lead ? "text-[14px] font-semibold" : "text-[13px] font-medium text-[#2A2F37]"}`}
        >
          {job.title}
        </button>
        <p className={`mt-0.5 truncate text-[#5F6570] ${lead ? "text-[13px]" : "text-[12.5px]"}`}>
          <span className={lead ? "font-medium text-[#3F4550]" : ""}>{job.company}</span> · {job.location}
          {lead && facts.length > 0 && <span className="hidden xl:inline"> · {facts.slice(0, 3).join(" · ")}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2" aria-label={`Fit ${job.score}`}>
        <SignalBars job={job} height={lead ? 12 : 10} />
        <span className={`font-semibold tabular-nums ${lead ? "text-[14px]" : "text-[13px] text-[#2A2F37]"}`}>{job.score}</span>
      </div>
      <div>
        <p className={`text-[13px] ${dl.state === "soon" ? "font-medium text-[#9A5B00]" : lead ? "font-medium" : "text-[#5F6570]"}`}>{deadlineLabel(job.deadline)}</p>
        {lead && job.deadline && dl.state !== "closed" && <p className="text-[12px] text-[#5F6570]">{shortDate(job.deadline, true)}</p>}
      </div>
      <div className="flex items-center justify-end gap-1">
        {tone === "suggestion" ? (
          <button onClick={() => toggleSaved(job.id)} className={`${btnGhost} h-7 pl-1.5 pr-2 text-[12.5px]`}>
            <Icon name="bookmark" size={13} /> Shortlist
          </button>
        ) : (
          <>
            {lead && (
              <button onClick={() => setStatus(job.id, "applied")} className={`${btnSecondary} h-7 px-2.5 text-[12.5px]`}>
                Mark as applied
              </button>
            )}
            <a href={job.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${job.title} listing`} title="Open listing" className={`grid h-7 w-7 place-items-center rounded-[6px] text-[#5F6570] hover:bg-[#EDEFF2] hover:text-[#0F1217] ${focusRing}`}>
              <Icon name="external" size={14} />
            </a>
            <button onClick={() => toggleSaved(job.id)} aria-label={`Remove ${job.title} from shortlist`} title="Remove from shortlist" className={`proto-press grid h-7 w-7 place-items-center rounded-[6px] text-[#5F6570] hover:bg-[#EDEFF2] hover:text-[#0F1217] ${focusRing}`}>
              <Icon name="x" size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Pipeline: roles I'm progressing ──────────────────────────────────────────

const COLUMNS: Status[] = ["applied", "interview", "offer", "rejected"];

function PipelineView() {
  const { tracked, topUnapplied, setStatus, select, setView, flashId } = useProto();
  const boardRef = useRef<HTMLDivElement>(null);
  const capture = useFlip(boardRef);
  const open = (id: number) => { select(id); setView("dashboard"); };
  const move = (id: number, s: Status) => { capture(); setStatus(id, s); };
  const counts = COLUMNS.map((s) => [s, tracked.filter((j) => j.status === s).length] as const);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-6 pb-28 pt-8 xl:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-[-0.015em]">Pipeline</h1>
            <p className="mt-1 text-[13.5px] text-[#5F6570]">Roles you're actively progressing.</p>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#3F4550]">
            {counts.map(([s, n]) => (
              <span key={s} className={`inline-flex items-center gap-1.5 ${n === 0 ? "text-[#9AA0AA]" : ""}`}>
                <StatusDot status={s} />
                <span className="tabular-nums">{n}</span> {STAGE_LABEL[s].toLowerCase()}
              </span>
            ))}
          </p>
        </header>

        {/* One bordered workspace with stage columns, not free-floating lanes. */}
        <div
          ref={boardRef}
          className="mt-5 grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,0.8fr)] divide-x divide-[#E3E6EA] overflow-hidden rounded-[10px] border border-[#E3E6EA] bg-white"
        >
          {COLUMNS.map((col) => {
            const items = tracked.filter((j) => j.status === col);
            const closedOut = col === "rejected";
            return (
              <section key={col} className={`flex min-h-[220px] flex-col ${closedOut ? "bg-[#FAFAFB]" : ""}`} aria-label={STAGE_LABEL[col]}>
                <header className="flex h-10 items-center gap-2 border-b border-[#EDEFF2] px-3">
                  <StatusDot status={col} />
                  <h2 className={`text-[12.5px] font-semibold ${closedOut ? "text-[#5F6570]" : ""}`}>{STAGE_LABEL[col]}</h2>
                  <span className="text-[12px] tabular-nums text-[#7D838D]">{items.length}</span>
                </header>
                <div className="flex flex-1 flex-col gap-2 bg-[#F7F8F9]/60 p-2">
                  {items.length === 0 && (
                    <p className="px-1.5 pt-1 text-[12.5px] text-[#7D838D]">{closedOut ? "Nothing closed out." : "No roles at this stage."}</p>
                  )}
                  {items.map((j) => (
                    <PipelineCard key={j.id} job={j} flash={flashId === j.id} onOpen={() => open(j.id)} onMove={(s) => move(j.id, s)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {topUnapplied.length > 0 && (
          <section className="mt-9">
            <div className="mb-1 flex items-baseline gap-2 px-1">
              <h2 className="text-[12.5px] font-semibold text-[#454B56]">Ready to apply</h2>
              <span className="text-[12px] text-[#7D838D]">· Highest fit, still open, not yet applied</span>
            </div>
            <ul className="divide-y divide-[#E8EAEE] border-y border-[#E8EAEE]">
              {topUnapplied.map((j) => (
                <li key={j.id} className="grid grid-cols-[24px_minmax(0,1fr)_150px_64px_auto] items-center gap-4 px-1 py-2">
                  <Logo company={j.company} size={24} className={`rounded-[6px] ${logoCls}`} fallbackClassName={logoFallback} />
                  <button onClick={() => open(j.id)} className={`min-w-0 truncate rounded-[4px] text-left text-[13px] font-medium text-[#2A2F37] hover:underline ${focusRing}`}>
                    {j.title} <span className="font-normal text-[#5F6570]">· {j.company}</span>
                  </button>
                  <span className="text-[12.5px] text-[#5F6570]">{deadlineLabel(j.deadline)}</span>
                  <span className="flex items-center gap-2"><SignalBars job={j} height={10} /><span className="text-[13px] font-semibold tabular-nums">{j.score}</span></span>
                  <button onClick={() => move(j.id, "applied")} className={`${btnSecondary} h-7 px-2.5 text-[12.5px]`}>Mark as applied</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function PipelineCard({ job, flash, onOpen, onMove }: { job: ProtoJob; flash: boolean; onOpen: () => void; onMove: (s: Status) => void }) {
  const next = nextStage(job.status);
  const rejected = job.status === "rejected";
  return (
    <article
      data-flip={job.id}
      className={`rounded-[8px] border border-[#E3E6EA] bg-white px-2.5 pb-1.5 pt-2.5 ${flash ? "proto-flash" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Logo company={job.company} size={16} className={`rounded-[4px] ${logoCls} ${rejected ? "opacity-60" : ""}`} fallbackClassName={logoFallback} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#454B56]">{job.company}</span>
        <span className="flex items-center gap-1.5" aria-label={`Fit ${job.score}`}>
          <SignalBars job={job} height={10} />
          <span className="text-[12px] font-semibold tabular-nums">{job.score}</span>
        </span>
      </div>
      <button
        onClick={onOpen}
        title={job.title}
        className={`mt-1.5 line-clamp-2 rounded-[4px] text-left text-[13px] font-medium leading-[1.35] hover:underline ${rejected ? "text-[#5F6570]" : ""} ${focusRing}`}
      >
        {job.title}
      </button>
      <p className="mt-1 text-[12px] text-[#5F6570]">Updated {shortDate(job.updated_at)} · {deadlineLabel(job.deadline)}</p>
      <div className="mt-1.5 flex items-center gap-1">
        {next ? (
          <button onClick={() => onMove(next)} className={`proto-press -ml-1 inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[12.5px] font-medium text-[#2449BC] hover:bg-[#F1F5FE] ${focusRing}`}>
            Move to {STAGE_LABEL[next].toLowerCase()} <Icon name="arrowRight" size={12} stroke={2} />
          </button>
        ) : rejected ? (
          <button onClick={() => onMove("applied")} className={`proto-press -ml-1 inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[12.5px] font-medium text-[#454B56] hover:bg-[#F1F3F5] ${focusRing}`}>
            Reopen as applied
          </button>
        ) : (
          <span className="inline-flex h-7 items-center gap-1 text-[12.5px] text-[#1C7A55]">
            <Icon name="check" size={12} stroke={2.5} /> Offer received
          </span>
        )}
        <span className="flex-1" />
        <CardMenu job={job} onMove={onMove} />
      </div>
    </article>
  );
}

function CardMenu({ job, onMove }: { job: ProtoJob; onMove: (s: Status) => void }) {
  return (
    <Popover
      label="Card actions"
      kind="menu"
      align="end"
      panelClassName="w-[210px] rounded-[10px] border border-[#E3E6EA] bg-white p-1 shadow-[0_12px_32px_rgb(15_18_23/0.12)]"
      trigger={(p) => (
        <button {...p} aria-label={`More actions for ${job.title}`} className={`grid h-7 w-7 place-items-center rounded-[6px] text-[#5F6570] hover:bg-[#F1F3F5] hover:text-[#0F1217] ${focusRing}`}>
          <Icon name="ellipsis" size={16} stroke={2} />
        </button>
      )}
    >
      {(close) => (
        <div onKeyDown={menuKeys}>
          <p className="px-2 pb-1 pt-1.5 text-[11.5px] font-medium text-[#5F6570]">Move to</p>
          {COLUMNS.map((s) => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={job.status === s}
              onClick={() => { close(); onMove(s); }}
              className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-left text-[13px] text-[#2A2F37] outline-none hover:bg-[#F4F5F7] focus-visible:bg-[#F4F5F7]"
            >
              <StatusDot status={s} />
              <span className="flex-1">{STAGE_LABEL[s]}</span>
              {job.status === s && <Icon name="check" size={14} stroke={2} className="text-[#2B55D6]" />}
            </button>
          ))}
          <div className="my-1 h-px bg-[#EDEFF2]" />
          <a href={job.url} target="_blank" rel="noopener noreferrer" role="menuitem" className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-[13px] text-[#2A2F37] outline-none hover:bg-[#F4F5F7] focus-visible:bg-[#F4F5F7]">
            Open listing <Icon name="external" size={13} className="ml-auto text-[#9AA0AA]" />
          </a>
          <MenuItem onClick={() => { close(); onMove("new"); }} muted>Remove from tracking</MenuItem>
        </div>
      )}
    </Popover>
  );
}
