import { FitRule, Job, RuleKey, Status } from "../types";
import { ACCENT } from "./styles";

// Brand marks: the radar logo, rings (score chip only) and bars (everywhere else).
// Both read the backend's fit_breakdown; nothing here computes a score.

export const RING_ORDER: RuleKey[] = ["role", "tech", "location", "requirements", "stack"];

export const STATUS_DOT: Record<Status, string> = {
  new: "#A0A6B0",
  applied: "#D08A1E",
  interview: "#7056D6",
  offer: "#1F9A6B",
  rejected: "#D04A3A",
};

export function gains(job: Job): Record<RuleKey, FitRule> {
  return Object.fromEntries(job.fit_breakdown.rules.map((r) => [r.key, r])) as Record<RuleKey, FitRule>;
}

export const firedPenalties = (job: Job) => job.fit_breakdown.rules.filter((r) => r.state === "penalty");
export const matchedCount = (job: Job) => job.fit_breakdown.rules.filter((r) => r.kind === "gain" && r.points > 0).length;
const fill = (r: FitRule) => (r.max ? Math.max(0, Math.min(1, r.points / r.max)) : 0);

export function RadarMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle cx="9" cy="9" r="7.6" fill="none" stroke={ACCENT} strokeOpacity="0.22" strokeWidth="1.4" />
      <circle cx="9" cy="9" r="4.4" fill="none" stroke={ACCENT} strokeOpacity="0.45" strokeWidth="1.4" />
      <path d="M9 1.4A7.6 7.6 0 0 1 16.6 9" fill="none" stroke={ACCENT} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="9" cy="9" r="1.6" fill={ACCENT} />
    </svg>
  );
}

/** Five rings, one per scoring rule, outer to inner; a red outer arc marks a penalty. */
export function SignalRings({ job, size, focus }: { job: Job; size: number; focus?: RuleKey | null }) {
  const byKey = gains(job);
  const penalty = firedPenalties(job).reduce((s, r) => s + Math.abs(r.points), 0);
  const c = size / 2;
  const penStroke = Math.max(1.4, size * 0.035);
  const outer = c - penStroke - 1.5;
  const step = (outer - size * 0.12) / (RING_ORDER.length - 1);
  const stroke = step * 0.55;
  const focusIsPenalty = focus != null && byKey[focus]?.kind === "penalty";

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
        const r = outer - stroke / 2 - i * step;
        const circ = 2 * Math.PI * r;
        const dim = focus != null && focus !== key;
        return (
          <g key={key}>
            <circle cx={c} cy={c} r={r} fill="none" stroke="#E6E8EC" strokeWidth={stroke} />
            <circle
              cx={c} cy={c} r={r} fill="none" stroke={ACCENT} strokeWidth={stroke}
              strokeLinecap={byKey[key].points > 0 ? "round" : "butt"}
              strokeDasharray={`${fill(byKey[key]) * circ} ${circ}`}
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
export function SignalBars({ job, height = 12 }: { job: Job; height?: number }) {
  const byKey = gains(job);
  const penalised = firedPenalties(job).length > 0;
  return (
    <span className="inline-flex flex-col items-stretch gap-[2px]" aria-hidden title={penalised ? "Includes a penalty" : undefined}>
      <span className="inline-flex items-end gap-[2px]" style={{ height }}>
        {RING_ORDER.map((key, i) => {
          const h = Math.round(height * (0.4 + 0.6 * ((i + 1) / RING_ORDER.length)));
          return (
            <span key={key} className="relative w-[3px] overflow-hidden rounded-[1px] bg-[#E1E4E8]" style={{ height: h }}>
              <span className="absolute inset-x-0 bottom-0 bg-[#5F6570]" style={{ height: `${fill(byKey[key]) * 100}%` }} />
            </span>
          );
        })}
      </span>
      <span className={`h-[1.5px] rounded-full ${penalised ? "bg-[#D04A3A]" : "bg-transparent"}`} />
    </span>
  );
}

export function StatusDot({ status }: { status: Status }) {
  return <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_DOT[status] }} />;
}

/** Visible score plus a screen-reader phrase, for places where the number sits without a label. */
export function FitValue({ score, className }: { score: number; className: string }) {
  return (
    <>
      <span aria-hidden className={className}>{score}</span>
      <span className="sr-only">Fit {score} of 100</span>
    </>
  );
}
