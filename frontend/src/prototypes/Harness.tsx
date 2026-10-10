import { ComponentType, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { loadJobs, LoadResult } from "./data";
import { ProtoProvider } from "./store";
import Radar from "./variants/Radar";
import RadarBefore from "./variants/RadarBefore";

// Temporary prototype picker. Not imported by the production app.
// Direction C (Radar) was chosen; Refined.tsx and Editorial.tsx are no longer listed.

const VARIANTS: { name: string; Component: ComponentType }[] = [
  { name: "Radar · refined", Component: Radar },
  { name: "Radar · before", Component: RadarBefore },
];

function initialIndex(): number {
  const v = parseInt(new URLSearchParams(location.search).get("v") ?? "", 10);
  return v >= 1 && v <= VARIANTS.length ? v - 1 : 0;
}

export default function Harness() {
  const [data, setData] = useState<LoadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(initialIndex);
  const [ready, setReady] = useState(false);
  const pickerRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    loadJobs().then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const moveHighlight = useCallback(() => {
    const el = itemRefs.current[current];
    const hl = highlightRef.current;
    if (!el || !hl) return;
    hl.style.width = `${el.offsetWidth}px`;
    hl.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [current]);

  useLayoutEffect(() => {
    moveHighlight();
    const url = new URL(location.href);
    url.searchParams.set("v", String(current + 1));
    history.replaceState(null, "", url);
  }, [current, moveHighlight, data]);

  useEffect(() => {
    // Enable the slide only after first paint, so load doesn't animate.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    window.addEventListener("resize", moveHighlight);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", moveHighlight); };
  }, [moveHighlight]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= VARIANTS.length) setCurrent(num - 1);
      else if (e.key === "ArrowRight") setCurrent((c) => (c + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft") setCurrent((c) => (c - 1 + VARIANTS.length) % VARIANTS.length);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (error) {
    return (
      <div className="grid h-screen place-items-center bg-white p-6 text-center text-sm text-neutral-600">
        <div>
          <p className="font-medium text-neutral-900">Couldn't load jobs from the API</p>
          <p className="mt-1">{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="h-screen bg-white" />;

  const { Component } = VARIANTS[current];

  return (
    <ProtoProvider initialJobs={data.jobs} hiddenPlaceholders={data.hiddenPlaceholders}>
      <Component key={current} />
      <nav ref={pickerRef} className="proto-picker" aria-label="Prototype variants" data-ready={ready ? "" : undefined}>
        <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
        {VARIANTS.map(({ name }, i) => (
          <button
            key={name}
            ref={(el) => { itemRefs.current[i] = el; }}
            className="proto-picker-item"
            data-active={i === current ? "" : undefined}
            aria-current={i === current ? "true" : undefined}
            onClick={() => setCurrent(i)}
          >
            {name}
          </button>
        ))}
      </nav>
    </ProtoProvider>
  );
}
