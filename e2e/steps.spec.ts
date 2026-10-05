// End-to-end checks: typing working and getting verdicts, the worked
// examples and the audit, the Arabic interface, the theme, and axe in
// each language and theme.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// `scan`, when given, names what was scanned; it is recorded as an
// annotation that scripts/badges.mjs reads to state the axe matrix.
async function expectNoSeriousViolations(page: Page, scan?: Record<string, string>) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  if (scan) test.info().annotations.push({ type: "axe-scan", description: JSON.stringify(scan) });
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

test("a line slow to check is stopped at the time limit, and the page answers meanwhile", async ({ page }) => {
  await page.goto("/");
  const next = page.getByLabel("Next line");
  // Within the engine's limits, but seconds of work: a degree-32
  // polynomial with nine-digit coefficients.
  await next.fill("(123456789x^2 + 987654321x - 1)^16 + x = 0");
  const started = Date.now();
  await next.press("Enter");
  const steps = page.locator(".working .step");
  await expect(steps.nth(1)).toContainText("Checking…");
  // The check runs in a worker, so the page goes on answering.
  const examples = page.getByRole("tab", { name: "Worked examples" });
  await examples.click({ timeout: 1000 });
  await expect(examples).toHaveAttribute("aria-selected", "true", { timeout: 1000 });
  await page.getByRole("tab", { name: "Check your working" }).click({ timeout: 1000 });
  await expect(steps.nth(1)).toContainText("took longer than 2 seconds", { timeout: 6000 });
  await expect(steps.nth(1)).toContainText("Too complex to check");
  // Two seconds and the time to report it, with room for a loaded machine.
  expect(Date.now() - started).toBeLessThan(4500);
  // The next line is checked as usual, in a new worker.
  await next.fill("x^2 = 4");
  await next.press("Enter");
  await next.fill("x = 2");
  await next.press("Enter");
  await expect(steps.nth(3)).toContainText("This step loses x = -2.");
});

test("hostile lines are answered within the time limit, each with the limit it is over", async ({ page }) => {
  await page.goto("/");
  const next = page.getByLabel("Next line");
  const steps = page.locator(".working .step");
  const cases: [string, string, string][] = [
    // 2,000 nested brackets used to break the engine until the page was reloaded.
    [`${"(".repeat(2000)}x${")".repeat(2000)} = 1`, "Cannot read this line", "Line 2: longer than 500 characters, the most the engine reads in a line."],
    [`${"(".repeat(200)}x${")".repeat(200)} = 1`, "Cannot read this line", "Line 2: brackets and signs nested more than 64 deep, the most the engine reads."],
    [`${"-".repeat(400)}x = 1`, "Cannot read this line", "nested more than 64 deep"],
    ["x^99999999999999999999 = 1", "Cannot read this line", "Line 2: the exponent at position 3 is too large."],
    ["((x+1)^64)^64 = 0", "Too complex to check", "Line 2: too complex to check: it needs a degree above 64"],
    [`x = ${"1 + ".repeat(2500)}1`, "Cannot read this line", "longer than 500 characters"],
    [Array.from({ length: 60 }, (_, k) => `x=${k}`).join(" or "), "Cannot read this line", "Line 2: more than 12 alternatives"],
    // Short lines with huge coefficients: 42 seconds of work before.
    ["735134400x^2 + x + 735134400 = 0", "Changes the solutions", "This step loses x = 2, x = 3."],
    ["963761198400x^2 + x + 963761198400 = 0", "Changes the solutions", "This step loses x = 2, x = 3."],
  ];
  for (const [line, badge, why] of cases) {
    await next.fill(line);
    const started = Date.now();
    await next.press("Enter");
    const row = steps.nth(1);
    await expect(row.locator(".step__badge")).not.toHaveText("Checking…");
    // The engine answered itself, well before the time limit would stop it.
    expect(Date.now() - started, line.slice(0, 40)).toBeLessThan(2000);
    await expect(row.locator(".step__badge")).toHaveText(new RegExp(badge));
    await expect(row.locator(".step__why")).toContainText(why);
    await page.getByRole("button", { name: "Remove last line" }).click();
    await expect(steps).toHaveCount(1);
  }
  // The engine still checks lines as before.
  await next.fill("(x - 2)(x - 3) = 0");
  await next.press("Enter");
  await expect(steps.nth(1)).toContainText("Correct");
});

