import { ReactNode, useMemo } from "react";
import { RadarJob } from "../lib/jobs";
import { deadlineLabel, deadlineState, shortDate, STATUS_LABEL } from "../lib/listing";
import { shortlistGroups } from "../lib/shortlist";
import { useStore } from "../store";
import { FitValue, SignalBars, StatusDot } from "../ui/marks";
import { Icon, Logo } from "../ui/primitives";
import { btnGhost, btnSecondary, focusRing, logoCls, logoFallback } from "../ui/styles";

export function ShortlistView() {
  const { jobs, openJob, setView } = useStore();
  const { considering, worthConsidering: suggestions, deadlinePassed: lapsed, inPipeline, closingSoon: soon } =
    useMemo(() => shortlistGroups(jobs), [jobs]);

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-[1040px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 xl:px-8">
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
              considering.map((j) => <ConsiderRow key={j.id} job={j} onOpen={() => openJob(j.id)} />)
            )}
          </div>
        </section>

        {/* Supporting groups: flat lists on the canvas, quieter headings. */}
        {suggestions.length > 0 && (
          <QuietGroup title="Worth considering" note="Highest fit, still open, not on your shortlist">
            {suggestions.map((j) => <ConsiderRow key={j.id} job={j} onOpen={() => openJob(j.id)} tone="suggestion" />)}
          </QuietGroup>
        )}

        {lapsed.length > 0 && (
          <QuietGroup title="Deadline passed" count={lapsed.length} note="Saved, but closed before you applied">
            {lapsed.map((j) => <ConsiderRow key={j.id} job={j} onOpen={() => openJob(j.id)} tone="lapsed" />)}
          </QuietGroup>
        )}

        {inPipeline.length > 0 && (
          <QuietGroup title="Already in your pipeline" count={inPipeline.length}>
            {inPipeline.map((j) => (
              <div key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pl-4 pr-3">
                <Logo company={j.company} size={20} className={`rounded-[5px] ${logoCls}`} fallbackClassName={logoFallback} />
                <button onClick={() => openJob(j.id)} className={`min-w-0 flex-1 truncate rounded-[4px] text-left text-[13px] font-medium text-[#2A2F37] hover:underline ${focusRing}`}>
                  {j.title} <span className="font-normal text-[#5F6570]">· {j.company}</span>
                </button>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#3F4550]"><StatusDot status={j.status} />{STATUS_LABEL[j.status]}</span>
                <button onClick={() => setView("pipeline")} className={`${btnGhost} h-7 pr-1.5 text-[12.5px]`}>
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
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 px-1">
        <h2 className="text-[12.5px] font-semibold text-[#454B56]">{title}</h2>
        {count !== undefined && <span className="text-[12px] tabular-nums text-[#6B717B]">{count}</span>}
        {note && <span className="text-[12px] text-[#6B717B]">· {note}</span>}
      </div>
      <div className="divide-y divide-[#E8EAEE] border-y border-[#E8EAEE]">{children}</div>
    </section>
  );
}

function ConsiderRow({ job, onOpen, tone = "lead" }: { job: RadarJob; onOpen: () => void; tone?: "lead" | "suggestion" | "lapsed" }) {
  const { setSaved, setStatus, flashId } = useStore();
  const facts = job.facts.filter((f) => ["Duration", "Starts", "Working pattern", "Salary"].includes(f.label)).map((f) => f.value);
  const dl = deadlineState(job.deadline);
  const lead = tone === "lead";

  return (
    <div
      className={`grid items-center gap-x-4 gap-y-1.5 transition-colors duration-100 ${flashId === job.id ? "ui-flash" : ""} ${
        // One column grid for every group (from 768px), so fit and deadline line up down the page.
        "grid-cols-[32px_minmax(0,1fr)_auto] md:grid-cols-[32px_minmax(0,1fr)_64px_150px_196px]"
      } ${lead ? "px-4 py-3.5 hover:bg-[#FAFBFC]" : "px-4 py-2.5"}`}
    >
      <Logo company={job.company} size={lead ? 32 : 24} className={`${lead ? "rounded-[7px]" : "rounded-[6px]"} ${logoCls} ${tone === "lapsed" ? "opacity-60" : ""}`} fallbackClassName={logoFallback} />
      <div className="min-w-0">
        <button
          onClick={onOpen}
          title={job.title}
          className={`block max-w-full truncate rounded-[4px] text-left hover:underline max-md:line-clamp-2 max-md:whitespace-normal ${focusRing} ${lead ? "text-[14px] font-semibold" : "text-[13px] font-medium text-[#2A2F37]"}`}
        >
          {job.title}
        </button>
        <p className={`mt-0.5 truncate text-[#5F6570] ${lead ? "text-[13px]" : "text-[12.5px]"}`}>
          <span className={lead ? "font-medium text-[#3F4550]" : ""}>{job.company}</span> · {job.location}
          {lead && facts.length > 0 && <span className="hidden xl:inline"> · {facts.slice(0, 3).join(" · ")}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <SignalBars job={job} height={lead ? 12 : 10} />
        <FitValue score={job.fit_score} className={`font-semibold tabular-nums ${lead ? "text-[14px]" : "text-[13px] text-[#2A2F37]"}`} />
      </div>
      <div className="col-start-2 md:col-start-auto">
        <p className={`text-[13px] ${dl.state === "soon" ? "font-medium text-[#9A5B00]" : lead ? "font-medium" : "text-[#5F6570]"}`}>{deadlineLabel(job.deadline)}</p>
        {lead && job.deadline && dl.state !== "closed" && <p className="text-[12px] text-[#5F6570]">{shortDate(job.deadline, true)}</p>}
      </div>
      <div className="flex items-center justify-end gap-1">
        {tone === "suggestion" ? (
          <button onClick={() => setSaved(job.id, true)} aria-label={`Shortlist ${job.title}`} className={`${btnGhost} h-7 pl-1.5 pr-2 text-[12.5px]`}>
            <Icon name="bookmark" size={13} /> <span aria-hidden>Shortlist</span>
          </button>
        ) : (
          <>
            {lead && (
              <button onClick={() => setStatus(job.id, "applied")} aria-label={`Mark ${job.title} as applied`} className={`${btnSecondary} h-7 px-2.5 text-[12.5px]`}>
                <span aria-hidden>Mark as applied</span>
              </button>
            )}
            <a href={job.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${job.title} listing (opens in a new tab)`} title="Open listing" className={`grid h-7 w-7 place-items-center rounded-[6px] text-[#5F6570] hover:bg-[#EDEFF2] hover:text-[#0F1217] ${focusRing}`}>
              <Icon name="external" size={14} />
            </a>
            <button onClick={() => setSaved(job.id, false)} aria-label={`Remove ${job.title} from shortlist`} title="Remove from shortlist" className={`ui-press grid h-7 w-7 place-items-center rounded-[6px] text-[#5F6570] hover:bg-[#EDEFF2] hover:text-[#0F1217] ${focusRing}`}>
              <Icon name="x" size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
