import { describe, expect, it } from "vitest";
import { addLine, canUndo, removeLast, setProblem, start, startOver, undo } from "./lines";

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

  it("does nothing with only the starting line", () => {
    const s = start("x = 1");
    expect(removeLast(s)).toBe(s);
    expect(startOver(s)).toBe(s);
    expect(undo(s)).toBe(s);
  });
});
