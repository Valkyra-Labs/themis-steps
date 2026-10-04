import { useEffect, useLayoutEffect, useState } from "react";
import { AppHeader, Button, ChoiceGroup, Disclosure, I18nProvider, Tabs } from "@valkyra-labs/stoa-react";
import { loadEngine } from "./engine";
import { strings, type Lang } from "./i18n";
import { chosenTheme, forgetTheme, rememberTheme, setParam, type Theme, type ThemeChoice } from "./settings";
import { Working } from "./Working";
import { Examples } from "./Examples";
import { Audit } from "./Audit";

type EngineState =
  | { status: "loading" }
  | { status: "ready" }
  /** `retrying` keeps the failure (and the focused Retry button) on
   * screen while the next attempt loads. */
  | { status: "failed"; detail: string; retrying: boolean };

export function App() {
  const [engine, setEngine] = useState<EngineState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [lang, setLang] = useState<Lang>(() => (new URLSearchParams(location.search).get("lang") === "ar" ? "ar" : "en"));
  const t = strings[lang];
  // Null while the theme follows the system (the switch shows System).
  const [theme, setTheme] = useState<Theme | null>(chosenTheme);

  useEffect(() => {
    let live = true;
    loadEngine().then(
      () => live && setEngine({ status: "ready" }),
      (e) => live && setEngine({ status: "failed", detail: String(e), retrying: false }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = () => {
    if (engine.status !== "failed") return;
    setEngine({ ...engine, retrying: true });
    setAttempt((a) => a + 1);
  };

  // The page direction follows the language; maths stays left to right.
  // Set before paint, so an Arabic page never shows a left-to-right frame.
  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = t.title;
  }, [lang, t]);

  // Without data-theme Stoa's tokens follow the system.
  useLayoutEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  const chooseTheme = (value: ThemeChoice) => {
    if (value === "system") {
      forgetTheme();
      setTheme(null);
    } else {
      rememberTheme(value);
      setTheme(value);
    }
  };

  // The language lives in ?lang= too, so a reload or a shared link keeps it.
  const switchLang = (next: Lang) => {
    setParam("lang", next);
    setLang(next);
  };

  const loading = engine.status === "loading" || (engine.status === "failed" && engine.retrying);

  // React Aria (and Stoa through it) takes its locale from here, not from
  // the browser; the locale also sets its keyboard direction, so arrow keys
  // in the tabs follow the Arabic layout. "ar" keeps Latin digits, as the
  // maths does.
  return (
    <I18nProvider locale={lang === "ar" ? "ar" : "en-US"}>
      <div className="app">
        <AppHeader
          title={t.title}
          subtitle={t.tagline}
          actions={
            <>
              <ChoiceGroup<ThemeChoice>
                label={t.theme}
                size="small"
                value={theme ?? "system"}
                onChange={chooseTheme}
                choices={[
                  { id: "system", label: t.system },
                  { id: "light", label: t.light },
                  { id: "dark", label: t.dark },
                ]}
              />
              {/* Language codes, the same in both interfaces; in the Arabic
                  one they are the only Latin letters outside maths, and are
                  marked as such. */}
              <ChoiceGroup<Lang>
                label={t.language}
                size="small"
                value={lang}
                onChange={switchLang}
                choices={[
                  { id: "en", label: <span lang={lang === "ar" ? "en" : undefined}>EN</span> },
                  { id: "ar", label: <span lang={lang === "ar" ? "en" : undefined}>AR</span> },
                ]}
              />
            </>
          }
        />
        <main className="content">
          {/* Always rendered, so a retry's loading message is announced. */}
          <p role="status" className="muted engine-status">
            {loading && t.loading}
          </p>
          {engine.status === "failed" && (
            <div className="load-failed">
              {/* A new element per attempt, so a repeated failure is announced again. */}
              <p key={attempt} role="alert" className="error">
                {t.loadFailed}
              </p>
              <Button variant="primary" onPress={retry} isPending={engine.retrying}>
                {t.retry}
              </Button>
              <Disclosure summary={t.technicalDetails}>
                <code lang="en" dir="ltr">
                  {engine.detail}
                </code>
              </Disclosure>
            </div>
          )}
          {engine.status === "ready" && (
            <>
              {/* Kept mounted, so the learner's working survives a look at
                  the other tabs. */}
              <Tabs
                label={t.title}
                keepMounted
                items={[
                  { id: "working", label: t.tabs.working, content: <Working t={t} /> },
                  { id: "examples", label: t.tabs.examples, content: <Examples t={t} /> },
                  { id: "audit", label: t.tabs.audit, content: <Audit t={t} /> },
                ]}
              />
            </>
          )}
        </main>
      </div>
    </I18nProvider>
  );
}
