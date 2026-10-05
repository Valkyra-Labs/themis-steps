// The step checker's own thread. A line that takes long to check holds up
// this worker, never the page, and the page stops the worker when a check
// runs past its time limit (engine.ts).
import init from "themis-algebra";
import type { Reply, Request } from "./engine";
import { checkNow, solveNow } from "./wasmCheck";

let ready: Promise<unknown> | null = null;

self.addEventListener("message", async (e: MessageEvent<Request>) => {
  const r = e.data;
  let reply: Reply;
  try {
    ready ??= init();
    await ready;
    const value = r.op === "load" ? null : r.op === "check" ? checkNow(r.before, r.after) : solveNow(r.line);
    reply = { id: r.id, ok: true, value };
  } catch (error) {
    reply = { id: r.id, ok: false, error: String(error) };
  }
  self.postMessage(reply);
});
