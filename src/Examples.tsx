import { useMemo } from "react";
import { Panel, StatusBadge } from "@valkyra-labs/stoa-react";
import { check } from "./engine";
import type { Strings } from "./i18n";
import { StepRow } from "./StepRow";

// Worked solutions; three of them contain the mistakes learners make most.
const EXAMPLES: { title: string; titleAr: string; lines: string[] }[] = [
  { title: "Factorising a quadratic", titleAr: "تحليل معادلة من الدرجة الثانية", lines: ["x^2 - 5x + 6 = 0", "(x - 2)(x - 3) = 0", "x = 2 or x = 3"] },
  { title: "Dividing by the unknown", titleAr: "القسمة على المجهول", lines: ["x^2 = 5x", "x = 5"] },
  { title: "The last line", titleAr: "السطر الأخير", lines: ["x^2 - 9 = 0", "x^2 = 9", "x = 3"] },
  { title: "Moving a term across", titleAr: "نقل حدّ إلى الطرف الآخر", lines: ["3x + 4 = 10 - x", "3x - x = 10 - 4", "2x = 6", "x = 3"] },
  { title: "A root that is not there", titleAr: "جذر غير موجود", lines: ["x/(x - 1) = 1/(x - 1)", "x = 1"] },
  { title: "Clearing a fraction, correctly", titleAr: "التخلص من الكسر بشكل صحيح", lines: ["(x + 1)/2 = x - 1", "x + 1 = 2(x - 1)", "x + 1 = 2x - 2", "x = 3"] },
];

export function Examples({ t, lang }: { t: Strings; lang: "en" | "ar" }) {
  const checked = useMemo(
    () =>
      EXAMPLES.map((ex) => ({
        ...ex,
        results: ex.lines.map((line, i) => (i === 0 ? undefined : check(ex.lines[i - 1]!, line))),
      })),
    [],
  );
  return (
    <div className="examples">
      <p className="muted">{t.examplesIntro}</p>
      {checked.map((ex) => {
        const first = ex.results.findIndex((r) => r && r.kind !== "equivalent");
        return (
          <Panel key={ex.title} title={lang === "ar" ? ex.titleAr : ex.title}>
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
