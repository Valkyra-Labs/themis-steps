import { StatusBadge, type StatusTone } from "@valkyra-labs/stoa-react";
import { badgeOf, type Badge, type Check } from "./verdict";
import type { Strings } from "./i18n";
import { pretty } from "./pretty";
import { RichText } from "./RichText";

const TONES: Record<Badge, StatusTone> = {
  start: "neutral",
  correct: "positive",
  wrong: "negative",
  notEqual: "negative",
  cannotRead: "warning",
  cannotCompare: "warning",
  tooComplex: "warning",
  notChecked: "warning",
};

/** One line of working with its verdict. Maths is always left to right,
 * isolated from the page direction; the explanation is in the interface's
 * language, with its maths isolated the same way. */
export function StepRow({ n, text, result, checking = false, t }: { n: number; text: string; result?: Check; checking?: boolean; t: Strings }) {
  const kind = badgeOf(result);
  const badge = checking ? (
    <StatusBadge tone="neutral">{t.checking}</StatusBadge>
  ) : (
    <StatusBadge tone={TONES[kind]}>{t[kind]}</StatusBadge>
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
          <RichText value={t.explain(result, { line: n })} />
        </p>
      )}
    </li>
  );
}
