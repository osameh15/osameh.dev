import { test, expect, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";

const availabilityFixture = JSON.parse(readFileSync(new URL("../../config/availability.json", import.meta.url), "utf8"));
const activeAvailability = availabilityFixture.profiles[availabilityFixture.activeStatus];

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
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
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

test("site remains English-only and clears legacy locale preference", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("portfolio-locale", "fa"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: /I build software/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Language:/i })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("portfolio-locale"))).toBeNull();
});

test("accessibility control center persists preferences", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Accessibility" }).click();
  const dialog = page.getByRole("dialog", { name: /Accessibility Control Center/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".accessibility-toggle > i svg")).toHaveCount(0);
  await dialog.getByRole("switch", { name: /Reduce motion/i }).click();
  await dialog.getByRole("switch", { name: /Enhanced focus indicators/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await expect(page.locator("html")).toHaveAttribute("data-strong-focus", "true");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await expect(page.locator("html")).toHaveAttribute("data-strong-focus", "true");
});

test("availability mood is centrally exposed from the header", async ({ page }) => {
  await page.goto("/");
  const moodButton = page.getByRole("button", { name: `Availability: ${activeAvailability.label}` });
  await expect(moodButton).toHaveAttribute("data-mood", availabilityFixture.activeStatus);
  await expect(page.locator("html")).toHaveAttribute("data-availability-mood", availabilityFixture.activeStatus);
  await moodButton.click();
  const dialog = page.getByRole("dialog", { name: "Availability" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(activeAvailability.label);
  await expect(dialog).toContainText(`PORTFOLIO MOOD · ${String(availabilityFixture.activeStatus).toUpperCase()}`);
  await expect(dialog).toContainText(availabilityFixture.timezone);
  if (activeAvailability.ctaEnabled) {
    await expect(dialog.getByRole("link", { name: /Start a conversation/i })).toHaveAttribute("href", `mailto:${availabilityFixture.email}`);
  } else {
    await expect(dialog.getByRole("link", { name: /Start a conversation/i })).toHaveCount(0);
    await expect(dialog).toContainText(/New opportunities are paused/i);
  }
});

test("case studies distinguish capabilities from published client work", async ({ page }) => {
  await page.goto("/case-studies");
  await expect(page.locator(".capability-card")).toHaveCount(3);
  await expect(page.locator(".published-case-studies .case-study-card")).toHaveCount(1);
  await expect(page.locator(".published-case-studies")).toContainText("Amorella Beauty");
  await expect(page.locator(".published-case-studies a[href=\"https://amorellabeauty.ir/\"]")).toBeVisible();
});

test("explorer keeps case studies immediately after projects", async ({ page }) => {
  await page.goto("/");
  const explorerLabels = await page.locator(".explorer > .file").allTextContents();
  const projectsIndex = explorerLabels.findIndex(label => /projects/i.test(label));
  const caseStudiesIndex = explorerLabels.findIndex(label => /case-studies/i.test(label));
  expect(projectsIndex).toBeGreaterThanOrEqual(0);
  expect(caseStudiesIndex).toBe(projectsIndex + 1);
});

test("Explorer follows the page sequence through GitHub Activity", async ({ page }) => {
  await page.goto("/");
  const labels = (await page.locator(".explorer > .file").allTextContents()).map(label => label.trim().toLowerCase());
  const projects = labels.findIndex(label => label.includes("projects"));
  const caseStudies = labels.findIndex(label => label.includes("case-studies"));
  const experience = labels.findIndex(label => label.includes("experience"));
  const activity = labels.findIndex(label => label.includes("github-activity"));
  const now = labels.findIndex(label => label === "now" || label.includes("now.md"));
  expect([projects, caseStudies, experience, activity, now].every(index => index >= 0)).toBe(true);
  expect(caseStudies).toBe(projects + 1);
  expect(experience).toBe(caseStudies + 1);
  expect(activity).toBe(experience + 1);
  expect(now).toBe(activity + 1);
  await page.locator("#activity").scrollIntoViewIfNeeded();
  await expect(page.locator("#activity .section-heading")).toContainText("05");
  await expect(page.locator("#activity .section-heading")).toContainText("GITHUB.ACTIVITY");
});

test("published case-study grid has no gray backing layer", async ({ page }) => {
  await page.goto("/case-studies");
  const grid = page.locator(".published-case-studies .client-case-study-grid");
  await expect(grid).toBeVisible();
  const style = await grid.evaluate(element => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, borderTopWidth: computed.borderTopWidth };
  });
  expect(style.background).toBe("rgba(0, 0, 0, 0)");
  expect(style.borderTopWidth).toBe("0px");
});

test("case-study modal preserves the opening position and never re-snaps after close", async ({ page }) => {
  await page.goto("/case-studies");
  // Route scrolling must settle before the user can open a dialog. This guards
  // against delayed route timers racing with modal scroll restoration.
  await expect.poll(async () => {
    const box = await page.locator("#case-studies").boundingBox();
    return Math.abs((box?.y ?? 9999) - 96);
  }).toBeLessThan(10);
  const openButton = page.getByRole("button", { name: /Open case study/i }).first();
  await openButton.scrollIntoViewIfNeeded();
  const workspaceScroll = await page.evaluate(() => window.scrollY);
  await openButton.click();
  const modal = page.getByRole("dialog");
  const body = modal.locator(".feature-modal-body");
  await expect(modal).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
  const target = await body.evaluate(element => {
    const top = Math.min(320, Math.max(0, element.scrollHeight - element.clientHeight - 20));
    element.scrollTo({ top, behavior: "auto" });
    return top;
  });
  expect(target).toBeGreaterThan(0);
  await page.waitForTimeout(700);
  const settled = await body.evaluate(element => element.scrollTop);
  expect(Math.abs(settled - target)).toBeLessThanOrEqual(2);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(workspaceScroll);
  await expect(page).toHaveURL(/\/case-studies\/?$/);

  // Closing a case-study dialog must not schedule a delayed section restore.
  // Use real wheel input so this covers the user-intent cancellation path.
  await page.mouse.wheel(0, 260);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(workspaceScroll);
  const userScroll = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(1_150);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(userScroll);
});

test("accessibility controls create immediately visible effects", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Accessibility" }).click();
  const dialog = page.getByRole("dialog", { name: /Accessibility Control Center/i });
  const preview = dialog.locator(".accessibility-live-preview");
  const previewText = preview.locator("p");
  const previewDot = preview.locator(".accessibility-preview-dot");

  const baseFont = Number.parseFloat(await previewText.evaluate(element => getComputedStyle(element).fontSize));
  await dialog.getByRole("switch", { name: /Larger interface text/i }).click();
  const largerFont = Number.parseFloat(await previewText.evaluate(element => getComputedStyle(element).fontSize));
  expect(largerFont).toBeGreaterThan(baseFont + 1);

  const baseBorder = await preview.evaluate(element => getComputedStyle(element).borderColor);
  await dialog.getByRole("switch", { name: /Increase contrast/i }).click();
  await expect.poll(() => preview.evaluate(element => getComputedStyle(element).borderColor)).not.toBe(baseBorder);

  await dialog.getByRole("switch", { name: /Reduce motion/i }).click();
  await expect(previewDot).toHaveCSS("animation-name", "none");

  await dialog.getByRole("switch", { name: /Enhanced focus indicators/i }).click();
  const sample = preview.getByRole("button", { name: /Keyboard focus sample/i });
  await sample.focus();
  expect(Number.parseFloat(await sample.evaluate(element => getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2);

  await expect(dialog).toContainText(/4 preferences active/i);
  await dialog.getByRole("button", { name: /Reset/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-large-text", "false");
  await expect(page.locator("html")).toHaveAttribute("data-high-contrast", "false");
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "false");
  await expect(page.locator("html")).toHaveAttribute("data-strong-focus", "false");
});

test("command palette ranks and opens case studies", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Command Palette" }).click();
  const search = page.getByRole("dialog", { name: "Command Palette" });
  await expect(search).toBeVisible();
  await search.getByRole("textbox").fill("amorella beauty");
  await expect(search.getByRole("option").first()).toContainText("Amorella Beauty");
  await search.getByRole("textbox").press("Enter");
  await expect(page).toHaveURL(/\/case-studies\/amorella-beauty$/);
});

test("command palette exposes one IDE-safe keyboard shortcut", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true, cancelable: true }));
  });
  await expect(page.getByRole("dialog", { name: "Command Palette" })).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  });
  await expect(page.getByRole("dialog", { name: "Command Palette" })).toBeVisible();
});

