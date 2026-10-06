import { useEffect, useState } from "react";
import { Ltr, StatusBadge, Table } from "@valkyra-labs/stoa-react";
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

type Row = (typeof EXERCISES)[number] & { actual: string[]; ok: boolean; wrong: Check | null };

async function audit(ex: (typeof EXERCISES)[number]): Promise<Row> {
  const actual = await solutions(ex.equation);
  const line = answerLine(ex.stated);
  if (line === null) return { ...ex, actual, ok: JSON.stringify(ex.stated) === JSON.stringify(actual), wrong: null };
  const c = await check(ex.equation, line);
  return { ...ex, actual, ok: c.kind === "equivalent", wrong: c.kind === "equivalent" ? null : c };
}

export function Audit({ t }: { t: Strings }) {
  const [rows, setRows] = useState<Row[] | "failed" | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(EXERCISES.map(audit)).then(
      (done) => live && setRows(done),
      () => live && setRows("failed"),
    );
    return () => {
      live = false;
    };
  }, []);
  if (rows === null) return <p className="muted">{t.checking}</p>;
  if (rows === "failed") return <p className="muted">{t.auditFailed}</p>;
  // Solutions are maths, kept left to right; "no real solution" and "every
  // x" are words, which take the interface's direction.
  const answer = (v: string[]) =>
    v.length === 0 ? (
      t.none
    ) : v[0] === "*" ? (
      <RichText value={t.every} />
    ) : (
      <Ltr mono>{pretty(v.join(t.listSeparator))}</Ltr>
    );
  const ok = rows.filter((r) => r.ok).length;
  return (
    <div className="audit">
      <p className="muted">{t.auditIntro}</p>
      <p>
        <strong>{t.auditSummary(ok, rows.length)}</strong>
      </p>
      {/* Too wide for a phone, the table scrolls sideways in its own region;
          maths stays on one line. */}
      <Table
        caption={t.tabs.audit}
        hideCaption
        rows={rows}
        rowKey={(r) => r.equation}
        emptyText=""
        columns={[
          {
            id: "exercise",
            header: t.exercise,
            cell: (r) => (
              <Ltr mono>{pretty(r.equation)}</Ltr>
            ),
          },
          { id: "stated", header: t.stated, cell: (r) => answer(r.stated) },
          { id: "actual", header: t.actual, cell: (r) => answer(r.actual) },
          {
            id: "verdict",
            header: t.verdict,
            cell: (r) => (
              <>
                <StatusBadge tone={r.ok ? "positive" : "negative"}>{r.ok ? t.answerOk : t.answerWrong}</StatusBadge>
                {r.wrong && (
                  <div className="muted">
                    <RichText value={t.explain(r.wrong, "answer")} />
                  </div>
                )}
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
