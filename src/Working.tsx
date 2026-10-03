import { useEffect, useRef, useState } from "react";
import { Button, TextField } from "@valkyra-labs/stoa-react";
import { check, type Check } from "./engine";
import type { Strings } from "./i18n";
import { addLine, canUndo, removeLast, setProblem, start, startOver, undo, type Notice, type WorkingState } from "./lines";
import { pretty } from "./pretty";
import { RichText } from "./RichText";
import { StepRow } from "./StepRow";

function noticeText(n: Notice, t: Strings): string {
  switch (n.kind) {
    case "removed":
      return t.lineRemoved(n.line);
    case "startedOver":
      return t.startedOver;
    case "restored":
      return n.line === null ? t.workingRestored : t.lineRestored(n.line);
  }
}

/** The learner writes the working; each line is checked against the one
 * before it as soon as Enter is pressed. Removing lines can be undone
 * until the next edit. */
export function Working({ t }: { t: Strings }) {
  const [state, setState] = useState<WorkingState>(() => start("x^2 - 5x + 6 = 0"));
  const [next, setNext] = useState("");
  // The last line checked, announced with its verdict in the current
  // language (so a change of language does not leave the other one behind).
  const [announce, setAnnounce] = useState<{ text: string; result: Check } | null>(null);
  const nextField = useRef<HTMLDivElement>(null);
  // Set when the control that had focus goes away (a button that becomes
  // disabled, or Undo once used); focus then moves to the next-line field.
  const [refocus, setRefocus] = useState(false);
  const { lines, notice } = state;

  useEffect(() => {
    if (!refocus) return;
    nextField.current?.querySelector("input")?.focus();
    setRefocus(false);
  }, [refocus]);

  const add = () => {
    const text = next.trim();
    if (!text) return;
    const prev = lines[lines.length - 1]!.text;
    const result = check(prev, text);
    setState(addLine(state, { text, result }));
    setNext("");
    setAnnounce({ text, result });
  };

  const remove = (action: (s: WorkingState) => WorkingState) => {
    const after = action(state);
    setState(after);
    if (after.lines.length < 2) setRefocus(true);
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
        <TextField label={t.problem} value={lines[0]!.text} onChange={(v) => setState(setProblem(state, v))} dir="ltr" />
      )}
      <div ref={nextField}>
        <TextField label={t.nextLine} value={next} onChange={setNext} onEnter={add} description={t.nextHint} dir="ltr" autoFocus />
      </div>
      <div className="actions">
        <Button onPress={add}>{t.nextLine}</Button>
        <Button isDisabled={lines.length < 2} onPress={() => remove(removeLast)}>
          {t.removeLast}
        </Button>
        <Button isDisabled={lines.length < 2} onPress={() => remove(startOver)}>
          {t.startOver}
        </Button>
        {last && <span className="muted">{t.checkedIn(last.ms.toFixed(2))}</span>}
      </div>
      {/* Always rendered, so each new notice is announced. */}
      <div role="status" className="notice">
        {notice && <span>{noticeText(notice, t)}</span>}
        {canUndo(state) && (
          <Button
            onPress={() => {
              setState(undo(state));
              setRefocus(true);
            }}
          >
            {t.undo}
          </Button>
        )}
      </div>
      {/* The line and the explanation of its verdict. */}
      <p className="stoa-visually-hidden" aria-live="polite">
        {announce && (
          <>
            <bdi dir="ltr">{pretty(t.showLine(announce.text))}</bdi>: <RichText value={t.explain(announce.result, "step")} />
          </>
        )}
      </p>
    </div>
  );
}
