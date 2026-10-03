// The learner's lines of working, with one step of undo for the two
// actions that remove lines. Undo stays available until the next edit,
// with no time limit.
import type { Check } from "./engine";

export type Line = { text: string; result?: Check };

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

/** Edit the starting line; only while it is the only one. */
export const setProblem = (s: WorkingState, text: string): WorkingState =>
  s.lines.length === 1 ? { lines: [{ text }], notice: null } : s;

export const removeLast = (s: WorkingState): WorkingState =>
  s.lines.length < 2 ? s : { lines: s.lines.slice(0, -1), notice: { kind: "removed", line: s.lines.length, previous: s.lines } };

export const startOver = (s: WorkingState): WorkingState =>
  s.lines.length < 2 ? s : { lines: s.lines.slice(0, 1), notice: { kind: "startedOver", previous: s.lines } };

export const canUndo = (s: WorkingState) => s.notice?.kind === "removed" || s.notice?.kind === "startedOver";

export function undo(s: WorkingState): WorkingState {
  const n = s.notice;
  if (n?.kind === "removed") return { lines: n.previous, notice: { kind: "restored", line: n.line } };
  if (n?.kind === "startedOver") return { lines: n.previous, notice: { kind: "restored", line: null } };
  return s;
}
