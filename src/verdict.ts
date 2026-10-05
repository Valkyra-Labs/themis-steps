// What the step checker says about a step, as this app reads it: the
// engine's result, and its errors read back from their text.

/** What the engine found unexpected while reading a line. */
export type Found =
  | { kind: "symbol"; text: string }
  | { kind: "endOfLine" }
  | { kind: "number" }
  /** A second `±` in one line. */
  | { kind: "plusMinus" }
  /** An alternative of an answer line that is not an equation. */
  | { kind: "alternative"; text: string }
  /** A token the engine names in a form this app does not know. */
  | { kind: "token"; raw: string };

export type ParseError =
  | { kind: "empty" }
  | { kind: "unexpected"; at: number; found: Found }
  | { kind: "twoUnknowns"; a: string; b: string }
  | { kind: "exponentNotInteger"; at: number }
  | { kind: "exponentTooLarge"; at: number }
  | { kind: "divisionByZero" }
  | { kind: "tooManyEquals" }
  // The engine's limits on what one line may ask for; `max` is the limit.
  /** Longer than the engine reads; not read at all. */
  | { kind: "tooLong"; max: number }
  /** Brackets and signs nested deeper than the engine reads. */
  | { kind: "tooDeep"; max: number }
  /** A polynomial of a degree above the highest the engine works with. */
  | { kind: "tooComplex"; max: number }
  /** More alternatives than the engine reads in an answer line. */
  | { kind: "tooManyAlternatives"; max: number };

export type EngineError =
  /** `line` counts the two lines of the check: 1 is the earlier one. */
  | { kind: "parse"; line: number; error: ParseError }
  /** One line is an equation and the other an expression; which one is
   * set where the two lines are known (wasmCheck.ts). */
  | { kind: "kindMismatch"; firstIsEquation: boolean }
  | { kind: "differentUnknowns"; a: string; b: string }
  /** A message in a form this app does not know; kept as the engine wrote it. */
  | { kind: "unknown"; text: string }
  /** The check ran past the time limit and was stopped (see engine.ts). */
  | { kind: "timeout"; limitMs: number }
  /** The engine failed while checking (its worker was replaced). */
  | { kind: "stopped" };

export type Check = {
  kind: "equivalent" | "changed" | "not_equal" | "error";
  /** Roots as the engine writes them: "2", "1/2 + √5/2", or "≈ 1.324718". */
  lost: string[];
  gained: string[];
  lostInfinitelyMany: boolean;
  gainedInfinitelyMany: boolean;
  domainWidenedAt: string[];
  domainNarrowedAt: string[];
  /** For "not_equal": an x where both are defined, and the two values there. */
  witness: string;
  before: string;
  after: string;
  /** For "error": what went wrong. */
  error?: EngineError;
  /** The engine's own English sentence; the interface writes its own
   * from the fields above, in either language. */
  explanation: string;
  /** Time the engine took, in milliseconds. */
  ms: number;
};

// The engine reports an error only as text (its Rust error's Display), so
// the error is read back from that text. Its tokens are written in their
// Rust debug form ("Op('*')", "RParen"); each becomes the symbol typed.
const TOKENS: Record<string, string> = { LParen: "(", RParen: ")", Eq: "=" };
const SUPERSCRIPTS: Record<string, string> = { "2": "²", "3": "³" };

function readFound(s: string): Found {
  if (s === "end of line") return { kind: "endOfLine" };
  if (s === "'±' (write it once per line, as in x = ±3)") return { kind: "plusMinus" };
  let m = /^'(.*)' \(each alternative must be an equation\)$/su.exec(s);
  if (m) return { kind: "alternative", text: m[1]! };
  m = /^'(.*)'$/su.exec(s) ?? /^(?:Op|Var)\('(.)'\)$/u.exec(s);
  if (m) return { kind: "symbol", text: m[1]! };
  if (TOKENS[s]) return { kind: "symbol", text: TOKENS[s] };
  m = /^Sup\((\d+)\)$/.exec(s);
  if (m) return { kind: "symbol", text: SUPERSCRIPTS[m[1]!] ?? `^${m[1]}` };
  if (s.startsWith("Num(")) return { kind: "number" };
  return { kind: "token", raw: s };
}

