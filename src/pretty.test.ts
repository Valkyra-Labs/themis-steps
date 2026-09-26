import { describe, expect, it } from "vitest";
import { pretty } from "./pretty";

describe("pretty", () => {
  it("writes powers, minus and multiplication as a textbook does", () => {
    expect(pretty("x^2 - 5x + 6 = 0")).toBe("x² − 5x + 6 = 0");
    expect(pretty("x^(-1) * 2")).toBe("x⁻¹ · 2");
    expect(pretty("x = -3")).toBe("x = −3");
  });
});
