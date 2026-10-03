import { beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
vi.mock("themis-algebra", () => ({ default: init, checkStep: vi.fn(), solve: vi.fn() }));

describe("loadEngine", () => {
  beforeEach(() => {
    vi.resetModules();
    init.mockReset();
  });

  it("loads the engine once", async () => {
    init.mockResolvedValue({});
    const { loadEngine } = await import("./engine");
    await Promise.all([loadEngine(), loadEngine()]);
    await loadEngine();
    expect(init).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failed load", async () => {
    init.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({});
    const { loadEngine } = await import("./engine");
    await expect(loadEngine()).rejects.toThrow("network");
    await expect(loadEngine()).resolves.toBeUndefined();
    expect(init).toHaveBeenCalledTimes(2);
  });
});