test("a message about a line names it by its number on screen", async ({ page }) => {
  await page.goto("/");
  const next = page.getByLabel("Next line");
  for (const line of ["(x - 2)(x - 3) = 0", "x = 2 or x = 3", "x = 2 or x = 3", "x = = 3", "x = 3"]) {
    await next.fill(line);
    await next.press("Enter");
  }
  const steps = page.locator(".working .step");
  await expect(steps).toHaveCount(6);
  await expect(steps.nth(4).locator(".step__n")).toHaveText("5");
  await expect(steps.nth(4)).toContainText("Line 5: more than one '='.");
  await expect(steps.nth(5)).toContainText("Line 5: more than one '='.");
  // Line 5 could not be read; line 6 was, and its step is not checked.
  await expect(steps.nth(4)).toContainText("Cannot read this line");
  await expect(steps.nth(5)).toContainText("Not checked");
  await expect(steps.nth(5)).not.toContainText("Cannot read");
  await expect(page.locator('[aria-live="polite"]').last()).toHaveText("x = 3: Line 5: more than one '='.");
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
  await expect(panel("A root that is not there")).toContainText("First mistake: line 2");
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

test("an Arabic page is right to left before the app draws anything", async ({ page }) => {
  // Records, in order, the root element's direction changes and the app's
  // first content.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes" && r.target === document.documentElement && r.attributeName === "dir") seen.push(`dir=${document.documentElement.dir}`);
        if (r.type === "childList" && (r.target as Element).id === "root" && r.addedNodes.length > 0) seen.push("content");
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["dir"] });
  });
  await page.goto("/?lang=ar");
  await expect(page.getByRole("tab").first()).toBeVisible();
  const seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen);
  expect(seen.slice(0, 2)).toEqual(["dir=rtl", "content"]);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
});

test("the Arabic face is preloaded on an Arabic page only", async ({ page }) => {
  const preloads = () => page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map((l) => l.href));
  await page.goto("/?lang=ar");
  await expect(page.getByRole("tab").first()).toBeVisible();
  const ar = await preloads();
  expect(ar).toHaveLength(1);
  expect(ar[0]).toMatch(/ibm-plex-sans-arabic-arabic-400-normal.*\.woff2/);
  // The face the page draws Arabic in, so the preload is used, not fetched twice.
  const used = await page.evaluate(async () => {
    await document.fonts.ready;
    return performance
      .getEntriesByType("resource")
      .filter((e) => /ibm-plex-sans-arabic-arabic-400-normal[^/?]*\.woff2$/.test(e.name))
      .map((e) => e.name);
  });
  expect(used).toEqual(ar);
  await page.goto("/?lang=en");
  await expect(page.getByRole("tab").first()).toBeVisible();
  expect(await preloads()).toEqual([]);
});

test("the chosen language survives a reload", async ({ page }) => {
  await page.goto("/?from=link");
  await expect(page.getByRole("radiogroup", { name: "Language" })).toBeVisible();
  await page.getByRole("radio", { name: "AR", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page).toHaveTitle("ثيميس");
  // The other parameters stay as they were.
  expect(new URL(page.url()).searchParams.get("from")).toBe("link");
  expect(new URL(page.url()).searchParams.get("lang")).toBe("ar");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("tab", { name: "تحقّق من حلّك" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "AR", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "EN", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("Themis Steps");
  await expect(page.getByRole("tab", { name: "Check your working" })).toBeVisible();
});

test("the Arabic interface explains each verdict in Arabic, with maths left to right", async ({ page }) => {
  await page.goto("/?lang=ar");
  const next = page.getByLabel("السطر التالي", { exact: true });
  await next.fill("x = 2");
  await next.press("Enter");
  const why = page.locator(".working .step__why");
  await expect(why).toHaveText("تفقد هذه الخطوة الحل x = 3.");
  // The sentence takes the page's direction and language; its maths is isolated.
  await expect(why).not.toHaveAttribute("lang");
  await expect(why).toHaveCSS("direction", "rtl");
  await expect(why.locator("bdi")).toHaveText("x = 3");
  await expect(why.locator("bdi")).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".working .step__math").last()).toHaveAttribute("dir", "ltr");
  const live = page.locator('[aria-live="polite"]').last();
  await expect(live).toHaveText("x = 2: تفقد هذه الخطوة الحل x = 3.");
  await expect(live).not.toHaveAttribute("lang");
  await next.fill("x = 2 $");
  await next.press("Enter");
  await expect(why.last()).toHaveText("السطر 3: لم يُتوقَّع «$» في الموضع 7.");
  await page.getByRole("tab", { name: "تدقيق التمارين" }).click();
  await expect(page.getByText("تفقد الإجابة المعلنة الحل x = -4.")).toBeVisible();
  await expect(page.getByText("تضيف الإجابة المعلنة الحل x = 2، وهو ليس حلًّا للمعادلة.")).toBeVisible();
  await expect(page.getByText("9 من 12 إجابة معلنة صحيحة")).toBeVisible();
});

test("answers typed with أو or the Arabic comma are read", async ({ page }) => {
  await page.goto("/?lang=ar");
  const next = page.getByLabel("السطر التالي", { exact: true });
  await expect(page.locator(".working .stoa-field__description")).toHaveText(
    "اضغط مفتاح الإدخال للتحقق. اكتب الإجابات هكذا: \u2066x\u00a0=\u00a02\u00a0أو\u00a0x\u00a0=\u00a03\u2069، أو \u2066x\u00a0=\u00a0±3\u2069.",
  );
  await next.fill("(x - 2)(x - 3) = 0");
  await next.press("Enter");
  await next.fill("x = 2 أو x = 3");
  await next.press("Enter");
  await next.fill("x = 3، x = 2");
  await next.press("Enter");
  const steps = page.locator(".working .step");
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(2)).toContainText("صحيح");
  await expect(steps.nth(3)).toContainText("صحيح");
  // An English answer line is shown with the Arabic word in the Arabic interface.
  await page.getByRole("tab", { name: "أمثلة محلولة" }).click();
  await expect(page.locator(".examples .step__math").nth(2)).toHaveText("x = 2 أو x = 3");
});

