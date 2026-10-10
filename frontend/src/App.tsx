import { useState } from "react";
import { StoreProvider, useStore, View } from "./store";
import { RadarMark } from "./ui/marks";
import { Icon, Toaster } from "./ui/primitives";
import { btnSecondary, focusRing } from "./ui/styles";
import { AddRoleDialog } from "./views/AddRoleDialog";
import { PipelineView } from "./views/PipelineView";
import { RadarView } from "./views/RadarView";
import { ShortlistView } from "./views/ShortlistView";

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { view, load } = useStore();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex h-dvh flex-col bg-[#F4F5F7] text-[13.5px] text-[#0F1217]">
      <header className="relative flex h-12 shrink-0 items-center border-b border-[#E3E6EA] bg-white px-4">
        <div className="flex items-center gap-2">
          <RadarMark />
          <span className="text-[14px] font-semibold tracking-[-0.01em]">Internship Radar</span>
        </div>
        <Tabs className="absolute left-1/2 hidden -translate-x-1/2 md:grid" />
        <div className="ml-auto flex items-center gap-2.5">
          <button onClick={() => setAdding(true)} disabled={load.state !== "ready"} className={`${btnSecondary} pl-2.5 max-sm:w-8 max-sm:justify-center max-sm:px-0`}>
            <Icon name="plus" size={14} stroke={2} />
            <span className="max-sm:sr-only">Add role</span>
          </button>
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-[#0F1217] text-[11px] font-semibold text-white">H</span>
        </div>
      </header>
      <div className="shrink-0 border-b border-[#E3E6EA] bg-white px-3 py-2 md:hidden">
        <Tabs className="relative grid w-full" fluid />
      </div>

      <main className="flex min-h-0 flex-1">
        {load.state === "loading" ? (
          <Message title="Loading roles…" status />
        ) : load.state === "error" ? (
          <LoadError message={load.message} />
        ) : (
          <>
            {view === "radar" && <RadarView />}
            {view === "shortlist" && <ShortlistView />}
            {view === "pipeline" && <PipelineView />}
          </>
        )}
      </main>

      <Toaster />
      {adding && <AddRoleDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function Tabs({ className, fluid = false }: { className: string; fluid?: boolean }) {
  const { view, setView, saved, tracked, load } = useStore();
  const ready = load.state === "ready";
  const tabs: { id: View; label: string; count?: number }[] = [
    { id: "radar", label: "Radar" },
    { id: "shortlist", label: "Shortlist", count: ready ? saved.length : undefined },
    { id: "pipeline", label: "Pipeline", count: ready ? tracked.length : undefined },
  ];
  const index = tabs.findIndex((t) => t.id === view);

  return (
    <nav aria-label="Main" className={`${className} grid-cols-3 rounded-[9px] bg-[#F0F1F4] p-[3px]`}>
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
            className={`relative flex h-[26px] items-center justify-center gap-1.5 rounded-[6px] text-[13px] font-medium transition-colors duration-150 ${fluid ? "w-full" : "w-[112px]"} ${focusRing} ${
              active ? "text-[#0F1217]" : "text-[#5F6570] hover:text-[#0F1217]"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="text-[12px] tabular-nums text-[#6B717B]">
                {t.count}<span className="sr-only"> roles</span>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function Message({ title, body, status, children }: { title: string; body?: string; status?: boolean; children?: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center px-6 text-center" role={status ? "status" : undefined}>
      <div>
        <p className="text-[14px] font-medium">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-[48ch] text-[13px] text-[#5F6570]">{body}</p>}
        {children}
      </div>
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  const { reload } = useStore();
  return (
    <Message title="Couldn't load roles" body={message}>
      <button onClick={reload} className={`${btnSecondary} mt-4`}>Try again</button>
    </Message>
  );
}
