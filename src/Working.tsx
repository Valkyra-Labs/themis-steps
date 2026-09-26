import { useState } from "react";
import { Button, TextField } from "@valkyra-labs/stoa-react";
import { check, type Check } from "./engine";
import type { Strings } from "./i18n";
import { StepRow } from "./StepRow";

type Line = { text: string; result?: Check };

/** The learner writes the working; each line is checked against the one
 * before it as soon as Enter is pressed. */
export function Working({ t }: { t: Strings }) {
  const [lines, setLines] = useState<Line[]>([{ text: "x^2 - 5x + 6 = 0" }]);
  const [next, setNext] = useState("");
  const [announce, setAnnounce] = useState("");

  const add = () => {
    const text = next.trim();
    if (!text) return;
    const prev = lines[lines.length - 1]!.text;
    const result = check(prev, text);
    setLines([...lines, { text, result }]);
    setNext("");
    setAnnounce(`${text}: ${result.explanation}`);
  };

  const last = lines[lines.length - 1]?.result;
  return (
    <div className="working">
      <ol className="steps" aria-label={t.tabs.working}>
        {lines.map((l, i) => (
          <StepRow key={i} n={i + 1} text={l.text} result={l.result} t={t} />
        ))}
      </ol>
      {lines.length === 1 && (
        <TextField label={t.problem} value={lines[0]!.text} onChange={(v) => setLines([{ text: v }])} dir="ltr" />
      )}
      <TextField label={t.nextLine} value={next} onChange={setNext} onEnter={add} description={t.nextHint} dir="ltr" autoFocus />
      <div className="actions">
        <Button onPress={add}>{t.nextLine}</Button>
        <Button isDisabled={lines.length < 2} onPress={() => setLines(lines.slice(0, -1))}>
          {t.removeLast}
        </Button>
        <Button isDisabled={lines.length < 2} onPress={() => setLines(lines.slice(0, 1))}>
          {t.startOver}
        </Button>
        {last && <span className="muted">{t.checkedIn(last.ms.toFixed(2))}</span>}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
