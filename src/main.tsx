import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyLanguage } from "@valkyra-labs/stoa-react";
import "@valkyra-labs/stoa-tokens/tokens.css";
import "./styles.css";
import { App } from "./App";
import { chosenLang } from "./settings";

// Before the app renders: the page's language and direction, so an Arabic
// page is laid out right to left from its first frame.
applyLanguage(chosenLang());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
