import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import App from "../App";

// Minimal rendering helpers: the real App, real DOM queries, user-level events.

let root: Root | null = null;

/** Let pending fetches and the renders they trigger finish. */
export async function settle(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

export async function renderApp(url = "/") {
  if (root) await cleanup();
  history.replaceState(null, "", url);
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(<App />); });
  await settle();
  return container;
}

export async function cleanup() {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = "";
}

/** Unmount and render again at the current URL, as a page reload would. */
export async function reload() {
  await cleanup();
  return renderApp(location.pathname + location.search);
}

export async function click(el: Element | null | undefined) {
  if (!el) throw new Error("click: element not found");
  await act(async () => { (el as HTMLElement).click(); });
  await settle();
}

export async function press(key: string, target: Element = document.body) {
  await act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); });
  await settle(2);
}

export async function type(input: HTMLInputElement, value: string) {
  // React tracks the value through the native setter.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle(2);
}

export const byText = (scope: ParentNode, selector: string, text: string | RegExp) =>
  [...scope.querySelectorAll<HTMLElement>(selector)].find((el) =>
    typeof text === "string" ? el.textContent?.trim() === text : text.test(el.textContent ?? ""));

export const byLabel = (scope: ParentNode, label: string) =>
  scope.querySelector<HTMLElement>(`[aria-label="${label}"]`);

/** Titles of the roles in the Radar feed, in order. */
export const feedTitles = (scope: ParentNode) =>
  [...scope.querySelectorAll<HTMLElement>("[data-row]")].map((b) => b.title);

export const detailTitle = (scope: ParentNode) => scope.querySelector("article h1")?.textContent;
