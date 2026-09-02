import { test, expect } from "@playwright/test";

test("home shell and engineering notes are reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /I build software/i })).toBeVisible();
  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: /Notes from the workbench/i })).toBeVisible();
});

test("note deep link renders content", async ({ page }) => {
  await page.goto("/notes/repository-driven-portfolio");
  await expect(page.getByRole("heading", { name: /Turning a portfolio into a repository-driven system/i })).toBeVisible();
  await expect(page.locator(".note-markdown")).toContainText("Repository-owned metadata");
});

test("project section and source explorer remain available", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.locator("#project-filter-panel")).toBeVisible();
});

test("baseline accessibility contracts", async ({ page }) => {
  await page.goto("/");
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map(el => el.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);
  const missingAlt = await page.locator("img:not([alt])").count();
  expect(missingAlt).toBe(0);
  const unnamedButtons = await page.evaluate(() => [...document.querySelectorAll("button")].filter(button => !(button.textContent || "").trim() && !button.getAttribute("aria-label") && !button.getAttribute("title")).length);
  expect(unnamedButtons).toBe(0);
});

test("engineering note TOC stays selected through repeated jumps and returns exactly to the notes index", async ({ page }) => {
  await page.goto("/notes/repository-driven-portfolio");
  const tocTarget = page.locator(".note-toc button").filter({ hasText: "Repository-owned metadata" }).first();
  await expect(tocTarget).toBeVisible();
  await tocTarget.click();
  await expect(tocTarget).toHaveAttribute("aria-current", "location");

  const tocButtons = page.locator(".note-toc button");
  const tocCount = await tocButtons.count();
  expect(tocCount).toBeGreaterThan(2);
  const repeatedTarget = tocButtons.nth(Math.min(2, tocCount - 1));
  await tocButtons.first().click();
  await expect(tocButtons.first()).toHaveAttribute("aria-current", "location");
  await repeatedTarget.click();
  await expect(repeatedTarget).toHaveAttribute("aria-current", "location");

  const manualHeading = page.locator(".note-markdown h2[id], .note-markdown h3[id]").last();
  const manualHeadingId = await manualHeading.getAttribute("id");
  expect(manualHeadingId).toBeTruthy();
  await manualHeading.evaluate(element => element.scrollIntoView({ block: "start" }));
  const manualTocTarget = page.locator(`.note-toc button[data-toc-id="${manualHeadingId}"]`);
  await expect(manualTocTarget).toHaveAttribute("aria-current", "location");

  await page.getByRole("button", { name: /Engineering Notes/i }).first().click();
  const notesHeading = page.getByRole("heading", { name: /Notes from the workbench/i });
  await expect(notesHeading).toBeVisible();
  await expect.poll(async () => {
    const box = await page.locator("#notes").boundingBox();
    return Math.abs((box?.y ?? 9999) - 96);
  }).toBeLessThan(10);
});

test("browser back from an engineering note restores the notes anchor", async ({ page }) => {
  await page.goto("/notes");
  await page.getByRole("button", { name: /Read note/i }).first().click();
  await expect(page).toHaveURL(/\/notes\/[a-z0-9-]+\/?$/i);
  await page.goBack();
  await expect(page).toHaveURL(/\/notes\/?$/);
  await expect.poll(async () => {
    const box = await page.locator("#notes").boundingBox();
    return Math.abs((box?.y ?? 9999) - 96);
  }).toBeLessThan(10);
});

test("large diagnostics modal stays viewport-capped and scrollable", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("portfolio:diagnostics")));
  const modal = page.locator(".health-center-modal");
  await expect(modal).toBeVisible();
  const box = await modal.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.height).toBeLessThanOrEqual(viewport!.height * .77);
  const overflowY = await modal.evaluate(element => getComputedStyle(element).overflowY);
  expect(["auto", "scroll"]).toContain(overflowY);
});

