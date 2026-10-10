import { ReactNode, useMemo } from "react";
import { EMPTY_FILTERS, Filters } from "../lib/filters";
import { RadarJob } from "../lib/jobs";
import { CATEGORY_LABEL, sourceLabel, STATUS_LABEL } from "../lib/listing";
import { useStore } from "../store";
import { RoleCategory } from "../types";
import { StatusDot } from "../ui/marks";
import { Icon, radioKeys } from "../ui/primitives";
import { btnPrimary, btnSecondary, focusRing, inputCls } from "../ui/styles";

const ROLE_GROUPS: RoleCategory[] = ["apprenticeship", "graduate", "placement", "internship"];
const STATUSES = ["", "new", "applied", "interview", "offer", "rejected"] as const;

export function FilterPanel({ onDone }: { onDone: () => void }) {
  const { jobs, filtered, filters, setFilters, activeFilterCount } = useStore();
  const set = (f: Partial<Filters>) => setFilters({ ...filters, ...f });
  const clear = () => setFilters({ ...EMPTY_FILTERS, search: filters.search });
  const roleCounts = useMemo(() => countBy(jobs, (j) => j.fit_breakdown.category), [jobs]);
  const sources = useMemo(() => [...new Set(jobs.map((j) => j.source))], [jobs]);

  return (
    <div className="flex max-h-[inherit] flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#EDEFF2] px-4">
        <p className="text-[13.5px] font-semibold">
          Filters
          {activeFilterCount > 0 && <span className="ml-1.5 font-normal tabular-nums text-[#5F6570]">{activeFilterCount} applied</span>}
        </p>
        {activeFilterCount > 0 && (
          <button onClick={clear} className={`h-7 rounded-[6px] px-2 text-[12.5px] font-medium text-[#5F6570] hover:bg-[#F1F3F5] hover:text-[#0F1217] ${focusRing}`}>
            Clear all
          </button>
        )}
      </div>
      <div className="flex max-h-[min(68dvh,640px)] flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-3.5">
        <FilterField label="Role type" id="filter-roles">
          <div role="group" aria-labelledby="filter-roles" className="-mx-1.5 flex flex-col">
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
                  <span className={`flex-1 text-[13px] ${on ? "font-medium" : "text-[#2A2F37]"}`}>{CATEGORY_LABEL[g]}</span>
                  <span className="text-[12px] tabular-nums text-[#5F6570]">
                    {roleCounts.get(g) ?? 0}<span className="sr-only"> roles</span>
                  </span>
                </label>
              );
            })}
          </div>
        </FilterField>

        <FilterField label="Location" id="filter-location">
          <input
            aria-labelledby="filter-location"
            value={filters.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Any location"
            className={inputCls}
          />
        </FilterField>

        <FilterField label="Deadline" id="filter-deadline">
          <Segmented labelledBy="filter-deadline" value={filters.deadline} onChange={(v) => set({ deadline: v })}
            options={[{ v: "", l: "Any" }, { v: "7", l: "7 days" }, { v: "14", l: "14 days" }, { v: "30", l: "30 days" }, { v: "none", l: "None" }]} />
        </FilterField>

        <FilterField label="Minimum fit" id="filter-fit">
          <Segmented labelledBy="filter-fit" value={filters.minScore} onChange={(v) => set({ minScore: v })}
            options={[{ v: 0, l: "Any" }, { v: 20, l: "20+" }, { v: 40, l: "40+" }, { v: 60, l: "60+" }]} />
        </FilterField>

        <FilterField label="Status" id="filter-status">
          <div role="radiogroup" aria-labelledby="filter-status" onKeyDown={radioKeys} className="grid grid-cols-2 gap-1">
            {STATUSES.map((v) => {
              const on = filters.status === v;
              return (
                <button
                  key={v}
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
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
          <FilterField label="Source" id="filter-source">
            <Segmented labelledBy="filter-source" value={filters.source} onChange={(v) => set({ source: v })}
              options={[{ v: "", l: "All" }, ...sources.map((s) => ({ v: s, l: sourceLabel(s) }))]} />
          </FilterField>
        ) : (
          <p className="flex items-center gap-1.5 text-[12px] text-[#5F6570]">
            <Icon name="globe" size={13} />
            All roles are from {sourceLabel(sources[0] ?? "")}.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#EDEFF2] py-2.5 pl-4 pr-3">
        <span className="text-[12.5px] text-[#5F6570]">
          <span className="font-semibold tabular-nums text-[#0F1217]">{filtered.length}</span> of <span className="tabular-nums">{jobs.length}</span> roles
        </span>
        {filtered.length > 0 ? (
          <button onClick={onDone} className={btnPrimary}>
            Show <span className="tabular-nums">{filtered.length}</span> {filtered.length === 1 ? "role" : "roles"}
          </button>
        ) : (
          <button onClick={clear} className={btnSecondary}>
            No matches · clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function countBy<K>(jobs: RadarJob[], key: (j: RadarJob) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const j of jobs) m.set(key(j), (m.get(key(j)) ?? 0) + 1);
  return m;
}

function FilterField({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <p id={id} className="mb-1.5 text-[12px] font-medium text-[#5F6570]">{label}</p>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  value, options, onChange, labelledBy,
}: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; labelledBy: string }) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={radioKeys}
      className="grid rounded-[7px] bg-[#F0F1F4] p-[2px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={String(o.v)}
          role="radio"
          aria-checked={value === o.v}
          tabIndex={value === o.v ? 0 : -1}
          onClick={() => onChange(o.v)}
          className={`h-7 min-w-0 truncate rounded-[5px] px-1 text-[12.5px] font-medium tabular-nums transition-colors duration-150 ${focusRing} ${
            value === o.v ? "bg-white text-[#0F1217] shadow-[0_1px_2px_rgb(15_18_23/0.1)]" : "text-[#5F6570] hover:text-[#0F1217]"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
