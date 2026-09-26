import { useEffect, useState } from "react";
import { Button, Tabs } from "@valkyra-labs/stoa-react";
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
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  return (
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
  );
}
