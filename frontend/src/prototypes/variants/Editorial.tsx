import { ReactNode, useMemo, useRef, useState } from "react";
import {
  isManual, ProtoJob, ROLE_GROUP_LABEL, RoleGroup, roleLabel, sourceLabel, Status, STATUS_LABEL,
} from "../data";
import { deadlineLabel, deadlineState, formatDescription, relativeAge, shortDate } from "../extract";
import { Factor, FactorKey } from "../scoring";
import { EMPTY_FILTERS, pickSelected, ProtoFilters, useProto, View } from "../store";
import { BookmarkSwap, highlight, Icon, Logo, menuKeys, Popover, Toaster, useListKeys } from "../primitives";

// Direction B — Editorial / career intelligence.
// Typography carries the hierarchy. Filters read as a sentence; the selected
// role reads as a dossier with the scoring ledger set in the margin.

const ink = "text-[#1A1A18]";
const ink2 = "text-[#55524B]";
const ink3 = "text-[#736F66]";
const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A6B]/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[#FBFAF7]";
const smallCaps = "text-[11px] font-medium uppercase tracking-[0.08em] text-[#736F66]";

const STATUS_TONE: Record<Status, string> = {
  new: "text-[#736F66]",
  applied: "text-[#94650F]",
  interview: "text-[#5B4AA0]",
  offer: "text-[#2F7A4F]",
  rejected: "text-[#A33A2A]",
};

const ROLE_GROUPS: RoleGroup[] = ["placement", "internship", "graduate", "apprenticeship"];

export default function Editorial() {
  const { view, setView, saved, tracked, toast } = useProto();
  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "dashboard", label: "Roles" },
    { id: "saved", label: "Shortlist", count: saved.length },
    { id: "applied", label: "Applications", count: tracked.length },
  ];

  return (
    <div className={`font-ed-sans flex h-screen flex-col bg-[#FBFAF7] text-[13.5px] ${ink}`}>
      <header className="flex h-14 shrink-0 items-center border-b border-[#E4E0D7] px-8">
        <span className="font-ed-serif mr-10 text-[19px] font-medium tracking-[-0.01em]">Internship Radar</span>
        <nav className="flex items-stretch gap-6 self-stretch" aria-label="Main">
          {tabs.map((t) => {
            const active = t.id === view;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-14 items-center gap-1.5 rounded-sm text-[13.5px] transition-colors duration-150 ${focusRing} ${
                  active ? `${ink} font-medium` : `${ink3} hover:text-[#1A1A18]`
                }`}
              >
                {active && <span aria-hidden className="absolute inset-x-0 bottom-[-1px] h-px bg-[#1A1A18]" />}
                {t.label}
                {t.count !== undefined && <span className="font-ed-serif text-[14px] tabular-nums text-[#8C887F]">{t.count}</span>}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <button
            onClick={() => toast("Manual entry uses the existing Add Job form (unchanged in this pass)")}
            className={`proto-press flex items-center gap-1.5 rounded-sm text-[13px] ${ink2} hover:text-[#1A1A18] ${focusRing}`}
          >
            <Icon name="plus" size={14} />
            Add a role
          </button>
          <span className="font-ed-serif grid h-7 w-7 place-items-center rounded-full border border-[#D6D1C6] text-[13px]">H</span>
        </div>
      </header>

      {view === "dashboard" && <RolesView />}
      {view === "saved" && <ShortlistView />}
      {view === "applied" && <ApplicationsView />}

      <Toaster
        className="bottom-6 right-6 w-[340px]"
        toastClassName="rounded-md bg-[#1A1A18] px-4 py-2.5 text-[13px] text-[#FBFAF7] shadow-[0_10px_30px_rgb(26_26_24/0.2)]"
        actionClassName="proto-press rounded-sm text-[13px] font-medium text-[#E9D9A6] underline underline-offset-4 hover:text-white"
      />
    </div>
  );
}

// ── Roles: query sentence, index, dossier ────────────────────────────────────

function RolesView() {
  const { filtered, selectedId, filters, setFilters, activeFilterCount } = useProto();
  const selected = pickSelected(filtered, selectedId);

  return (
    <>
      <QuerySentence />
      <div className="flex min-h-0 flex-1">
        <Index jobs={filtered} selectedId={selected?.id ?? null} />
        <div className="min-w-0 flex-1 overflow-y-auto">
          {selected ? <Dossier key={selected.id} job={selected} /> : (
            <div className="grid h-full place-items-center px-10 text-center">
              <div>
                <p className="font-ed-serif text-[22px]">No roles match this query</p>
                <p className={`mt-2 max-w-[42ch] text-[13.5px] ${ink2}`}>
                  Every listed deadline in the current data has passed, so deadline windows return nothing.
                </p>
                {activeFilterCount > 0 && (
                  <button onClick={() => setFilters({ ...EMPTY_FILTERS, search: filters.search })} className={`mt-4 rounded-sm text-[13.5px] font-medium text-[#1E3A6B] underline underline-offset-4 ${focusRing}`}>
                    Reset the query
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function QuerySentence() {
  const { jobs, filtered, filters, setFilters, activeFilterCount } = useProto();
  const set = (f: Partial<ProtoFilters>) => setFilters({ ...filters, ...f });
  const count = (pred: (j: ProtoJob) => boolean) => jobs.filter(pred).length;
  const sources = [...new Set(jobs.map((j) => j.source))];

  const typeText = filters.roles.length === 0
    ? "any type"
    : filters.roles.length === 1 ? ROLE_GROUP_LABEL[filters.roles[0]].toLowerCase() + "s" : `${filters.roles.length} role types`;
  const deadlineText = { "": "any deadline", "7": "closing within 7 days", "14": "closing within 14 days", "30": "closing within 30 days", none: "no deadline listed" }[filters.deadline];

  return (
    <div className="flex min-h-[52px] shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#E4E0D7] px-8 py-2.5">
      <div className={`min-w-0 flex-1 text-[14px] leading-7 ${ink2}`}>
        Showing <span className={`font-ed-serif text-[17px] tabular-nums ${ink}`}>{filtered.length}</span> roles of{" "}
        <Token label="Role type" text={typeText} active={filters.roles.length > 0}>
          {() => (
            <OptionList>
              {ROLE_GROUPS.map((g) => {
                const on = filters.roles.includes(g);
                return (
                  <OptionItem
                    key={g}
                    kind="checkbox"
                    checked={on}
                    label={ROLE_GROUP_LABEL[g]}
                    count={count((j) => j.role_group === g)}
                    onChange={() => set({ roles: on ? filters.roles.filter((r) => r !== g) : [...filters.roles, g] })}
                  />
                );
              })}
            </OptionList>
          )}
        </Token>
        , in{" "}
        <Token label="Location" text={filters.location ? `“${filters.location}”` : "any location"} active={!!filters.location}>
          {(close) => (
            <div className="p-3">
              <label className={smallCaps} htmlFor="ed-loc">Location contains</label>
              <input
                id="ed-loc"
                data-autofocus
                value={filters.location}
                onChange={(e) => set({ location: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") close(); }}
                placeholder="Manchester, London, Remote"
                className="mt-2 h-9 w-full rounded-md border border-[#D6D1C6] bg-white px-3 text-[13.5px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#A39F95] focus:border-[#1E3A6B]/60 focus:shadow-[0_0_0_3px_rgb(30_58_107/0.12)]"
              />
            </div>
          )}
        </Token>
        , with{" "}
        <Token label="Deadline" text={deadlineText} active={!!filters.deadline}>
          {(close) => (
            <OptionList>
              {(["", "7", "14", "30", "none"] as const).map((v) => (
                <OptionItem
                  key={v}
                  kind="radio"
                  checked={filters.deadline === v}
                  label={{ "": "Any deadline", "7": "Closing within 7 days", "14": "Closing within 14 days", "30": "Closing within 30 days", none: "No deadline listed" }[v]}
                  count={v === "" ? jobs.length : v === "none" ? count((j) => !j.deadline) : count((j) => {
                    const d = deadlineState(j.deadline);
                    return (d.state === "soon" || d.state === "open") && d.days !== null && d.days <= Number(v);
                  })}
                  onChange={() => { set({ deadline: v }); close(); }}
                />
              ))}
            </OptionList>
          )}
        </Token>
        ,{" "}
        <Token label="Fit" text={filters.minScore ? `fit of ${filters.minScore} or more` : "any fit"} active={!!filters.minScore}>
          {(close) => (
            <OptionList>
              {[0, 20, 40, 60].map((n) => (
                <OptionItem key={n} kind="radio" checked={filters.minScore === n} label={n ? `${n} or more` : "Any fit"} count={count((j) => j.score >= n)} onChange={() => { set({ minScore: n }); close(); }} />
              ))}
            </OptionList>
          )}
        </Token>
        ,{" "}
        <Token label="Status" text={filters.status ? STATUS_LABEL[filters.status].toLowerCase() : "any status"} active={!!filters.status}>
          {(close) => (
            <OptionList>
              {(["", "new", "applied", "interview", "offer", "rejected"] as const).map((s) => (
                <OptionItem key={s} kind="radio" checked={filters.status === s} label={s ? STATUS_LABEL[s] : "Any status"} count={s ? count((j) => j.status === s) : jobs.length} onChange={() => { set({ status: s }); close(); }} />
              ))}
            </OptionList>
          )}
        </Token>
        , from{" "}
        <Token label="Source" text={filters.source ? sourceLabel(filters.source) : "all sources"} active={!!filters.source}>
          {(close) => (
            <OptionList>
              <OptionItem kind="radio" checked={!filters.source} label="All sources" count={jobs.length} onChange={() => { set({ source: "" }); close(); }} />
              {sources.map((s) => (
                <OptionItem key={s} kind="radio" checked={filters.source === s} label={sourceLabel(s)} count={count((j) => j.source === s)} onChange={() => { set({ source: s }); close(); }} />
              ))}
            </OptionList>
          )}
        </Token>
        .
        {activeFilterCount > 0 && (
          <button onClick={() => setFilters({ ...EMPTY_FILTERS, search: filters.search })} className={`ml-3 rounded-sm text-[13px] text-[#1E3A6B] underline underline-offset-4 ${focusRing}`}>
            Reset
          </button>
        )}
      </div>
      <label className="relative w-[260px] shrink-0">
        <span className="sr-only">Search roles</span>
        <Icon name="search" size={15} className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[#8C887F]" />
        <input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search titles, companies, text"
          className="h-8 w-full border-b border-[#D6D1C6] bg-transparent pl-6 text-[13.5px] outline-none transition-colors duration-150 placeholder:text-[#A39F95] focus:border-[#1A1A18]"
        />
      </label>
    </div>
  );
}

function Token({
  label, text, active, children,
}: { label: string; text: string; active: boolean; children: (close: () => void) => ReactNode }) {
  return (
    <span className="inline-block [&>div]:inline-block">
      <Popover
        label={label}
        panelClassName="w-[248px] rounded-lg border border-[#E4E0D7] bg-white shadow-[0_14px_36px_rgb(26_26_24/0.12)]"
        trigger={(p, open) => (
          <button
            {...p}
            className={`rounded-sm underline decoration-1 underline-offset-[5px] transition-colors duration-150 ${focusRing} ${
              active ? "font-medium text-[#1E3A6B] decoration-[#1E3A6B]" : `${ink} decoration-[#B5B0A5] decoration-dotted hover:decoration-solid`
            } ${open ? "decoration-solid" : ""}`}
          >
            {text}
          </button>
        )}
      >
        {(close) => children(() => close())}
      </Popover>
    </span>
  );
}

function OptionList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col p-1.5">{children}</div>;
}

function OptionItem({
  kind, checked, label, count, onChange,
}: { kind: "checkbox" | "radio"; checked: boolean; label: string; count?: number; onChange: () => void }) {
  return (
    <label className={`flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13.5px] hover:bg-[#F5F3EE] ${count === 0 && !checked ? "opacity-50" : ""}`}>
      <input type={kind} checked={checked} onChange={onChange} className="peer sr-only" />
      <span aria-hidden className={`grid h-3.5 w-3.5 shrink-0 place-items-center border peer-focus-visible:ring-2 peer-focus-visible:ring-[#1E3A6B]/45 ${kind === "radio" ? "rounded-full" : "rounded-[3px]"} ${checked ? "border-[#1E3A6B] bg-[#1E3A6B]" : "border-[#B5B0A5] bg-white"}`}>
        {checked && (kind === "radio" ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : <Icon name="check" size={10} stroke={3} className="text-white" />)}
      </span>
      <span className={`flex-1 ${checked ? "font-medium" : ""}`}>{label}</span>
      {count !== undefined && <span className="font-ed-serif text-[14px] tabular-nums text-[#8C887F]">{count}</span>}
    </label>
  );
}

function Index({ jobs, selectedId }: { jobs: ProtoJob[]; selectedId: number | null }) {
  const { select, flashId } = useProto();
  const listRef = useRef<HTMLOListElement>(null);
  const onKeyDown = useListKeys(listRef, jobs.map((j) => j.id), selectedId, select);

  return (
    <div className="flex w-[420px] shrink-0 flex-col border-r border-[#E4E0D7] bg-[#F5F3EE] 2xl:w-[460px]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#E4E0D7] px-6">
        <span className={smallCaps}>Index · ranked by fit</span>
        <span className={smallCaps}>Fit</span>
      </div>
      <ol ref={listRef} onKeyDown={onKeyDown} className="flex-1 overflow-y-auto">
        {jobs.map((j, i) => {
          const active = j.id === selectedId;
          return (
            <li key={j.id} className={`border-b border-[#E9E5DC] ${flashId === j.id ? "proto-flash" : ""}`}>
              <button
                data-row={j.id}
                onClick={() => select(j.id)}
                aria-current={active ? "true" : undefined}
                className={`relative grid w-full grid-cols-[26px_minmax(0,1fr)_36px] gap-3 px-6 py-3 text-left transition-colors duration-100 outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(30_58_107/0.45)] ${
                  active ? "bg-[#FBFAF7]" : "hover:bg-[#EFECE5]"
                }`}
              >
                {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[#1A1A18]" />}
                <span className={`pt-[3px] text-[12px] tabular-nums ${ink3}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-[14px] font-medium leading-[1.35]">{j.title}</span>
                  <span className={`mt-1 flex items-center gap-1.5 text-[12.5px] ${ink2}`}>
                    <span className="truncate">{j.company} · {j.location}</span>
                  </span>
                  <span className={`mt-1 flex min-w-0 items-center gap-2 whitespace-nowrap text-[12px] ${ink3}`}>
                    <span>{roleLabel(j.role_type)}</span>
                    <span aria-hidden>—</span>
                    <span className="truncate">{deadlineLabel(j.deadline)}</span>
                    {j.status !== "new" && <span className={`text-[11px] font-medium uppercase tracking-[0.06em] ${STATUS_TONE[j.status]}`}>{STATUS_LABEL[j.status]}</span>}
                    {j.is_saved && <Icon name="bookmark" size={12} filled className="ml-auto text-[#1E3A6B]" />}
                  </span>
                </span>
                <span className="font-ed-serif text-right text-[19px] leading-[1.15] tabular-nums">{j.score}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Dossier ──────────────────────────────────────────────────────────────────

const DESCRIPTION_FACTORS: FactorKey[] = ["tech", "requirements", "stack", "graduate", "unpaid", "offTarget"];

function Dossier({ job }: { job: ProtoJob }) {
  const { toggleSaved, setStatus } = useProto();
  const [hovered, setHovered] = useState<FactorKey | null>(null);
  const [pinned, setPinned] = useState<FactorKey | null>(null);
  const [fullText, setFullText] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const blocks = formatDescription(job.description, job.title);
  const factors = [...job.breakdown.gains, ...job.breakdown.penalties];
  const activeKey = hovered ?? pinned;
  const activeFactor = factors.find((f) => f.key === activeKey);
  const terms = activeFactor && DESCRIPTION_FACTORS.includes(activeFactor.key) ? activeFactor.evidence.map((e) => e.term) : [];
  const markCls = "rounded-[2px] bg-[#F1DE9C] px-[1px] text-[#1A1A18]";

  // Hover only previews highlights in place; it never changes layout.
  // A click pins the rule, opens the full text and brings the first match into view.
  function pin(key: FactorKey) {
    if (pinned === key) { setPinned(null); return; }
    setPinned(key);
    setFullText(true);
    requestAnimationFrame(() => {
      textRef.current?.querySelector("mark")?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }

  return (
    <article className="mx-auto grid max-w-[1040px] grid-cols-1 gap-x-14 px-8 pb-28 pt-10 xl:grid-cols-[minmax(0,1fr)_256px] xl:px-12">
      <div className="min-w-0 xl:col-start-1 xl:row-start-1">
        <div className="flex items-center gap-2.5">
          <Logo company={job.company} size={26} className="rounded-[6px] outline outline-1 -outline-offset-1 outline-black/[0.08]" fallbackClassName="bg-[#ECE8DF] text-[#55524B]" />
          <span className="text-[13.5px] font-medium">{job.company}</span>
          <span aria-hidden className={ink3}>·</span>
          <span className={smallCaps}>{roleLabel(job.role_type)}</span>
        </div>
        <h1 className="font-ed-serif mt-4 text-[38px] font-medium leading-[1.1] tracking-[-0.015em] [text-wrap:balance]">{job.title}</h1>
        <p className={`mt-3 text-[14.5px] leading-6 ${ink2}`}>{job.location}</p>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <a href={job.url} target="_blank" rel="noopener noreferrer" className={`proto-press flex h-9 items-center gap-2 rounded-md bg-[#1E3A6B] px-4 text-[13.5px] font-medium text-white hover:bg-[#172E55] ${focusRing}`}>
            Open listing <Icon name="external" size={14} stroke={2} />
          </a>
          <button
            onClick={() => toggleSaved(job.id)}
            aria-pressed={job.is_saved}
            className={`proto-press flex h-9 items-center gap-2 rounded-md border px-3.5 text-[13.5px] ${focusRing} ${
              job.is_saved ? "border-[#1E3A6B]/30 bg-[#1E3A6B]/[0.06] text-[#1E3A6B]" : "border-[#D6D1C6] hover:bg-[#F5F3EE]"
            }`}
          >
            <BookmarkSwap on={job.is_saved} size={15} />
            {job.is_saved ? "On your shortlist" : "Add to shortlist"}
          </button>
          {job.status === "new" ? (
            <button onClick={() => setStatus(job.id, "applied")} className={`proto-press h-9 rounded-md border border-[#D6D1C6] px-3.5 text-[13.5px] hover:bg-[#F5F3EE] ${focusRing}`}>
              Mark as applied
            </button>
          ) : (
            <StageMenu job={job} />
          )}
        </div>
      </div>

      {/* Below 1280px the margin can't sit beside the text, so it moves up under the actions. */}
      <aside className="mt-10 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:mt-1">
        <div className="grid gap-x-12 gap-y-8 border-t border-[#E4E0D7] pt-6 md:grid-cols-[minmax(0,1fr)_220px] xl:sticky xl:top-8 xl:block xl:border-t-0 xl:pt-0">
          <Ledger job={job} factors={factors} active={activeKey} pinned={pinned} onHover={setHovered} onPin={pin} />
          <div className="xl:mt-8 xl:border-t xl:border-[#E4E0D7] xl:pt-5">
            <h2 className={smallCaps}>Provenance</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row label="Source" value={sourceLabel(job.source)} />
              <Row label={isManual(job.source) ? "Added" : "Collected"} value={`${shortDate(job.created_at, true)}`} note={relativeAge(job.created_at)} />
              {job.status !== "new" && <Row label="Last change" value={shortDate(job.updated_at, true)} />}
            </dl>
          </div>
        </div>
      </aside>

      <div className="min-w-0 xl:col-start-1 xl:row-start-2">
        <section className="mt-10 border-t border-[#E4E0D7] pt-6">
          <h2 className={smallCaps}>At a glance</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-10 gap-y-5">
            <Fact label="Deadline" value={deadlineLabel(job.deadline)} note={job.deadline && job.deadline_state !== "closed" ? shortDate(job.deadline, true) : undefined} />
            <Fact label="Status" value={STATUS_LABEL[job.status]} note={job.status !== "new" ? `Last change ${shortDate(job.updated_at)}` : undefined} />
            {job.facts.map((f) => <Fact key={f.label} label={f.label} value={f.value} title={f.excerpt} />)}
          </dl>
          {job.facts.length === 0 && (
            <p className={`mt-4 text-[13px] ${ink3}`}>No dates, eligibility or salary details were found in the listing text.</p>
          )}
        </section>

        <section className="mt-10 border-t border-[#E4E0D7] pt-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className={smallCaps}>From the listing</h2>
            {terms.length > 0 && (
              <span className="text-[12px] text-[#8A6A12]">
                Highlighting {activeFactor?.label.toLowerCase()}{!fullText && pinned !== activeKey ? " · click the line to jump to it" : ""}
              </span>
            )}
          </div>
          <div ref={textRef} className={`relative mt-4 ${fullText ? "" : "max-h-[420px] overflow-hidden"}`}>
            <div className="font-ed-serif max-w-[64ch] text-[17px] leading-[1.62] text-[#2A2925]">
              {blocks.map((b, i) => (
                <div key={i}>
                  {b.heading && <h3 className="font-ed-sans mb-2 mt-7 text-[13.5px] font-semibold first:mt-0">{b.heading}</h3>}
                  {b.paragraphs.map((para, k) => <p key={k} className="mt-4 first:mt-0">{highlight(para, terms, markCls)}</p>)}
                </div>
              ))}
            </div>
            {!fullText && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#FBFAF7] to-[#FBFAF7]/0" />}
          </div>
          <button onClick={() => setFullText((v) => !v)} className={`mt-3 rounded-sm text-[13.5px] font-medium text-[#1E3A6B] underline underline-offset-4 ${focusRing}`}>
            {fullText ? "Collapse" : "Continue reading"}
          </button>
        </section>
      </div>
    </article>
  );
}

function Fact({ label, value, note, title }: { label: string; value: string; note?: string; title?: string }) {
  return (
    <div title={title}>
      <dt className={`text-[12.5px] ${ink3}`}>{label}</dt>
      <dd className="font-ed-serif mt-0.5 text-[18px] leading-snug">{value}</dd>
      {note && <dd className={`text-[12.5px] ${ink3}`}>{note}</dd>}
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={ink3}>{label}</dt>
      <dd className="text-right">{value}{note && <span className={`block text-[12px] ${ink3}`}>{note}</span>}</dd>
    </div>
  );
}

function Ledger({
  job, factors, active, pinned, onHover, onPin,
}: {
  job: ProtoJob; factors: Factor[]; active: FactorKey | null; pinned: FactorKey | null;
  onHover: (k: FactorKey | null) => void; onPin: (k: FactorKey) => void;
}) {
  const { raw, score } = job.breakdown;
  return (
    <section aria-label="How the fit score is calculated">
      <h2 className={smallCaps}>Fit</h2>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="font-ed-serif text-[56px] font-normal leading-none tabular-nums tracking-[-0.02em]">{score}</span>
        <span className={`text-[13px] ${ink3}`}>/ 100</span>
      </p>
      <ul className="mt-5 border-t border-[#1A1A18]">
        {factors.map((f) => {
          const findable = DESCRIPTION_FACTORS.includes(f.key) && f.evidence.length > 0;
          const isActive = active === f.key;
          return (
            <li key={f.key} className="border-b border-[#E4E0D7]">
              <button
                onMouseEnter={() => findable && onHover(f.key)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => findable && onHover(f.key)}
                onBlur={() => onHover(null)}
                onClick={() => findable && onPin(f.key)}
                aria-pressed={findable ? pinned === f.key : undefined}
                className={`w-full py-2.5 text-left transition-colors duration-150 ${focusRing} ${isActive ? "bg-[#F6EDCB]/60" : ""} ${findable ? "cursor-pointer" : "cursor-default"}`}
                aria-describedby={`ledger-${f.key}`}
              >
                <span className="flex items-baseline gap-2">
                  <span className={`text-[13px] ${f.points === 0 ? ink3 : ink}`}>{f.label}</span>
                  <span aria-hidden className="mb-[3px] flex-1 border-b border-dotted border-[#C9C4B8]" />
                  <span className={`font-ed-serif text-[16px] tabular-nums ${f.penalty ? "text-[#A33A2A]" : f.points === 0 ? "text-[#A39F95]" : ""}`}>
                    {f.points > 0 ? `+${f.points}` : f.points === 0 ? "0" : `−${Math.abs(f.points)}`}
                    {!f.penalty && <span className="font-ed-sans text-[11px] text-[#A39F95]"> /{f.max}</span>}
                  </span>
                </span>
                <span id={`ledger-${f.key}`} className={`mt-0.5 block text-[12px] leading-[1.45] ${ink3}`}>
                  {f.evidence.length > 0
                    ? f.evidence.map((e) => (e.word !== e.term ? `${e.term} (in “${e.word}”)` : e.term)).join(", ")
                    : `Not matched · ${f.rule.toLowerCase()}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between border-b-[3px] border-double border-[#1A1A18] py-2.5">
        <span className="text-[13px] font-medium">{raw !== score ? `Total (raw ${raw}, clamped)` : "Total"}</span>
        <span className="font-ed-serif text-[18px] tabular-nums">{score}</span>
      </div>
      <p className={`mt-3 text-[12px] leading-[1.5] ${ink3}`}>
        Every rule the scorer applies. Hover a line to highlight its evidence; click to jump to it. Keywords match inside longer words too.
      </p>
    </section>
  );
}

function StageMenu({ job, small = false }: { job: ProtoJob; small?: boolean }) {
  const { setStatus } = useProto();
  return (
    <Popover
      label="Change stage"
      kind="menu"
      align={small ? "end" : "start"}
      panelClassName="w-[210px] rounded-lg border border-[#E4E0D7] bg-white p-1.5 shadow-[0_14px_36px_rgb(26_26_24/0.12)]"
      trigger={(p) => (
        <button
          {...p}
          className={`proto-press flex items-center gap-2 rounded-md border border-[#D6D1C6] ${small ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-[13.5px]"} hover:bg-[#F5F3EE] ${focusRing}`}
        >
          <span className={`font-medium ${STATUS_TONE[job.status]}`}>{STATUS_LABEL[job.status]}</span>
          <Icon name="chevronDown" size={12} stroke={2} className={ink3} />
        </button>
      )}
    >
      {(close) => (
        <div onKeyDown={menuKeys}>
          {(["applied", "interview", "offer", "rejected"] as Status[]).map((s) => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={job.status === s}
              onClick={() => { setStatus(job.id, s); close(); }}
              className="flex h-8 w-full items-center rounded-md px-2.5 text-left text-[13.5px] outline-none hover:bg-[#F5F3EE] focus-visible:bg-[#F5F3EE]"
            >
              <span className={`flex-1 ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>
              {job.status === s && <Icon name="check" size={14} stroke={2} />}
            </button>
          ))}
          <div className="my-1 h-px bg-[#E4E0D7]" />
          <button
            role="menuitem"
            onClick={() => { setStatus(job.id, "new"); close(); }}
            className={`flex h-8 w-full items-center rounded-md px-2.5 text-left text-[13.5px] outline-none hover:bg-[#F5F3EE] focus-visible:bg-[#F5F3EE] ${ink3}`}
          >
            Remove from tracking
          </button>
        </div>
      )}
    </Popover>
  );
}

// ── Shortlist: compare saved roles side by side ──────────────────────────────

type SortKey = "fit" | "deadline";

function ShortlistView() {
  const { saved, toggleSaved, select, setView } = useProto();
  const [sort, setSort] = useState<SortKey>("fit");
  const [openId, setOpenId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const list = [...saved];
    if (sort === "fit") list.sort((a, b) => b.score - a.score);
    else list.sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
    return list;
  }, [saved, sort]);

  const cols = "grid grid-cols-[minmax(0,1fr)_120px_140px_130px_60px_110px_36px] items-center gap-5";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1120px] px-8 pb-28 pt-10 xl:px-12">
        <h1 className="font-ed-serif text-[34px] font-medium tracking-[-0.015em]">Shortlist</h1>
        <p className={`mt-2 text-[14.5px] ${ink2}`}>
          <span className="font-ed-serif text-[17px] tabular-nums text-[#1A1A18]">{saved.length}</span> saved roles, compared side by side.
        </p>

        {rows.length === 0 ? (
          <div className="mt-10 border-y border-[#E4E0D7] py-14 text-center">
            <p className="font-ed-serif text-[20px]">Your shortlist is empty</p>
            <p className={`mt-1 text-[13.5px] ${ink2}`}>Add roles from the index to compare them here.</p>
          </div>
        ) : (
          <div className="mt-8 border-t border-[#1A1A18]" role="table" aria-label="Saved roles">
            <div className={`${cols} border-b border-[#E4E0D7] py-2.5 text-[12px] ${ink3}`} role="row">
              <span role="columnheader">Role</span>
              <span role="columnheader">Type</span>
              <span role="columnheader">Location</span>
              <SortHeader label="Deadline" active={sort === "deadline"} onClick={() => setSort("deadline")} />
              <SortHeader label="Fit" active={sort === "fit"} onClick={() => setSort("fit")} align="right" />
              <span role="columnheader">Status</span>
              <span role="columnheader"><span className="sr-only">Actions</span></span>
            </div>
            {rows.map((j) => {
              const open = openId === j.id;
              return (
                <div key={j.id} role="rowgroup" className="border-b border-[#E4E0D7]">
                  <div className={`${cols} py-3.5 transition-colors duration-100 hover:bg-[#F5F3EE]/70`} role="row">
                    <button
                      onClick={() => setOpenId(open ? null : j.id)}
                      aria-expanded={open}
                      className={`flex min-w-0 items-center gap-3 rounded-sm text-left ${focusRing}`}
                      role="cell"
                    >
                      <Icon name="chevronRight" size={14} className={`text-[#A39F95] transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
                      <Logo company={j.company} size={28} className="rounded-[6px] outline outline-1 -outline-offset-1 outline-black/[0.08]" fallbackClassName="bg-[#ECE8DF] text-[#55524B]" />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{j.title}</span>
                        <span className={`block truncate text-[12.5px] ${ink3}`}>{j.company}</span>
                      </span>
                    </button>
                    <span role="cell" className={`text-[13px] ${ink2}`}>{roleLabel(j.role_type)}</span>
                    <span role="cell" className={`truncate text-[13px] ${ink2}`}>{j.location}</span>
                    <span role="cell" className={`text-[13px] ${j.deadline_state === "closed" ? ink3 : ink2}`}>{deadlineLabel(j.deadline)}</span>
                    <span role="cell" className="font-ed-serif text-right text-[20px] tabular-nums">{j.score}</span>
                    <span role="cell" className={`text-[11.5px] font-medium uppercase tracking-[0.06em] ${STATUS_TONE[j.status]}`}>{STATUS_LABEL[j.status]}</span>
                    <span role="cell">
                      <button
                        onClick={() => toggleSaved(j.id)}
                        aria-label={`Remove ${j.title} from shortlist`}
                        title="Remove from shortlist"
                        className={`proto-press grid h-8 w-8 place-items-center rounded-md text-[#8C887F] hover:bg-[#ECE8DF] hover:text-[#1A1A18] ${focusRing}`}
                      >
                        <Icon name="x" size={15} />
                      </button>
                    </span>
                  </div>
                  {open && (
                    <div className="proto-reveal grid grid-cols-[minmax(0,1fr)_280px] gap-12 pb-6 pl-[70px] pr-10">
                      <div>
                        <p className={smallCaps}>At a glance</p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-2 text-[13.5px]">
                          {j.facts.length === 0 && <dd className={ink3}>No dates, eligibility or salary details found.</dd>}
                          {j.facts.map((f) => (
                            <div key={f.label} className="flex gap-3" title={f.excerpt}>
                              <dt className={`w-[100px] shrink-0 ${ink3}`}>{f.label}</dt>
                              <dd>{f.value}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="mt-5 flex gap-4">
                          <button onClick={() => { select(j.id); setView("dashboard"); }} className={`rounded-sm text-[13.5px] font-medium text-[#1E3A6B] underline underline-offset-4 ${focusRing}`}>
                            Read the full dossier
                          </button>
                          <a href={j.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 rounded-sm text-[13.5px] ${ink2} underline underline-offset-4 ${focusRing}`}>
                            Open listing <Icon name="external" size={13} />
                          </a>
                        </div>
                      </div>
                      <div>
                        <p className={smallCaps}>Fit, line by line</p>
                        <ul className="mt-2 text-[13px]">
                          {[...j.breakdown.gains, ...j.breakdown.penalties].map((f) => (
                            <li key={f.key} className="flex items-baseline gap-2 py-0.5">
                              <span className={f.points === 0 ? ink3 : ""}>{f.label}</span>
                              <span aria-hidden className="mb-[3px] flex-1 border-b border-dotted border-[#C9C4B8]" />
                              <span className={`font-ed-serif tabular-nums ${f.penalty ? "text-[#A33A2A]" : f.points === 0 ? "text-[#A39F95]" : ""}`}>
                                {f.points > 0 ? `+${f.points}` : f.points === 0 ? "0" : `−${Math.abs(f.points)}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SortHeader({ label, active, onClick, align = "left" }: { label: string; active: boolean; onClick: () => void; align?: "left" | "right" }) {
  return (
    <span role="columnheader" aria-sort={active ? (label === "Fit" ? "descending" : "ascending") : "none"} className={align === "right" ? "text-right" : ""}>
      <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-sm ${focusRing} ${active ? "font-medium text-[#1A1A18]" : "hover:text-[#1A1A18]"}`}>
        {label}
        <Icon name="chevronDown" size={11} stroke={2} className={active ? "" : "opacity-40"} />
      </button>
    </span>
  );
}

// ── Applications: a ledger ───────────────────────────────────────────────────

const STAGE_ORDER: Status[] = ["offer", "interview", "applied", "rejected"];
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => WORDS[n] ?? String(n);

function ApplicationsView() {
  const { tracked, topUnapplied, select, setView, flashId } = useProto();
  const rows = [...tracked].sort((a, b) => STAGE_ORDER.indexOf(a.status) - STAGE_ORDER.indexOf(b.status));
  const parts = STAGE_ORDER
    .map((s) => [s, tracked.filter((j) => j.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${word(n)} ${s === "interview" ? "interviewing" : STATUS_LABEL[s].toLowerCase()}`);
  const cols = "grid grid-cols-[minmax(0,1fr)_150px_120px_140px_56px_36px] items-center gap-5";
  const open = (id: number) => { select(id); setView("dashboard"); };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1120px] px-8 pb-28 pt-10 xl:px-12">
        <h1 className="font-ed-serif text-[34px] font-medium tracking-[-0.015em]">Applications</h1>
        <p className={`mt-2 text-[14.5px] ${ink2}`}>
          {tracked.length === 0
            ? "Nothing tracked yet. Mark a role as applied to start the ledger."
            : <><span className="font-ed-serif text-[17px] tabular-nums text-[#1A1A18]">{tracked.length}</span> tracked: {parts.join(", ")}.</>}
        </p>

        {rows.length > 0 && (
          <div className="mt-8 border-t border-[#1A1A18]" role="table" aria-label="Tracked applications">
            <div className={`${cols} border-b border-[#E4E0D7] py-2.5 text-[12px] ${ink3}`} role="row">
              <span role="columnheader">Role</span>
              <span role="columnheader">Stage</span>
              <span role="columnheader">Last change</span>
              <span role="columnheader">Deadline</span>
              <span role="columnheader" className="text-right">Fit</span>
              <span role="columnheader"><span className="sr-only">Listing</span></span>
            </div>
            {rows.map((j) => (
              <div key={j.id} role="row" className={`${cols} border-b border-[#E4E0D7] py-3.5 hover:bg-[#F5F3EE]/70 ${flashId === j.id ? "proto-flash" : ""}`}>
                <button role="cell" onClick={() => open(j.id)} className={`flex min-w-0 items-center gap-3 rounded-sm text-left ${focusRing}`}>
                  <Logo company={j.company} size={28} className="rounded-[6px] outline outline-1 -outline-offset-1 outline-black/[0.08]" fallbackClassName="bg-[#ECE8DF] text-[#55524B]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium hover:underline">{j.title}</span>
                    <span className={`block truncate text-[12.5px] ${ink3}`}>{j.company} · {j.location}</span>
                  </span>
                </button>
                <span role="cell"><StageMenu job={j} small /></span>
                <span role="cell" className={`text-[13px] tabular-nums ${ink2}`} title="Most recent status or save change">{shortDate(j.updated_at, true)}</span>
                <span role="cell" className={`text-[13px] ${j.deadline_state === "closed" ? ink3 : ink2}`}>{deadlineLabel(j.deadline)}</span>
                <span role="cell" className="font-ed-serif text-right text-[20px] tabular-nums">{j.score}</span>
                <a role="cell" href={j.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${j.title} listing`} className={`grid h-8 w-8 place-items-center rounded-md text-[#8C887F] hover:bg-[#ECE8DF] hover:text-[#1A1A18] ${focusRing}`}>
                  <Icon name="external" size={14} />
                </a>
              </div>
            ))}
          </div>
        )}

        <section className="mt-16">
          <h2 className="font-ed-serif text-[22px] font-medium">Highest-fit roles you haven't applied to</h2>
          <ol className="mt-4 border-t border-[#E4E0D7]">
            {topUnapplied.map((j, i) => (
              <li key={j.id} className="border-b border-[#E4E0D7]">
                <button onClick={() => open(j.id)} className={`grid w-full grid-cols-[28px_minmax(0,1fr)_150px_40px] items-baseline gap-4 py-3 text-left hover:bg-[#F5F3EE]/70 ${focusRing}`}>
                  <span className={`text-[12px] tabular-nums ${ink3}`}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 truncate text-[14px]"><span className="font-medium">{j.title}</span><span className={ink3}> — {j.company}</span></span>
                  <span className={`text-[13px] ${ink3}`}>{deadlineLabel(j.deadline)}</span>
                  <span className="font-ed-serif text-right text-[18px] tabular-nums">{j.score}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
