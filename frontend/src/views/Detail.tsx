import { ReactNode, RefObject, useEffect, useRef, useState } from "react";
import {
  deadlineLabel, deadlineState, formatDescription, isManual, nextStage, relativeAge, roleLabel, shortDate,
  sourceLabel, STAGES, STATUS_LABEL,
} from "../lib/listing";
import { RadarJob, useStore } from "../store";
import { FitRule, RuleKey } from "../types";
import { firedPenalties, matchedCount, SignalRings, StatusDot } from "../ui/marks";
import { BookmarkSwap, Icon, Logo, menuKeys, Popover } from "../ui/primitives";
import { btnGhost, btnPrimary, btnSecondary, focusRing, logoCls, logoFallback, menuPanel } from "../ui/styles";

export function Detail({ job, wide }: { job: RadarJob; wide: boolean }) {
  const { setSaved } = useStore();
  const [focus, setFocus] = useState<RuleKey | null>(null);
  const breakdownRef = useRef<HTMLElement>(null);
  const dl = deadlineState(job.deadline);
  const openBreakdown = () => breakdownRef.current?.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start",
  });
  // The chip sits beside the title only when there is room for both; otherwise it joins the action row.
  const chipBeside = wide ? "block" : "hidden xl:block";
  const chipInline = wide ? "hidden" : "sm:ml-auto xl:hidden"; // left-aligned when it wraps on a phone

  return (
    // With the list hidden, the page widens and centres, but text keeps a reading measure.
    <article className={wide ? "mx-auto max-w-[1120px] px-10 pb-28 pt-8" : "max-w-[880px] px-4 pb-28 pt-5 sm:px-6 sm:pt-7 xl:px-10"}>
      <header className="flex items-start gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Logo company={job.company} size={24} className={`rounded-[6px] ${logoCls}`} fallbackClassName={logoFallback} />
            <span className="truncate text-[13.5px] font-medium leading-6 text-[#3F4550]">{job.company}</span>
          </div>
          <h1 tabIndex={-1} className={`mt-2.5 text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] outline-none [text-wrap:balance] sm:text-[26px] sm:leading-[1.18] ${wide ? "max-w-[36ch]" : ""}`}>{job.title}</h1>
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
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <button
              onClick={() => setSaved(job.id, !job.is_saved)}
              aria-pressed={job.is_saved}
              className={job.is_saved
                ? `ui-press inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#D6DEF5] bg-[#F4F7FE] pl-2.5 pr-3 text-[13px] font-medium text-[#2449BC] ${focusRing}`
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

      <Listing job={job} />
    </article>
  );
}