test("mobile project view exposes bottom quick access navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects/osameh.dev");
  const nav = page.locator(".project-quick-access");
  await expect(nav).toBeVisible();
  const position = await nav.evaluate(element => getComputedStyle(element).position);
  expect(position).toBe("fixed");
  const box = await nav.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
});

test("light theme keeps key interactive surfaces visible", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("portfolio-theme", "light"));
  await page.goto("/notes");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const readNote = page.getByRole("button", { name: /Read note/i }).first();
  await expect(readNote).toBeVisible();
  const contrastSignals = await readNote.evaluate(element => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor, border: style.borderColor };
  });
  expect(contrastSignals.color).not.toBe(contrastSignals.background);
  expect(contrastSignals.border).not.toBe("rgba(0, 0, 0, 0)");
});

test("case studies support privacy-safe deep links", async ({ page }) => {
  await page.goto("/case-studies");
  await expect(page.locator("#case-studies")).toBeVisible();
  await page.getByRole("button", { name: /Open case study/i }).first().click();
  await expect(page).toHaveURL(/\/case-studies\/[a-z0-9-]+$/);
  await expect(page.getByRole("dialog")).toContainText("Engineering decisions");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("browser back from a case study restores the case-studies anchor", async ({ page }) => {
  await page.goto("/case-studies");
  await page.getByRole("button", { name: /Open case study/i }).first().click();
  await expect(page).toHaveURL(/\/case-studies\/[a-z0-9-]+\/?$/i);
  await page.goBack();
  await expect(page).toHaveURL(/\/case-studies\/?$/);
  await expect.poll(async () => {
    const box = await page.locator("#case-studies").boundingBox();
    return Math.abs((box?.y ?? 9999) - 96);
  }).toBeLessThan(12);
});

test("case studies participate in Explorer scroll spy", async ({ page }) => {
  await page.goto("/");
  await page.locator("#case-studies").evaluate(element => element.scrollIntoView({ block: "start", behavior: "auto" }));
  const explorerItem = page.locator(".explorer .file").filter({ hasText: "case-studies" });
  await expect(explorerItem).toHaveAttribute("aria-current", "page");
});

test("feature dialogs keep keyboard focus contained", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Accessibility" }).click();
  const dialog = page.getByRole("dialog", { name: /Accessibility Control Center/i });
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 8; index += 1) await page.keyboard.press("Tab");
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  for (let index = 0; index < 8; index += 1) await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
});

test("language preference switches document direction and persists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Language: English/i }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: /نرم‌افزاری می‌سازم/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("portfolio-locale"))).toBe("fa");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
});

test("accessibility control center persists preferences", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Accessibility" }).click();
  const dialog = page.getByRole("dialog", { name: /Accessibility Control Center/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("switch", { name: /Reduce motion/i }).click();
  await dialog.getByRole("switch", { name: /Enhanced focus indicators/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await expect(page.locator("html")).toHaveAttribute("data-strong-focus", "true");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await expect(page.locator("html")).toHaveAttribute("data-strong-focus", "true");
});

test("availability is centrally exposed from the header", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Availability: Open to selected opportunities/i }).click();
  const dialog = page.getByRole("dialog", { name: "Availability" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Asia/Tehran");
  await expect(dialog.getByRole("link", { name: /Start a conversation/i })).toHaveAttribute("href", "mailto:osirandoust@gmail.com");
});

test("universal search ranks and opens case studies", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+K");
  const search = page.getByRole("dialog", { name: "Universal Search" });
  await expect(search).toBeVisible();
  await search.getByRole("textbox").fill("realtime communications");
  await expect(search.getByRole("option").first()).toContainText("Cross-platform real-time communications");
  await search.getByRole("textbox").press("Enter");
  await expect(page).toHaveURL(/\/case-studies\/realtime-communications$/);
});

test("mobile feature modals stay viewport capped and internally scrollable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Accessibility" }).click();
  const modal = page.locator(".feature-modal");
  const box = await modal.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeLessThanOrEqual(844 * .77);
  const bodyOverflow = await page.locator(".feature-modal-body").evaluate(element => getComputedStyle(element).overflowY);
  expect(["auto", "scroll"]).toContain(bodyOverflow);
});

