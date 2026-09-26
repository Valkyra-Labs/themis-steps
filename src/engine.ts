// The step checker (themis-algebra compiled to WebAssembly). Checks take
// well under a millisecond, so they run on the UI thread.
import init, { checkStep, solve } from "themis-algebra";

let ready: Promise<void> | null = null;
export const loadEngine = () => (ready ??= init().then(() => undefined));

export type Check = {
  kind: "equivalent" | "changed" | "not_equal" | "error";
  lost: string[];
  gained: string[];
  lostInfinitelyMany: boolean;
  gainedInfinitelyMany: boolean;
  domainWidenedAt: string[];
  explanation: string;
  /** Time the engine took, in milliseconds. */
  ms: number;
};

export function check(before: string, after: string): Check {
  const t = performance.now();
  const r = checkStep(before, after);
  const out: Check = {
    kind: r.kind as Check["kind"],
    lost: r.lost,
    gained: r.gained,
    lostInfinitelyMany: r.lostInfinitelyMany,
    gainedInfinitelyMany: r.gainedInfinitelyMany,
    domainWidenedAt: r.domainWidenedAt,
    explanation: r.explanation,
    ms: 0,
  };
  r.free();
  out.ms = performance.now() - t;
  return out;
}

/** Real solutions as text; ["*"] for every x of the domain. */
export function solutions(line: string): string[] {
  return solve(line);
}