test("mobile engineering-note TOC stays below the editor tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes/repository-driven-portfolio");
  const toc = page.locator(".note-toc");
  await expect(toc).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "auto" }));
  await expect.poll(async () => {
    const tabsBox = await page.locator(".tabs-row").boundingBox();
    const tocBox = await toc.boundingBox();
    if (!tabsBox || !tocBox) return false;
    return tocBox.y >= tabsBox.y + tabsBox.height + 10;
  }).toBe(true);
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

test("v5.1 feature surfaces use the redesigned light-theme palette", async ({ page }) => {
  const expectLightSurface = async (locator: Locator) => {
    const background = await locator.evaluate(element => getComputedStyle(element).backgroundColor);
    const channels = background.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    expect(channels).toHaveLength(3);
    // The 4.2 semantic light palette intentionally includes both pure-white
    // and soft neutral surfaces. Assert perceptual lightness/neutrality rather
    // than one brittle RGB literal.
    const normalized = channels.map(channel => channel / 255);
    const luminance = .2126 * normalized[0] + .7152 * normalized[1] + .0722 * normalized[2];
    expect(luminance).toBeGreaterThanOrEqual(.86);
    expect(Math.max(...channels) - Math.min(...channels)).toBeLessThanOrEqual(30);
  };

  await page.addInitScript(() => localStorage.setItem("portfolio-theme", "light"));
  await page.goto("/case-studies");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expectLightSurface(page.locator(".capability-card").first());
  await expectLightSurface(page.locator(".case-study-card").first());
  await page.getByRole("button", { name: /Open case study/i }).first().click();
  await expectLightSurface(page.locator(".case-study-modal"));
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Accessibility" }).click();
  await expectLightSurface(page.getByRole("switch", { name: /Reduce motion/i }));
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: `Availability: ${activeAvailability.label}` }).click();
  await expectLightSurface(page.locator(".availability-details > div").first());
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Command Palette" }).click();
  await expectLightSurface(page.getByRole("dialog", { name: "Command Palette" }));
});


