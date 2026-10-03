// The interface's settings. Language lives in ?lang=. Theme is light or
// dark: Stoa's tokens follow the system until <html> carries data-theme;
// a choice made here is kept in ?theme= (for a shared link) and in
// localStorage (for the next visit), the link winning.

export type Theme = "light" | "dark";

const KEY = "themis-steps.theme";
const DARK = "(prefers-color-scheme: dark)";

const read = (v: string | null): Theme | null => (v === "light" || v === "dark" ? v : null);

/** The theme chosen earlier, or null to follow the system. */
export function chosenTheme(): Theme | null {
  const fromUrl = read(new URLSearchParams(location.search).get("theme"));
  if (fromUrl) return fromUrl;
  try {
    return read(localStorage.getItem(KEY));
  } catch {
    // Storage can be blocked (a private window, a strict browser setting).
    return null;
  }
}

export function systemTheme(): Theme {
  return matchMedia(DARK).matches ? "dark" : "light";
}

/** Calls back when the system theme changes; returns the unsubscribe. */
export function onSystemTheme(callback: (theme: Theme) => void): () => void {
  const query = matchMedia(DARK);
  const listener = () => callback(query.matches ? "dark" : "light");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function rememberTheme(theme: Theme) {
  setParam("theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Not kept for the next visit; the link still carries it.
  }
}

/** Sets one URL parameter, keeping the others. replaceState: a change of
 * setting is not a step to go back through. */
export function setParam(name: string, value: string) {
  const url = new URL(location.href);
  url.searchParams.set(name, value);
  history.replaceState(history.state, "", url);
}
