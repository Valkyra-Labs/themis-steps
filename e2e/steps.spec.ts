// End-to-end checks: typing working and getting verdicts, the worked
// examples and the audit, the Arabic interface, and axe in both.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

test("typing a line checks it against the previous one", async ({ page }) => {
  await page.goto("/");
  const next = page.getByLabel("Next line");
  await next.fill("(x - 2)(x - 3) = 0");
  await next.press("Enter");
  await next.fill("x = 2");
  await next.press("Enter");
  const steps = page.locator(".working .step");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(1)).toContainText("Correct");
  await expect(steps.nth(2)).toContainText("This step loses x = 3.");
  // The verdict is announced to screen readers.
  await expect(page.locator('[aria-live="polite"]').last()).toContainText("loses x = 3");
});

test("removing lines can be undone until the next edit", async ({ page }) => {
  await page.goto("/");
  const next = page.getByLabel("Next line");
  await next.fill("(x - 2)(x - 3) = 0");
  await next.press("Enter");
  await next.fill("x = 2 or x = 3");
  await next.press("Enter");
  const steps = page.locator(".working .step");
  const notice = page.locator(".notice");
  await expect(notice).toHaveRole("status");
  await expect(steps).toHaveCount(3);

  await page.getByRole("button", { name: "Remove last line" }).click();
  await expect(steps).toHaveCount(2);
  await expect(notice).toHaveText("Line 3 removed.Undo");
  await notice.getByRole("button", { name: "Undo" }).click();
  await expect(steps).toHaveCount(3);
  await expect(notice).toHaveText("Line 3 restored.");
  await expect(next).toBeFocused();

  // Start over disables itself, so focus moves on to the next-line field.
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(steps).toHaveCount(1);
  await expect(next).toBeFocused();
  await expect(notice).toContainText("Started over: every line after the first was removed.");
  await notice.getByRole("button", { name: "Undo" }).click();
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(2)).toContainText("x = 2 or x = 3");
  await expect(notice).toHaveText("Your working was restored.");

  await page.getByRole("button", { name: "Remove last line" }).click();
  await expect(notice.getByRole("button", { name: "Undo" })).toBeVisible();
  await next.fill("x = 3");
  await next.press("Enter");
  await expect(notice.getByRole("button", { name: "Undo" })).toHaveCount(0);
  await expect(notice).toBeEmpty();
});

test("the working survives a visit to another tab", async ({ page }) => {
  await page.goto("/");
  const next = page.getByLabel("Next line");
  await next.fill("(x - 2)(x - 3) = 0");
  await next.press("Enter");
  await next.fill("x = 2");
  await page.getByRole("tab", { name: "Worked examples" }).click();
  await page.getByRole("tab", { name: "Check your working" }).click();
  await expect(page.locator(".working .step")).toHaveCount(2);
  await expect(next).toHaveValue("x = 2");
});

test("undo in the Arabic interface", async ({ page }) => {
  await page.goto("/?lang=ar");
  const next = page.getByLabel("السطر التالي", { exact: true });
  await next.fill("(x - 2)(x - 3) = 0");
  await next.press("Enter");
  await page.getByRole("button", { name: "احذف السطر الأخير" }).click();
  const notice = page.locator(".notice");
  await expect(notice).toContainText("حُذف السطر 2.");
  await expectNoSeriousViolations(page);
  await notice.getByRole("button", { name: "تراجع" }).click();
  await expect(notice).toHaveText("استُعيد السطر 2.");
  await expect(page.locator(".working .step")).toHaveCount(2);
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

test("the chosen language survives a reload", async ({ page }) => {
  await page.goto("/?from=link");
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  // The other parameters stay as they were.
  expect(new URL(page.url()).searchParams.get("from")).toBe("link");
  expect(new URL(page.url()).searchParams.get("lang")).toBe("ar");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("tab", { name: "تحقّق من حلّك" })).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("tab", { name: "Check your working" })).toBeVisible();
});

test("English text in the Arabic interface is marked as English", async ({ page }) => {
  await page.goto("/?lang=ar");
  const next = page.getByLabel("السطر التالي", { exact: true });
  await next.fill("x = 2");
  await next.press("Enter");
  const why = page.locator(".working .step__why");
  await expect(why).toHaveText("This step loses x = 3.");
  await expect(why).toHaveAttribute("lang", "en");
  await expect(why).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".working .step__math").last()).toHaveAttribute("dir", "ltr");
  const live = page.locator('[aria-live="polite"]').last();
  await expect(live).toContainText("loses x = 3");
  await expect(live).toHaveAttribute("lang", "en");
  await page.getByRole("tab", { name: "تدقيق التمارين" }).click();
  const reason = page.getByText("The stated answer loses x = -4.");
  await expect(reason).toHaveAttribute("lang", "en");
  await expect(reason).toHaveAttribute("dir", "ltr");
});

test("the Arabic audit keeps words right to left and maths left to right", async ({ page }) => {
  await page.goto("/?lang=ar");
  await page.getByRole("tab", { name: "تدقيق التمارين" }).click();
  // "Every x in the domain" read in a left-to-right cell put its words in
  // the wrong order.
  const words = page.getByRole("cell", { name: "كل x في المجال" }).first();
  await expect(words).toHaveCSS("direction", "rtl");
  const equation = page.getByRole("cell", { name: "2x + 3 = 11" }).locator("bdi");
  await expect(equation).toHaveAttribute("dir", "ltr");
});

test("Arabic text has a font file for each weight it is drawn in", async ({ page }) => {
  // Without one the browser synthesises bold from the regular face.
  await page.goto("/?lang=ar");
  for (const tab of ["تحقّق من حلّك", "أمثلة محلولة", "تدقيق التمارين"]) {
    await page.getByRole("tab", { name: tab }).click();
    const missing = await page.evaluate(async () => {
      await document.fonts.ready;
      const weights = new Set<string>();
      for (const el of document.querySelectorAll("body *")) {
        const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("");
        if (/[\u0600-\u06FF]/.test(own)) weights.add(getComputedStyle(el).fontWeight);
      }
      const loaded = new Set(
        [...document.fonts].filter((f) => f.family.replace(/"/g, "") === "IBM Plex Sans Arabic" && f.status === "loaded").map((f) => f.weight),
      );
      return [...weights].filter((w) => !loaded.has(w));
    });
    expect(missing, tab).toEqual([]);
  }
});

test("on a phone the field hint is at least 12px", async ({ page }) => {
  // Lighthouse's mobile legible-font audit; Stoa draws field hints at 11px.
  await page.setViewportSize({ width: 412, height: 823 });
  await page.goto("/?lang=ar");
  await expect(page.locator(".working .stoa-field__description")).toHaveCSS("font-size", "12px");
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
  await expectNoSeriousViolations(page);
  await page.unroute("**/*.wasm");
  await page.getByRole("button", { name: "أعد المحاولة" }).click();
  await expect(page.getByRole("tab", { name: "تحقّق من حلّك" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const lang of ["en", "ar"]) {
  test(`no serious or critical axe violations (${lang})`, async ({ page }) => {
    await page.goto(`/?lang=${lang}`);
    await expect(page.locator(".step").first()).toBeVisible();
    await expectNoSeriousViolations(page);
    // The other tabs' panels are hidden until chosen, so axe sees each one
    // only while it is shown.
    for (const tab of (await page.getByRole("tab").all()).slice(1)) {
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expectNoSeriousViolations(page);
    }
  });
}
