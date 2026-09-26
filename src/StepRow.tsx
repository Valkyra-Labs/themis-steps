import { StatusBadge } from "@valkyra-labs/stoa-react";
import type { Check } from "./engine";
import type { Strings } from "./i18n";
import { pretty } from "./pretty";

/** One line of working with its verdict. Maths is always left to right,
 * isolated from the page direction. */
export function StepRow({ n, text, result, t }: { n: number; text: string; result?: Check; t: Strings }) {
  const badge = !result ? (
    <StatusBadge tone="neutral">{t.start}</StatusBadge>
  ) : result.kind === "equivalent" ? (
    <StatusBadge tone="positive">{t.correct}</StatusBadge>
  ) : result.kind === "error" ? (
    <StatusBadge tone="warning">{t.cannotRead}</StatusBadge>
  ) : (
    <StatusBadge tone="negative">{result.kind === "not_equal" ? t.notEqual : t.wrong}</StatusBadge>
  );
  return (
    <li className={`step step--${result?.kind ?? "start"}`}>
      <span className="step__n" aria-hidden="true">
        {n}
      </span>
      <span className="step__math" dir="ltr">
        <bdi>{pretty(text)}</bdi>
      </span>
      <span className="step__badge">{badge}</span>
      {result && result.kind !== "equivalent" && (
        <p className="step__why" dir="ltr">
          {result.explanation}
        </p>
      )}
      {result && result.kind === "equivalent" && result.domainWidenedAt.length > 0 && (
        <p className="step__why" dir="ltr">
          {result.explanation}
        </p>
      )}
    </li>
  );
}