test("mobile project toolbar selects Gallery at the document end", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects/osameh.dev");
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" }));
  const gallery = page.getByRole("button", { name: "Jump to Gallery" });
  await expect(gallery).toHaveAttribute("aria-current", "location");
  await expect.poll(async () => {
    const navBox = await page.locator(".project-quick-access").boundingBox();
    const galleryBox = await gallery.boundingBox();
    if (!navBox || !galleryBox) return false;
    return galleryBox.x >= navBox.x - 1 && galleryBox.x + galleryBox.width <= navBox.x + navBox.width + 1;
  }).toBe(true);
});

test("light theme meets contrast targets across primary surfaces", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("portfolio-theme", "light"));
  const contrastRatio = async (selector: string) => {
    const target = page.locator(selector).first();
    await expect(target, `Expected contrast target ${selector} on ${page.url()}`).toBeVisible({ timeout: 5_000 });
    return target.evaluate(element => {
      const parse = (value: string) => {
        const values = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
        return values.slice(0, 3).map(channel => {
          const normalized = channel / 255;
          return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        });
      };
      const luminance = (rgb: number[]) => .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
      const style = getComputedStyle(element);
      const foreground = luminance(parse(style.color));
      let current: Element | null = element;
      let background = "rgba(0, 0, 0, 0)";
      while (current) {
        background = getComputedStyle(current).backgroundColor;
        const channels = background.match(/[\d.]+/g)?.map(Number) ?? [];
        const alpha = channels.length > 3 ? channels[3] : 1;
        if (alpha > 0) break;
        current = current.parentElement;
      }
      const backdrop = luminance(parse(background));
      return (Math.max(foreground, backdrop) + .05) / (Math.min(foreground, backdrop) + .05);
    });
  };
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  for (const selector of [".hero .eyebrow", ".showcase-signal-list b", ".showcase-signal-list span", ".showcase-chip-cloud span"]) {
    expect(await contrastRatio(selector), selector).toBeGreaterThanOrEqual(4.5);
  }
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  for (const selector of [".skill-card h3", ".skills-preview article>div button"]) {
    expect(await contrastRatio(selector), selector).toBeGreaterThanOrEqual(4.5);
  }
  await page.goto("/projects/osameh.dev");
  expect(await contrastRatio(".ide-project-view .eyebrow"), "project eyebrow").toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".editor-tab.active"), "active project tab").toBeGreaterThanOrEqual(4.5);
  await page.goto("/notes");
  expect(await contrastRatio(".engineering-notes .section-heading > div > p"), "notes section label").toBeGreaterThanOrEqual(4.5);
  await page.goto("/missing-light-theme-route");
  expect(await contrastRatio(".not-found-view .eyebrow"), "404 eyebrow").toBeGreaterThanOrEqual(4.5);
});

test("light floating compare queue uses readable surfaces", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("portfolio-theme", "light"));
  await page.goto("/projects");
  await page.locator(".compare-chip").first().click();
  const queue = page.locator(".compare-bar");
  await expect(queue).toBeVisible();
  const colors = await queue.evaluate(element => {
    const queueStyle = getComputedStyle(element);
    const actionStyle = getComputedStyle(element.querySelector(".compare-run")!);
    return {
      queueBackground: queueStyle.backgroundColor,
      queueColor: queueStyle.color,
      actionBackground: actionStyle.backgroundColor,
      actionColor: actionStyle.color,
    };
  });
  expect(colors.queueBackground).not.toBe(colors.queueColor);
  expect(colors.actionBackground).not.toBe(colors.actionColor);
});