/** Latin letters the Arabic interface shows outside maths. Maths is text
 * inside a <bdi> (it may hold a single letter such as x, but no word of
 * two letters or more) or, in a plain string such as the field hint,
 * between the Unicode isolates LRI and PDI. Excluded: the language
 * switch's EN and AR, which are language codes. Read: every text node of
 * the page, shown or visually hidden (live regions included), and the
 * aria-label, title, placeholder and alt attributes, and the page title. */
async function latinOutsideMaths(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const languages = document.querySelector('[role="radiogroup"][aria-label="اللغة"]');
    const isolated = /\u2066[^\u2069]*\u2069/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement!;
      if (el.closest("script, style") || languages?.contains(el)) continue;
      const text = (n.textContent ?? "").replace(isolated, "");
      const words = el.closest("bdi") ? text.match(/[A-Za-z]{2,}/g) : text.match(/[A-Za-z]+/g);
      for (const w of words ?? []) out.push(`${w} in "${n.textContent!.trim()}"`);
    }
    for (const el of document.querySelectorAll("[aria-label], [title], [placeholder], [alt]")) {
      if (languages?.contains(el)) continue;
      for (const name of ["aria-label", "title", "placeholder", "alt"]) {
        const v = el.getAttribute(name)?.replace(isolated, "");
        for (const w of v?.match(/[A-Za-z]+/g) ?? []) out.push(`${w} in ${name}="${v}"`);
      }
    }
    for (const w of document.title.match(/[A-Za-z]+/g) ?? []) out.push(`${w} in the title`);
    // Nothing is marked as English, apart from the language codes.
    for (const el of document.querySelectorAll("body [lang]"))
      if (el.getAttribute("lang") !== "ar" && !languages?.contains(el)) out.push(`lang="${el.getAttribute("lang")}" on ${el.outerHTML.slice(0, 60)}`);
    return out;
  });
}

test("the Arabic interface has no Latin letters outside maths", async ({ page }) => {
  await page.goto("/?lang=ar");
  const next = page.getByLabel("السطر التالي", { exact: true });
  // A correct step, a wrong one, one that cannot be read, and a removal
  // with its undo notice.
  for (const line of ["(x - 2)(x - 3) = 0", "x = 2", "x = 2 $", "x = 1 or x + 1", "x = 3"]) {
    await next.fill(line);
    await next.press("Enter");
  }
  await page.getByRole("button", { name: "احذف السطر الأخير" }).click();
  await expect(page.locator(".notice")).toContainText("حُذف السطر 6.");
  expect(await latinOutsideMaths(page)).toEqual([]);
  for (const tab of ["أمثلة محلولة", "تدقيق التمارين"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    expect(await latinOutsideMaths(page), tab).toEqual([]);
  }
  // The check finds a Latin word in text, and a word inside maths.
  await page.evaluate(() => {
    const p = document.createElement("p");
    p.innerHTML = "اضغط Enter <bdi>x = 2 or x = 3</bdi>";
    document.body.append(p);
  });
  expect(await latinOutsideMaths(page)).toEqual(['Enter in "اضغط Enter"', 'or in "x = 2 or x = 3"']);
});

test("the theme follows the system until one is chosen", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
  // System is the default and the switch says so, whatever the scheme.
  await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
  await expect(html).not.toHaveAttribute("data-theme");
  const background = () => html.evaluate((el) => getComputedStyle(el).backgroundColor);
  const dark = await background();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
  await expect(html).not.toHaveAttribute("data-theme");
  await expect.poll(background).not.toBe(dark);
});

