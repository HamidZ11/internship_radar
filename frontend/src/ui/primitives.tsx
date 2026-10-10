import {
  KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject, useCallback, useEffect, useId,
  useLayoutEffect, useRef, useState,
} from "react";
import { useStore } from "../store";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

// ── Popover ──────────────────────────────────────────────────────────────────

interface TriggerProps {
  ref: RefObject<HTMLButtonElement>;
  onClick: () => void;
  "aria-expanded": boolean;
  "aria-haspopup": "dialog" | "menu";
  "aria-controls": string;
}

/**
 * Anchored panel: opens on click, focuses its first control, closes on Escape
 * (returning focus to the trigger), on an outside click, or when focus leaves.
 * With `sheet`, it becomes a bottom sheet below 768px.
 */
export function Popover({
  trigger, children, align = "start", panelClassName = "", kind = "dialog", label, sheet = false,
}: {
  trigger: (props: TriggerProps, open: boolean) => ReactNode;
  children: (close: (restoreFocus?: boolean) => void) => ReactNode;
  align?: "start" | "end";
  panelClassName?: string;
  kind?: "dialog" | "menu";
  label: string;
  sheet?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });

    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div className="relative">
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((o) => !o),
        "aria-expanded": open,
        "aria-haspopup": kind,
        "aria-controls": id,
      }, open)}
      {open && sheet && <div aria-hidden className="ui-fade fixed inset-0 z-30 bg-[#0F1217]/25 md:hidden" />}
      {open && (
        <div
          ref={panelRef}
          id={id}
          role={kind}
          aria-label={label}
          data-align={align}
          data-sheet={sheet ? "" : undefined}
          onBlur={(e) => {
            // Tabbing out of the panel closes it without stealing focus back.
            const next = e.relatedTarget as Node | null;
            if (next && !panelRef.current?.contains(next) && !triggerRef.current?.contains(next)) close(false);
          }}
          className={`ui-pop absolute top-full z-40 mt-1.5 ${align === "end" ? "right-0" : "left-0"} ${panelClassName} ${
            sheet
              ? "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:mt-0 max-md:w-auto max-md:rounded-b-none max-md:pb-[env(safe-area-inset-bottom)]"
              : ""
          }`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** Up/Down/Home/End roving focus for role="menuitem*" children. */
export function menuKeys(e: ReactKeyboardEvent<HTMLElement>) {
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
  const i = items.indexOf(document.activeElement as HTMLElement);
  let next = -1;
  if (e.key === "ArrowDown") next = (i + 1) % items.length;
  else if (e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;
  if (next >= 0) { e.preventDefault(); items[next].focus(); }
}

/** Arrow keys move between radios in a group and select the one focused (roving tabindex). */
export function radioKeys(e: ReactKeyboardEvent<HTMLElement>) {
  const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
  const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
  if (!forward && !back) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const next = items[(i + (forward ? 1 : -1) + items.length) % items.length];
  next.focus();
  next.click();
}

// ── Toasts ───────────────────────────────────────────────────────────────────

export function Toaster() {
  const { toasts, dismissToast } = useStore();
  return (
    <div
      className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[340px]"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`ui-toast flex items-center gap-3 rounded-[9px] px-3.5 py-2.5 text-[13px] text-white shadow-[0_8px_24px_rgb(15_18_23/0.2)] ${
            t.tone === "error" ? "bg-[#8F2A1F]" : "bg-[#0F1217]"
          }`}
        >
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action && (
            <button
              className="ui-press rounded-[5px] px-1.5 py-0.5 text-[12.5px] font-medium text-[#A9BFFF] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
              onClick={() => { t.action!.run(); dismissToast(t.id); }}
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] text-white/60 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Icon name="x" size={13} stroke={2} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Company logo with a quiet, systematic fallback ───────────────────────────

const failedLogos = new Set<string>();

function guessDomain(company: string): string {
  return `${company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
}

export function monogram(company: string): string {
  const words = company.replace(/[^A-Za-z0-9 &-]/g, " ").split(/[\s-]+/).filter(Boolean);
  const first = words[0] ?? "?";
  if (/^[A-Z0-9]{2,4}$/.test(first)) return first;
  const sig = words.filter((w) => !/^(limited|ltd|plc|group|the|and|&|of|uk)$/i.test(w));
  return ((sig[0]?.[0] ?? first[0]) + (sig[1]?.[0] ?? "")).toUpperCase();
}

interface LogoProps { company: string; size: number; className?: string; fallbackClassName: string }

/** Keyed by company so the image and its failed state reset when the selection changes. */
export function Logo(props: LogoProps) {
  return <LogoImage key={props.company} {...props} />;
}

function LogoImage({ company, size, className = "", fallbackClassName }: LogoProps) {
  const token = import.meta.env.VITE_LOGO_DEV_TOKEN;
  const [failed, setFailed] = useState(() => !token || failedLogos.has(company));
  const box = { width: size, height: size };

  if (failed) {
    // Below 24px two or three letters become unreadable, so use one.
    const text = size < 24 ? monogram(company).charAt(0) : monogram(company);
    const ratio = text.length === 1 ? 0.56 : text.length > 2 ? 0.28 : 0.36;
    return (
      <span
        aria-hidden
        style={{ ...box, fontSize: Math.max(9, Math.round(size * ratio)) }}
        className={`inline-flex shrink-0 select-none items-center justify-center font-semibold ${fallbackClassName} ${className}`}
      >
        {text}
      </span>
    );
  }
  return (
    <span style={box} className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ${className}`}>
      <img
        src={`https://img.logo.dev/${guessDomain(company)}?token=${token}&fallback=404`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => { failedLogos.add(company); setFailed(true); }}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

// ── Keyboard list navigation (instant: this is a high-frequency action) ──────

export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && !!t.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");

export function useListKeys(
  listRef: RefObject<HTMLElement>,
  ids: number[],
  selectedId: number | null,
  onSelect: (id: number) => void,
) {
  return useCallback((e: ReactKeyboardEvent) => {
    const down = e.key === "ArrowDown" || e.key === "j";
    const up = e.key === "ArrowUp" || e.key === "k";
    if (!down && !up || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping(e.target) || (e.target as HTMLElement).closest("[role=menu], [role=dialog]")) return;
    e.preventDefault();
    const i = Math.max(0, ids.indexOf(selectedId ?? -1));
    const next = ids[Math.min(ids.length - 1, Math.max(0, i + (down ? 1 : -1)))];
    if (next === undefined) return;
    onSelect(next);
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${next}"]`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "nearest" });
    });
  }, [ids, selectedId, onSelect, listRef]);
}

// ── FLIP: animate items to their new position after a state change ──────────

export function useFlip(containerRef: RefObject<HTMLElement>) {
  const before = useRef<Map<string, DOMRect> | null>(null);

  const capture = useCallback(() => {
    const map = new Map<string, DOMRect>();
    containerRef.current?.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      map.set(el.dataset.flip!, el.getBoundingClientRect());
    });
    before.current = map;
  }, [containerRef]);

  useLayoutEffect(() => {
    const prev = before.current;
    if (!prev) return;
    before.current = null;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    containerRef.current?.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      const was = prev.get(el.dataset.flip!);
      if (!was) return;
      const now = el.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: 280, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
      );
    });
  });

  return capture;
}