function Provenance({ job }: { job: RadarJob }) {
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

function FitChip({ job, focus, onOpen, compact }: { job: RadarJob; focus: RuleKey | null; onOpen: () => void; compact?: boolean }) {
  const n = matchedCount(job);
  const p = firedPenalties(job).length;
  const label = `Fit ${job.fit_score} of 100, ${n} of 5 rules matched${p ? `, ${p} ${p === 1 ? "penalty" : "penalties"}` : ""}. Show breakdown.`;

  if (compact) {
    return (
      <button onClick={onOpen} aria-label={label} className={`ui-press inline-flex h-8 items-center gap-2 rounded-[7px] border border-[#E3E6EA] bg-white pl-1.5 pr-2.5 hover:border-[#D3D7DD] hover:bg-[#F7F8F9] ${focusRing}`}>
        <SignalRings job={job} size={22} focus={focus} />
        <span className="text-[13.5px] font-semibold tabular-nums">{job.fit_score}</span>
        <span className="text-[12px] text-[#5F6570]">{n}/5 rules{p ? " · penalty" : ""}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      aria-label={label}
      className={`ui-press group flex shrink-0 items-center gap-2.5 rounded-[10px] border border-[#E6E8EC] bg-white py-2 pl-2 pr-3 text-left hover:border-[#D3D7DD] hover:bg-[#FAFBFC] ${focusRing}`}
    >
      <SignalRings job={job} size={36} focus={focus} />
      <span>
        <span className="flex items-baseline gap-0.5">
          <span className="text-[20px] font-semibold leading-none tabular-nums tracking-[-0.02em]">{job.fit_score}</span>
          <span className="text-[11.5px] text-[#6B717B]">/100</span>
        </span>
        <span className="mt-1 block whitespace-nowrap text-[12px] text-[#5F6570] group-hover:text-[#2A2F37]">
          {n} of 5 rules{p > 0 ? ` · ${p} ${p === 1 ? "penalty" : "penalties"}` : ""}
        </span>
      </span>
    </button>
  );
}

// ── Application tracker ──────────────────────────────────────────────────────

function ApplicationTracker({ job }: { job: RadarJob }) {
  const { setStatus } = useStore();
  const sectionRef = useRef<HTMLElement>(null);
  const [refocus, setRefocus] = useState(false);
  const rejected = job.status === "rejected";
  const untrack = (close: (restoreFocus?: boolean) => void) => {
    close(false);
    setRefocus(true);
    setStatus(job.id, "new");
  };
  // The menu trigger disappears with tracking, so focus moves to the now-current stage.
  useEffect(() => {
    if (!refocus) return;
    sectionRef.current?.querySelector<HTMLElement>("[aria-current=step]")?.focus();
    setRefocus(false);
  }, [refocus]);
  const pos = rejected ? -1 : STAGES.indexOf(job.status);
  const next = nextStage(job.status);
  const tracked = job.status !== "new";

  const summary = rejected
    ? `Rejected ${shortDate(job.updated_at)} · choose a stage to reopen`
    : job.status === "new"
      ? "Not applied yet"
      : `${STATUS_LABEL[job.status]} · updated ${shortDate(job.updated_at)}`;

  return (
    <section ref={sectionRef} className="mt-6 rounded-[10px] border border-[#E3E6EA]" aria-labelledby="application-h">
      <div className="flex h-11 items-center gap-2.5 pl-4 pr-1.5">
        <h2 id="application-h" className="shrink-0 text-[13.5px] font-semibold">Application</h2>
        <span aria-hidden className="h-3.5 w-px shrink-0 bg-[#E3E6EA]" />
        <p className={`flex min-w-0 items-center gap-1.5 text-[12.5px] ${rejected ? "text-[#B23A2C]" : "text-[#5F6570]"}`}>
          <StatusDot status={job.status} />
          <span className="truncate">{summary}</span>
        </p>
        <span className="flex-1" />
        {tracked && (
          <Popover
            label="More application actions"
            kind="menu"
            align="end"
            panelClassName={menuPanel}
            trigger={(p) => (
              <button {...p} aria-label="More application actions" className={`grid h-8 w-8 shrink-0 place-items-center rounded-[7px] text-[#5F6570] hover:bg-[#F1F3F5] hover:text-[#0F1217] ${focusRing}`}>
                <Icon name="ellipsis" size={16} stroke={2} />
              </button>
            )}
          >
            {(close) => (
              <div onKeyDown={menuKeys}>
                {!rejected && (
                  <MenuItem onClick={() => { close(); setStatus(job.id, "rejected"); }}>
                    <StatusDot status="rejected" /> Mark as rejected
                  </MenuItem>
                )}
                <MenuItem onClick={() => untrack(close)} muted>Remove from tracking</MenuItem>
              </div>
            )}
          </Popover>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-[#EDEFF2] px-2 py-2 sm:flex-row sm:items-center sm:gap-3 sm:pl-2.5">
        <ol className="grid min-w-0 grid-cols-4 sm:flex sm:flex-1 sm:items-center sm:gap-1" aria-label="Stages">
          {STAGES.map((s, i) => {
            const done = !rejected && i < pos;
            const current = !rejected && i === pos;
            return (
              <li key={s} className={`flex min-w-0 items-center justify-center gap-1 sm:justify-start ${i < STAGES.length - 1 ? "sm:flex-1" : ""}`}>
                <button
                  onClick={() => setStatus(job.id, s)}
                  aria-current={current ? "step" : undefined}
                  aria-label={`${STATUS_LABEL[s]}${current ? ", current stage" : done ? ", completed" : ""}`}
                  className={`group flex min-w-0 shrink-0 flex-col items-center gap-1 rounded-[7px] px-1 py-1.5 transition-colors duration-150 sm:h-8 sm:flex-row sm:gap-2 sm:py-0 sm:pl-1.5 sm:pr-2.5 ${focusRing} ${
                    current ? "bg-[#EEF3FE]" : "hover:bg-[#F4F5F7]"
                  }`}
                >
                  <StageMark done={done} current={current} />
                  <span className={`whitespace-nowrap text-[12px] sm:text-[12.5px] ${current ? "font-semibold text-[#0F1217]" : "text-[#454B56] group-hover:text-[#0F1217]"}`}>
                    {STATUS_LABEL[s]}
                  </span>
                </button>
                {i < STAGES.length - 1 && (
                  <span aria-hidden className={`hidden h-px min-w-3 flex-1 transition-colors duration-200 sm:block ${done ? "bg-[#AEB3BB]" : "bg-[#E3E6EA]"}`} />
                )}
              </li>
            );
          })}
        </ol>
        {next && (
          <>
            <span aria-hidden className="hidden h-5 w-px shrink-0 bg-[#E3E6EA] sm:block" />
            <button onClick={() => setStatus(job.id, next)} className={`${btnSecondary} shrink-0 justify-center pr-2.5`}>
              {job.status === "new" ? "Mark as applied" : `Move to ${STATUS_LABEL[next].toLowerCase()}`}
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
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 border-[#2B55D6] bg-white">
        <span className="h-1.5 w-1.5 rounded-full bg-[#2B55D6]" />
      </span>
    );
  }
  if (done) {
    return (
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#E3E6EA] text-[#454B56]">
        <Icon name="check" size={10} stroke={3} />
      </span>
    );
  }
  return <span className="h-4 w-4 shrink-0 rounded-full border-[1.5px] border-[#B5BAC2] bg-white transition-colors duration-150 group-hover:border-[#7D838D]" />;
}

export function MenuItem({ children, onClick, muted }: { children: ReactNode; onClick: () => void; muted?: boolean }) {
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

// ── Fit breakdown (from the backend scorer) ──────────────────────────────────

function FitBreakdown({
  job, focus, onFocus, sectionRef, wide,
}: { job: RadarJob; focus: RuleKey | null; onFocus: (k: RuleKey | null) => void; sectionRef: RefObject<HTMLElement>; wide: boolean }) {
  const fb = job.fit_breakdown;
  const rules = fb.rules.filter((r) => r.kind === "gain" || r.state === "penalty");
  // Narrow screens put the evidence on its own line under the rule name.
  const cols = `grid-cols-[18px_minmax(0,1fr)_36px_34px] ${
    wide ? "sm:grid-cols-[18px_200px_minmax(0,1fr)_40px_40px]" : "sm:grid-cols-[18px_150px_minmax(0,1fr)_36px_36px] xl:grid-cols-[18px_170px_minmax(0,1fr)_40px_40px]"
  }`;
  const evidenceCell = "col-span-3 col-start-2 row-start-2 sm:col-span-1 sm:col-start-auto sm:row-start-auto";
  const stale = fb.score !== job.fit_score;

  return (
    <section ref={sectionRef} className="mt-9 scroll-mt-14 lg:scroll-mt-6" aria-labelledby="breakdown-h">
      <div className="flex items-baseline justify-between gap-4 px-1">
        <h2 id="breakdown-h" className="text-[13.5px] font-semibold">Why this scores {job.fit_score}</h2>
        <span className="text-[12px] text-[#5F6570]">{matchedCount(job)} of 5 rules matched</span>
      </div>
      <ul className="mt-2.5 border-t border-[#E3E6EA]" onMouseLeave={() => onFocus(null)}>
        {rules.map((r) => {
          const hit = r.points > 0;
          const penalty = r.state === "penalty";
          return (
            <li
              key={r.key}
              onMouseEnter={() => onFocus(r.key)}
              className={`grid ${cols} items-start gap-x-3 gap-y-0.5 border-b border-[#EDEFF2] px-1 py-2 transition-colors duration-150 ${focus === r.key ? "bg-[#F6F8FE]" : ""}`}
            >
              <RuleIcon rule={r} />
              <span className={`text-[13px] leading-5 ${penalty || hit ? "font-medium text-[#0F1217]" : "text-[#5F6570]"}`}>{r.label}</span>
              <span className={`text-[12.5px] leading-5 text-[#5F6570] ${evidenceCell}`}>
                {r.evidence.length > 0
                  ? r.evidence.map((e, i) => (
                      <span key={e.term}>
                        {i > 0 && ", "}
                        <span className="text-[#2A2F37]">{e.term}</span>
                        {e.word.toLowerCase() !== e.term.toLowerCase() && <span className="text-[#6B717B]"> in “{e.word}”</span>}
                      </span>
                    ))
                  : <span className="text-[#6B717B]">Not matched · {r.rule.toLowerCase()}</span>}
              </span>
              <span className={`text-right text-[13px] font-semibold leading-5 tabular-nums ${penalty ? "text-[#B23A2C]" : hit ? "text-[#0F1217]" : "font-normal text-[#6B717B]"}`}>
                {r.points > 0 ? `+${r.points}` : r.points === 0 ? "0" : `−${Math.abs(r.points)}`}
              </span>
              <span className="text-[12px] leading-5 tabular-nums text-[#6B717B]">{r.max === null ? "" : `/ ${r.max}`}</span>
            </li>
          );
        })}
        <li className={`grid ${cols} items-baseline gap-x-3 gap-y-0.5 px-1 py-2`}>
          <span />
          <span className="text-[13px] font-semibold">Total</span>
          <span className={`text-[12px] text-[#6B717B] ${evidenceCell}`}>
            {fb.raw !== fb.score ? `Rules add up to ${fb.raw}; scores are kept between 0 and 100` : ""}
          </span>
          <span className="text-right text-[13.5px] font-semibold tabular-nums">{fb.score}</span>
          <span className="text-[12px] tabular-nums text-[#6B717B]">/ 100</span>
        </li>
      </ul>
      {stale && (
        <p className="mt-2 rounded-[7px] bg-[#FDF6E7] px-3 py-2 text-[12.5px] text-[#7A4A00]">
          The stored score is {job.fit_score}, but the current scoring rules give {fb.score}. Scores update when the listings are rescored.
        </p>
      )}
      <p className="mt-1.5 px-1 text-[12px] leading-[1.5] text-[#6B717B]">
        Five keyword rules and three penalties make up the whole score. Keywords match as whole words, including plurals and capitalised acronyms such as RESTful.
      </p>
    </section>
  );
}

function RuleIcon({ rule }: { rule: FitRule }) {
  if (rule.state === "penalty") {
    return (
      <span role="img" aria-label="Penalty" className="mt-[1px] grid h-[18px] w-[18px] place-items-center rounded-full bg-[#FBE9E6] text-[#B23A2C]">
        <Icon name="minus" size={11} stroke={2.5} />
      </span>
    );
  }
  if (rule.state === "matched") {
    return (
      <span role="img" aria-label="Matched" className="mt-[1px] grid h-[18px] w-[18px] place-items-center rounded-full bg-[#2B55D6] text-white">
        <Icon name="check" size={10} stroke={3} />
      </span>
    );
  }
  return <span role="img" aria-label="Not matched" className="mt-[1px] h-[18px] w-[18px] rounded-full border-[1.5px] border-[#D0D4DA]" />;
}

// ── Details and listing text ─────────────────────────────────────────────────

function Details({ job, wide }: { job: RadarJob; wide: boolean }) {
  const dl = deadlineState(job.deadline);
  return (
    <section className="mt-9 px-1" aria-labelledby="details-h">
      <h2 id="details-h" className="text-[13.5px] font-semibold">Details</h2>
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
      <dd className={`mt-0.5 break-words text-[13.5px] font-medium ${warn ? "text-[#9A5B00]" : ""}`}>{v}</dd>
      {sub && <dd className="text-[12px] text-[#5F6570]">{sub}</dd>}
    </div>
  );
}

function Listing({ job }: { job: RadarJob }) {
  const [open, setOpen] = useState(false);
  const blocks = formatDescription(job.description, job.title);
  if (blocks.length === 0) {
    return (
      <section className="mt-9 px-1" aria-labelledby="listing-h">
        <h2 id="listing-h" className="text-[13.5px] font-semibold">Listing</h2>
        <p className="mt-3 text-[13px] text-[#5F6570]">No listing text was collected for this role. Open the listing to read it on {sourceLabel(job.source)}.</p>
      </section>
    );
  }
  return (
    <section className="mt-9 px-1" aria-labelledby="listing-h">
      <h2 id="listing-h" className="text-[13.5px] font-semibold">Listing</h2>
      <div id={`listing-${job.id}`} className={`relative mt-3 ${open ? "" : "max-h-[280px] overflow-hidden"}`}>
        {/* Reading measure holds even when the page widens. */}
        <div className="max-w-[68ch] break-words text-[14px] leading-[1.65] text-[#2E333B]">
          {blocks.map((b, i) => (
            <div key={i}>
              {b.heading && <h3 className="mb-1 mt-5 text-[13.5px] font-semibold text-[#0F1217] first:mt-0">{b.heading}</h3>}
              {b.paragraphs.map((p, k) => <p key={k} className="mt-3 first:mt-0">{p}</p>)}
            </div>
          ))}
        </div>
        {!open && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-white/0" />}
      </div>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={`listing-${job.id}`} className={`${btnGhost} -ml-2 mt-1 text-[#2449BC] hover:text-[#1D3C9E]`}>
        {open ? "Show less" : "Show full listing"}
        <Icon name="chevronDown" size={13} stroke={2} className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
    </section>
  );
}
