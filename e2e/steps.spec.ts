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

for (const lang of ["en", "ar"]) {
  test(`no serious or critical axe violations (${lang})`, async ({ page }) => {
    await page.goto(`/?lang=${lang}`);
    await expect(page.locator(".step").first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
