import { afterEach, beforeEach, vi } from "vitest";
import { setViewport, TODAY, viewport } from "./env";
import { cleanup } from "./render";

// Tell React these tests drive updates through act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;


beforeEach(() => {
  // Only Date is faked; timers stay real.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  setViewport(1440);
  sessionStorage.clear();
  history.replaceState(null, "", "/");
  window.matchMedia = (query: string) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    return {
      matches: min ? viewport() >= Number(min[1]) : false, // prefers-reduced-motion etc.: off
      media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
  // jsdom has no layout: scrolling is a no-op.
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.scrollTo = () => {};
});

afterEach(async () => {
  await cleanup(); // unmount, so no listeners or timers leak into the next test
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
