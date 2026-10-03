import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initSync } from "themis-algebra";
import { beforeAll, describe, expect, it } from "vitest";
import { check, readError, toEngine, type Check } from "./engine";
import { plain, strings, type Rich } from "./i18n";

// The real engine, loaded from its WebAssembly file.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  initSync({ module: readFileSync(require.resolve("themis-algebra/themis_algebra_bg.wasm")) });
});

/** Every key path of a table, with the kind of value at it (a function's
 * arity included). */
function shape(v: unknown, path = ""): string[] {
  if (Array.isArray(v)) return [`${path}: rich`];
  if (typeof v === "function") return [`${path}: function/${v.length}`];
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => shape(x, path ? `${path}.${k}` : k));
  return [`${path}: ${typeof v}`];
}

describe("language tables", () => {
  it("English and Arabic have the same keys, with the same kinds of value", () => {
    expect(shape(strings.ar).sort()).toEqual(shape(strings.en).sort());
  });

  it("no string is empty", () => {
    for (const lang of ["en", "ar"] as const)
      for (const [k, v] of Object.entries(strings[lang])) if (typeof v === "string") expect(v, `${lang}.${k}`).not.toBe("");
  });
});

/** Latin letters outside maths, and Latin words (two letters or more)
 * inside it: what an Arabic explanation must not contain. */
function latin(r: Rich): string[] {
  return r.flatMap((p) => (typeof p === "string" ? (p.match(/[A-Za-z]+/g) ?? []) : (p.math.match(/[A-Za-z]{2,}/g) ?? [])));
}

const step = (before: string, after: string) => check(before, after);

// One step for each thing the engine can say: every verdict, every kind
// of root, both changes of domain, and every error it reaches from a typed
// line. The English is the engine's own sentence.
const CASES: [string, string][] = [
  ["x^2 - 1", "(x - 1)(x + 1)"], // equivalent
  ["x^2 - 5x + 6 = 0", "(x - 2)(x - 3) = 0"], // equivalent
  ["x^2 = 9", "x = 3"], // loses one root
  ["x^2 - 2 = 0", "x = 1"], // loses two surds, adds one
  ["x = 1", "x = ±3 or x = ±2"], // loses one, adds four
  ["x = 2", "x^2 = 4"], // adds one
  ["x = 1", "x = 2"], // loses one and adds one
  ["x^3 - x - 1 = 0", "x = 1"], // an approximate root
  ["2(x + 3) = 2x + 6", "x = 1"], // loses infinitely many
  ["x = 1", "2(x + 3) = 2x + 6"], // gains infinitely many
  ["x = 1", "x/x = 1"], // gains infinitely many, narrows the domain
  ["x/(x - 1) = 1/(x - 1)", "x = 1"], // adds a root, widens the domain
  ["x^2 - 4 = 0", "(x^2 - 4)/(x - 2) = 0"], // loses a root, narrows the domain
  ["(x - 2)(x + 2)/(x - 2) = 0", "x + 2 = 0"], // equivalent, widens the domain
  ["x + 1", "x + 2"], // expressions not equal
  ["x/2 + 1", "x + 1/2"], // not equal, at a fraction
  ["x = 1", ""], // empty
  ["x = 1", "x $ 2"], // unexpected character
  ["x = 1", "x = 1..2"], // unexpected number text
  ["x = 1", "x="], // unexpected end of line
  ["x = 1", "x = 2 ± 3 ± 1"], // a second ±
  ["x = 1", "x = 1 or x + 1"], // an alternative that is not an equation
  ["x = 1", "x+y=1"], // two unknowns
  ["x = 1", "x^x = 1"], // exponent not a whole number
  ["x = 1", "x^99 = 1"], // exponent too large
  ["x = 1", "1/0 = x"], // division by zero
  ["x = 1", "x = 2 = 3"], // more than one =
  ["x = 1", "x + 1"], // equation and expression
  ["x = 1", "y = 1"], // different unknowns
];