test("header utility controls share one visual height and mood label", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true })));
  const install = page.getByRole("button", { name: "Install app" });
  const palette = page.getByRole("button", { name: "Command Palette" });
  const accessibility = page.getByRole("button", { name: "Accessibility" });
  const mood = page.getByRole("button", { name: `Availability: ${activeAvailability.label}` });
  await expect(install).toBeVisible();
  const heights = await Promise.all([install, palette, accessibility, mood].map(async locator => (await locator.boundingBox())?.height ?? 0));
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
  await expect(mood).toContainText(activeAvailability.shortLabel);
});

test("feature modal cards keep symmetric inline gutters", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Accessibility" }).click();
  const body = page.locator(".feature-modal-body");
  const card = page.getByRole("switch", { name: /Reduce motion/i });
  const bodyBox = await body.boundingBox();
  const cardBox = await card.boundingBox();
  expect(bodyBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  const left = cardBox!.x - bodyBox!.x;
  const right = bodyBox!.x + bodyBox!.width - (cardBox!.x + cardBox!.width);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
});

test("context menu distinguishes engineering notes from case studies", async ({ page }) => {
  await page.goto("/notes");
  const noteCard = page.locator(".note-card").first();
  await noteCard.click({ button: "right" });
  const noteMenu = page.getByRole("menu", { name: "Portfolio context menu" });
  await expect(noteMenu).toContainText("ENGINEERING NOTE");
  await expect(noteMenu.getByRole("menuitem", { name: /Open note/i })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/case-studies");
  const caseCard = page.locator(".case-study-card").first();
  await caseCard.click({ button: "right" });
  const caseMenu = page.getByRole("menu", { name: "Portfolio context menu" });
  await expect(caseMenu).toContainText("CASE STUDY");
  await expect(caseMenu.getByRole("menuitem", { name: /Open case study/i })).toBeVisible();
  await expect(caseMenu.getByRole("menuitem", { name: /Visit live site/i })).toBeVisible();
  await expect(caseMenu.getByRole("menuitem", { name: /Share case study/i })).toBeVisible();
  await expect(caseMenu).not.toContainText(/^LINK$/);
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
