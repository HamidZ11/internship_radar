import { useEffect, useRef, useState } from "react";
import { deadlineLabel, nextStage, shortDate, STATUS_LABEL, TRACKED } from "../lib/listing";
import { RadarJob, useStore } from "../store";
import { Status } from "../types";
import { FitValue, SignalBars, StatusDot } from "../ui/marks";
import { Icon, Logo, menuKeys, Popover, useFlip } from "../ui/primitives";
import { btnSecondary, focusRing, logoCls, logoFallback, menuPanel } from "../ui/styles";
import { MenuItem } from "./Detail";

// Roles I'm progressing. Columns are the backend's tracked statuses; every move
// is a PATCH /jobs/{id}/status.

export function PipelineView() {
  const { tracked, topUnapplied, setStatus, openJob, flashId } = useStore();
  const boardRef = useRef<HTMLDivElement>(null);
  const capture = useFlip(boardRef);
  const [refocus, setRefocus] = useState<{ id: number; from: Status } | null>(null);
  const move = (id: number, s: Status) => {
    const from = tracked.find((j) => j.id === id)?.status;
    capture();
    // The card re-mounts in its new column (or leaves the board): keep keyboard focus with it.
    if (from && boardRef.current?.contains(document.activeElement)) setRefocus({ id, from });
    setStatus(id, s);
  };
  useEffect(() => {
    if (!refocus) return;
    const card = boardRef.current?.querySelector<HTMLElement>(`[data-flip="${refocus.id}"] [aria-haspopup=menu]`);
    (card ?? boardRef.current?.querySelector<HTMLElement>(`#col-${refocus.from}`))?.focus();
    setRefocus(null);
  }, [refocus]);
  const counts = TRACKED.map((s) => [s, tracked.filter((j) => j.status === s).length] as const);

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 xl:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-[-0.015em]">Pipeline</h1>
            <p className="mt-1 text-[13.5px] text-[#5F6570]">Roles you're actively progressing.</p>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#3F4550]">
            {counts.map(([s, n]) => (
              <span key={s} className={`inline-flex items-center gap-1.5 ${n === 0 ? "text-[#6B717B]" : ""}`}>
                <StatusDot status={s} />
                <span className="tabular-nums">{n}</span> {STATUS_LABEL[s].toLowerCase()}
              </span>
            ))}
          </p>
        </header>

        {/* One bordered workspace with stage columns, not free-floating lanes. Stacks below 1024px. */}
        <div
          ref={boardRef}
          className="mt-5 grid grid-cols-1 divide-y divide-[#E3E6EA] overflow-hidden rounded-[10px] border border-[#E3E6EA] bg-white lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,0.8fr)] lg:divide-x lg:divide-y-0"
        >
          {TRACKED.map((col) => {
            const items = tracked.filter((j) => j.status === col);
            const closedOut = col === "rejected";
            return (
              <section key={col} className={`flex flex-col lg:min-h-[220px] ${closedOut ? "bg-[#FAFAFB]" : ""}`} aria-labelledby={`col-${col}`}>
                <header className="flex h-10 items-center gap-2 border-b border-[#EDEFF2] px-3">
                  <StatusDot status={col} />
                  <h2 id={`col-${col}`} tabIndex={-1} className={`text-[12.5px] font-semibold outline-none ${closedOut ? "text-[#5F6570]" : ""}`}>{STATUS_LABEL[col]}</h2>
                  <span className="text-[12px] tabular-nums text-[#6B717B]">{items.length}</span>
                </header>
                <div className="flex flex-1 flex-col gap-2 bg-[#F7F8F9]/60 p-2">
                  {items.length === 0 && (
                    <p className="px-1.5 py-1 text-[12.5px] text-[#6B717B]">{closedOut ? "Nothing closed out." : "No roles at this stage."}</p>
                  )}
                  {items.map((j) => (
                    <PipelineCard key={j.id} job={j} flash={flashId === j.id} onOpen={() => openJob(j.id)} onMove={(s) => move(j.id, s)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {topUnapplied.length > 0 && (
          <section className="mt-9" aria-labelledby="ready-h">
            <div className="mb-1 flex flex-wrap items-baseline gap-x-2 px-1">
              <h2 id="ready-h" className="text-[12.5px] font-semibold text-[#454B56]">Ready to apply</h2>
              <span className="text-[12px] text-[#6B717B]">· Highest fit, still open, not yet applied</span>
            </div>
            <ul className="divide-y divide-[#E8EAEE] border-y border-[#E8EAEE]">
              {topUnapplied.map((j) => (
                <li key={j.id} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-1 py-2 md:grid-cols-[24px_minmax(0,1fr)_150px_64px_auto]">
                  <Logo company={j.company} size={24} className={`rounded-[6px] ${logoCls}`} fallbackClassName={logoFallback} />
                  <button onClick={() => openJob(j.id)} className={`min-w-0 truncate rounded-[4px] text-left text-[13px] font-medium text-[#2A2F37] hover:underline ${focusRing}`}>
                    {j.title} <span className="font-normal text-[#5F6570]">· {j.company}</span>
                  </button>
                  <span className="col-start-2 row-start-2 text-[12.5px] text-[#5F6570] md:col-start-auto md:row-start-auto">{deadlineLabel(j.deadline)}</span>
                  <span className="flex items-center gap-2"><SignalBars job={j} height={10} /><FitValue score={j.fit_score} className="text-[13px] font-semibold tabular-nums" /></span>
                  <button onClick={() => move(j.id, "applied")} aria-label={`Mark ${j.title} as applied`} className={`${btnSecondary} col-start-3 row-start-2 h-7 px-2.5 text-[12.5px] md:col-start-auto md:row-start-auto`}>
                    <span aria-hidden>Mark as applied</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function PipelineCard({ job, flash, onOpen, onMove }: { job: RadarJob; flash: boolean; onOpen: () => void; onMove: (s: Status) => void }) {
  const next = nextStage(job.status);
  const rejected = job.status === "rejected";
  return (
    <article
      data-flip={job.id}
      aria-label={job.title}
      className={`rounded-[8px] border border-[#E3E6EA] bg-white px-2.5 pb-1.5 pt-2.5 ${flash ? "ui-flash" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Logo company={job.company} size={16} className={`rounded-[4px] ${logoCls} ${rejected ? "opacity-60" : ""}`} fallbackClassName={logoFallback} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#454B56]">{job.company}</span>
        <span className="flex items-center gap-1.5">
          <SignalBars job={job} height={10} />
          <FitValue score={job.fit_score} className="text-[12px] font-semibold tabular-nums" />
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
          <button onClick={() => onMove(next)} aria-label={`Move to ${STATUS_LABEL[next].toLowerCase()}: ${job.title}`} className={`ui-press -ml-1 inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[12.5px] font-medium text-[#2449BC] hover:bg-[#F1F5FE] ${focusRing}`}>
            Move to {STATUS_LABEL[next].toLowerCase()} <Icon name="arrowRight" size={12} stroke={2} />
          </button>
        ) : rejected ? (
          <button onClick={() => onMove("applied")} aria-label={`Reopen as applied: ${job.title}`} className={`ui-press -ml-1 inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[12.5px] font-medium text-[#454B56] hover:bg-[#F1F3F5] ${focusRing}`}>
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

function CardMenu({ job, onMove }: { job: RadarJob; onMove: (s: Status) => void }) {
  return (
    <Popover
      label={`Actions for ${job.title}`}
      kind="menu"
      align="end"
      panelClassName={menuPanel}
      trigger={(p) => (
        <button {...p} aria-label={`More actions for ${job.title}`} className={`grid h-7 w-7 place-items-center rounded-[6px] text-[#5F6570] hover:bg-[#F1F3F5] hover:text-[#0F1217] ${focusRing}`}>
          <Icon name="ellipsis" size={16} stroke={2} />
        </button>
      )}
    >
      {(close) => (
        <div onKeyDown={menuKeys}>
          <p aria-hidden className="px-2 pb-1 pt-1.5 text-[11.5px] font-medium text-[#5F6570]">Move to</p>
          {TRACKED.map((s) => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={job.status === s}
              onClick={() => { close(); onMove(s); }}
              className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-left text-[13px] text-[#2A2F37] outline-none hover:bg-[#F4F5F7] focus-visible:bg-[#F4F5F7]"
            >
              <StatusDot status={s} />
              <span className="flex-1">{STATUS_LABEL[s]}</span>
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