// ── Session-scoped UI preference ─────────────────────────────────────────────

export function useSessionFlag(key: string): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
  });
  const set = useCallback((v: boolean) => {
    setValue(v);
    try { sessionStorage.setItem(key, v ? "1" : "0"); } catch { /* keep the in-memory value */ }
  }, [key]);
  return [value, set];
}

// ── Icons: one outline set (Heroicons paths) ─────────────────────────────────

const PATHS = {
  bookmark: "M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z",
  external: "M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  check: "m4.5 12.75 6 6 9-13.5",
  chevronDown: "m19.5 8.25-7.5 7.5-7.5-7.5",
  chevronLeft: "M15.75 19.5 8.25 12l7.5-7.5",
  plus: "M12 4.5v15m7.5-7.5h-15",
  x: "M6 18 18 6M6 6l12 12",
  sliders: "M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75",
  ellipsis: "M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z",
  globe: "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
  arrowRight: "M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3",
  minus: "M5 12h14",
  panelClose: "M9 4.5v15M15.5 9.5 13 12l2.5 2.5M5.25 4.5h13.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Z",
  panelOpen: "M9 4.5v15M13 9.5l2.5 2.5-2.5 2.5M5.25 4.5h13.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name, size = 16, stroke = 1.5, className = "", filled = false,
}: { name: IconName; size?: number; stroke?: number; className?: string; filled?: boolean }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Outline ↔ filled bookmark cross-fade (scale .25→1, blur 4px→0). */
export function BookmarkSwap({ on, size }: { on: boolean; size: number }) {
  return (
    <span className="ui-icon-swap" aria-hidden>
      <span data-off={on ? undefined : ""}><Icon name="bookmark" size={size} filled /></span>
      <span data-off={on ? "" : undefined}><Icon name="bookmark" size={size} /></span>
    </span>
  );
}