test("System clears a chosen theme", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "System" }).click();
  await expect(html).not.toHaveAttribute("data-theme");
  expect(new URL(page.url()).searchParams.get("theme")).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("themis-steps.theme"))).toBeNull();
  await page.reload();
  await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
  // A link can ask for the system over a remembered theme.
  await page.getByRole("radio", { name: "Light" }).click();
  await page.goto("/?theme=system");
  await expect(html).not.toHaveAttribute("data-theme");
});

test("the chosen theme survives a reload and the next visit", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/?from=link");
  const html = page.locator("html");
  const background = () => html.evaluate((el) => getComputedStyle(el).backgroundColor);
  const light = await background();
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(await background()).not.toBe(light);
  const url = new URL(page.url());
  expect(url.searchParams.get("theme")).toBe("dark");
  expect(url.searchParams.get("from")).toBe("link");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  // Without the parameter, the choice comes from the last visit.
  await page.goto("/?lang=ar");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("radiogroup", { name: "المظهر" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "داكن" })).toBeChecked();
  // A link's theme wins over the remembered one.
  await page.goto("/?theme=light");
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
});

test("the theme can be chosen with storage blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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

for (const lang of ["en", "ar"]) {
  test(`on a phone the tabs share one row and the audit keeps each piece of maths on one line (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/?lang=${lang}`);
    await expect(page.getByRole("tab")).toHaveCount(3);
    const tabs = await page.getByRole("tab").all();
    const tops = await Promise.all(tabs.map(async (tab) => (await tab.boundingBox())!.y));
    expect(new Set(tops).size, "tab rows").toBe(1);
    await tabs[2]!.click();
    await expect(page.locator(".audit table")).toBeVisible();
    // Each piece of maths and each badge in the table is drawn on one line.
    const broken = await page.locator(".audit table").evaluate((table) =>
      [...table.querySelectorAll("bdi, .stoa-badge")]
        .filter((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
          return lines.size > 1;
        })
        .map((el) => el.textContent),
    );
    expect(broken).toEqual([]);
    // The table scrolls in its own region; the page does not scroll sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectNoSeriousViolations(page);
  });
}

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
  for (const theme of ["light", "dark"]) {
    test(`no serious or critical axe violations (${lang}, ${theme})`, async ({ page }) => {
      await page.goto(`/?lang=${lang}&theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      // A wrong step, so an explanation and a negative badge are checked too.
      const next = page.locator(".working input").last();
      await next.fill("x = 2");
      await next.press("Enter");
      await expect(page.locator(".working .step__why")).toBeVisible();
      const tabs = await page.getByRole("tab").all();
      await expectNoSeriousViolations(page, { lang, theme, tab: "1" });
      // The other tabs' panels are hidden until chosen, so axe sees each one
      // only while it is shown.
      for (const [i, tab] of tabs.entries()) {
        if (i === 0) continue;
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expectNoSeriousViolations(page, { lang, theme, tab: String(i + 1) });
      }
    });
  }
}

test("the header stays at the top and the page scrolls under it, with Stoa's scrollbars", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Worked examples" }).click();
  const banner = page.getByRole("banner");
  const before = (await banner.boundingBox())!;
  const scroll = page.locator(".stoa-page-shell__scroll");
  await scroll.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await banner.boundingBox()).toEqual(before);
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight > window.innerHeight)).toBe(false);
  const region = (await scroll.boundingBox())!;
  expect(region.y).toBeGreaterThanOrEqual(before.y + before.height - 1);
  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("radio", { name: theme }).click();
    const style = await scroll.evaluate((el) => {
      const probe = (name: string) => {
        const span = document.createElement("span");
        span.style.color = `var(${name})`;
        el.appendChild(span);
        const value = getComputedStyle(span).color;
        span.remove();
        return value;
      };
      const own = getComputedStyle(el);
      return { width: own.scrollbarWidth, color: own.scrollbarColor, expected: `${probe("--stoa-color-scrollbar-thumb")} ${probe("--stoa-color-scrollbar-track")}` };
    });
    expect(style.width, theme).toBe("thin");
    expect(style.color, theme).toBe(style.expected);
  }
});
