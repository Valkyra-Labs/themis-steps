// Calls into the step checker (themis-algebra compiled to WebAssembly),
// which must already be loaded. The engine's worker makes these calls
// (engine.worker.ts), so a slow line never holds up the page; the unit
// tests make them directly.
import { checkStep, solve } from "themis-algebra";
import { readError, toEngine, type Check } from "./verdict";

export function checkNow(before: string, after: string): Check {
  const t = performance.now();
  const r = checkStep(toEngine(before), toEngine(after));
  const out: Check = {
    kind: r.kind as Check["kind"],
    lost: r.lost,
    gained: r.gained,
    lostInfinitelyMany: r.lostInfinitelyMany,
    gainedInfinitelyMany: r.gainedInfinitelyMany,
    domainWidenedAt: r.domainWidenedAt,
    domainNarrowedAt: r.domainNarrowedAt,
    witness: r.witness,
    before: r.before,
    after: r.after,
    explanation: r.explanation,
    ms: 0,
  };
  r.free();
  if (out.kind === "error") out.error = readError(out.explanation);
  // The engine reads a line with "=" as an equation (an answer line's
  // alternatives too), and says only that the kinds differ.
  if (out.error?.kind === "kindMismatch") out.error.firstIsEquation = toEngine(before).includes("=");
  out.ms = performance.now() - t;
  return out;
}

/** Real solutions as text; ["*"] for every x of the domain. */
export function solveNow(line: string): string[] {
  return solve(toEngine(line));
}
