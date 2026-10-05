// The learner's lines of working, with one step of undo for the two
// actions that remove lines. Undo stays available until the next edit,
// with no time limit. A line is added as soon as it is entered and gets
// its verdict when its check ends; lines are not removed meanwhile.
import type { Check } from "./verdict";

/** The first line has no result; a later one has its verdict, or is
 * `checking` until it arrives. */
export type Line = { text: string; result?: Check; checking?: true };

/** What the last action did, shown and announced under the working. The
 * removing actions keep the lines from before, for Undo. */
export type Notice =
  | { kind: "removed"; line: number; previous: Line[] }
  | { kind: "startedOver"; previous: Line[] }
  /** `line` is the restored line, or null when the whole working was. */
  | { kind: "restored"; line: number | null };

export type WorkingState = { lines: Line[]; notice: Notice | null };

export const start = (text: string): WorkingState => ({ lines: [{ text }], notice: null });

export const addLine = (s: WorkingState, line: Line): WorkingState => ({ lines: [...s.lines, line], notice: null });

export const isChecking = (s: WorkingState) => s.lines.some((l) => l.checking);

/** The verdict of line `index`, when it is being checked. */
export function setResult(s: WorkingState, index: number, result: Check): WorkingState {
  const line = s.lines[index];
  if (!line?.checking) return s;
  return { ...s, lines: s.lines.map((l, i) => (i === index ? { text: l.text, result } : l)) };
}

/** Edit the starting line; only while it is the only one. */
export const setProblem = (s: WorkingState, text: string): WorkingState =>
  s.lines.length === 1 ? { lines: [{ text }], notice: null } : s;

export const removeLast = (s: WorkingState): WorkingState =>
  s.lines.length < 2 || isChecking(s) ? s : { lines: s.lines.slice(0, -1), notice: { kind: "removed", line: s.lines.length, previous: s.lines } };

export const startOver = (s: WorkingState): WorkingState =>
  s.lines.length < 2 || isChecking(s) ? s : { lines: s.lines.slice(0, 1), notice: { kind: "startedOver", previous: s.lines } };

export const canUndo = (s: WorkingState) => s.notice?.kind === "removed" || s.notice?.kind === "startedOver";

export function undo(s: WorkingState): WorkingState {
  const n = s.notice;
  if (n?.kind === "removed") return { lines: n.previous, notice: { kind: "restored", line: n.line } };
  if (n?.kind === "startedOver") return { lines: n.previous, notice: { kind: "restored", line: null } };
  return s;
}