// Tokens the engine names in Rust's debug form; shown as the symbol.
const TOKEN_CASES: [string, string, string][] = [
  ["x = 1", "x + = 3", "line 2: unexpected '=' at position 5"],
  ["x = 1", "x)", "line 2: unexpected ')' at position 2"],
  ["x = 1", "x = *2", "line 2: unexpected '*' at position 5"],
  ["x = 1", "x = ²", "line 2: unexpected '²' at position 5"],
];

describe("explanations", () => {
  it("the English is the engine's own sentence", () => {
    for (const [a, b] of CASES) {
      const c = step(a, b);
      expect(plain(strings.en.explain(c, "step")), `${a} -> ${b}`).toBe(c.explanation);
    }
  });

  it("every case is covered", () => {
    const checks = CASES.map(([a, b]) => step(a, b));
    const has = (f: (c: Check) => boolean) => checks.some(f);
    expect(has((c) => c.kind === "equivalent")).toBe(true);
    expect(has((c) => c.kind === "equivalent" && c.domainWidenedAt.length > 0)).toBe(true);
    expect(has((c) => c.kind === "not_equal")).toBe(true);
    expect(has((c) => c.lost.length === 1)).toBe(true);
    expect(has((c) => c.lost.length === 2)).toBe(true);
    expect(has((c) => c.gained.length === 1)).toBe(true);
    expect(has((c) => c.gained.length > 2)).toBe(true);
    expect(has((c) => c.lost.length > 0 && c.gained.length > 0)).toBe(true);
    expect(has((c) => c.lost.some((r) => r.startsWith("≈")))).toBe(true);
    expect(has((c) => c.lost.some((r) => r.includes("√")))).toBe(true);
    expect(has((c) => c.lostInfinitelyMany)).toBe(true);
    expect(has((c) => c.gainedInfinitelyMany)).toBe(true);
    expect(has((c) => c.domainWidenedAt.length > 0)).toBe(true);
    expect(has((c) => c.domainNarrowedAt.length > 0)).toBe(true);
    const errors = checks.flatMap((c) => (c.error ? [c.error] : []));
    expect(new Set(errors.map((e) => e.kind))).toEqual(new Set(["parse", "kindMismatch", "differentUnknowns"]));
    const parse = errors.flatMap((e) => (e.kind === "parse" ? [e.error] : []));
    expect(new Set(parse.map((e) => e.kind))).toEqual(
      new Set(["empty", "unexpected", "twoUnknowns", "exponentNotInteger", "exponentTooLarge", "divisionByZero", "tooManyEquals"]),
    );
    const found = parse.flatMap((e) => (e.kind === "unexpected" ? [e.found.kind] : []));
    expect(new Set(found)).toEqual(new Set(["symbol", "endOfLine", "plusMinus", "alternative"]));
  });

  it("tokens the engine writes in debug form are shown as the symbol", () => {
    for (const [a, b, english] of TOKEN_CASES) {
      const c = step(a, b);
      expect(c.error).toMatchObject({ kind: "parse", line: 2, error: { kind: "unexpected" } });
      expect(plain(strings.en.explain(c, "step"))).toBe(english);
    }
  });

  it("every error message is read", () => {
    expect(readError("line 2: unexpected Num(Ratio { numer: 3, denom: 1 }) at position 4")).toEqual({
      kind: "parse",
      line: 2,
      error: { kind: "unexpected", at: 4, found: { kind: "number" } },
    });
    expect(readError("line 1: unexpected Var('y') at position 1")).toMatchObject({ error: { found: { kind: "symbol", text: "y" } } });
    expect(readError("line 1: unexpected LParen at position 1")).toMatchObject({ error: { found: { kind: "symbol", text: "(" } } });
    expect(readError("line 1: unexpected Sup(3) at position 1")).toMatchObject({ error: { found: { kind: "symbol", text: "³" } } });
    // A form this app does not know is kept, and the Arabic does not show it.
    expect(readError("something new")).toEqual({ kind: "unknown", text: "something new" });
    const unknown: Check = { ...step("x = 1", "x = 1"), kind: "error", error: { kind: "unknown", text: "something new" } };
    expect(plain(strings.en.explain(unknown, "step"))).toBe("something new");
    expect(plain(strings.ar.explain(unknown, "step"))).toBe("تعذّرت قراءة السطر");
  });

  it("the Arabic has no Latin words, and its maths no Latin words either", () => {
    for (const [a, b] of [...CASES, ...TOKEN_CASES]) {
      const r = strings.ar.explain(step(a, b), "step");
      expect(latin(r), `${a} -> ${b}: ${plain(r)}`).toEqual([]);
    }
  });

  it("the Arabic agrees with the number of roots", () => {
    expect(plain(strings.ar.explain(step("x^2 = 9", "x = 3"), "step"))).toBe("تفقد هذه الخطوة الحل x = -3.");
    expect(plain(strings.ar.explain(step("x = 2", "x^2 = 4"), "step"))).toBe("تضيف هذه الخطوة الحل x = -2، وهو ليس حلًّا للسطر السابق.");
    expect(plain(strings.ar.explain(step("x^2 - 2 = 0", "x = 1"), "step"))).toBe(
      "تفقد هذه الخطوة الحلّين x = -√2، x = √2؛ تضيف هذه الخطوة الحل x = 1، وهو ليس حلًّا للسطر السابق.",
    );
    expect(plain(strings.ar.explain(step("x = 1", "x = ±3 or x = ±2"), "step"))).toBe(
      "تفقد هذه الخطوة الحل x = 1؛ تضيف هذه الخطوة الحلول x = -3، x = -2، x = 2، x = 3، وهي ليست حلولًا للسطر السابق.",
    );
  });

  it("a stated answer is explained against its equation", () => {
    const lost = step("x^2 = 16", "x = 4");
    expect(plain(strings.en.explain(lost, "answer"))).toBe("The stated answer loses x = -4.");
    expect(plain(strings.ar.explain(lost, "answer"))).toBe("تفقد الإجابة المعلنة الحل x = -4.");
    // The equation's excluded point is not repeated as a change of domain.
    const gained = step("(x^2 - 4)/(x - 2) = 4", "x = 2");
    expect(plain(strings.en.explain(gained, "answer"))).toBe("The stated answer adds x = 2, which the equation does not have.");
    expect(plain(strings.ar.explain(gained, "answer"))).toBe("تضيف الإجابة المعلنة الحل x = 2، وهو ليس حلًّا للمعادلة.");
    const both = step("x^2 - 2x = 0", "x = 2 or x = 1");
    expect(plain(strings.en.explain(both, "answer"))).toBe(
      "The stated answer loses x = 0; the stated answer adds x = 1, which the equation does not have.",
    );
    const every = step("2(x + 3) = 2x + 6", "x = 1");
    expect(plain(strings.en.explain(every, "answer"))).toBe("The equation holds for every x in its domain, the stated answer does not.");
    expect(plain(strings.ar.explain(every, "answer"))).toBe("تتحقق المعادلة لكل x في مجالها، ولا تتحقق الإجابة المعلنة.");
  });
});

describe("answers typed in Arabic", () => {
  it("أو and the Arabic comma and semicolon reach the engine as or, comma and semicolon", () => {
    expect(toEngine("x = 2 أو x = 3")).toBe("x = 2 or x = 3");
    expect(toEngine("x = 2أوx = 3")).toBe("x = 2 or x = 3");
    expect(toEngine("x = 2، x = 3")).toBe("x = 2, x = 3");
    expect(toEngine("x = 2؛ x = 3")).toBe("x = 2; x = 3");
  });

  it("are checked like the English ones", () => {
    for (const answer of ["x = 2 أو x = 3", "x = 2، x = 3", "x = 3 أو x = 2"])
      expect(step("(x - 2)(x - 3) = 0", answer).kind, answer).toBe("equivalent");
  });

  it("are shown with the Arabic words in the Arabic interface", () => {
    expect(strings.ar.showLine("x = 2 or x = 3")).toBe("x = 2 أو x = 3");
    expect(strings.en.showLine("x = 2 or x = 3")).toBe("x = 2 or x = 3");
  });
});
