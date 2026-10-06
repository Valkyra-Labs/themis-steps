import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEngine, type Reply, type Request, type WorkerLike } from "./engine";
import type { Check } from "./verdict";

/** A worker that records what it is sent and answers when told to. */
class FakeWorker implements WorkerLike {
  sent: Request[] = [];
  terminated = false;
  private listeners: Record<string, ((e: any) => void)[]> = {};
  /** Answers each request as it arrives, when set. */
  auto?: (r: Request) => Reply | undefined;
  addEventListener(type: string, listener: (e: any) => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  postMessage(r: Request) {
    this.sent.push(r);
    const reply = this.auto?.(r);
    if (reply) queueMicrotask(() => this.reply(reply));
  }
  terminate() {
    this.terminated = true;
  }
  reply(r: Reply) {
    for (const l of this.listeners.message ?? []) l({ data: r });
  }
  fail(message: string) {
    for (const l of this.listeners.error ?? []) l({ message });
  }
}

const verdict = (kind: Check["kind"]): Check => ({
  kind,
  lost: [],
  gained: [],
  lostInfinitelyMany: false,
  gainedInfinitelyMany: false,
  domainWidenedAt: [],
  domainNarrowedAt: [],
  witness: "",
  before: "",
  after: "",
  explanation: "",
  ms: 0.1,
});

/** Answers loads at once and checks with "equivalent". */
const answering = (r: Request): Reply =>
  r.op === "load" ? { id: r.id, ok: true, value: null } : r.op === "check" ? { id: r.id, ok: true, value: verdict("equivalent") } : { id: r.id, ok: true, value: ["3"] };

function setup(limitMs = 1000) {
  const workers: FakeWorker[] = [];
  const engine = createEngine(() => {
    const w = new FakeWorker();
    w.auto = answering;
    workers.push(w);
    return w;
  }, limitMs);
  return { engine, workers };
}

describe("the engine's worker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is started and loaded once", async () => {
    const { engine, workers } = setup();
    await Promise.all([engine.load(), engine.load()]);
    await engine.load();
    expect(workers).toHaveLength(1);
    expect(workers[0]!.sent.filter((r) => r.op === "load")).toHaveLength(1);
  });

  it("is started again after a failed load", async () => {
    const workers: FakeWorker[] = [];
    const engine = createEngine(() => {
      const w = new FakeWorker();
      w.auto = workers.length === 0 ? (r) => ({ id: r.id, ok: false, error: "TypeError: Failed to fetch" }) : answering;
      workers.push(w);
      return w;
    });
    await expect(engine.load()).rejects.toThrow("Failed to fetch");
    expect(workers[0]!.terminated).toBe(true);
    await expect(engine.load()).resolves.toBeUndefined();
    expect(workers).toHaveLength(2);
  });

  it("a worker that cannot start fails the load", async () => {
    const workers: FakeWorker[] = [];
    const engine = createEngine(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
    const loading = engine.load();
    workers[0]!.fail("could not load the script");
    await expect(loading).rejects.toThrow("could not load the script");
  });

  it("checks a step in the worker", async () => {
    const { engine, workers } = setup();
    await expect(engine.check("x^2 = 9", "x = 3")).resolves.toMatchObject({ kind: "equivalent" });
    expect(workers[0]!.sent.at(-1)).toMatchObject({ op: "check", before: "x^2 = 9", after: "x = 3" });
    await expect(engine.solutions("x = 3")).resolves.toEqual(["3"]);
  });

  it("stops a check that runs past the time limit, and checks the next step in a new worker", async () => {
    const { engine, workers } = setup(2000);
    await engine.load();
    workers[0]!.auto = (r) => (r.op === "check" ? undefined : answering(r));
    const slow = engine.check("x = 1", "(x + 1)^64 + x = 0");
    await vi.advanceTimersByTimeAsync(1999);
    expect(workers[0]!.terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(slow).resolves.toMatchObject({ kind: "error", error: { kind: "timeout", limitMs: 2000 } });
    expect(workers[0]!.terminated).toBe(true);
    await expect(engine.check("x = 1", "x = 2")).resolves.toMatchObject({ kind: "equivalent" });
    expect(workers).toHaveLength(2);
    expect(workers[1]!.sent.map((r) => r.op)).toEqual(["load", "check"]);
  });

  it("replaces a worker whose check failed", async () => {
    const { engine, workers } = setup();
    await engine.load();
    workers[0]!.auto = (r) => (r.op === "check" ? { id: r.id, ok: false, error: "RuntimeError: unreachable" } : answering(r));
    await expect(engine.check("x = 1", "x = 2")).resolves.toMatchObject({ kind: "error", error: { kind: "stopped" } });
    expect(workers[0]!.terminated).toBe(true);
    await expect(engine.check("x = 1", "x = 2")).resolves.toMatchObject({ kind: "equivalent" });
    expect(workers).toHaveLength(2);
  });

  it("runs one check at a time, each with its own time limit", async () => {
    const { engine, workers } = setup(1000);
    await engine.load();
    const w = workers[0]!;
    w.auto = undefined;
    const first = engine.check("x = 1", "x = 2");
    const second = engine.check("x = 2", "x = 3");
    await vi.advanceTimersByTimeAsync(0);
    expect(w.sent.filter((r) => r.op === "check")).toHaveLength(1);
    // The first takes 900 ms; the second's limit starts when it is sent.
    await vi.advanceTimersByTimeAsync(900);
    w.reply({ id: w.sent.at(-1)!.id, ok: true, value: verdict("changed") });
    await expect(first).resolves.toMatchObject({ kind: "changed" });
    await vi.advanceTimersByTimeAsync(0);
    expect(w.sent.filter((r) => r.op === "check")).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(900);
    w.reply({ id: w.sent.at(-1)!.id, ok: true, value: verdict("equivalent") });
    await expect(second).resolves.toMatchObject({ kind: "equivalent" });
    expect(w.terminated).toBe(false);
  });
});
