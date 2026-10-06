import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initSync } from "themis-algebra";
import { beforeAll, describe, expect, it } from "vitest";
import { badgeOf, type Check } from "./verdict";
import { checkNow as step } from "./wasmCheck";

beforeAll(() => {
  const require = createRequire(import.meta.url);
  initSync({ module: readFileSync(require.resolve("themis-algebra/themis_algebra_bg.wasm")) });
});

const failed = (error: NonNullable<Check["error"]>): Check => ({ ...step("x = 1", "x = 1"), kind: "error", error });

describe("the badge of a line", () => {
  it("says a line cannot be read only when that line was not read", () => {
    expect(badgeOf(step("x = 1", "x = = 3"))).toBe("cannotRead");
    expect(badgeOf(step("x = 1", "x $ 2"))).toBe("cannotRead");
    // The line before it could not be read: this one was, but the step is not checked.
    expect(badgeOf(step("x = = 3", "x = 3"))).toBe("notChecked");
    // Both were read, and are of different kinds or unknowns.
    expect(badgeOf(step("x = 1", "x^2 + 1"))).toBe("cannotCompare");
    expect(badgeOf(step("x = 1", "y = 1"))).toBe("cannotCompare");
    expect(badgeOf(failed({ kind: "timeout", limitMs: 2000 }))).toBe("tooComplex");
    // Too complex is said of the line that is; the one after it is not checked.
    expect(badgeOf(step("x = 1", "((x + 1)^64)^64 = 0"))).toBe("tooComplex");
    expect(badgeOf(step("((x + 1)^64)^64 = 0", "x = 1"))).toBe("notChecked");
    expect(badgeOf(failed({ kind: "stopped" }))).toBe("notChecked");
    expect(badgeOf(failed({ kind: "unknown", text: "something new" }))).toBe("notChecked");
  });

  it("gives the verdict otherwise", () => {
    expect(badgeOf(undefined)).toBe("start");
    expect(badgeOf(step("x^2 = 9", "x = ±3"))).toBe("correct");
    expect(badgeOf(step("x^2 = 9", "x = 3"))).toBe("wrong");
    expect(badgeOf(step("x + 1", "x + 2"))).toBe("notEqual");
  });
});