function readParseError(s: string): ParseError | null {
  if (s === "the line is empty") return { kind: "empty" };
  if (s === "division by zero") return { kind: "divisionByZero" };
  if (s === "more than one '='") return { kind: "tooManyEquals" };
  let limit = /^the line is longer than (\d+) characters$/.exec(s);
  if (limit) return { kind: "tooLong", max: Number(limit[1]) };
  limit = /^brackets and signs are nested more than (\d+) deep$/.exec(s);
  if (limit) return { kind: "tooDeep", max: Number(limit[1]) };
  limit = /^the line is too complex to check: its degree is above (\d+)$/.exec(s);
  if (limit) return { kind: "tooComplex", max: Number(limit[1]) };
  limit = /^more than (\d+) alternatives$/.exec(s);
  if (limit) return { kind: "tooManyAlternatives", max: Number(limit[1]) };
  let m = /^unexpected (.*) at position (\d+)$/su.exec(s);
  if (m) return { kind: "unexpected", at: Number(m[2]), found: readFound(m[1]!) };
  m = /^two unknowns \((.) and (.)\); one is supported$/u.exec(s);
  if (m) return { kind: "twoUnknowns", a: m[1]!, b: m[2]! };
  m = /^the exponent at position (\d+) must be a whole number$/.exec(s);
  if (m) return { kind: "exponentNotInteger", at: Number(m[1]) };
  m = /^the exponent at position (\d+) is too large$/.exec(s);
  if (m) return { kind: "exponentTooLarge", at: Number(m[1]) };
  return null;
}

/** The engine's error message, read back into its parts. */
export function readError(text: string): EngineError {
  if (text === "one line is an equation and the other is an expression") return { kind: "kindMismatch", firstIsEquation: false };
  let m = /^the lines use different unknowns \((.) and (.)\)$/u.exec(text);
  if (m) return { kind: "differentUnknowns", a: m[1]!, b: m[2]! };
  m = /^line (\d+): (.*)$/su.exec(text);
  const error = m && readParseError(m[2]!);
  if (m && error) return { kind: "parse", line: Number(m[1]), error };
  return { kind: "unknown", text };
}

/** The engine reads "or", "," and ";" between the alternatives of an
 * answer line; an Arabic learner writes "أو", "،" and "؛". */
export function toEngine(line: string): string {
  return line
    .replace(/\s*أو\s*/gu, " or ")
    .replace(/،/gu, ",")
    .replace(/؛/gu, ";");
}

/** What a line's badge says. "cannotRead" only for a line the engine
 * could not read; a step it could not check for another reason says why
 * not. */
export type Badge = "start" | "correct" | "wrong" | "notEqual" | "cannotRead" | "cannotCompare" | "tooComplex" | "notChecked";

/** The badge of the line a step ends on, or of the first line (no result). */
export function badgeOf(result: Check | undefined): Badge {
  if (!result) return "start";
  if (result.kind === "equivalent") return "correct";
  if (result.kind === "changed") return "wrong";
  if (result.kind === "not_equal") return "notEqual";
  const e = result.error;
  switch (e?.kind) {
    case "parse":
      // Line 2 of the pair is this one; line 1 is the one before it.
      if (e.line !== 2) return "notChecked";
      // Read, but asking for more work than the engine does.
      return e.error.kind === "tooComplex" ? "tooComplex" : "cannotRead";
    case "kindMismatch":
    case "differentUnknowns":
      return "cannotCompare";
    case "timeout":
      return "tooComplex";
    default:
      return "notChecked";
  }
}
