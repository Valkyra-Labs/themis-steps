import { useEffect, useState } from "react";
import { Panel, StatusBadge } from "@valkyra-labs/stoa-react";
import { check, type Check } from "./engine";
import type { Strings } from "./i18n";
import { StepRow } from "./StepRow";

// Worked solutions; four of them contain the mistakes learners make most.
// The titles are in the language tables, under the same keys.
const EXAMPLES: { id: keyof Strings["exampleTitles"]; lines: string[] }[] = [
  { id: "factorising", lines: ["x^2 - 5x + 6 = 0", "(x - 2)(x - 3) = 0", "x = 2 or x = 3"] },
  { id: "dividing", lines: ["x^2 = 5x", "x = 5"] },
  { id: "lastLine", lines: ["x^2 - 9 = 0", "x^2 = 9", "x = 3"] },
  { id: "moving", lines: ["3x + 4 = 10 - x", "3x - x = 10 - 4", "2x = 6", "x = 3"] },
  { id: "notThere", lines: ["x/(x - 1) = 1/(x - 1)", "x = 1"] },
  { id: "clearing", lines: ["(x + 1)/2 = x - 1", "x + 1 = 2(x - 1)", "x + 1 = 2x - 2", "x = 3"] },
];

type Checked = (typeof EXAMPLES)[number] & { results: (Check | undefined)[] };

export function Examples({ t }: { t: Strings }) {
  const [checked, setChecked] = useState<Checked[] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(
      EXAMPLES.map(async (ex) => ({
        ...ex,
        results: await Promise.all(ex.lines.map((line, i) => (i === 0 ? undefined : check(ex.lines[i - 1]!, line)))),
      })),
    ).then((done) => live && setChecked(done));
    return () => {
      live = false;
    };
  }, []);
  if (!checked) return <p className="muted">{t.checking}</p>;
  return (
    <div className="examples">
      <p className="muted">{t.examplesIntro}</p>
      {checked.map((ex) => {
        const first = ex.results.findIndex((r) => r && r.kind !== "equivalent");
        return (
          <Panel key={ex.id} title={t.exampleTitles[ex.id]}>
            <p>
              {first < 0 ? (
                <StatusBadge tone="positive">{t.allCorrect}</StatusBadge>
              ) : (
                <StatusBadge tone="negative">{t.firstMistake(first + 1)}</StatusBadge>
              )}
            </p>
            <ol className="steps">
              {ex.lines.map((line, i) => (
                <StepRow key={i} n={i + 1} text={line} result={ex.results[i]} t={t} />
              ))}
            </ol>
          </Panel>
        );
      })}
    </div>
  );
}
