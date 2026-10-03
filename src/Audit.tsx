import { useMemo } from "react";
import { StatusBadge } from "@valkyra-labs/stoa-react";
import { check, solutions, type Check } from "./engine";
import type { Strings } from "./i18n";
import { pretty } from "./pretty";
import { RichText } from "./RichText";

// A sample of generated exercises with stated answers, as a content
// pipeline would produce them; some answers are wrong on purpose. The
// answers are checked by meaning: the stated answer line must have the
// same solution set as the equation.
const EXERCISES: { equation: string; stated: string[] }[] = [
  { equation: "2x + 3 = 11", stated: ["4"] },
  { equation: "x^2 - 7x + 12 = 0", stated: ["3", "4"] },
  { equation: "x^2 = 16", stated: ["4"] },
  { equation: "3(x - 1) = 2x + 5", stated: ["8"] },
  { equation: "x^2 + 4 = 0", stated: [] },
  { equation: "(x^2 - 4)/(x - 2) = 4", stated: ["2"] },
  { equation: "x/(x + 1) = 1/2", stated: ["1"] },
  { equation: "x^2 - 2x = 0", stated: ["2"] },
  { equation: "5 - 2x = 3x", stated: ["1"] },
  { equation: "x^3 = 4x", stated: ["-2", "0", "2"] },
  { equation: "(x + 2)^2 = x^2 + 4", stated: ["0"] },
  { equation: "2(x + 3) = 2x + 6", stated: ["*"] },
];

function answerLine(stated: string[]): string | null {
  if (stated.length === 0 || stated[0] === "*") return null;
  return stated.map((a) => `x = ${a}`).join(" or ");
}

export function Audit({ t }: { t: Strings }) {
  const rows = useMemo(
    () =>
      EXERCISES.map((ex) => {
        const actual = solutions(ex.equation);
        const line = answerLine(ex.stated);
        let ok: boolean;
        let wrong: Check | null = null;
        if (line === null) {
          ok = JSON.stringify(ex.stated) === JSON.stringify(actual);
        } else {
          const c = check(ex.equation, line);
          ok = c.kind === "equivalent";
          if (!ok) wrong = c;
        }
        return { ...ex, actual, ok, wrong };
      }),
    [],
  );
  // Solutions are maths, kept left to right; "no real solution" and "every
  // x" are words, which take the interface's direction.
  const answer = (v: string[]) =>
    v.length === 0 ? (
      t.none
    ) : v[0] === "*" ? (
      <RichText value={t.every} />
    ) : (
      <bdi dir="ltr" className="math">
        {pretty(v.join(t.listSeparator))}
      </bdi>
    );
  const ok = rows.filter((r) => r.ok).length;
  return (
    <div className="audit">
      <p className="muted">{t.auditIntro}</p>
      <p>
        <strong>{t.auditSummary(ok, rows.length)}</strong>
      </p>
      <table className="stoa-table">
        <caption className="stoa-visually-hidden">{t.tabs.audit}</caption>
        <thead>
          <tr>
            <th scope="col">{t.exercise}</th>
            <th scope="col">{t.stated}</th>
            <th scope="col">{t.actual}</th>
            <th scope="col">{t.verdict}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.equation}>
              <td>
                <bdi dir="ltr" className="math">
                  {pretty(r.equation)}
                </bdi>
              </td>
              <td>{answer(r.stated)}</td>
              <td>{answer(r.actual)}</td>
              <td>
                <StatusBadge tone={r.ok ? "positive" : "negative"}>{r.ok ? t.answerOk : t.answerWrong}</StatusBadge>
                {r.wrong && (
                  <div className="muted">
                    <RichText value={t.explain(r.wrong, "answer")} />
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
