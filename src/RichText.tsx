import type { Rich } from "./i18n";

/** Text with maths in it: each piece of maths is isolated left to right,
 * so it reads the same inside an Arabic sentence as in an English one, and
 * kept on one line. */
export function RichText({ value }: { value: Rich }) {
  return (
    <>
      {value.map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <bdi key={i} dir="ltr" className="inline-math">
            {p.math}
          </bdi>
        ),
      )}
    </>
  );
}
