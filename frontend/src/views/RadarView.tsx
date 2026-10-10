import { RefObject, useEffect, useId, useLayoutEffect, useRef } from "react";
import { deadlineLabel, STATUS_LABEL, roleShort } from "../lib/listing";
import { EMPTY_FILTERS, filterTokens } from "../lib/filters";
import { RadarJob } from "../lib/jobs";
import { pickSelected, useStore } from "../store";
import { FitValue, SignalBars, StatusDot } from "../ui/marks";
import { Icon, isTyping, Logo, Popover, useListKeys, useSessionFlag } from "../ui/primitives";
import { btnGhost, btnSecondary, focusRing, logoCls, logoFallback } from "../ui/styles";
import { Detail } from "./Detail";
import { FilterPanel } from "./FilterPanel";

export function RadarView() {
  const { wide, jobs } = useStore();
  if (jobs.length === 0) {
    return (
      <div className="grid flex-1 place-items-center px-6 text-center">
        <div>
          <p className="text-[14px] font-medium">No roles yet</p>
          <p className="mx-auto mt-1 max-w-[44ch] text-[13px] text-[#5F6570]">Run the RateMyPlacement collector, or use Add role to enter one by hand.</p>
        </div>
      </div>
    );
  }
  return wide ? <TwoPane /> : <SinglePane />;
}

/** j / k move between roles from anywhere on the page, except while typing or inside a menu or dialog. */
function useRoleKeys(jobs: RadarJob[], selectedId: number | null, onMove: (id: number) => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || (e.key !== "j" && e.key !== "k")) return;
      if (isTyping(e.target) || (e.target as HTMLElement).closest("[role=dialog], [role=menu]")) return;
      const ids = jobs.map((j) => j.id);
      const i = Math.max(0, ids.indexOf(selectedId ?? -1));
      const next = ids[Math.min(ids.length - 1, Math.max(0, i + (e.key === "j" ? 1 : -1)))];
      if (next === undefined || next === selectedId) return;
      e.preventDefault();
      onMove(next);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [jobs, selectedId, onMove]);
}

// ── ≥1024px: collapsible feed beside the detail ──────────────────────────────

function TwoPane() {
  const { filtered, selectedId, select } = useStore();
  const [listHidden, setListHidden] = useSessionFlag("radar:role-list-hidden");
  const selected = pickSelected(filtered, selectedId);
  const position = selected ? filtered.findIndex((j) => j.id === selected.id) + 1 : 0;
  const paneRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const listId = useId();

  // The hidden list stays mounted, so its scroll position survives, but leaves the
  // tab order and the accessibility tree.
  useEffect(() => {
    paneRef.current?.toggleAttribute("inert", listHidden);
  }, [listHidden]);

  useRoleKeys(filtered, selected?.id ?? null, (id) => {
    select(id);
    if (!listHidden) {
      requestAnimationFrame(() => paneRef.current?.querySelector(`[data-row="${id}"]`)?.scrollIntoView({ block: "nearest" }));
    }
  });

  // A newly selected role starts at the top of its detail.
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [selected?.id]);

  // Showing the list keeps its scroll position. The selected row is only brought into
  // view on first load, or if j/k changed the selection while the list was hidden.
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
            <FeedToolbar reserveToggle />
            <Feed jobs={filtered} selectedId={selected?.id ?? null} onOpen={select} />
          </section>
        </div>
        <PanelToggle hidden={listHidden} onToggle={() => setListHidden(!listHidden)} controls={listId} />
        {listHidden && position > 0 && (
          <p className="ui-reveal absolute inset-x-0 top-[52px] text-center text-[11px] leading-[14px] tabular-nums text-[#5F6570]" title="Use j and k to move between roles">
            <span className="block text-[12px] font-semibold text-[#0F1217]">{position}</span>
            of {filtered.length}
          </p>
        )}
      </div>
      <section ref={detailRef} className="min-w-0 flex-1 overflow-y-auto overscroll-contain bg-white" aria-label="Role details">
        {selected ? <Detail key={selected.id} job={selected} wide={listHidden} /> : <NoSelection />}
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
      className={`ui-press group absolute right-1.5 top-3 z-20 grid h-8 w-8 place-items-center rounded-[7px] text-[#5F6570] hover:bg-[#E8EAEE] hover:text-[#0F1217] ${focusRing}`}
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

