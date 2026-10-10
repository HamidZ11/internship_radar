// Shared test environment state.

/** A fixed "today" so deadline windows are deterministic. */
export const TODAY = new Date("2026-10-10T12:00:00");

/** Viewport width used by matchMedia("(min-width: …)"). */
let viewportWidth = 1440;
export const setViewport = (w: number) => { viewportWidth = w; };
export const viewport = () => viewportWidth;
