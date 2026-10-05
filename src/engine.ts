// The step checker (themis-algebra compiled to WebAssembly) runs in a
// worker (engine.worker.ts), one check at a time. A check that runs past
// the time limit is stopped by ending the worker, and the step is reported
// as not checked in time; the next check starts a new worker. So a line
// that is slow to check never holds up the page, and a worker whose engine
// failed is never used again.
import type { Check } from "./verdict";

export type { Check } from "./verdict";

/** The longest a check may take, in milliseconds. School algebra takes
 * well under one. */
export const CHECK_TIME_LIMIT_MS = 2000;

/** What the worker is asked to do. */
export type Job = { op: "load" } | { op: "check"; before: string; after: string } | { op: "solve"; line: string };
export type Request = Job & { id: number };
export type Reply = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string };

/** The parts of a Worker the engine uses (a fake one in the tests). */
export type WorkerLike = {
  postMessage(r: Request): void;
  terminate(): void;
  addEventListener(type: "message", listener: (e: MessageEvent<Reply>) => void): void;
  addEventListener(type: "error", listener: (e: ErrorEvent) => void): void;
};

/** A check that did not give a verdict. */
const notChecked = (error: NonNullable<Check["error"]>, ms: number): Check => ({
  kind: "error",
  lost: [],
  gained: [],
  lostInfinitelyMany: false,
  gainedInfinitelyMany: false,
  domainWidenedAt: [],
  domainNarrowedAt: [],
  witness: "",
  before: "",
  after: "",
  error,
  explanation: "",
  ms,
});

export function createEngine(spawn: () => WorkerLike, limitMs = CHECK_TIME_LIMIT_MS) {
  let worker: WorkerLike | null = null;
  let loading: Promise<void> | null = null;
  let lastId = 0;
  const waiting = new Map<number, (r: Reply) => void>();
  // Each request waits for the one before it, so a time limit counts only
  // the request's own check.
  let queue: Promise<unknown> = Promise.resolve();

  /** Ends the worker, and with it any check it is running. */
  function drop(error: string) {
    worker?.terminate();
    worker = null;
    loading = null;
    for (const [id, settle] of waiting) settle({ id, ok: false, error });
    waiting.clear();
  }

  function send(w: WorkerLike, job: Job): Promise<Reply> {
    const id = ++lastId;
    return new Promise((resolve) => {
      waiting.set(id, resolve);
      w.postMessage({ ...job, id });
    });
  }

  /** Starts the worker and loads the engine in it, once. A failed load is
   * forgotten, so calling again retries it in a new worker. */
  function load(): Promise<void> {
    loading ??= (async () => {
      const w = spawn();
      worker = w;
      w.addEventListener("message", (e: MessageEvent<Reply>) => {
        const settle = waiting.get(e.data.id);
        waiting.delete(e.data.id);
        settle?.(e.data);
      });
      // The worker's script could not be loaded, or it failed outside a request.
      w.addEventListener("error", (e: ErrorEvent) => {
        if (worker === w) drop(e.message || "The engine's worker failed.");
      });
      const r = await send(w, { op: "load" });
      if (!r.ok) {
        if (worker === w) drop(r.error);
        throw new Error(r.error);
      }
    })();
    return loading;
  }

  /** Runs one request after the ones before it: the reply's value, or the
   * error ("timeout" past the limit), after which the worker is replaced. */
  function run(job: Job): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
    const task = queue.then(async () => {
      try {
        await load();
      } catch (e) {
        return { ok: false as const, error: String(e) };
      }
      const w = worker!;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<Reply>((resolve) => {
        timer = setTimeout(() => resolve({ id: 0, ok: false, error: "timeout" }), limitMs);
      });
      const reply = await Promise.race([send(w, job), timedOut]);
      clearTimeout(timer);
      if (!reply.ok && worker === w) drop(reply.error);
      return reply;
    });
    queue = task;
    return task;
  }

  return {
    load,
    async check(before: string, after: string): Promise<Check> {
      const reply = await run({ op: "check", before, after });
      if (reply.ok) return reply.value as Check;
      return reply.error === "timeout" ? notChecked({ kind: "timeout", limitMs }, limitMs) : notChecked({ kind: "stopped" }, 0);
    },
    /** Real solutions as text; ["*"] for every x of the domain. Rejects
     * when the line could not be solved. */
    async solutions(line: string): Promise<string[]> {
      const reply = await run({ op: "solve", line });
      if (reply.ok) return reply.value as string[];
      throw new Error(reply.error);
    },
  };
}

const engine = createEngine(() => new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" }));

export const loadEngine = engine.load;
export const check = engine.check;
export const solutions = engine.solutions;