// ── <1024px: the list, then the selected role on its own screen ─────────────

function SinglePane() {
  const { filtered, selectedId, select, detailOpen, detailFrom, openDetail, closeDetail } = useStore();
  const selected = pickSelected(filtered, selectedId);
  const showDetail = detailOpen && selected !== null;
  const position = selected ? filtered.findIndex((j) => j.id === selected.id) + 1 : 0;
  const feedRef = useRef<HTMLUListElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const listScroll = useRef<number | null>(null);

  useRoleKeys(filtered, selected?.id ?? null, (id) => {
    select(id);
    if (showDetail) detailRef.current?.scrollTo({ top: 0 });
    else requestAnimationFrame(() => feedRef.current?.querySelector(`[data-row="${id}"]`)?.scrollIntoView({ block: "nearest" }));
  });

  const open = (id: number) => {
    listScroll.current = feedRef.current?.scrollTop ?? null;
    openDetail(id);
  };

  // Entering the detail moves focus to its heading; leaving it restores the list where it was.
  useLayoutEffect(() => {
    if (showDetail) {
      detailRef.current?.scrollTo({ top: 0 });
      detailRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
      return;
    }
    const feed = feedRef.current;
    if (!feed || !selected) return;
    const row = feed.querySelector<HTMLElement>(`[data-row="${selected.id}"]`);
    if (listScroll.current !== null) feed.scrollTop = listScroll.current;
    else row?.scrollIntoView({ block: "nearest" });
    listScroll.current = null;
    row?.focus({ preventScroll: true });
    // Only when switching between list and detail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetail]);

  return (
    <>
      <section aria-label="Roles" className={`min-w-0 flex-1 flex-col bg-[#F4F5F7] ${showDetail ? "hidden" : "flex"}`}>
        <FeedToolbar />
        <Feed jobs={filtered} selectedId={selected?.id ?? null} onOpen={open} listRef={feedRef} />
      </section>
      {showDetail && (
        <section ref={detailRef} className="min-w-0 flex-1 overflow-y-auto overscroll-contain bg-white" aria-label="Role details">
          <div className="sticky top-0 z-20 flex h-11 items-center justify-between border-b border-[#E3E6EA] bg-white/95 pl-1.5 pr-4 backdrop-blur-sm">
            <button onClick={closeDetail} className={`${btnGhost} pl-1`}>
              <Icon name="chevronLeft" size={16} stroke={2} />
              {detailFrom === "shortlist" ? "Back to Shortlist" : detailFrom === "pipeline" ? "Back to Pipeline" : "Back to results"}
            </button>
            {position > 0 && (
              <span className="text-[12px] tabular-nums text-[#5F6570]">{position} of {filtered.length}</span>
            )}
          </div>
          <Detail key={selected.id} job={selected} wide={false} />
        </section>
      )}
    </>
  );
}

// ── Feed ─────────────────────────────────────────────────────────────────────

function FeedToolbar({ reserveToggle = false }: { reserveToggle?: boolean }) {
  const { filtered, filters, setFilters, activeFilterCount } = useStore();
  const tokens = filterTokens(filters);

  return (
    <div className={`shrink-0 border-b border-[#E3E6EA] pb-2 pl-3 pt-3 ${reserveToggle ? "pr-11" : "pr-3"}`}>
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search roles</span>
          <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AA0AA]" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search roles or companies"
            className="h-8 w-full rounded-[7px] border border-[#E3E6EA] bg-white pl-8 pr-2.5 text-[13px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#6B717B] hover:border-[#D3D7DD] focus:border-[#2B55D6]/50 focus:shadow-[0_0_0_3px_rgb(43_85_214/0.12)] [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        <Popover
          label="Filters"
          align="end"
          sheet
          panelClassName="w-[340px] rounded-[10px] border border-[#E3E6EA] bg-white shadow-[0_12px_32px_rgb(15_18_23/0.12),0_2px_6px_rgb(15_18_23/0.05)]"
          trigger={(p, open) => (
            <button
              {...p}
              aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} applied` : "Filters"}
              className={`ui-press inline-flex h-8 items-center gap-1.5 rounded-[7px] border pl-2.5 pr-2.5 text-[13px] font-medium ${focusRing} ${
                open || activeFilterCount > 0
                  ? "border-[#C9D5F6] bg-[#F1F5FE] text-[#2449BC]"
                  : "border-[#E3E6EA] bg-white text-[#2A2F37] hover:border-[#D3D7DD] hover:bg-[#F7F8F9]"
              }`}
            >
              <Icon name="sliders" size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span aria-hidden className="grid h-4 min-w-4 place-items-center rounded-[4px] bg-[#2B55D6] px-1 text-[11px] font-semibold tabular-nums text-white">{activeFilterCount}</span>
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
              className={`ui-press inline-flex h-6 max-w-full items-center gap-1 rounded-[6px] bg-[#E9ECF1] pl-2 pr-1 text-[12px] font-medium text-[#2A2F37] hover:bg-[#DFE3EA] ${focusRing}`}
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
        <span aria-live="polite"><span className="font-semibold tabular-nums text-[#0F1217]">{filtered.length}</span> {filtered.length === 1 ? "role" : "roles"}</span>
        <span>Best fit first</span>
      </div>
    </div>
  );
}

function Feed({
  jobs, selectedId, onOpen, listRef: externalRef,
}: { jobs: RadarJob[]; selectedId: number | null; onOpen: (id: number) => void; listRef?: RefObject<HTMLUListElement> }) {
  const { select, flashId, filters, setFilters, jobs: all } = useStore();
  const ownRef = useRef<HTMLUListElement>(null);
  const listRef = externalRef ?? ownRef;
  const onKeyDown = useListKeys(listRef, jobs.map((j) => j.id), selectedId, select);

  if (jobs.length === 0) {
    const deadlineWindow = filters.deadline !== "" && filters.deadline !== "none";
    const anyOpen = all.some((j) => j.deadline_state === "soon" || j.deadline_state === "open");
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-[13.5px] font-medium">No roles match {filters.search.trim() ? "this search" : "these filters"}</p>
        <p className="mx-auto mt-1 max-w-[32ch] text-[12.5px] text-[#5F6570]">
          {deadlineWindow && !anyOpen
            ? "Every listed deadline has passed, so deadline windows return nothing."
            : "Try removing a filter or changing your search."}
        </p>
        <button onClick={() => setFilters(EMPTY_FILTERS)} className={`${btnSecondary} mt-4`}>
          Clear {filters.search.trim() ? "search and filters" : "filters"}
        </button>
      </div>
    );
  }

  // One tab stop for the whole list; arrow keys and j / k move within it.
  const tabStop = jobs.some((j) => j.id === selectedId) ? selectedId : jobs[0].id;

  return (
    <ul ref={listRef} onKeyDown={onKeyDown} className="ui-noscrollbar flex-1 overflow-y-auto overscroll-contain">
      {jobs.map((j) => {
        const active = j.id === selectedId;
        return (
          <li
            key={j.id}
            className={`relative border-b ${active ? "z-10 border-[#DCDFE4] bg-white shadow-[inset_0_1px_0_#DCDFE4]" : "border-[#E8EAEE]"} ${flashId === j.id ? "ui-flash" : ""}`}
          >
            <button
              data-row={j.id}
              tabIndex={j.id === tabStop ? 0 : -1}
              onClick={() => onOpen(j.id)}
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
                  {j.is_saved && (
                    <span className="ml-auto inline-flex shrink-0">
                      <Icon name="bookmark" size={12} filled className="text-[#8A909A]" />
                      <span className="sr-only">Shortlisted</span>
                    </span>
                  )}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1.5 pt-0.5">
                <FitValue score={j.fit_score} className="text-[14px] font-semibold leading-4 tabular-nums" />
                <SignalBars job={j} height={11} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
