import { StatusBadge } from "@valkyra-labs/stoa-react";
import type { Check } from "./engine";
import type { Strings } from "./i18n";
import { pretty } from "./pretty";
import { RichText } from "./RichText";

/** One line of working with its verdict. Maths is always left to right,
 * isolated from the page direction; the explanation is in the interface's
 * language, with its maths isolated the same way. */
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
        <bdi>{pretty(t.showLine(text))}</bdi>
      </span>
      <span className="step__badge">{badge}</span>
      {/* A correct step is explained only when it widens the domain. */}
      {result && (result.kind !== "equivalent" || result.domainWidenedAt.length > 0) && (
        <p className="step__why">
          <RichText value={t.explain(result, "step")} />
        </p>
      )}
    </li>
  );
}
