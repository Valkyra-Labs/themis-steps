// End-to-end checks: typing working and getting verdicts, the worked
// examples and the audit, the Arabic interface, and axe in both.
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("typing a line checks it against the previous one", async ({ page }) => {
  await page.goto("/");
  const next = page.getByLabel("Next line");
  await next.fill("(x - 2)(x - 3) = 0");
  await next.press("Enter");
  await next.fill("x = 2");
  await next.press("Enter");
  const steps = page.locator(".step");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(1)).toContainText("Correct");
  await expect(steps.nth(2)).toContainText("This step loses x = 3.");
  // The verdict is announced to screen readers.
  await expect(page.locator('[aria-live="polite"]').last()).toContainText("loses x = 3");
});

test("worked examples point at the first wrong line", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Worked examples" }).click();
  const panel = (title: string) => page.locator(".stoa-panel", { has: page.getByRole("heading", { name: title }) });
  await expect(panel("Factorising a quadratic")).toContainText("Every step is correct");
  await expect(panel("Dividing by the unknown")).toContainText("First mistake: line 2");
  await expect(panel("The last line")).toContainText("First mistake: line 3");
  await expect(panel("Moving a term across")).toContainText("First mistake: line 2");
});

test("the audit finds the wrong stated answers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Audit exercises" }).click();
  await expect(page.getByText("9 of 12 stated answers are correct")).toBeVisible();
  await expect(page.getByText("The stated answer loses x = -4.")).toBeVisible();
});

test("the Arabic interface is right to left and keeps maths left to right", async ({ page }) => {
  await page.goto("/?lang=ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("tab", { name: "تحقّق من حلّك" })).toBeVisible();
  await expect(page.locator(".step__math").first()).toHaveAttribute("dir", "ltr");
});

test("arrow keys in the tabs follow the page direction", async ({ page }) => {
  // React Aria takes its direction from the locale it is given, not from
  // the page; the browser here is en-US in both languages.
  await page.goto("/?lang=ar");
  await page.getByRole("tab", { name: "تحقّق من حلّك" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "أمثلة محلولة" })).toBeFocused();
  await page.goto("/");
  await page.getByRole("tab", { name: "Check your working" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Worked examples" })).toBeFocused();
});

test("a loading message shows until the engine is ready", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/*.wasm", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("status").filter({ hasText: "Loading the engine…" })).toBeVisible();
  release();
  await expect(page.getByRole("tab", { name: "Check your working" })).toBeVisible();
  await expect(page.getByText("Loading the engine…")).toHaveCount(0);
});

test("a failed engine load says so and can be retried", async ({ page }) => {
  await page.route("**/*.wasm", (route) => route.abort());
  await page.goto("/?lang=ar");
  await expect(page.getByRole("alert")).toHaveText("تعذّر تحميل المحرّك. تحقّق من اتصالك ثم أعد المحاولة.");
  // The browser's error message is English, and marked so.
  await expect(page.locator(".load-failed code")).toHaveAttribute("lang", "en");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await page.unroute("**/*.wasm");
  await page.getByRole("button", { name: "أعد المحاولة" }).click();
  await expect(page.getByRole("tab", { name: "تحقّق من حلّك" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const lang of ["en", "ar"]) {
  test(`no serious or critical axe violations (${lang})`, async ({ page }) => {
    await page.goto(`/?lang=${lang}`);
    await expect(page.locator(".step").first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
