// The interface's settings. Language lives in ?lang=. Theme is System,
// Light or Dark: Stoa's tokens follow the system until <html> carries
// data-theme; a Light or Dark choice is kept in ?theme= (for a shared
// link) and in localStorage (for the next visit), the link winning, and
// System clears both (`?theme=system` asks for it in a link).

import type { Lang } from "./i18n";

export type Theme = "light" | "dark";
export type ThemeChoice = Theme | "system";

const KEY = "themis-steps.theme";

const read = (v: string | null): Theme | null => (v === "light" || v === "dark" ? v : null);

/** The theme chosen earlier, or null to follow the system. */
export function chosenTheme(): Theme | null {
  const asked = new URLSearchParams(location.search).get("theme");
  if (asked === "system") return null;
  const fromUrl = read(asked);
  if (fromUrl) return fromUrl;
  try {
    return read(localStorage.getItem(KEY));
  } catch {
    // Storage can be blocked (a private window, a strict browser setting).
    return null;
  }
}

export function rememberTheme(theme: Theme) {
  setParam("theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Not kept for the next visit; the link still carries it.
  }
}

/** Back to the system: no theme in the link, none remembered. */
export function forgetTheme() {
  const url = new URL(location.href);
  url.searchParams.delete("theme");
  history.replaceState(history.state, "", url);
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was remembered where storage is blocked.
  }
}

/** The language asked for in the link; English otherwise. */
export function chosenLang(): Lang {
  return new URLSearchParams(location.search).get("lang") === "ar" ? "ar" : "en";
}

/** Sets one URL parameter, keeping the others. replaceState: a change of
 * setting is not a step to go back through. */
export function setParam(name: string, value: string) {
  const url = new URL(location.href);
  url.searchParams.set(name, value);
  history.replaceState(history.state, "", url);
}
