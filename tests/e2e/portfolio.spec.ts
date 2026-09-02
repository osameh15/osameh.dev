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

test("engineering note TOC follows selection and returns to the notes index", async ({ page }) => {
  await page.goto("/notes/repository-driven-portfolio");
  const tocTarget = page.locator(".note-toc button").filter({ hasText: "Repository-owned metadata" }).first();
  await expect(tocTarget).toBeVisible();
  await tocTarget.click();
  await expect(tocTarget).toHaveAttribute("aria-current", "location");
  await page.getByRole("button", { name: /Engineering Notes/i }).first().click();
  const notesHeading = page.getByRole("heading", { name: /Notes from the workbench/i });
  await expect(notesHeading).toBeVisible();
  await expect.poll(async () => {
    const box = await notesHeading.boundingBox();
    return box?.y ?? 9999;
  }, { timeout: 750 }).toBeLessThan(260);
});

test("browser back restores the engineering notes section exactly", async ({ page }) => {
  await page.goto("/notes");
  await page.getByRole("button", { name: /Read note/i }).first().click();
  await expect(page.locator(".note-detail")).toBeVisible();
  await page.goBack();
  const notes = page.locator("#notes");
  await expect(notes).toBeVisible();
  await expect.poll(async () => Math.abs((await notes.boundingBox())?.y ?? 9999), { timeout: 750 }).toBeLessThan(105);
});

test("engineering note TOC remains stable across repeated selection", async ({ page }) => {
  await page.goto("/notes/repository-driven-portfolio");
  const buttons = page.locator(".note-toc button");
  await expect(buttons.first()).toBeVisible();
  const count = await buttons.count();
  expect(count).toBeGreaterThan(1);
  const last = buttons.nth(count - 1);
  await last.click();
  await expect(last).toHaveAttribute("aria-current", "location");
  await buttons.first().click();
  await expect(buttons.first()).toHaveAttribute("aria-current", "location");
  await last.click();
  await expect(last).toHaveAttribute("aria-current", "location");
});

test("mobile install icon is vertically centered in the header", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: "dismissed" }) });
    window.dispatchEvent(event);
  });
  const header = page.locator(".topbar");
  const install = page.locator(".pwa-install");
  await expect(install).toBeVisible();
  const headerBox = await header.boundingBox();
  const installBox = await install.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(installBox).not.toBeNull();
  const headerCenter = headerBox!.y + headerBox!.height / 2;
  const installCenter = installBox!.y + installBox!.height / 2;
  expect(Math.abs(headerCenter - installCenter)).toBeLessThanOrEqual(1);
  const iconBox = await install.locator(".pwa-install-icon svg").boundingBox();
  expect(iconBox).not.toBeNull();
  const iconCenter = iconBox!.y + iconBox!.height / 2;
  expect(Math.abs(installCenter - iconCenter)).toBeLessThanOrEqual(1);
});

test("mobile notes toolbar stays below the editor tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes/repository-driven-portfolio");
  const tabsBox = await page.locator(".tabs-row").boundingBox();
  const tocBox = await page.locator(".note-toc").boundingBox();
  expect(tabsBox).not.toBeNull();
  expect(tocBox).not.toBeNull();
  expect(tocBox!.y).toBeGreaterThanOrEqual(tabsBox!.y + tabsBox!.height - 1);
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

test("light theme meets contrast targets across primary surfaces", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("portfolio-theme", "light"));

  const contrastRatio = async (selector: string) => page.locator(selector).first().evaluate(element => {
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
  expect(await contrastRatio(".engineering-notes .eyebrow"), "notes eyebrow").toBeGreaterThanOrEqual(4.5);

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
