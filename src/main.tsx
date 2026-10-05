import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyLanguage } from "@valkyra-labs/stoa-react";
import plexArabic from "@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2?url";
import "@valkyra-labs/stoa-tokens/tokens.css";
import "./styles.css";
import { App } from "./App";
import { chosenLang } from "./settings";

// Before the app renders: the page's language and direction, so an Arabic
// page is laid out right to left from its first frame; and on an Arabic
// page the Arabic face it draws first, so it usually arrives before the
// text does (only there: a preload that is not used costs the download).
applyLanguage(chosenLang());
if (document.documentElement.lang === "ar") {
  const link = Object.assign(document.createElement("link"), { rel: "preload", as: "font", type: "font/woff2", href: plexArabic, crossOrigin: "anonymous" });
  document.head.append(link);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
