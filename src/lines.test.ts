import { describe, expect, it } from "vitest";
import { addLine, canUndo, isChecking, removeLast, setProblem, setResult, start, startOver, undo } from "./lines";
import type { Check } from "./verdict";

const three = () => addLine(addLine(start("x^2 = 9"), { text: "x = 3 or x = -3" }), { text: "x = ±3" });

describe("working lines", () => {
  it("removing the last line can be undone", () => {
    const s = removeLast(three());
    expect(s.lines.map((l) => l.text)).toEqual(["x^2 = 9", "x = 3 or x = -3"]);
    expect(s.notice).toMatchObject({ kind: "removed", line: 3 });
    expect(canUndo(s)).toBe(true);
    const back = undo(s);
    expect(back.lines).toEqual(three().lines);
    expect(back.notice).toEqual({ kind: "restored", line: 3 });
    expect(canUndo(back)).toBe(false);
  });

  it("starting over can be undone", () => {
    const s = startOver(three());
    expect(s.lines.map((l) => l.text)).toEqual(["x^2 = 9"]);
    const back = undo(s);
    expect(back.lines).toEqual(three().lines);
    expect(back.notice).toEqual({ kind: "restored", line: null });
  });

  it("the next edit ends the undo", () => {
    expect(canUndo(addLine(removeLast(three()), { text: "x = 3" }))).toBe(false);
    expect(canUndo(setProblem(startOver(three()), "x^2 = 4"))).toBe(false);
    // A second removal replaces the first: undo brings back the line it removed.
    const twice = removeLast(removeLast(three()));
    expect(undo(twice).lines.map((l) => l.text)).toEqual(["x^2 = 9", "x = 3 or x = -3"]);
  });

  it("a line is added while it is checked, and gets its verdict when the check ends", () => {
    const s = addLine(start("x^2 = 9"), { text: "x = 3", checking: true });
    expect(isChecking(s)).toBe(true);
    // Lines are not removed while one is checked: the check is for the step it ends.
    expect(removeLast(s)).toBe(s);
    expect(startOver(s)).toBe(s);
    const result = { kind: "changed" } as Check;
    const done = setResult(s, 1, result);
    expect(done.lines[1]).toEqual({ text: "x = 3", result });
    expect(isChecking(done)).toBe(false);
    // Only a line being checked takes a verdict.
    expect(setResult(done, 1, result)).toBe(done);
    expect(setResult(done, 5, result)).toBe(done);
  });

  it("does nothing with only the starting line", () => {
    const s = start("x = 1");
    expect(removeLast(s)).toBe(s);
    expect(startOver(s)).toBe(s);
    expect(undo(s)).toBe(s);
  });
});
