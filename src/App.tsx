import { useEffect, useLayoutEffect, useState } from "react";
import { Button, Disclosure, I18nProvider, Tabs } from "@valkyra-labs/stoa-react";
import { loadEngine } from "./engine";
import { strings, type Lang } from "./i18n";
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

  // The language lives in ?lang= too, so a reload or a shared link keeps it.
  // replaceState: switching language is not a step to go back through.
  const switchLang = () => {
    const next: Lang = lang === "en" ? "ar" : "en";
    const url = new URL(location.href);
    url.searchParams.set("lang", next);
    history.replaceState(history.state, "", url);
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
        <header className="bar">
          <h1>{t.title}</h1>
          <span className="muted">{t.tagline}</span>
          <span className="spacer" />
          <Button onPress={switchLang}>
            <span lang={lang === "en" ? "ar" : "en"}>{t.language}</span>
          </Button>
        </header>
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
