import { useEffect, useLayoutEffect, useState } from "react";
import { Button, I18nProvider, Tabs } from "@valkyra-labs/stoa-react";
import { loadEngine } from "./engine";
import { strings, type Lang } from "./i18n";
import { Working } from "./Working";
import { Examples } from "./Examples";
import { Audit } from "./Audit";

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(() => (new URLSearchParams(location.search).get("lang") === "ar" ? "ar" : "en"));
  const t = strings[lang];

  useEffect(() => {
    loadEngine().then(() => setReady(true), (e) => setError(String(e)));
  }, []);

  // The page direction follows the language; maths stays left to right.
  // Set before paint, so an Arabic page never shows a left-to-right frame.
  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

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
          <Button onPress={() => setLang(lang === "en" ? "ar" : "en")}>
            <span lang={lang === "en" ? "ar" : "en"}>{t.language}</span>
          </Button>
        </header>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {ready && (
          <main className="content">
            {t.mathNote && <p className="muted">{t.mathNote}</p>}
            <Tabs
              label={t.title}
              items={[
                { id: "working", label: t.tabs.working, content: <Working t={t} /> },
                { id: "examples", label: t.tabs.examples, content: <Examples t={t} lang={lang} /> },
                { id: "audit", label: t.tabs.audit, content: <Audit t={t} /> },
              ]}
            />
          </main>
        )}
      </div>
    </I18nProvider>
  );
}
