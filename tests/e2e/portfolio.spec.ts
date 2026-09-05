import { test, expect, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";

const availabilityFixture = JSON.parse(readFileSync(new URL("../../config/availability.json", import.meta.url), "utf8"));
const activeAvailability = availabilityFixture.profiles[availabilityFixture.activeStatus];

async function expectSymmetric(dialog: Locator, leftCard: Locator, rightCard = leftCard, tolerance = 2) {
  const dialogBox = await dialog.boundingBox();
  const leftCardBox = await leftCard.boundingBox();
  const rightCardBox = await rightCard.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(leftCardBox).not.toBeNull();
  expect(rightCardBox).not.toBeNull();
  const left = leftCardBox!.x - dialogBox!.x;
  const right = dialogBox!.x + dialogBox!.width - (rightCardBox!.x + rightCardBox!.width);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(tolerance);
  return { left, right, difference: Math.abs(left - right) };
}

async function expectEdgeToEdge(dialog: Locator, surface: Locator, tolerance = 1) {
  const dialogBox = await dialog.boundingBox();
  const surfaceBox = await surface.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(surfaceBox).not.toBeNull();
  expect(Math.abs(surfaceBox!.x - dialogBox!.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs((surfaceBox!.x + surfaceBox!.width) - (dialogBox!.x + dialogBox!.width))).toBeLessThanOrEqual(tolerance);
}

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

test("direct GitHub Activity route renders the first-class section", async ({ page }) => {
  await page.goto("/activity");
  await expect(page).toHaveURL(/\/activity\/?$/);
  await expect(page.getByRole("heading", { name: "Recent repository activity." })).toBeVisible();
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
  const pageViewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(pageViewport).not.toBeNull();
  expect(box!.height).toBeLessThanOrEqual(pageViewport!.height * .77);
  const scrollViewport = modal.locator(".modal-scroll-viewport");
  const overflowY = await scrollViewport.evaluate(element => getComputedStyle(element).overflowY);
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
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Engineering decisions");
  const sections = dialog.locator(".case-study-detail > .modal-content > section");
  await expect(sections).toHaveCount(6);
  await expect(sections.first().locator("h3")).toBeVisible();
  const sectionPadding = await sections.first().evaluate(element => Number.parseFloat(getComputedStyle(element).paddingInlineStart));
  expect(sectionPadding).toBeGreaterThanOrEqual(20);
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

test("shared modal behavior traps focus, closes on Escape, and returns focus", async ({ page }) => {
  await page.goto("/");
  const returnTarget = page.getByRole("button", { name: "Command Palette" });
  await returnTarget.focus();
  await page.evaluate(() => window.dispatchEvent(new Event("portfolio:diagnostics")));
  const diagnostics = page.getByRole("dialog", { name: /Production signals/i });
  await expect(diagnostics).toBeVisible();
  await expect.poll(() => diagnostics.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => diagnostics.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(diagnostics).toBeHidden();
  await expect(returnTarget).toBeFocused();

  await returnTarget.click();
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(returnTarget).toBeFocused();
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
  // Playwright's normal click may auto-scroll a barely-visible target by a
  // few pixels after the baseline is captured. Force only the pointer action
  // so this assertion measures the exact workspace position before opening.
  await openButton.click({ force: true });
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
  await expect(mood).toContainText(activeAvailability.label);
  const installBox = await install.boundingBox();
  const installIconBox = await install.locator("svg").boundingBox();
  expect(installBox).not.toBeNull();
  expect(installIconBox).not.toBeNull();
  const buttonCenterY = installBox!.y + installBox!.height / 2;
  const iconCenterY = installIconBox!.y + installIconBox!.height / 2;
  expect(Math.abs(buttonCenterY - iconCenterY)).toBeLessThanOrEqual(1);
});

test("modal chrome and cards stay geometrically symmetric across themes and viewports", async ({ page }) => {
  const viewports = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 375, height: 480 }];
  for (const theme of ["dark", "light"] as const) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await page.evaluate(selectedTheme => {
        if (selectedTheme === "light") localStorage.setItem("portfolio-theme", "light");
        else localStorage.removeItem("portfolio-theme");
      }, theme);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      await page.getByRole("button", { name: "Accessibility" }).click();
      const accessibilityDialog = page.getByRole("dialog", { name: /Accessibility Control Center/i });
      await expect(accessibilityDialog).toBeVisible();
      await expectSymmetric(accessibilityDialog, accessibilityDialog.getByRole("switch", { name: /Reduce motion/i }));
      await expectEdgeToEdge(accessibilityDialog, accessibilityDialog.locator("header"));
      if (viewport.width <= 390) await expect.poll(() => accessibilityDialog.locator(".modal-scroll-viewport").evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
      await page.keyboard.press("Escape");

      await page.evaluate(() => window.dispatchEvent(new Event("portfolio:diagnostics")));
      const diagnosticsDialog = page.getByRole("dialog", { name: /Production signals/i });
      await expect(diagnosticsDialog).toBeVisible();
      const diagnosticCards = diagnosticsDialog.locator(".health-client-grid > article");
      await expectSymmetric(diagnosticsDialog, diagnosticCards.first(), diagnosticCards.last(), 3);
      await expectEdgeToEdge(diagnosticsDialog, diagnosticsDialog.locator("header"));
      await page.keyboard.press("Escape");

      await page.locator(".section-link-button").first().dispatchEvent("click");
      const recruiterDialog = page.getByRole("dialog", { name: "Recruiter mode" });
      await expect(recruiterDialog).toBeVisible();
      await expectSymmetric(recruiterDialog, recruiterDialog.locator(".recruiter-facts"));
      await expectEdgeToEdge(recruiterDialog, recruiterDialog.locator("header"));
      await expectEdgeToEdge(recruiterDialog, recruiterDialog.locator(".recruiter-progress"));
      await expect.poll(() => recruiterDialog.locator(".modal-scroll-viewport").evaluate(element => element.scrollHeight >= element.clientHeight)).toBe(true);
      await page.keyboard.press("Escape");

      await page.goto("/case-studies");
      const caseStudyButton = page.getByRole("button", { name: /Open case study/i }).first();
      // The fixed mobile status bar can cover the card action; dispatch the
      // real React click without routing the pointer through that overlay.
      await caseStudyButton.dispatchEvent("click");
      const caseStudyDialog = page.locator(".case-study-modal[role=dialog]");
      await expect(caseStudyDialog).toBeVisible();
      await expectSymmetric(caseStudyDialog, caseStudyDialog.locator(".case-study-detail-hero"));
      await expectEdgeToEdge(caseStudyDialog, caseStudyDialog.locator("header"));
      await expect.poll(() => caseStudyDialog.locator(".modal-scroll-viewport").evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
      await page.keyboard.press("Escape");
    }
  }
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

test("project context-menu Gallery action targets the opened project Gallery", async ({ page }) => {
  await page.goto("/projects");
  const projectCard = page.locator(".project-card").first();
  await expect(projectCard).toBeVisible();
  const projectName = await projectCard.getAttribute("data-project-name");
  expect(projectName).toBeTruthy();
  await projectCard.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Open gallery/i }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/projects/${encodeURIComponent(projectName!)}`);
  const gallery = page.locator(".project-gallery");
  await expect(gallery).toHaveAttribute("id", `gallery-${projectName}`);
  await expect.poll(() => gallery.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= 0 && bounds.top < window.innerHeight / 2;
  })).toBe(true);
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

const openPaletteShortcut = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));

test("Escape closes only the topmost dialog on the modal stack", async ({ page }) => {
  await page.goto("/case-studies");
  await page.getByRole("button", { name: /Open case study/i }).first().click();
  const caseStudy = page.locator('[role="dialog"].case-study-modal');
  await expect(caseStudy).toBeVisible();
  await expect(page).toHaveURL(/\/case-studies\/[a-z0-9-]+$/);

  await page.evaluate(openPaletteShortcut);
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  await expect(caseStudy).toBeVisible();

  // Every open dialog listens on window in the capture phase. Without an
  // explicit stack the dialog that opened first consumes Escape and closes
  // behind the palette the user is actually looking at.
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(caseStudy).toBeVisible();
  await expect(page).toHaveURL(/\/case-studies\/[a-z0-9-]+$/);
  // The last remaining dialog still owns the workspace lock.
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");

  await page.keyboard.press("Escape");
  await expect(caseStudy).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await expect(page).toHaveURL(/\/case-studies\/?$/);
});

test("case study opened from the Command Palette restores the deep workspace position", async ({ page }) => {
  await page.goto("/case-studies");
  await expect.poll(async () => {
    const box = await page.locator("#case-studies").boundingBox();
    return Math.abs((box?.y ?? 9999) - 96);
  }).toBeLessThan(10);
  await page.mouse.wheel(0, 600);
  // Let any delayed section restoration settle so the baseline is the real
  // workspace position rather than a value a later timer will overwrite.
  await page.waitForTimeout(1_150);
  const workspaceScroll = await page.evaluate(() => window.scrollY);
  expect(workspaceScroll).toBeGreaterThan(300);

  await page.getByRole("button", { name: "Command Palette" }).click();
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  // The palette freezes the body, so window.scrollY reads 0 from here on.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await palette.getByRole("textbox").fill("amorella beauty");
  await expect(palette.getByRole("option").first()).toContainText("Amorella Beauty");
  await palette.getByRole("textbox").press("Enter");

  const caseStudy = page.locator('[role="dialog"].case-study-modal');
  await expect(caseStudy).toBeVisible();
  await expect(palette).toBeHidden();
  await expect(page).toHaveURL(/\/case-studies\/amorella-beauty$/);

  await page.keyboard.press("Escape");
  await expect(caseStudy).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  // The origin must be the frozen workspace position, never the 0 that
  // window.scrollY reports while a dialog holds the body lock.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(workspaceScroll);
});

test("stacking a dialog never releases and re-takes the shared body lock", async ({ page }) => {
  await page.goto("/case-studies");
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(1_150);
  await page.getByRole("button", { name: /Open case study/i }).first().click();
  await expect(page.locator('[role="dialog"].case-study-modal')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
  const frozenTop = await page.evaluate(() => document.body.style.top);
  expect(frozenTop).not.toBe("");

  // Record the shared lock state at every style mutation from here on. A lock
  // that is released and re-acquired while a dialog stays open scrolls the
  // page and flashes the workspace behind the modal.
  await page.evaluate(() => {
    const store = window as unknown as { __lockLog: string[] };
    store.__lockLog = [];
    new MutationObserver(() => {
      store.__lockLog.push(`${document.documentElement.dataset.modalOpen ?? "-"}|${document.body.style.position || "-"}|${document.body.style.top || "-"}`);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-modal-open"], subtree: true });
  });

  await page.evaluate(openPaletteShortcut);
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  // Typing re-renders the shell, recreating the restore-position object passed
  // to the dialog on every keystroke. That must not touch the lock lifecycle.
  await palette.getByRole("textbox").fill("case study");
  await palette.getByRole("textbox").fill("amorella");
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(page.locator('[role="dialog"].case-study-modal')).toBeVisible();

  expect(await page.evaluate(() => document.body.style.top)).toBe(frozenTop);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const log = await page.evaluate(() => (window as unknown as { __lockLog: string[] }).__lockLog);
  expect(log.filter(entry => entry !== `true|fixed|${frozenTop}`)).toEqual([]);
});

test("a stacked dialog with no restore position cannot take over the underlying restore", async ({ page }) => {
  await page.goto("/case-studies");
  await expect.poll(async () => {
    const box = await page.locator("#case-studies").boundingBox();
    return Math.abs((box?.y ?? 9999) - 96);
  }).toBeLessThan(10);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(1_150);
  const workspaceScroll = await page.evaluate(() => window.scrollY);
  expect(workspaceScroll).toBeGreaterThan(300);

  // The Case Study lock owns a restore position.
  await page.getByRole("button", { name: /Open case study/i }).first().click();
  const caseStudy = page.locator('[role="dialog"].case-study-modal');
  await expect(caseStudy).toBeVisible();

  // The palette stacks on top holding no restore position of its own, and must
  // not become the owner of where the workspace lands.
  await page.evaluate(openPaletteShortcut);
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(caseStudy).toBeVisible();
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");

  await page.keyboard.press("Escape");
  await expect(caseStudy).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(workspaceScroll);
});

test("Command Palette destinations run only after the palette releases its lock", async ({ page }) => {
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  const pick = async (query: string, option: RegExp) => {
    await page.evaluate(openPaletteShortcut);
    await expect(palette).toBeVisible();
    await palette.getByRole("textbox").fill(query);
    await expect(palette.getByRole("option").first()).toContainText(option);
    await palette.getByRole("textbox").press("Enter");
    await expect(palette).toBeHidden();
  };
  const scrollDeep = async (path: string) => {
    await page.goto(path);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(1_150);
    const position = await page.evaluate(() => window.scrollY);
    expect(position).toBeGreaterThan(300);
    return position;
  };

  // Engineering Note. The destination resets the scroll itself, which only
  // lands if the palette's lock released the frozen body first.
  await scrollDeep("/");
  await pick("repository-driven system", /Read note:/);
  await expect(page).toHaveURL(/\/notes\/[a-z0-9-]+$/);
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  // Project.
  await scrollDeep("/");
  await pick("open project", /Open project:/);
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  // Case Study. The lock passes straight to the dialog, so the origin it
  // records must be the real workspace position rather than the frozen 0.
  const workspaceScroll = await scrollDeep("/case-studies");
  await pick("amorella beauty", /Case study:/);
  await expect(page.locator('[role="dialog"].case-study-modal')).toBeVisible();
  await expect(page).toHaveURL(/\/case-studies\/[a-z0-9-]+$/);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(workspaceScroll);
});

const tourViewports = [
  { width: 320, height: 568, margin: 8 },
  { width: 360, height: 800, margin: 8 },
  { width: 390, height: 844, margin: 12 },
  { width: 412, height: 915, margin: 12 },
  { width: 768, height: 1024, margin: 30 },
];

// Featured projects normally come from the GitHub metadata API, which is not
// reachable from a static preview server. Without them the tour only contains
// its intro and outro, so the long project steps - the ones most likely to
// overflow - would never be measured. These fixtures make two realistic, long
// project steps deterministic without any network access.
const LONG_HEADLINE = "A production portfolio platform that treats every public repository as the single source of truth for its own presentation, metadata, architecture diagram and case study narrative.";
const LONG_POINTS = [
  "Repository-owned portfolio.json drives project pages, so documentation never drifts from the code it describes across eleven public repositories.",
  "A same-origin PHP proxy fronts the GitHub REST API with disk caching, strict path validation and secret-aware exclusions for the public source explorer.",
  "Deployment runs a single indexable build through quality gates, TypeScript, PHP lint, Playwright and Lighthouse before environment-specific packaging.",
];
const FEATURED_FIXTURES: Record<string, number> = { "osameh.dev": 1, "Mizekar": 2 };

async function stubFeaturedProjects(page: import("@playwright/test").Page) {
  await page.route("**/api/github/meta/**", async route => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() || "");
    const order = FEATURED_FIXTURES[name];
    if (!order) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ found: false }) });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        found: true,
        repo: name,
        metadata: {
          schemaVersion: "1.0",
          project: { name, type: "Production web platform", featured: true, featuredOrder: order, summary: LONG_HEADLINE, lifecycle: "active" },
          // normalizePortfolioMetadata returns null unless all four of these
          // exist, which would silently fall back to an unfeatured project.
          repository: { owner: "osameh15", name, defaultBranch: "main", license: "MIT" },
          caseStudy: { problem: LONG_HEADLINE, solution: LONG_HEADLINE, highlights: LONG_POINTS, results: LONG_POINTS },
          architecture: { nodes: [], edges: [] },
          ownership: { role: "Lead engineer, end to end", collaboration: "solo", responsibilities: LONG_POINTS },
          recruiter: { headline: LONG_HEADLINE, skillsDemonstrated: ["TypeScript", "React", "PHP", "CI/CD", "Accessibility", "Performance", "Security"], talkingPoints: LONG_POINTS },
        },
      }),
    });
  });
}

for (const viewport of tourViewports) {
  test(`recruiter tour fits the ${viewport.width}px viewport on every step, including long project steps`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await stubFeaturedProjects(page);
    await page.goto("/");
    await page.evaluate(openPaletteShortcut);
    const palette = page.getByRole("dialog", { name: "Command Palette" });
    await expect(palette).toBeVisible();
    await palette.getByRole("textbox").fill("recruiter mode");
    await palette.getByRole("textbox").press("Enter");

    const tour = page.locator('[role="dialog"].recruiter-mode');
    await expect(tour).toBeVisible();
    const steps = Number(((await page.locator(".recruiter-mode > footer > span").textContent()) || "1 / 1").split("/")[1]);
    // intro + two fixture project steps + outro
    expect(steps).toBe(4);

    for (let step = 0; step < steps; step++) {
      const box = await tour.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(viewport.margin - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width - viewport.margin + 1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      for (const control of [page.locator(".recruiter-mode > header button"), page.locator(".recruiter-progress"), page.locator(".recruiter-mode > footer button").last()]) {
        const rect = await control.boundingBox();
        expect(rect).not.toBeNull();
        expect(rect!.y).toBeGreaterThanOrEqual(0);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height + 1);
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width + 1);
      }
      // Inline gaps stay symmetric at every width, not merely non-negative.
      expect(Math.abs(box!.x - (viewport.width - (box!.x + box!.width)))).toBeLessThanOrEqual(2);

      // Long project steps must wrap rather than scroll sideways, and any
      // vertical overflow has to be handled inside the panel body.
      const body = page.locator(".recruiter-mode > main");
      const flow = await body.evaluate(element => ({
        horizontal: element.scrollWidth - element.clientWidth,
        scrollable: element.scrollHeight > element.clientHeight + 1,
        widest: Math.max(0, ...[...element.querySelectorAll("p, h2, span, b")].map(node => node.scrollWidth - element.clientWidth)),
      }));
      expect(flow.horizontal).toBeLessThanOrEqual(1);
      expect(flow.widest).toBeLessThanOrEqual(1);
      if (flow.scrollable) {
        const moved = await body.evaluate(element => { element.scrollTop = 120; return element.scrollTop; });
        expect(moved).toBeGreaterThan(0);
        await body.evaluate(element => { element.scrollTop = 0; });
      }

      if (step < steps - 1) await page.locator(".recruiter-mode > footer button").last().click();
    }

    await page.locator(".recruiter-mode > footer button").first().click();
    await expect(tour).toBeVisible();
    await page.locator(".recruiter-mode > header button").click();
    await expect(tour).toBeHidden();
  });
}

test("unknown routes keep their URL and render the custom IDE 404 workspace", async ({ page }) => {
  // Only the client half of the 404 contract is observable here. The real HTTP
  // 404 status, the noindex meta rewrite and the X-Robots-Tag header are all
  // produced by not-found.php, which a static preview server never executes;
  // those are verified against staging after deployment.
  await page.goto("/this-route-does-not-exist");
  await expect(page).toHaveURL(/\/this-route-does-not-exist$/);
  await expect(page.getByText(/404/).first()).toBeVisible();
  await expect(page.locator("#root")).toBeVisible();
});

test("valid first-class routes still render their own workspace", async ({ page }) => {
  for (const path of ["/activity", "/case-studies", "/notes"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("#root")).toBeVisible();
  }
});
