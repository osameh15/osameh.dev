import { test, expect, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolveReleaseCodename } from "../../frontend/src/lib/releaseMetadataCore.js";
import { adjacentNotes, engineeringNotes } from "../../frontend/src/features/notes/notesData";
import { RECAPTCHA_ACTION, recaptchaSiteKey } from "../../frontend/src/config/recaptchaConfig";
import { canonicalKeys, technologyLabel } from "../../frontend/src/lib/technology";
import { codeProfiles, skillCatalog } from "../../frontend/src/app/workspacePreferences";
import { BUILD_COMMIT, BUILD_COMMIT_SHORT } from "../../frontend/src/generated/build";
import { relatedToCaseStudy, relatedToNote, relatedToProject, type RelatedSource } from "../../frontend/src/lib/relatedContent";
import { caseStudies as clientCaseStudies } from "../../frontend/src/data/caseStudiesData";
import { ERROR_STATUSES } from "../../scripts/error-pages.mjs";

const availabilityFixture = JSON.parse(readFileSync(new URL("../../config/availability.json", import.meta.url), "utf8"));
const releasesFixture = JSON.parse(readFileSync(new URL("../../config/releases.json", import.meta.url), "utf8"));
const RELEASE_VERSION: string = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;
// The codename is resolved the same way the application resolves it, so a new
// release family never invalidates these assertions.
const RELEASE_CODENAME: string = resolveReleaseCodename(releasesFixture, RELEASE_VERSION);
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

test("Explore my work navigates from section routes to Projects", async ({ page }) => {
  await page.goto("/about");
  const explore = page.getByRole("link", { name: /Explore my work/i });
  await expect(explore).toHaveAttribute("href", "/projects");
  await explore.click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect.poll(async () => Math.abs(((await page.locator("#work").boundingBox())?.y ?? 9999) - 94)).toBeLessThan(12);
});

test("project cards render without GitHub and expose native detail links", async ({ page }) => {
  await page.route("**/api/github/**", route => route.abort());
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  const card = page.locator(".project-card").first();
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute("role", "button");
  const link = card.getByRole("link", { name: /Open project details/i });
  await expect(link).toHaveAttribute("href", /^\/projects\/.+/);
  const href = await link.getAttribute("href");
  const projectName = await card.getAttribute("data-project-name");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(page.locator(".editor-tab.active")).toContainText(projectName ?? "");
});

test("notes and case studies expose native links with SPA navigation", async ({ page }) => {
  await page.goto("/notes");
  const noteLink = page.locator(".note-card").first().getByRole("link", { name: /Read note/i });
  await expect(noteLink).toHaveAttribute("href", /^\/notes\/[a-z0-9-]+$/);
  await noteLink.click();
  await expect(page).toHaveURL(/\/notes\/[a-z0-9-]+$/);
  await expect(page.locator(".editor-tab.active")).toHaveText(`${engineeringNotes[0].slug}.md`);

  await page.goto("/case-studies");
  const caseLink = page.getByRole("link", { name: /Open case study/i }).first();
  await expect(caseLink).toHaveAttribute("href", "/case-studies/amorella-beauty");
  await caseLink.click();
  await expect(page).toHaveURL(/\/case-studies\/amorella-beauty$/);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("sitemap and identity schema match canonical document intent", async ({ page, request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  expect(urls).toHaveLength(20);
  for (const section of ["about", "projects", "case-studies", "experience", "activity", "now", "changelog", "notes", "contact", "resume"]) {
    expect(urls).not.toContain(`https://osameh.dev/${section}`);
  }
  expect(urls).toContain("https://osameh.dev/case-studies/amorella-beauty");
  expect(urls.some(url => url.includes("/projects/"))).toBe(true);
  expect(urls.some(url => url.includes("/notes/"))).toBe(true);

  await page.goto("/");
  const graph = await page.locator('script[type="application/ld+json"]').first().evaluate(node => JSON.parse(node.textContent || "{}") as { "@graph": Array<Record<string, unknown>> });
  const website = graph["@graph"].find(item => item["@type"] === "WebSite");
  const person = graph["@graph"].find(item => item["@type"] === "Person");
  expect(website).toMatchObject({ "@id": "https://osameh.dev/#website", name: "Osameh Irandoust", alternateName: "osameh.dev", publisher: { "@id": "https://osameh.dev/#person" } });
  expect(person).toMatchObject({ "@id": "https://osameh.dev/#person", name: "Osameh Irandoust", jobTitle: "Software Engineer" });
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".showcase-card h2")).toBeVisible();
});

test("direct GitHub Activity route renders the first-class section", async ({ page }) => {
  await page.goto("/activity");
  await expect(page).toHaveURL(/\/activity\/?$/);
  await expect(page.getByRole("heading", { name: "Recent engineering activity." })).toBeVisible();
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
  await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
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
  await page.getByRole("link", { name: /Read note/i }).first().click();
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
  const readNote = page.getByRole("link", { name: /Read note/i }).first();
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
  await page.getByRole("link", { name: /Open case study/i }).first().click();
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
  await page.getByRole("link", { name: /Open case study/i }).first().click();
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
  await expect(page.locator(".published-case-studies .case-study-card")).toHaveCount(clientCaseStudies.length);
  await expect(page.locator(".published-case-studies")).toContainText("Amorella Beauty");
  await expect(page.locator(".published-case-studies a[href=\"https://amorellabeauty.ir/\"]")).toBeVisible();
  await expect(page.locator(".published-case-studies")).toContainText("Hirava");
  // The temporary Hirava preview is labelled as a preview, not as a live site.
  const hiravaLive = page.locator('.case-study-card[data-case-study-id="hirava"] a.case-study-live');
  await expect(hiravaLive).toHaveAttribute("href", "https://hirava.osameh.dev");
  await expect(hiravaLive).toHaveText(/Open live preview/);
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
  // The section carries releases and notes as well as repository activity, so
  // its eyebrow names engineering activity; the route and Explorer entry are
  // unchanged.
  await expect(page.locator("#activity .section-heading")).toContainText("ENGINEERING.ACTIVITY");
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
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const openButton = page.getByRole("link", { name: /Open case study/i }).first();
  await openButton.scrollIntoViewIfNeeded();
  const workspaceScroll = await page.evaluate(() => window.scrollY);
  // DOM activation preserves the native anchor's click handler without
  // letting Playwright auto-scroll the target after the baseline is captured.
  await openButton.evaluate(element => (element as HTMLAnchorElement).click());
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
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBe(target);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(workspaceScroll);
  await expect(page).toHaveURL(/\/case-studies\/?$/);

  // Closing a case-study dialog must not schedule a delayed section restore.
  // Use real wheel input so this covers the user-intent cancellation path.
  await page.mouse.move(500, 500);
  await page.mouse.wheel(0, 260);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(workspaceScroll);
  const userScroll = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(1_150);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(userScroll);
});

// ---- v5.6.2 Raven: measured section stabilization ----
//
// A section address places its section once, then a bounded transaction
// compensates only for measured layout movement above it. These tests pin
// outcomes, and wait on the transaction's own lifecycle signal rather than on
// fixed sleeps.

const sectionSettling = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.hasAttribute("data-section-settling"));
const waitForSectionSettled = (page: import("@playwright/test").Page) =>
  expect.poll(() => sectionSettling(page), { timeout: 8_000 }).toBe(false);
const nextFrames = (page: import("@playwright/test").Page) =>
  page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
/**
 * Once stabilization has ended, the browser's own scroll anchoring legitimately
 * keeps the viewport steady when content above it grows. Tests that must prove
 * the stabilizer itself stopped compensating switch that native behaviour off
 * for the page under test, so any movement left can only come from the app.
 */
const disableNativeScrollAnchoring = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    document.documentElement.style.overflowAnchor = "none";
    document.body.style.overflowAnchor = "none";
  });
/** Grows #about - which sits above every stabilized section - by `height` pixels. */
const growContentAbove = (page: import("@playwright/test").Page, height: number) =>
  page.evaluate(px => {
    const spacer = document.createElement("div");
    spacer.style.height = `${px}px`;
    document.getElementById("about")!.appendChild(spacer);
    return document.documentElement.hasAttribute("data-section-settling");
  }, height);
/**
 * The section is on target and the initial navigation has finished: placement
 * is confirmed over its first frames, and only then does "compensating" begin.
 * Scrolling during "placing" would be racing the original navigation itself.
 */
const placedAt = async (page: import("@playwright/test").Page, id: string, offset = 96) => {
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.sectionSettling ?? "ended")).not.toBe("placing");
  await expect.poll(async () => Math.abs(((await sectionTop(page, id)) ?? 9999) - offset)).toBeLessThanOrEqual(2);
};

test("stabilization compensates layout growth above the section by the measured delta", async ({ page }) => {
  await page.goto("/notes", { waitUntil: "domcontentloaded" });
  await placedAt(page, "notes");
  expect(await growContentAbove(page, 300), "the growth lands inside the stabilization transaction").toBe(true);
  await waitForSectionSettled(page);
  expect(Math.abs((await sectionTop(page, "notes"))! - 96), "the section is kept under the chrome").toBeLessThanOrEqual(2);
});

test("a scroll away during stabilization is preserved, not re-snapped, while layout keeps moving", async ({ page }) => {
  await page.goto("/case-studies", { waitUntil: "domcontentloaded" });
  await placedAt(page, "case-studies");
  // Find-in-page and screen readers move the page instantly and without wheel
  // or key events. The page keeps that position, compensated for the growth.
  const moved = await page.evaluate(() => {
    const active = document.documentElement.hasAttribute("data-section-settling");
    const before = window.scrollY;
    window.scrollBy({ top: 400, behavior: "instant" as ScrollBehavior });
    return { active, distance: window.scrollY - before };
  });
  expect(moved.active).toBe(true);
  expect(moved.distance).toBeGreaterThan(300);
  expect(await growContentAbove(page, 250)).toBe(true);
  await waitForSectionSettled(page);
  expect(Math.abs((await sectionTop(page, "case-studies"))! - (96 - moved.distance)), "the viewport stays where it was moved, relative to the section").toBeLessThanOrEqual(3);
});

test("an external scroll with no layout change is never pulled back when stabilization ends", async ({ page }) => {
  await page.goto("/notes", { waitUntil: "domcontentloaded" });
  await placedAt(page, "notes");
  const moved = await page.evaluate(() => {
    window.scrollBy({ top: -350, behavior: "instant" as ScrollBehavior });
    return window.scrollY;
  });
  await waitForSectionSettled(page);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - moved)).toBeLessThanOrEqual(1);
});

test("wheel input ends stabilization immediately and stops compensation", async ({ page }) => {
  await page.goto("/notes", { waitUntil: "domcontentloaded" });
  await placedAt(page, "notes");
  const ended = await page.evaluate(() => {
    const before = document.documentElement.hasAttribute("data-section-settling");
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true }));
    return { before, after: document.documentElement.hasAttribute("data-section-settling") };
  });
  expect(ended).toEqual({ before: true, after: false });
  await disableNativeScrollAnchoring(page);
  const scrollY = await page.evaluate(() => window.scrollY);
  const top = (await sectionTop(page, "notes"))!;
  expect(await growContentAbove(page, 200)).toBe(false);
  await nextFrames(page);
  expect(await page.evaluate(() => window.scrollY), "no compensation after the user took control").toBe(scrollY);
  expect((await sectionTop(page, "notes"))! - top).toBeGreaterThanOrEqual(198);
});

test("navigation keys end stabilization; modifiers and typing in a field do not", async ({ page }) => {
  await page.goto("/notes", { waitUntil: "domcontentloaded" });
  await placedAt(page, "notes");
  const result = await page.evaluate(() => {
    const settling = () => document.documentElement.hasAttribute("data-section-settling");
    const start = settling();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true }));
    const afterModifier = settling();
    const field = document.createElement("input");
    document.body.appendChild(field);
    field.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    const afterTyping = settling();
    field.remove();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));
    return { start, afterModifier, afterTyping, afterPageDown: settling() };
  });
  expect(result).toEqual({ start: true, afterModifier: true, afterTyping: true, afterPageDown: false });
});

test("a new section navigation replaces the running stabilization instead of stacking", async ({ page }) => {
  await page.goto("/case-studies", { waitUntil: "domcontentloaded" });
  await placedAt(page, "case-studies");
  await page.evaluate(() => {
    window.history.pushState({}, "", "/notes");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await placedAt(page, "notes");
  // Two live stabilizers would each compensate, moving the page twice as far.
  expect(await growContentAbove(page, 300)).toBe(true);
  await waitForSectionSettled(page);
  expect(Math.abs((await sectionTop(page, "notes"))! - 96)).toBeLessThanOrEqual(2);
});

test("a finished stabilization leaves no observer behind", async ({ page }) => {
  await page.goto("/notes", { waitUntil: "domcontentloaded" });
  await placedAt(page, "notes");
  await waitForSectionSettled(page);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowAnchor), "native scroll anchoring is restored").toBe("auto");
  await disableNativeScrollAnchoring(page);
  const scrollY = await page.evaluate(() => window.scrollY);
  const top = (await sectionTop(page, "notes"))!;
  expect(await growContentAbove(page, 240)).toBe(false);
  await nextFrames(page);
  expect(await page.evaluate(() => window.scrollY), "no stabilizer compensation after the transaction ended").toBe(scrollY);
  expect((await sectionTop(page, "notes"))! - top).toBeGreaterThanOrEqual(238);
});

test("Browser Back restores the notes anchor with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/notes");
  await page.getByRole("link", { name: /Read note/i }).first().click();
  await expect(page).toHaveURL(/\/notes\/[a-z0-9-]+\/?$/i);
  await page.goBack();
  await expect(page).toHaveURL(/\/notes\/?$/);
  await placedAt(page, "notes");
  await waitForSectionSettled(page);
  expect(Math.abs((await sectionTop(page, "notes"))! - 96)).toBeLessThanOrEqual(2);
});

for (const width of [320, 360, 390, 412]) {
  test(`Browser Back restores the notes anchor at ${width}px without overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/notes");
    await page.getByRole("link", { name: /Read note/i }).first().click();
    await expect(page).toHaveURL(/\/notes\/[a-z0-9-]+\/?$/i);
    await page.goBack();
    await expect(page).toHaveURL(/\/notes\/?$/);
    await placedAt(page, "notes", 72);
    await waitForSectionSettled(page);
    expect(Math.abs((await sectionTop(page, "notes"))! - 72)).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

for (const width of [1280, 390]) {
  test(`a direct note route survives internal navigation and Browser Back at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 720 ? 844 : 720 });
    const slug = "architecting-hirava-recruitment-marketplace";
    await page.goto(`/notes/${slug}`);
    await expect(page.locator("#note-detail-title")).toBeVisible();
    await expect(page.locator(".note-markdown")).toBeVisible();
    await expect(page.locator(".editor-tab.active")).toHaveText(`${slug}.md`);

    // Internal navigation: the breadcrumb returns to the Engineering Notes
    // index, which starts a section stabilization transaction.
    await page.locator(".note-detail-breadcrumb button").click();
    await expect.poll(() => activeTabId(page)).toBe("home");
    await expect.poll(() => sectionTop(page, "notes")).toBeLessThan(140);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/notes/${slug}$`));
    await expect(page.locator(".editor-tab.active")).toHaveText(`${slug}.md`);
    await expect(page.locator("#note-detail-title")).toBeInViewport();
    // Opening a note starts it at its own beginning; that is the intended position.
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThanOrEqual(2);
    await waitForSectionSettled(page);
    // No stale index section survives, and the end of stabilization moved nothing.
    await expect(page.locator("#notes")).toHaveCount(0);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeLessThanOrEqual(2);
    await expect(page.locator("#note-detail-title")).toBeInViewport();
  });
}

// Records which primary home section is presented at the reading line just
// below the sticky chrome, in painted frames only. A flash of an unrelated
// section - the historical Changelog/other-section bug - shows up as an extra id.
//
// Sampling geometry in requestAnimationFrame is not enough: it runs before that
// frame's layout and ResizeObserver step, so it forces layout on changes that
// are corrected before paint and reports flashes nobody ever sees.
// IntersectionObserver intersections are computed after ResizeObserver, just
// before paint, so a one-pixel band at the reading line reports what was drawn.
// Sections unmounted while a note is open are observed as they re-mount.
const PRIMARY_SECTIONS = ["home", "about", "work", "case-studies", "experience", "activity", "now", "changelog", "notes", "contact"];
const startPresentedSectionRecorder = (page: import("@playwright/test").Page, readingLine: number) =>
  page.evaluate(({ line, ids }) => {
    const state = window as unknown as { __presented: string[]; __stopRecorder: () => void };
    const presented: string[] = [];
    state.__presented = presented;
    const band = `-${line}px 0px -${Math.max(0, window.innerHeight - line - 1)}px 0px`;
    const intersections = new IntersectionObserver(entries => {
      for (const entry of [...entries].sort((a, b) => a.time - b.time)) {
        if (entry.isIntersecting && presented[presented.length - 1] !== entry.target.id) presented.push(entry.target.id);
      }
    }, { rootMargin: band, threshold: 0 });
    const observed = new WeakSet<Element>();
    const observeSections = () => {
      for (const id of ids) {
        const section = document.getElementById(id);
        if (section && !observed.has(section)) { observed.add(section); intersections.observe(section); }
      }
    };
    const mounts = new MutationObserver(observeSections);
    mounts.observe(document.body, { childList: true, subtree: true });
    observeSections();
    state.__stopRecorder = () => { mounts.disconnect(); intersections.disconnect(); };
  }, { line: readingLine, ids: PRIMARY_SECTIONS });
const stopPresentedSectionRecorder = async (page: import("@playwright/test").Page) => {
  // Let the last rendering update's intersection records be delivered.
  await nextFrames(page);
  return page.evaluate(() => {
    const state = window as unknown as { __presented: string[]; __stopRecorder: () => void };
    state.__stopRecorder();
    return state.__presented;
  });
};

// A flash detector that cannot see a flash proves nothing. This paints a real
// Changelog frame on purpose and requires the recorder to report it.
test("the presented-section recorder detects a painted flash", async ({ page }) => {
  await page.goto("/notes");
  await placedAt(page, "notes");
  await waitForSectionSettled(page);
  await startPresentedSectionRecorder(page, 120);
  await nextFrames(page);
  await page.evaluate(() => window.scrollBy({ top: -160, behavior: "instant" as ScrollBehavior }));
  await nextFrames(page);
  await page.evaluate(() => window.scrollBy({ top: 160, behavior: "instant" as ScrollBehavior }));
  await nextFrames(page);
  const presented = await stopPresentedSectionRecorder(page);
  expect(presented, `recorded: ${presented.join(" -> ")}`).toEqual(["notes", "changelog", "notes"]);
});

for (const width of [1280, 390]) {
  test(`Browser Back to the notes index presents no unrelated section at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 720 ? 844 : 720 });
    const offset = width <= 720 ? 72 : 96;
    await page.goto("/notes");
    await placedAt(page, "notes", offset);
    await waitForSectionSettled(page);
    await page.getByRole("link", { name: /Read note/i }).first().click();
    await expect(page.locator(".note-markdown")).toBeVisible();

    await startPresentedSectionRecorder(page, offset + 24);
    await page.goBack();
    await expect(page).toHaveURL(/\/notes\/?$/);
    await placedAt(page, "notes", offset);
    await waitForSectionSettled(page);
    const presented = await stopPresentedSectionRecorder(page);
    expect(presented, `sections presented during restoration: ${presented.join(" -> ")}`).toEqual(["notes"]);
  });

  test(`closing a case study presents no unrelated section at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 720 ? 844 : 720 });
    const offset = width <= 720 ? 72 : 96;
    await page.goto("/case-studies");
    await placedAt(page, "case-studies", offset);
    await waitForSectionSettled(page);
    await page.locator('.case-study-card[data-case-study-id="hirava"] a.card-surface-link').evaluate(element => (element as HTMLAnchorElement).click());
    const modal = page.locator('[role="dialog"].case-study-modal');
    await expect(modal).toBeVisible();

    await startPresentedSectionRecorder(page, offset + 24);
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
    await nextFrames(page);
    await nextFrames(page);
    const presented = await stopPresentedSectionRecorder(page);
    expect(presented, `sections presented while closing: ${presented.join(" -> ")}`).toEqual(["case-studies"]);
  });
}

// Opening a case study from a note switched the editor to the Home tab, and
// neither Escape nor Browser Back switched it back: the note URL returned but
// the note stayed hidden behind Home. Present on 5.6.1 as well; fixed in 5.6.2.
for (const width of [1280, 390]) {
  for (const close of ["Browser Back", "Escape"] as const) {
    test(`a case study opened from a note returns to that note on ${close} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width <= 720 ? 844 : 720 });
      const slug = "designing-trust-into-hiring-workflows";
      await page.goto(`/notes/${slug}`);
      await expect(page.locator(".note-markdown")).toBeVisible();
      await expect(page.locator(".editor-tab.active")).toHaveText(`${slug}.md`);

      const originTab = await activeTabId(page);
      expect(originTab).toBe(`note:${slug}`);
      const originTitle = await page.title();

      await page.locator(".continue-exploring a.continue-exploring-link[href='/case-studies/hirava']").click();
      const modal = page.locator('[role="dialog"].case-study-modal');
      await expect(modal).toBeVisible();
      await expect(page).toHaveURL(/\/case-studies\/hirava$/);
      // The covered editor stays the note: Home never takes over behind the dialog.
      expect(await activeTabId(page), "no Home takeover while the case study is open").toBe(originTab);

      await startPresentedSectionRecorder(page, (width <= 720 ? 72 : 96) + 24);
      if (close === "Browser Back") await page.goBack();
      else await page.keyboard.press("Escape");

      await expect(modal).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`/notes/${slug}$`));
      await expect.poll(() => activeTabId(page), "the originating editor tab is active again").toBe(originTab);
      await expect(page.locator(".editor-tab.active")).toHaveText(`${slug}.md`);
      await expect(page.locator(".note-markdown"), "the note itself is shown").toBeVisible();
      await expect(page.locator("#notes"), "the home sections are not shown behind the note").toHaveCount(0);
      await waitForSectionSettled(page);
      const presented = await stopPresentedSectionRecorder(page);
      expect(presented, `home sections painted while returning: ${presented.join(" -> ")}`).toEqual([]);
      await expect(page, "the note's document title is restored").toHaveTitle(originTitle);
      expect((await tabIds(page)).filter(id => id === `note:${slug}`), "the note tab is not duplicated").toHaveLength(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  }
}

// ---- v5.6.2 Raven: System Health vocabulary ----
//
// The backend reports what each check proved. deployed and configured are
// healthy resting states; the interface used to render both as Down.

const RAVEN_HEALTH_CHECKS: [id: string, label: string, status: string, expected: string, tone: string][] = [
  ["github", "GitHub upstream", "operational", "Operational", "positive"],
  ["github-proxy", "GitHub proxy", "deployed", "Deployed", "informational"],
  ["contact", "Contact API", "deployed", "Deployed", "informational"],
  ["recaptcha", "Contact protection", "configured", "Configured", "informational"],
  ["notes", "Engineering Notes", "operational", "Operational", "positive"],
  ["cache", "Private cache", "operational", "Operational", "positive"],
  ["build", "Build metadata", "deployed", "Deployed", "informational"],
];

async function openSystemHealth(page: import("@playwright/test").Page, checks: { id: string; label: string; status: string }[], overall = "operational") {
  await page.route("**/api/health*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: overall,
      environment: "production",
      generatedAt: new Date().toISOString(),
      build: { version: RELEASE_VERSION, buildId: "test", builtAt: null, environment: "production" },
      checks: checks.map(check => ({ ...check, latencyMs: null, detail: `${check.label} detail` })),
    }),
  }));
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("portfolio:diagnostics")));
  const dialog = page.getByRole("dialog", { name: /Production signals/i });
  await expect(dialog.locator(".health-check[data-status]")).toHaveCount(checks.length);
  return dialog;
}

test("System Health renders the Raven production payload with no false Down", async ({ page }) => {
  const dialog = await openSystemHealth(page, RAVEN_HEALTH_CHECKS.map(([id, label, status]) => ({ id, label, status })));
  for (const [, label, status, expected, tone] of RAVEN_HEALTH_CHECKS) {
    const card = dialog.locator(".health-check", { hasText: label });
    await expect(card.locator("b"), label).toHaveText(expected);
    await expect(card).toHaveAttribute("data-status", status);
    await expect(card).toHaveClass(new RegExp(`\\btone-${tone}\\b`));
  }
  await expect(dialog.locator(".health-check b", { hasText: /^Down$/ })).toHaveCount(0);
  await expect(dialog.locator(".health-check.tone-error")).toHaveCount(0);
  await expect(dialog.locator(".health-overall")).toContainText("Operational");
});

test("every health status keeps its own label and failure states still read as failures", async ({ page }) => {
  const cases: [status: string, expected: string, tone: string][] = [
    ["operational", "Operational", "positive"],
    ["deployed", "Deployed", "informational"],
    ["configured", "Configured", "informational"],
    ["degraded", "Degraded", "warning"],
    ["unavailable", "Unavailable", "error"],
    ["down", "Down", "error"],
    ["unknown", "Unknown", "neutral"],
    ["something-new", "Unknown", "neutral"],
    ["", "Unknown", "neutral"],
  ];
  const dialog = await openSystemHealth(page, cases.map(([status], index) => ({ id: `check-${index}`, label: `Check ${index}`, status })), "degraded");
  for (const [index, [status, expected, tone]] of cases.entries()) {
    const card = dialog.locator(".health-check", { hasText: `Check ${index}` });
    await expect(card.locator("b"), `status "${status}"`).toHaveText(expected);
    await expect(card).toHaveClass(new RegExp(`\\btone-${tone}\\b`));
  }
  await expect(dialog.locator(".health-check b", { hasText: /^Down$/ })).toHaveCount(1);
  await expect(dialog.locator(".health-overall")).toContainText("Degraded");
});

for (const theme of ["light", "dark"] as const) {
  test(`health status text meets AA contrast in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript(themeName => localStorage.setItem("portfolio-theme", themeName), theme);
    await openSystemHealth(page, [
      { id: "a", label: "Positive", status: "operational" },
      { id: "b", label: "Informational", status: "deployed" },
      { id: "c", label: "Warning", status: "degraded" },
      { id: "d", label: "Error", status: "down" },
      { id: "e", label: "Neutral", status: "unknown" },
    ]);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const tone of ["positive", "informational", "warning", "error", "neutral"]) {
      expect(await renderedContrast(page, `.health-check.tone-${tone} code`), `${tone} status text`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

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
    // Flush against the tabs: below them, with no margin of its own.
    return Math.abs(tocBox.y - (tabsBox.y + tabsBox.height)) <= 1;
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
  await page.getByRole("link", { name: /Open case study/i }).first().click();
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
      const caseStudyButton = page.getByRole("link", { name: /Open case study/i }).first();
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

test("activity timeline metadata meets WCAG AA in both themes", async ({ page }) => {
  await page.route("**/api/github/activity", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ id: "contrast-fixture", type: "PushEvent", repo: "osameh.dev", message: "Contrast fixture", created_at: "2026-01-01T00:00:00Z", url: "https://github.com/osameh15/osameh.dev" }]),
  }));
  const contrastRatio = (selector: string) => page.locator(selector).first().evaluate(element => {
    const parse = (value: string) => (value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]).slice(0, 3).map(channel => {
      const normalized = channel / 255;
      return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
    });
    const luminance = (rgb: number[]) => .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
    const style = getComputedStyle(element);
    const foreground = luminance(parse(style.color));
    let current: Element | null = element;
    let background = "rgba(0, 0, 0, 0)";
    while (current) {
      background = getComputedStyle(current).backgroundColor;
      const channels = background.match(/[\d.]+/g)?.map(Number) ?? [];
      if ((channels.length > 3 ? channels[3] : 1) > 0) break;
      current = current.parentElement;
    }
    const backdrop = luminance(parse(background));
    return (Math.max(foreground, backdrop) + .05) / (Math.min(foreground, backdrop) + .05);
  });
  await page.goto("/activity");
  const target = page.locator(".activity-timeline small").first();
  await expect(target).toBeVisible();
  expect(await contrastRatio(".activity-timeline small")).toBeGreaterThanOrEqual(4.5);
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  expect(await contrastRatio(".activity-timeline small")).toBeGreaterThanOrEqual(4.5);
});

const openPaletteShortcut = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));

test("Escape closes only the topmost dialog on the modal stack", async ({ page }) => {
  await page.goto("/case-studies");
  await page.getByRole("link", { name: /Open case study/i }).first().click();
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
  await page.getByRole("link", { name: /Open case study/i }).first().click();
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
  await page.getByRole("link", { name: /Open case study/i }).first().click();
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
const FEATURED_REPOS = Object.keys(FEATURED_FIXTURES).map((name, index) => ({
  id: index + 1,
  name,
  description: LONG_HEADLINE,
  language: "TypeScript",
  topics: ["react", "typescript", "accessibility"],
  stargazers_count: 1,
  forks_count: 0,
  archived: false,
  updated_at: `2026-01-0${index + 1}T00:00:00Z`,
  fork: false,
  default_branch: "main",
}));

async function stubFeaturedProjects(page: import("@playwright/test").Page) {
  await page.route("**/api/github/repos", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FEATURED_REPOS) }));
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

// ---------------------------------------------------------------------------
// Shared editor-tab contract. Every tab-backed view uses one lifecycle:
// activating a tab never removes another, closing the active tab activates the
// tab to its left, and Home restores the section owned by the tab it replaced.
// ---------------------------------------------------------------------------

// A palette target carries the exact destination it must reach. "Any project"
// is not a usable post-condition: once one project is open it is already true,
// so the helper would stop waiting before the requested tab existed.
const PROJECT_A = { query: "open project: osameh", path: "/projects/osameh.dev", tab: "osameh.dev.md" };
const PROJECT_B = { query: "open project: Mizekar", path: "/projects/Mizekar", tab: "Mizekar.md" };
const NOTE_A = { query: "read note: repository-driven", path: "/notes/repository-driven-portfolio", tab: "repository-driven-portfolio.md" };
type PaletteTarget = typeof PROJECT_A;

async function runPalette(page: import("@playwright/test").Page, target: PaletteTarget) {
  await page.evaluate(openPaletteShortcut);
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  await palette.getByRole("textbox").fill(target.query);
  await expect(palette.getByRole("option").first()).toBeVisible();
  await palette.getByRole("textbox").press("Enter");
  await expect(palette).toBeHidden();
  // The open handler pushes history synchronously, so a matching URL alone is
  // not evidence that the tab has rendered. Wait for the entity this call asked
  // for: its exact route, and its own tab actually active in the strip.
  await expect.poll(() => new URL(page.url()).pathname).toBe(target.path);
  await expect(page.locator(".editor-tab.active")).toHaveText(target.tab);
}

/** Title of the active tab, so a failure names the tab instead of a count. */
const activeTabTitle = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (document.querySelector(".editor-tab.active") as HTMLElement | null)?.textContent?.trim() || null);
const tabIds = (page: import("@playwright/test").Page) =>
  page.evaluate(() => [...document.querySelectorAll(".editor-tab")].map(tab => (tab as HTMLElement).dataset.tabId || "home"));
const activeTabId = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (document.querySelector(".editor-tab.active") as HTMLElement | null)?.dataset.tabId || "home");
const clickTab = (page: import("@playwright/test").Page, id: string) =>
  id === "home" ? page.locator(".editor-tab").first().click() : page.locator(`.editor-tab[data-tab-id="${id}"]`).click();
const closeTabById = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`.editor-tab[data-tab-id="${id}"] [aria-label^="Close"]`).click();
const sectionTop = (page: import("@playwright/test").Page, id: string) =>
  page.evaluate(sectionId => { const node = document.getElementById(sectionId); return node ? Math.round(node.getBoundingClientRect().top) : null; }, id);

test("closing a project returns Home to the Projects section", async ({ page }) => {
  await page.goto("/");
  await runPalette(page, PROJECT_A);
  const project = (await tabIds(page)).find(id => id.startsWith("project:"))!;
  expect(project).toBeTruthy();
  await closeTabById(page, project);
  await expect.poll(() => activeTabId(page)).toBe("home");
  await expect(page).toHaveURL(/\/$/);
  // Real geometry, not just an active class: the Projects section is anchored
  // under the sticky chrome exactly like the Notes restoration.
  await expect.poll(() => sectionTop(page, "work")).toBeLessThan(140);
  await expect.poll(() => sectionTop(page, "work")).toBeGreaterThan(40);
  // And it must stay there - no delayed re-snap.
  const settled = await sectionTop(page, "work");
  await page.waitForTimeout(1_150);
  expect(await sectionTop(page, "work")).toBe(settled);
});

test("clicking Home keeps the project tab open and restores Projects", async ({ page }) => {
  await page.goto("/");
  await runPalette(page, PROJECT_A);
  const project = (await tabIds(page)).find(id => id.startsWith("project:"))!;
  await clickTab(page, "home");
  await expect.poll(() => activeTabId(page)).toBe("home");
  expect(await tabIds(page)).toContain(project);
  await expect.poll(() => sectionTop(page, "work")).toBeLessThan(140);
  await clickTab(page, project);
  await expect.poll(() => activeTabId(page)).toBe(project);
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
});

test("clicking Home keeps the note tab open and restores Engineering Notes", async ({ page }) => {
  await page.goto("/");
  await runPalette(page, NOTE_A);
  const note = (await tabIds(page)).find(id => id.startsWith("note:"))!;
  expect(note).toBeTruthy();
  await clickTab(page, "home");
  await expect.poll(() => activeTabId(page)).toBe("home");
  expect(await tabIds(page)).toContain(note);
  await expect.poll(() => sectionTop(page, "notes")).toBeLessThan(140);
  await clickTab(page, note);
  await expect.poll(() => activeTabId(page)).toBe(note);
  await expect(page).toHaveURL(/\/notes\/[a-z0-9-]+$/);
});

test("mixed project and note tabs coexist, switch and never duplicate", async ({ page }) => {
  await stubFeaturedProjects(page);
  await page.goto("/");
  await runPalette(page, PROJECT_A);
  await runPalette(page, NOTE_A);
  await runPalette(page, PROJECT_B);
  let ids = await tabIds(page);
  expect(await activeTabTitle(page)).toBe(PROJECT_B.tab);
  expect(ids.filter(id => id.startsWith("project:"))).toHaveLength(2);
  expect(ids.filter(id => id.startsWith("note:"))).toHaveLength(1);
  expect(ids[0]).toBe("home");

  // Re-opening an already-open entity activates its tab instead of duplicating.
  const before = ids.length;
  await runPalette(page, PROJECT_A);
  expect(await tabIds(page)).toHaveLength(before);
  // Tab order is stable: activation must not reorder the strip.
  expect(await tabIds(page)).toEqual(ids);

  const note = ids.find(id => id.startsWith("note:"))!;
  await clickTab(page, note);
  await expect(page).toHaveURL(/\/notes\/[a-z0-9-]+$/);
  const projectB = ids.filter(id => id.startsWith("project:"))[1];
  await clickTab(page, projectB);
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  ids = await tabIds(page);
  expect(ids).toHaveLength(before);
});

test("closing the active tab activates the tab to its left", async ({ page }) => {
  await page.goto("/");
  await runPalette(page, PROJECT_A);
  await runPalette(page, NOTE_A);
  const ids = await tabIds(page);
  const projectA = ids.find(id => id.startsWith("project:"))!;
  const note = ids.find(id => id.startsWith("note:"))!;
  await expect.poll(() => activeTabId(page)).toBe(note);
  await closeTabById(page, note);
  // Not Home - the tab immediately to the left.
  await expect.poll(() => activeTabId(page)).toBe(projectA);
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  expect(await tabIds(page)).not.toContain(note);
});

test("closing an inactive tab leaves the active tab untouched", async ({ page }) => {
  await page.goto("/");
  await runPalette(page, PROJECT_A);
  await runPalette(page, NOTE_A);
  const ids = await tabIds(page);
  const projectA = ids.find(id => id.startsWith("project:"))!;
  const note = ids.find(id => id.startsWith("note:"))!;
  await expect.poll(() => activeTabId(page)).toBe(note);
  await closeTabById(page, projectA);
  await expect.poll(() => activeTabId(page)).toBe(note);
  await expect(page).toHaveURL(/\/notes\/[a-z0-9-]+$/);
  expect(await tabIds(page)).not.toContain(projectA);
});

test("closing an active project with Home to its left restores Projects and keeps other tabs", async ({ page }) => {
  await page.goto("/");
  await runPalette(page, PROJECT_A);
  await runPalette(page, NOTE_A);
  const ids = await tabIds(page);
  const projectA = ids.find(id => id.startsWith("project:"))!;
  const note = ids.find(id => id.startsWith("note:"))!;
  await clickTab(page, projectA);
  await closeTabById(page, projectA);
  await expect.poll(() => activeTabId(page)).toBe("home");
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => sectionTop(page, "work")).toBeLessThan(140);
  // The unrelated note tab survives the close.
  expect(await tabIds(page)).toContain(note);
});

test("closing the only note returns Home to Engineering Notes", async ({ page }) => {
  await page.goto("/");
  await runPalette(page, NOTE_A);
  const note = (await tabIds(page)).find(id => id.startsWith("note:"))!;
  await closeTabById(page, note);
  await expect.poll(() => activeTabId(page)).toBe("home");
  await expect.poll(() => sectionTop(page, "notes")).toBeLessThan(140);
  await expect.poll(() => sectionTop(page, "notes")).toBeGreaterThan(40);
  expect(await tabIds(page)).toEqual(["home"]);
});

test("build modal reports the deployed environment from build-info.json", async ({ page }) => {
  // One bundle is built and the staging/production bundles are derived from it,
  // so the same JS ships to both. The environment must come from the packaged
  // build-info.json at runtime, never from a literal compiled into the bundle.
  await page.route("**/build-info.json", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ version: "5.1.1", buildId: "v5.1.1-test", builtAt: new Date().toISOString(), environment: "staging", availabilityMood: "selective" }),
  }));
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("portfolio:build")));
  const modal = page.locator(".build-info-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator(".build-info-badge")).toHaveText("STAGING BUILD");
  const environment = modal.locator(".build-info-grid article").filter({ hasText: "ENVIRONMENT" }).locator("strong");
  await expect(environment).toHaveText("staging");
});

// ---------------------------------------------------------------------------
// Release identity — codename architecture, Neural Cipher branding, and
// active-tab auto-scroll. The version is read from package.json so a patch bump
// never invalidates these assertions.
// ---------------------------------------------------------------------------

test("release identity surfaces show the version and release codename", async ({ page }) => {
  await page.goto("/");
  // Status bar
  const status = page.locator(".status-build");
  await expect(status).toContainText(`v${RELEASE_VERSION}`);
  await expect(status).toContainText(RELEASE_CODENAME.toUpperCase());
  // Build Info
  await page.evaluate(() => window.dispatchEvent(new Event("portfolio:build")));
  const modal = page.locator(".build-info-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator("#build-info-title")).toContainText(`v${RELEASE_VERSION} · ${RELEASE_CODENAME.toUpperCase()}`);
  const cell = (label: string) => modal.locator(".build-info-grid article").filter({ hasText: label }).locator("strong");
  await expect(cell("VERSION")).toHaveText(`v${RELEASE_VERSION} · ${RELEASE_CODENAME.toUpperCase()}`);
  await expect(cell("CODENAME")).toHaveText(RELEASE_CODENAME);
  // Environment must stay runtime-derived, not compiled in.
  const buildInfo = await (await page.request.get("/build-info.json")).json() as { environment?: string };
  await expect(cell("ENVIRONMENT")).toHaveText(buildInfo.environment ?? "resolving…");
});

test("build info reports staging environment while keeping the release identity", async ({ page }) => {
  await page.route("**/build-info.json", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ version: RELEASE_VERSION, codename: RELEASE_CODENAME, buildId: `v${RELEASE_VERSION}-test`, builtAt: new Date().toISOString(), environment: "staging", availabilityMood: "selective" }),
  }));
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("portfolio:build")));
  const modal = page.locator(".build-info-modal");
  await expect(modal.locator(".build-info-badge")).toHaveText("STAGING BUILD");
  await expect(modal.locator(".build-info-grid article").filter({ hasText: "ENVIRONMENT" }).locator("strong")).toHaveText("staging");
  await expect(modal.locator(".build-info-grid article").filter({ hasText: "CODENAME" }).locator("strong")).toHaveText(RELEASE_CODENAME);
});

test("terminal version and status output carry the release codename", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /I build software/i })).toBeVisible();
  await page.keyboard.press("`");
  const terminal = page.locator(".terminal-panel");
  await expect(terminal).toBeVisible();
  const input = terminal.locator("input");
  await input.fill("version");
  await input.press("Enter");
  await expect(terminal.locator(".terminal-output")).toContainText(`osameh.dev v${RELEASE_VERSION} · ${RELEASE_CODENAME}`);
  await input.fill("neofetch");
  await input.press("Enter");
  await expect(terminal.locator(".terminal-output")).toContainText(`Codename  ${RELEASE_CODENAME}`);
  await expect(terminal.locator(".terminal-output")).toContainText("OSAMEH.DEV // NEURAL CIPHER");
});

test("header and resume use the Neural Cipher brand mark", async ({ page }) => {
  await page.goto("/");
  const header = page.locator(".brand-mark img");
  await expect(header).toHaveAttribute("src", "/icons/icon-32x32.png");
  await expect(header).toHaveAttribute("srcset", /icon-64x64\.png 2x/);
  // Decorative: the wrapping link carries the accessible name.
  await expect(header).toHaveAttribute("alt", "");
  const loaded = await header.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  expect(loaded).toBe(true);

  await page.evaluate(() => window.dispatchEvent(new Event("portfolio:resume")));
  const resumeMark = page.locator(".resume-brand img");
  await expect(resumeMark).toBeVisible();
  await expect.poll(() => resumeMark.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test("manifest and favicons use the new icon pack and drop the retired names", async ({ page }) => {
  await page.goto("/");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  const sources = (manifest.icons || []).map((icon: { src: string }) => icon.src);
  expect(sources).toContain("/icons/pwa-192x192.png");
  expect(sources).toContain("/icons/pwa-512x512.png");
  expect(sources.join(" ")).not.toMatch(/icon-192\.png|icon-512\.png/);
  for (const src of sources) expect((await page.request.get(src)).status()).toBe(200);

  // Head wiring plus real asset availability.
  await expect(page.locator('link[rel="icon"][href="/icons/favicon.ico"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"][sizes="180x180"]')).toHaveCount(1);
  for (const asset of ["/icons/favicon.ico", "/icons/icon-16x16.png", "/icons/icon-32x32.png", "/icons/icon-48x48.png", "/icons/apple-touch-icon.png", "/og-cover-social.jpg"]) {
    expect((await page.request.get(asset)).status()).toBe(200);
  }
  // The retired monogram favicon must not be referenced any more.
  await expect(page.locator('link[href="/favicon.svg"]')).toHaveCount(0);
});

const tabScrollViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
];

/** Geometry of the active tab relative to its scroll container. */
const activeTabVisibility = (page: import("@playwright/test").Page) => page.evaluate(() => {
  const strip = document.querySelector(".tabs-row") as HTMLElement | null;
  const active = strip?.querySelector(".editor-tab.active") as HTMLElement | null;
  if (!strip || !active) return null;
  const stripBox = strip.getBoundingClientRect();
  const tabBox = active.getBoundingClientRect();
  return {
    overflows: strip.scrollWidth > strip.clientWidth + 1,
    fullyVisible: tabBox.left >= stripBox.left - 1 && tabBox.right <= stripBox.right + 1,
    id: active.dataset.tabId || "home",
  };
});

for (const viewport of tabScrollViewports) {
  test(`active editor tab scrolls into view at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubFeaturedProjects(page);
    await page.goto("/");

    // Build enough tabs to force real horizontal overflow.
    await runPalette(page, PROJECT_A);
    await runPalette(page, NOTE_A);
    await runPalette(page, PROJECT_B);
    const ids = await tabIds(page);
    // Diagnose before counting: a bare count says "3 != 4" without saying which
    // tab never arrived.
    expect(await activeTabTitle(page)).toBe(PROJECT_B.tab);
    expect(ids.filter(id => id.startsWith("project:"))).toHaveLength(2);
    expect(ids.filter(id => id.startsWith("note:"))).toHaveLength(1);
    expect(ids.length).toBeGreaterThanOrEqual(4);

    // Scrolling is smooth, so poll until it settles rather than sampling once.
    const visible = () => activeTabVisibility(page).then(state => state?.fullyVisible ?? false);
    const activeId = () => activeTabVisibility(page).then(state => state?.id ?? null);

    // The most recently opened tab is far right and must become visible.
    await expect.poll(visible).toBe(true);

    // Far-left Home.
    await clickTab(page, "home");
    await expect.poll(activeId).toBe("home");
    await expect.poll(visible).toBe(true);

    // Back to the far-right tab. Switching between two editor tabs performs no
    // section restoration, so the page must not move vertically at all - only
    // the strip scrolls horizontally.
    const last = ids[ids.length - 1];
    await clickTab(page, last);
    await expect.poll(activeId).toBe(last);
    await expect.poll(visible).toBe(true);
    // Activating a tab scrolls the document to the top of that view. The
    // horizontal strip scroll must not hijack that: the page settles at 0
    // rather than at some arbitrary intermediate offset.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    // Closing the active tab activates its left neighbour, which must also be visible.
    await closeTabById(page, last);
    await expect.poll(visible).toBe(true);

    // The tab strip scrolls inside itself; the document never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}

// ---------------------------------------------------------------------------
// README asset URLs. A README may reference an asset with a raw space, with the
// space already percent-encoded, or as a third party's absolute raw URL. Each
// must be encoded exactly once - a second pass turns "%20" into "%2520" and
// 404s the image - and a third party's URL must never be rewritten onto ours.
// ---------------------------------------------------------------------------

const README_FIXTURE = [
  "# Fixture",
  "",
  "![Raw space](<docs/My Image.png>)",
  "![Encoded space](docs/My%20Encoded.png)",
  "![Unicode](docs/تصویر.png)",
  "![Nested](<docs/screenshots/Deep Folder/Shot One.png>)",
  '<img src="docs/Html Image.png" alt="Html">',
  "![Third party](https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg)",
  "",
  "[Relative doc link](<docs/Some Doc.md>)",
].join("\n");

test("README assets are encoded exactly once and third-party hosts are preserved", async ({ page }) => {
  await stubFeaturedProjects(page);
  await page.route("**/api/github/readme/**", route => route.fulfill({ status: 200, contentType: "text/markdown", body: README_FIXTURE }));
  await page.goto("/");
  await runPalette(page, PROJECT_A);

  const preview = page.locator(".markdown-preview");
  await expect(preview).toBeVisible();
  const sources = await preview.locator("img").evaluateAll(nodes => nodes.map(node => node.getAttribute("src") || ""));
  expect(sources.length).toBeGreaterThanOrEqual(6);

  // The defect this release fixes: no asset URL may carry a double encoding.
  for (const source of sources) expect(source).not.toContain("%2520");

  const root = "https://raw.githubusercontent.com/osameh15/osameh.dev/main/";
  expect(sources).toContain(root + "docs/My%20Image.png");
  expect(sources).toContain(root + "docs/My%20Encoded.png");
  expect(sources).toContain(root + "docs/" + encodeURIComponent("تصویر.png"));
  expect(sources).toContain(root + "docs/screenshots/Deep%20Folder/Shot%20One.png");
  expect(sources).toContain(root + "docs/Html%20Image.png");
  // A third party's asset stays on its own repository, byte for byte.
  expect(sources).toContain("https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg");

  // Sanitization and the tab lifecycle are unaffected by the transform.
  expect(await preview.locator("script").count()).toBe(0);
  const links = await preview.locator("a").evaluateAll(nodes => nodes.map(node => node.getAttribute("href") || ""));
  for (const href of links) expect(href).not.toContain("%2520");
  expect(await activeTabTitle(page)).toBe(PROJECT_A.tab);
});

test("tab auto-scroll leaves an already-visible active tab alone", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFeaturedProjects(page);
  await page.goto("/");
  await runPalette(page, PROJECT_A);
  await runPalette(page, NOTE_A);
  // Wide viewport: no overflow, so the strip must not scroll at all.
  const scrollLeft = await page.evaluate(() => (document.querySelector(".tabs-row") as HTMLElement).scrollLeft);
  await clickTab(page, "home");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (document.querySelector(".tabs-row") as HTMLElement).scrollLeft)).toBe(scrollLeft);
});

test("changelog shows codename badges only for named releases", async ({ page }) => {
  await page.goto("/changelog");
  await page.waitForTimeout(1_200);
  const expand = page.locator(".changelog-load-more button").first();
  if (await expand.count()) await expand.click();
  await page.waitForTimeout(500);

  const rows = await page.evaluate(() => [...document.querySelectorAll(".changelog-node")].map(node => ({
    version: (node.querySelector(".changelog-node-axis small")?.textContent || "").replace(/^v/, ""),
    codename: node.querySelector(".release-codename")?.textContent || null,
  })));
  expect(rows.length).toBeGreaterThan(5);

  for (const row of rows) {
    // A family codename applies to every patch in that family; historical names
    // are exact. Everything else must render no badge at all. The expectation
    // comes from the same resolver the application uses, so activating a new
    // family updates both sides at once.
    const expected = resolveReleaseCodename(releasesFixture, row.version);
    expect(row.codename, `codename badge for ${row.version}`).toBe(expected);
  }
  // A version with no official release metadata naturally renders no badge.
  expect(rows.find(row => row.version === "1.0.0")?.codename).toBeNull();

  // The detail panel names the selected release.
  await expect(page.locator(".release-codename-line .release-codename")).toHaveText(RELEASE_CODENAME);
});

// ---------------------------------------------------------------------------
// Build Info runtime environment contract. One JS bundle serves staging and
// production, so an unresolved environment must stay neutral: guessing would let
// staging assert "PRODUCTION BUILD" while the request is in flight or failed.
// ---------------------------------------------------------------------------

const buildInfoState = (page: import("@playwright/test").Page) => page.evaluate(() => {
  const modal = document.querySelector(".build-info-modal");
  if (!modal) return null;
  const cell = (label: string) => [...modal.querySelectorAll(".build-info-grid article")]
    .find(a => a.querySelector("small")?.textContent === label)?.querySelector("strong")?.textContent || "";
  return { badge: modal.querySelector(".build-info-badge")?.textContent || "", environment: cell("ENVIRONMENT") };
});

async function openBuildInfoWithDelayedMetadata(page: import("@playwright/test").Page, options: { environment?: string; delayMs: number; fail?: boolean }) {
  await page.route("**/build-info.json", async route => {
    await new Promise(resolve => setTimeout(resolve, options.delayMs));
    if (options.fail) return route.abort("failed");
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ version: "5.2.2", codename: "Cipher", buildId: "v5.2.2-test", builtAt: new Date().toISOString(), environment: options.environment, availabilityMood: "selective" }),
    });
  });
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("portfolio:build")));
  await expect(page.locator(".build-info-modal")).toBeVisible();
}

test("build info never claims production while the environment is unresolved", async ({ page }) => {
  await openBuildInfoWithDelayedMetadata(page, { environment: "staging", delayMs: 2_500 });
  // Sampled repeatedly across the pending window, not once.
  for (let sample = 0; sample < 3; sample++) {
    const state = await buildInfoState(page);
    expect(state, "build info modal should be open").not.toBeNull();
    expect(state!.badge).not.toMatch(/PRODUCTION/i);
    expect(state!.environment).not.toBe("production");
    await page.waitForTimeout(500);
  }
  // Resolves to the real environment.
  await expect.poll(() => buildInfoState(page).then(s => s?.environment)).toBe("staging");
  await expect.poll(() => buildInfoState(page).then(s => s?.badge)).toBe("STAGING BUILD");
});

test("build info shows production only after production metadata arrives", async ({ page }) => {
  await openBuildInfoWithDelayedMetadata(page, { environment: "production", delayMs: 1_800 });
  const pending = await buildInfoState(page);
  expect(pending!.badge).not.toMatch(/PRODUCTION/i);
  expect(pending!.environment).not.toBe("production");
  await expect.poll(() => buildInfoState(page).then(s => s?.badge)).toBe("PRODUCTION BUILD");
  await expect.poll(() => buildInfoState(page).then(s => s?.environment)).toBe("production");
});

test("build info never guesses production when the metadata request fails", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await openBuildInfoWithDelayedMetadata(page, { delayMs: 800, fail: true });
  await page.waitForTimeout(2_500);
  const state = await buildInfoState(page);
  expect(state!.badge).not.toMatch(/PRODUCTION/i);
  expect(state!.environment).not.toBe("production");
  // The modal stays usable and nothing rejects unhandled.
  await expect(page.locator(".build-info-modal")).toBeVisible();
  await expect(page.locator("#build-info-title")).toContainText(RELEASE_CODENAME.toUpperCase());
  expect(pageErrors).toEqual([]);
});


// ---------------------------------------------------------------------------
// v5.3.0 Vanta — adjacent Engineering Note navigation.
//
// Order comes from the one authoritative list, the links are real anchors, and
// following one goes through the shared editor-tab lifecycle.
// ---------------------------------------------------------------------------

const FIRST_NOTE = engineeringNotes[0];
const LAST_NOTE = engineeringNotes[engineeringNotes.length - 1];
const MIDDLE_NOTES = engineeringNotes.slice(1, -1);

const noteNav = (page: import("@playwright/test").Page) => page.locator("nav.note-adjacent");
const previousLink = (page: import("@playwright/test").Page) => noteNav(page).locator('[data-adjacent="previous"]');
const nextLink = (page: import("@playwright/test").Page) => noteNav(page).locator('[data-adjacent="next"]');

test("adjacent note order is derived from the authoritative Notes order", () => {
  expect(engineeringNotes.length).toBeGreaterThan(2);
  expect(adjacentNotes(FIRST_NOTE.slug).previous).toBeNull();
  expect(adjacentNotes(FIRST_NOTE.slug).next?.slug).toBe(engineeringNotes[1].slug);
  expect(adjacentNotes(LAST_NOTE.slug).next).toBeNull();
  expect(adjacentNotes(LAST_NOTE.slug).previous?.slug).toBe(engineeringNotes[engineeringNotes.length - 2].slug);
  // Every interior position agrees with its index in the published order.
  engineeringNotes.forEach((note, index) => {
    const { previous, next } = adjacentNotes(note.slug);
    expect(previous?.slug ?? null).toBe(index > 0 ? engineeringNotes[index - 1].slug : null);
    expect(next?.slug ?? null).toBe(index < engineeringNotes.length - 1 ? engineeringNotes[index + 1].slug : null);
  });
  // An unknown slug has no neighbours rather than defaulting to the ends.
  expect(adjacentNotes("not-a-note")).toEqual({ previous: null, next: null });
});

test("the first note offers only Next", async ({ page }) => {
  await page.goto(`/notes/${FIRST_NOTE.slug}`);
  await expect(page.locator(".note-markdown")).toBeVisible();
  await expect(previousLink(page)).toHaveCount(0);
  await expect(nextLink(page)).toHaveAttribute("href", `/notes/${engineeringNotes[1].slug}`);
  await expect(nextLink(page)).toContainText(engineeringNotes[1].title);
  // Absent, not disabled: no dead control is exposed to assistive technology.
  await expect(noteNav(page).locator("button, [aria-disabled='true'], [disabled]")).toHaveCount(0);
});

test("middle notes offer Previous and Next with correct hrefs", async ({ page }) => {
  for (const note of MIDDLE_NOTES) {
    const index = engineeringNotes.findIndex(item => item.slug === note.slug);
    await page.goto(`/notes/${note.slug}`);
    await expect(page.locator(".note-markdown")).toBeVisible();
    await expect(previousLink(page)).toHaveAttribute("href", `/notes/${engineeringNotes[index - 1].slug}`);
    await expect(nextLink(page)).toHaveAttribute("href", `/notes/${engineeringNotes[index + 1].slug}`);
    await expect(previousLink(page)).toContainText(engineeringNotes[index - 1].title);
    await expect(nextLink(page)).toContainText(engineeringNotes[index + 1].title);
  }
});

test("the last note offers only Previous", async ({ page }) => {
  await page.goto(`/notes/${LAST_NOTE.slug}`);
  await expect(page.locator(".note-markdown")).toBeVisible();
  await expect(nextLink(page)).toHaveCount(0);
  await expect(previousLink(page)).toHaveAttribute("href", `/notes/${engineeringNotes[engineeringNotes.length - 2].slug}`);
});

test("adjacent note links are real anchors with descriptive labels", async ({ page }) => {
  await page.goto(`/notes/${engineeringNotes[1].slug}`);
  await expect(page.locator(".note-markdown")).toBeVisible();
  for (const link of [previousLink(page), nextLink(page)]) {
    await expect(link).toHaveJSProperty("tagName", "A");
    await expect(link).not.toHaveAttribute("role", "link");
  }
  await expect(previousLink(page)).toHaveAttribute("aria-label", `Previous note: ${engineeringNotes[0].title}`);
  await expect(nextLink(page)).toHaveAttribute("aria-label", `Next note: ${engineeringNotes[2].title}`);
  await expect(noteNav(page)).toHaveAttribute("aria-label", "Engineering Notes navigation");
});

test("Next opens the adjacent note through the shared editor-tab lifecycle", async ({ page }) => {
  await page.goto(`/notes/${FIRST_NOTE.slug}`);
  await expect(page.locator(".note-markdown")).toBeVisible();
  const before = (await tabIds(page)).length;
  await nextLink(page).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/notes/${engineeringNotes[1].slug}`);
  await expect(page.locator(".editor-tab.active")).toHaveText(`${engineeringNotes[1].slug}.md`);
  expect((await tabIds(page)).length).toBe(before + 1);
  // The destination starts at its own beginning, not at the previous scroll,
  // and it is there immediately rather than animating down from the old one.
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(40);
});

test("adjacent navigation never duplicates an already open note tab", async ({ page }) => {
  await page.goto(`/notes/${FIRST_NOTE.slug}`);
  await expect(page.locator(".note-markdown")).toBeVisible();
  await nextLink(page).click();
  await expect(page.locator(".editor-tab.active")).toHaveText(`${engineeringNotes[1].slug}.md`);
  const opened = (await tabIds(page)).length;
  await previousLink(page).click();
  await expect(page.locator(".editor-tab.active")).toHaveText(`${FIRST_NOTE.slug}.md`);
  // Returning activates the existing tab instead of appending a second one.
  expect((await tabIds(page)).length).toBe(opened);
  const noteTabs = (await tabIds(page)).filter(id => id.startsWith("note:"));
  expect(new Set(noteTabs).size).toBe(noteTabs.length);
});

test("adjacent navigation preserves mixed project and note tabs", async ({ page }) => {
  await page.goto("/");
  await runPalette(page, PROJECT_A);
  await runPalette(page, NOTE_A);
  const beforeIds = await tabIds(page);
  await expect(page.locator(".note-markdown")).toBeVisible();
  await nextLink(page).click();
  // The neighbour is whatever the authoritative order says follows NOTE_A, so
  // publishing a note never rewrites this expectation.
  const afterNoteA = adjacentNotes(NOTE_A.path.replace("/notes/", "")).next!;
  await expect(page.locator(".editor-tab.active")).toHaveText(`${afterNoteA.slug}.md`);
  const afterIds = await tabIds(page);
  // Every tab that was open is still open, in the same order, plus the new one.
  expect(afterIds.slice(0, beforeIds.length)).toEqual(beforeIds);
  expect(afterIds.filter(id => id.startsWith("project:"))).toEqual(beforeIds.filter(id => id.startsWith("project:")));
});

test("browser Back returns to the note the reader came from", async ({ page }) => {
  await page.goto(`/notes/${FIRST_NOTE.slug}`);
  await expect(page.locator(".note-markdown")).toBeVisible();
  await nextLink(page).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/notes/${engineeringNotes[1].slug}`);
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/notes/${FIRST_NOTE.slug}`);
  await expect(page.locator(".editor-tab.active")).toHaveText(`${FIRST_NOTE.slug}.md`);
  await expect(page.getByRole("heading", { name: FIRST_NOTE.title })).toBeVisible();
});

test("adjacent navigation is keyboard operable", async ({ page }) => {
  await page.goto(`/notes/${FIRST_NOTE.slug}`);
  await expect(page.locator(".note-markdown")).toBeVisible();
  await nextLink(page).focus();
  await expect(nextLink(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/notes/${engineeringNotes[1].slug}`);
});

for (const width of [320, 360, 390, 412, 768]) {
  test(`adjacent note navigation fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await page.goto(`/notes/${engineeringNotes[1].slug}`);
    await expect(page.locator(".note-markdown")).toBeVisible();
    await expect(previousLink(page)).toBeVisible();
    await expect(nextLink(page)).toBeVisible();
    for (const link of [previousLink(page), nextLink(page)]) {
      const box = (await link.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      // Comfortable tap target.
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

// ---------------------------------------------------------------------------
// v5.3.0 Vanta — Google reCAPTCHA v3 on contact submission.
//
// Nothing here contacts Google. grecaptcha is stubbed deterministically, and
// the host-mapped tests serve the local preview under the real hostnames so
// exact-hostname site-key selection can be observed in a browser.
// ---------------------------------------------------------------------------

test("site keys are selected by exact hostname and never fall back to production", () => {
  const production = recaptchaSiteKey("osameh.dev");
  const staging = recaptchaSiteKey("staging.osameh.dev");
  expect(production).toBeTruthy();
  expect(staging).toBeTruthy();
  expect(production).not.toBe(staging);
  expect(recaptchaSiteKey("OSAMEH.DEV")).toBe(production);
  for (const host of ["localhost", "127.0.0.1", "www.osameh.dev", "osameh.dev.attacker.example", "staging.osameh.dev.attacker.example", ""]) {
    expect(recaptchaSiteKey(host), `unknown host ${host || "(empty)"}`).toBeNull();
  }
  expect(RECAPTCHA_ACTION).toBe("contact_submit");
});

type RecaptchaBehavior = "token" | "reject" | "empty";

/** Deterministic grecaptcha. Present before app code runs, so no script loads. */
async function stubRecaptcha(page: import("@playwright/test").Page, behavior: RecaptchaBehavior = "token") {
  await page.addInitScript(mode => {
    const calls: { siteKey: string; action: string }[] = [];
    (window as unknown as { __recaptcha: typeof calls }).__recaptcha = calls;
    (window as unknown as { grecaptcha: unknown }).grecaptcha = {
      ready: (callback: () => void) => callback(),
      execute: (siteKey: string, options: { action: string }) => {
        calls.push({ siteKey, action: options.action });
        if (mode === "reject") return Promise.reject(new Error("execute-failed"));
        if (mode === "empty") return Promise.resolve("");
        return Promise.resolve(`token-${calls.length}`);
      },
    };
  }, behavior);
}

const recaptchaCalls = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __recaptcha?: { siteKey: string; action: string }[] }).__recaptcha ?? []);

/**
 * Serves the local preview under a real portfolio hostname.
 *
 * Site-key selection is exact-hostname, so 127.0.0.1 deliberately resolves to
 * no configuration. Mapping the origin is the only way to exercise the
 * configured paths in a browser without shipping a test-only key.
 */
async function gotoAsHost(page: import("@playwright/test").Page, host: string, path = "/contact") {
  await page.route(`https://${host}/**`, async route => {
    const url = new URL(route.request().url());
    // The service worker only registers over HTTPS; keep it out of the test.
    if (url.pathname === "/sw.js") return route.fulfill({ status: 404, body: "" });
    // API stubs are registered before this handler, and the last registered
    // route wins, so hand /api/* back to them instead of the preview server,
    // which serves no PHP.
    if (url.pathname.startsWith("/api/")) return route.fallback();
    const response = await route.fetch({ url: `http://127.0.0.1:4173${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  await page.goto(`https://${host}${path}`);
}

async function fillContactForm(page: import("@playwright/test").Page) {
  const form = page.locator(".contact-form");
  await form.locator('input[name="name"]').fill("Regression Tester");
  await form.locator('input[name="email"]').fill("tester@example.com");
  await form.locator('input[name="subject"]').fill("Automated regression");
  await form.locator('textarea[name="message"]').fill("This is a deterministic regression message with more than twenty characters.");
  return form;
}

/** Captures contact POSTs and answers them without touching the real endpoint. */
async function captureContactPosts(page: import("@playwright/test").Page, respond: { status?: number; body?: Record<string, unknown> } = {}) {
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/contact", async route => {
    if (route.request().method() !== "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, csrf: "a".repeat(48) }) });
    }
    posts.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({
      status: respond.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(respond.body ?? { success: true, message: "Message sent." }),
    });
  });
  return posts;
}

for (const [host, label] of [["osameh.dev", "production"], ["staging.osameh.dev", "staging"]] as const) {
  test(`the ${label} host loads reCAPTCHA with its own site key`, async ({ page }) => {
    const requested: string[] = [];
    await page.route("https://www.google.com/recaptcha/**", async route => {
      requested.push(route.request().url());
      // Stand in for Google's api.js without contacting it.
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "window.grecaptcha={ready:cb=>cb(),execute:()=>Promise.resolve('stub-token')};",
      });
    });
    await gotoAsHost(page, host);
    const form = page.locator(".contact-form");
    await expect(form).toBeVisible();
    // Nothing third-party before the visitor touches the form.
    expect(requested).toEqual([]);
    await form.locator('input[name="name"]').focus();
    await expect.poll(() => requested.length).toBeGreaterThan(0);
    expect(requested[0]).toContain(`render=${recaptchaSiteKey(host)}`);
    const otherHost = host === "osameh.dev" ? "staging.osameh.dev" : "osameh.dev";
    expect(requested[0]).not.toContain(recaptchaSiteKey(otherHost)!);
  });
}

test("an unknown host refuses to submit rather than using the production key", async ({ page }) => {
  await stubRecaptcha(page);
  const posts = await captureContactPosts(page);
  await page.goto("/contact");
  const form = await fillContactForm(page);
  await form.locator('button[type="submit"]').click();
  await expect(form.locator(".form-message.error")).toContainText(/not configured/i);
  expect(await recaptchaCalls(page)).toEqual([]);
  expect(posts).toEqual([]);
});

test("a token is generated at submission time with the contact_submit action", async ({ page }) => {
  await stubRecaptcha(page);
  const posts = await captureContactPosts(page);
  await gotoAsHost(page, "staging.osameh.dev");
  const form = await fillContactForm(page);
  // Filling the form must not spend a token.
  expect(await recaptchaCalls(page)).toEqual([]);
  await form.locator('button[type="submit"]').click();
  await expect(form.locator(".form-message.success")).toBeVisible();
  const calls = await recaptchaCalls(page);
  expect(calls).toHaveLength(1);
  expect(calls[0].action).toBe("contact_submit");
  expect(calls[0].siteKey).toBe(recaptchaSiteKey("staging.osameh.dev"));
  expect(posts).toHaveLength(1);
  expect(posts[0].recaptchaToken).toBe("token-1");
});

test("a failed token execution blocks the submission and stays retryable", async ({ page }) => {
  await stubRecaptcha(page, "reject");
  const posts = await captureContactPosts(page);
  await gotoAsHost(page, "staging.osameh.dev");
  const form = await fillContactForm(page);
  await form.locator('button[type="submit"]').click();
  await expect(form.locator(".form-message.error")).toContainText("Verification could not be completed.");
  expect(posts).toEqual([]);
  // Retryable: the button is live again and the fields are intact.
  await expect(form.locator('button[type="submit"]')).toBeEnabled();
  await expect(form.locator('input[name="email"]')).toHaveValue("tester@example.com");
});

test("an empty token blocks the submission", async ({ page }) => {
  await stubRecaptcha(page, "empty");
  const posts = await captureContactPosts(page);
  await gotoAsHost(page, "staging.osameh.dev");
  const form = await fillContactForm(page);
  await form.locator('button[type="submit"]').click();
  await expect(form.locator(".form-message.error")).toContainText("Verification could not be completed.");
  expect(posts).toEqual([]);
});

test("a rejected verification is reported without exposing any score", async ({ page }) => {
  await stubRecaptcha(page);
  await captureContactPosts(page, { status: 403, body: { success: false, message: "Verification could not be completed. Please try again." } });
  await gotoAsHost(page, "staging.osameh.dev");
  const form = await fillContactForm(page);
  await form.locator('button[type="submit"]').click();
  const message = form.locator(".form-message.error");
  await expect(message).toContainText("Verification could not be completed.");
  await expect(message).not.toContainText(/score/i);
  await expect(message).not.toContainText(/0\.\d/);
});

test("only one submission is in flight at a time", async ({ page }) => {
  await stubRecaptcha(page);
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/contact", async route => {
    if (route.request().method() !== "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, csrf: "a".repeat(48) }) });
    }
    posts.push(JSON.parse(route.request().postData() || "{}"));
    await new Promise(resolve => setTimeout(resolve, 900));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, message: "Message sent." }) });
  });
  await gotoAsHost(page, "staging.osameh.dev");
  const form = await fillContactForm(page);
  const submitButton = form.locator('button[type="submit"]');
  await submitButton.click();
  await expect(submitButton).toBeDisabled();
  // A second activation while pending must not start another verification.
  await form.locator('textarea[name="message"]').press("Enter");
  await page.evaluate(() => (document.querySelector(".contact-form") as HTMLFormElement).requestSubmit());
  await expect(form.locator(".form-message.success")).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(await recaptchaCalls(page)).toHaveLength(1);
});

test("a retry after a failure requests a brand new token", async ({ page }) => {
  await stubRecaptcha(page);
  let attempt = 0;
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/contact", async route => {
    if (route.request().method() !== "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, csrf: "a".repeat(48) }) });
    }
    posts.push(JSON.parse(route.request().postData() || "{}"));
    attempt += 1;
    await route.fulfill({
      status: attempt === 1 ? 403 : 200,
      contentType: "application/json",
      body: JSON.stringify(attempt === 1
        ? { success: false, message: "Verification could not be completed. Please try again." }
        : { success: true, message: "Message sent." }),
    });
  });
  await gotoAsHost(page, "staging.osameh.dev");
  const form = await fillContactForm(page);
  await form.locator('button[type="submit"]').click();
  await expect(form.locator(".form-message.error")).toBeVisible();
  await form.locator('button[type="submit"]').click();
  await expect(form.locator(".form-message.success")).toBeVisible();
  expect(posts).toHaveLength(2);
  // A token is never replayed.
  expect(posts[0].recaptchaToken).toBe("token-1");
  expect(posts[1].recaptchaToken).toBe("token-2");
});

test("the reCAPTCHA disclosure is present and the home page loads no Google script", async ({ page }) => {
  const googleRequests: string[] = [];
  page.on("request", request => { if (/google\.com|gstatic\.com/.test(request.url())) googleRequests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /I build software/i })).toBeVisible();
  expect(googleRequests).toEqual([]);
  const note = page.locator(".contact-recaptcha-note");
  await expect(note).toContainText(/reCAPTCHA/i);
  await expect(note.getByRole("link", { name: /Privacy Policy/i })).toHaveAttribute("href", "https://policies.google.com/privacy");
  await expect(note.getByRole("link", { name: /Terms of Service/i })).toHaveAttribute("href", "https://policies.google.com/terms");
});


// ---------------------------------------------------------------------------
// v5.3.1 Vanta — whole-card navigation.
//
// The card's primary anchor is stretched over the card surface, so clicking the
// body navigates while secondary controls keep their own action. These tests
// assert the behaviour, not the technique.
// ---------------------------------------------------------------------------

/**
 * A point on the card's own surface that a real click would actually reach.
 *
 * The workspace has sticky top chrome and a fixed status bar, so a card scrolled
 * merely "into view" can still have its heading underneath them. The point is
 * therefore validated with elementFromPoint and the page nudged until the card
 * itself is what sits under the cursor.
 */
async function cardBodyPoint(card: Locator) {
  await card.scrollIntoViewIfNeeded();
  const heading = card.locator("h3").first();
  await heading.waitFor({ state: "visible" });

  for (let attempt = 0; attempt < 6; attempt++) {
    await card.page().waitForTimeout(150);
    const box = (await heading.boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const covered = await card.page().evaluate(({ x, y }) => {
      const at = document.elementFromPoint(x, y);
      if (!at) return "outside";
      return at.closest(".project-card, .note-card, .case-study-card") ? "" : (at.className || at.tagName);
    }, point);
    if (covered === "") return point;
    // Lift the card clear of whatever fixed chrome is covering it.
    await card.page().evaluate(() => window.scrollBy({ top: 160, behavior: "auto" }));
  }
  const box = (await heading.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("clicking a project card body opens the project", async ({ page }) => {
  await page.route("**/api/github**", route => route.abort());
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  const card = page.locator(".project-card").first();
  await expect(card).toBeVisible();

  const link = card.locator("a.card-surface-link");
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/projects\/.+/);

  const before = (await tabIds(page)).length;
  const point = await cardBodyPoint(card);
  await page.mouse.click(point.x, point.y);

  await expect.poll(() => new URL(page.url()).pathname).toBe(href);
  expect((await tabIds(page)).length).toBe(before + 1);
  await expect(page.locator(".editor-tab.active")).toHaveText(`${href!.split("/").pop()}.md`);
});

test("a project card never opens twice", async ({ page }) => {
  await page.route("**/api/github**", route => route.abort());
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  const card = page.locator(".project-card").first();
  const href = (await card.locator("a.card-surface-link").getAttribute("href"))!;
  await page.mouse.click(...Object.values(await cardBodyPoint(card)) as [number, number]);
  await expect.poll(() => new URL(page.url()).pathname).toBe(href);
  const opened = (await tabIds(page)).length;

  await page.goBack();
  await expect(page.locator(".project-card").first()).toBeVisible();
  await page.mouse.click(...Object.values(await cardBodyPoint(page.locator(".project-card").first())) as [number, number]);
  await expect.poll(() => new URL(page.url()).pathname).toBe(href);
  expect((await tabIds(page)).length).toBe(opened);
});

test("a project card secondary action does not navigate", async ({ page }) => {
  await page.route("**/api/github**", route => route.abort());
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  const card = page.locator(".project-card").first();
  await expect(card).toBeVisible();
  const compare = card.locator(".compare-chip");
  await compare.click();
  await expect(compare).toHaveAttribute("aria-pressed", "true");
  // Still on the projects route: Compare selected, nothing navigated.
  expect(new URL(page.url()).pathname).toBe("/projects");
  expect((await tabIds(page)).filter(id => id.startsWith("project:"))).toEqual([]);
});

test("clicking a note card body opens the note", async ({ page }) => {
  await page.goto("/notes");
  const card = page.locator(".note-card").first();
  await expect(card).toBeVisible();
  const href = (await card.locator("a.card-surface-link").getAttribute("href"))!;
  expect(href).toBe(`/notes/${engineeringNotes[0].slug}`);
  await page.mouse.click(...Object.values(await cardBodyPoint(card)) as [number, number]);
  await expect.poll(() => new URL(page.url()).pathname).toBe(href);
  await expect(page.locator(".editor-tab.active")).toHaveText(`${engineeringNotes[0].slug}.md`);
});

test("clicking a case study card body opens the case study", async ({ page }) => {
  await page.goto("/case-studies");
  const card = page.locator(".case-study-card").first();
  await expect(card).toBeVisible();
  const href = (await card.locator("a.card-surface-link").getAttribute("href"))!;
  expect(href).toMatch(/^\/case-studies\/.+/);
  await page.mouse.click(...Object.values(await cardBodyPoint(card)) as [number, number]);
  await expect.poll(() => new URL(page.url()).pathname).toBe(href);
  await expect(page.locator(".case-study-modal")).toBeVisible();
});

test("card primary links are real anchors and keyboard operable", async ({ page }) => {
  await page.route("**/api/github**", route => route.abort());
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  const link = page.locator(".project-card").first().locator("a.card-surface-link");
  await expect(link).toHaveJSProperty("tagName", "A");
  await expect(link).not.toHaveAttribute("role", "button");
  // No card is itself a button, and no anchor wraps a card.
  expect(await page.locator('article.project-card[role="button"]').count()).toBe(0);
  expect(await page.locator("a article").count()).toBe(0);
  const href = (await link.getAttribute("href"))!;
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => new URL(page.url()).pathname).toBe(href);
});

test("a modified click on a card is left to the browser", async ({ page }) => {
  await page.route("**/api/github**", route => route.abort());
  await page.goto("/projects", { waitUntil: "domcontentloaded" });
  const card = page.locator(".project-card").first();
  await expect(card.locator("a.card-surface-link")).toHaveAttribute("href", /^\/projects\/.+/);

  // Asserted at the event level rather than by driving a real modified click,
  // because whether Chromium opens a background tab is the browser's business.
  // Ours is only this: a plain click is taken over by the SPA, and a modified
  // click is not touched, so the browser's own link handling still applies.
  const outcome = await page.evaluate(() => {
    const link = document.querySelector(".project-card a.card-surface-link") as HTMLAnchorElement;
    const fire = (init: MouseEventInit) => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...init });
      link.dispatchEvent(event);
      return event.defaultPrevented;
    };
    return { modified: fire({ ctrlKey: true }), meta: fire({ metaKey: true }), middle: fire({ button: 1 }) };
  });
  expect(outcome.modified, "ctrl+click must not be intercepted").toBe(false);
  expect(outcome.meta, "cmd+click must not be intercepted").toBe(false);
  expect(outcome.middle, "middle click must not be intercepted").toBe(false);
  // None of those navigated the SPA.
  expect(new URL(page.url()).pathname).toBe("/projects");
});

for (const width of [320, 360, 390, 412, 768]) {
  test(`project card navigation stays usable at ${width}px`, async ({ page }) => {
    await page.route("**/api/github**", route => route.abort());
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/projects", { waitUntil: "domcontentloaded" });
    const card = page.locator(".project-card").first();
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    // The secondary control remains a comfortable target above the overlay.
    const compare = card.locator(".compare-chip");
    const compareBox = (await compare.boundingBox())!;
    expect(compareBox.height).toBeGreaterThanOrEqual(24);
    await compare.click();
    await expect(compare).toHaveAttribute("aria-pressed", "true");
    expect(new URL(page.url()).pathname).toBe("/projects");
  });
}

// ---------------------------------------------------------------------------
// v5.3.1 Vanta — search discovery readiness.
//
// Google's indexed snapshot of this domain predates the portfolio. These assert
// the mechanics on our side; nothing here contacts Google or Search Console.
// ---------------------------------------------------------------------------

test("the homepage declares a stable crawlable favicon and current metadata", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Osameh Irandoust/);

  const declarations = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="icon"]')].map(node => ({
      href: node.getAttribute("href") || "",
      sizes: node.getAttribute("sizes") || "",
    })));
  expect(declarations.some(item => item.href === "/favicon.ico")).toBe(true);
  expect(declarations.some(item => item.href === "/favicon-48x48.png")).toBe(true);
  // A hashed asset URL changes every build and cannot be a stable search favicon.
  expect(declarations.every(item => !item.href.includes("/assets/"))).toBe(true);

  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical).toBe("https://osameh.dev/");

  const body = await page.content();
  for (const legacy of ["Secured Home of osameh.dev", "private_html", "upload a new index.html"]) {
    expect(body, `legacy placeholder: ${legacy}`).not.toContain(legacy);
  }
});

test("the favicon assets are served as images, not the SPA shell", async ({ request }) => {
  for (const [path, type] of [["/favicon.ico", /image\/(x-icon|vnd\.microsoft\.icon|ico)/], ["/favicon-48x48.png", /image\/png/]] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"] || "", path).toMatch(type);
    const body = await response.body();
    expect(body.length, path).toBeGreaterThan(500);
    expect(body.subarray(0, 20).toString("utf8"), path).not.toContain("<!doctype");
  }
});

test("project, note and case study destinations are crawlable from the rendered page", async ({ page }) => {
  await page.route("**/api/github**", route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".project-card").first()).toBeVisible();

  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")].map(node => node.getAttribute("href") || ""));
  expect(hrefs.some(href => href.startsWith("/projects/"))).toBe(true);
  expect(hrefs.some(href => href.startsWith("/notes/"))).toBe(true);
  expect(hrefs.some(href => href.startsWith("/case-studies/"))).toBe(true);
});


// ---------------------------------------------------------------------------
// v5.3.2 Vanta — default portfolio presentation language.
//
// This is the File-menu language selector, not a claim about how the site is
// built. A fresh visitor sees C++; an explicit stored choice always wins.
// ---------------------------------------------------------------------------

const homeTab = (page: import("@playwright/test").Page) => page.locator(".editor-tab").first();

test("a fresh session presents the workspace in C++", async ({ page }) => {
  await page.goto("/");
  await expect(homeTab(page)).toHaveText("main.cpp");
  await expect(page.locator(".showcase-stack-context code")).toHaveText("main.cpp");
  await expect(page.locator(".showcase-card-stack header span")).toContainText("C++");
  expect(await page.evaluate(() => localStorage.getItem("portfolio-language"))).toBe("cpp");
});

test("an explicit saved language survives a reload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("portfolio-language", "typescript"));
  await page.goto("/");
  await expect(homeTab(page)).toHaveText("home.tsx");
  await expect(page.locator(".showcase-card-stack header span")).toContainText("TypeScript");
  await page.reload();
  await expect(homeTab(page)).toHaveText("home.tsx");
  // The default must not have overwritten the stored choice.
  expect(await page.evaluate(() => localStorage.getItem("portfolio-language"))).toBe("typescript");
});

test("an unusable saved language falls back to C++", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("portfolio-language", "brainfuck"));
  await page.goto("/");
  await expect(homeTab(page)).toHaveText("main.cpp");
  await expect(page.locator(".showcase-card-stack header span")).toContainText("C++");
});

test("every language-aware surface follows one selection", async ({ page }) => {
  await page.goto("/");
  const languageFor = async () => page.evaluate(() => ({
    tab: (document.querySelector(".editor-tab") as HTMLElement | null)?.textContent?.trim() || "",
    explorer: [...document.querySelectorAll(".explorer .file")].map(node => node.textContent?.trim() || "")[0] || "",
    stack: (document.querySelector(".showcase-stack-context code") as HTMLElement | null)?.textContent?.trim() || "",
    lens: (document.querySelector(".showcase-card-stack header span") as HTMLElement | null)?.textContent?.trim() || "",
  }));

  const cpp = await languageFor();
  expect(cpp.tab).toBe("main.cpp");
  expect(cpp.explorer).toBe("main.cpp");
  expect(cpp.stack).toBe("main.cpp");
  expect(cpp.lens).toContain("C++");

  // Switching still works, and every surface moves together.
  await page.evaluate(() => localStorage.setItem("portfolio-language", "go"));
  await page.reload();
  const go = await languageFor();
  expect(go.tab).toBe("main.go");
  expect(go.explorer).toBe("main.go");
  expect(go.stack).toBe("main.go");
  expect(go.lens).toContain("Go");

  // And back to the default when the preference is cleared.
  await page.evaluate(() => localStorage.removeItem("portfolio-language"));
  await page.reload();
  await expect(homeTab(page)).toHaveText("main.cpp");
});

// ---- v5.3.3 Vanta: branded HTTP error documents ----
//
// These are the server's fallback documents, served by Apache through
// ErrorDocument. The preview server used here is static, so the live status
// codes belong to staging/production acceptance; what is provable in a browser
// is the document itself: its identity, its independence from the application
// runtime, and its layout.

test("every branded error document carries its own status identity", async ({ page }) => {
  for (const { status, reason } of ERROR_STATUSES) {
    await page.goto(`/errors/${status}.html`);
    await expect(page.locator("h1 .status")).toHaveText(String(status));
    await expect(page.locator("h1 .reason")).toHaveText(reason);
    await expect(page.locator(".tab")).toHaveText(`error_${status}.cpp`);
    await expect(page).toHaveTitle(`${status} — ${reason} | osameh.dev`);
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toBe("noindex,nofollow,noarchive");
  }
});

test("an error document renders without the application runtime", async ({ page }) => {
  const bundleRequests: string[] = [];
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/assets/") || path.endsWith(".js")) bundleRequests.push(path);
  });
  await page.goto("/errors/403.html");

  // No script of any kind: no bundle, no inline handler, no javascript: URL.
  expect(await page.locator("script").count()).toBe(0);
  expect(bundleRequests).toEqual([]);
  expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);

  // The shared stylesheet is a real request that actually applied.
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  const tabBorder = await page.evaluate(() => getComputedStyle(document.querySelector(".tab")!).borderTopWidth);
  expect(tabBorder).toBe("2px");
});

test("an error document offers real recovery links", async ({ page }) => {
  await page.goto("/errors/403.html");
  const home = page.getByRole("link", { name: "Go Home" });
  const portfolio = page.getByRole("link", { name: "Back to Portfolio" });
  await expect(home).toHaveAttribute("href", "/");
  await expect(portfolio).toHaveAttribute("href", "/projects");

  // Keyboard operable with a visible focus ring, and a comfortable target.
  await home.focus();
  await expect(home).toBeFocused();
  const outline = await home.evaluate(element => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
  const box = await home.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  await home.click();
  await expect(page).toHaveURL(/\/$/);
});

for (const width of [320, 360, 390, 412, 768]) {
  test(`the error document has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/errors/500.html");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.locator("h1 .status")).toBeVisible();
  });
}

// ---- v5.3.4 Vanta: mobile Note TOC bleed ----
//
// Below 720px the sticky TOC rail cancels the reading layout's 18px side
// padding with negative margins so it spans the viewport. An inherited
// max-width:100% used to resolve against the padded containing block, which
// over-constrained the box: the negative left margin was honoured, the width
// was clamped 36px short, and the browser recomputed the right margin away.
// The result was a rail flush left and inset 36px on the right.

for (const width of [320, 360, 390, 412, 600, 719]) {
  test(`the note TOC rail spans the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/notes/repository-driven-portfolio");
    await page.waitForSelector(".note-toc button");

    const rail = await page.evaluate(() => {
      const toc = document.querySelector(".note-toc")!.getBoundingClientRect();
      return { left: toc.left, right: toc.right, viewport: document.documentElement.clientWidth };
    });

    expect(rail.left).toBeLessThanOrEqual(0.5);
    expect(rail.viewport - rail.right).toBeLessThanOrEqual(0.5);

    // Full bleed must not come at the cost of a horizontally scrolling page.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

// ---- v5.4.0 Phantom: accessibility regressions ----
//
// The Phantom audit established that computed-CSS contrast checks both miss real
// failures and invent false ones: one element computed at 2.49:1 measured 11.75:1
// once the actual pixels were read, because the walker never saw the background
// that was really painted. These tests therefore screenshot each element and
// measure what was rendered. They assert a contrast outcome, not a declaration,
// so they survive any refactor that keeps the result readable.

/** Best-case contrast present in an element's rendered pixels. */
async function renderedContrast(page: import("@playwright/test").Page, selector: string) {
  const target = page.locator(selector).first();
  await expect(target, `contrast target ${selector}`).toBeVisible({ timeout: 10_000 });
  // An element far down the page can screenshot as a uniform blank, which reads
  // as a contrast of exactly 1 and would fail for a reason that has nothing to
  // do with colour. Bring it into view and let layout settle first.
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const shot = await target.screenshot();
  return page.evaluate(async (dataUrl: string) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const luminance = (r: number, g: number, b: number) => {
      const [rr, gg, bb] = [r, g, b].map(channel => {
        const value = channel / 255;
        return value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return .2126 * rr + .7152 * gg + .0722 * bb;
    };
    let min = 1, max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const value = luminance(data[i], data[i + 1], data[i + 2]);
      if (value < min) min = value;
      if (value > max) max = value;
    }
    return (max + .05) / (min + .05);
  }, `data:image/png;base64,${shot.toString("base64")}`);
}

// Each entry failed AA in the Phantom audit at the ratio noted.
const LIGHT_CONTRAST_TARGETS: [string, number, string][] = [
  [".now-grid article p", 4.5, "Now section body copy (was 2.38)"],
  [".changelog-node.active .changelog-node-content small", 4.5, "LATEST badge (was 1.39)"],
  [".explorer-title", 4.5, "EXPLORER heading (was 1.98)"],
  [".stack-explorer > span", 4.5, "Explore by stack (was 2.68)"],
  [".explorer-footer button", 4.5, "OUTLINE (was 2.83)"],
  [".explorer-plugins-title", 4.5, "PORTFOLIO PLUGINS (was 2.83)"],
  [".line-nums", 4.5, "line numbers (was 2.99)"],
  [".vertical-name", 4.5, "vertical wordmark (was 3.83)"],
];

const DARK_CONTRAST_TARGETS: [string, number, string][] = [
  [".code-close span", 4.5, "based in Tehran (was 3.52)"],
  [".changelog-node-pending", 4.5, "older releases (was 3.53)"],
  [".showcase-card-primary header span", 4.5, "Live focus (was 3.31)"],
  [".showcase-stack-context span", 4.5, "language selector copy (was 3.08)"],
  [".line-nums", 4.5, "line numbers (was 1.69)"],
];

for (const [theme, targets] of [["light", LIGHT_CONTRAST_TARGETS], ["dark", DARK_CONTRAST_TARGETS]] as const) {
  test(`${theme} theme meets AA contrast in rendered pixels`, async ({ page }) => {
    await page.addInitScript(themeName => localStorage.setItem("portfolio-theme", themeName), theme);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const [selector, minimum, label] of targets) {
      expect(await renderedContrast(page, selector), `${label} — ${selector}`).toBeGreaterThanOrEqual(minimum);
    }
  });
}

// Only controls that perform an action. Informational labels are excluded on
// purpose: padding a label to 44px would be bloat, not accessibility.
test("interactive controls meet the touch-target floor at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const hitBox = (selector: string) => page.locator(selector).first().evaluate(element => {
    const own = element.getBoundingClientRect();
    // A control may keep compact chrome while an ::after overlay carries the
    // real target, so the effective area is the union of both.
    const after = getComputedStyle(element, "::after");
    const inset = (value: string) => Math.abs(parseFloat(value) || 0);
    const grownX = after.content !== "none" ? inset(after.left) + inset(after.right) : 0;
    const grownY = after.content !== "none" ? inset(after.top) + inset(after.bottom) : 0;
    return { width: own.width + grownX, height: own.height + grownY };
  });

  const menu = await hitBox(".menu-button");
  expect(menu.width, "mobile menu width").toBeGreaterThanOrEqual(44);
  expect(menu.height, "mobile menu height").toBeGreaterThanOrEqual(44);

  await page.goto("/notes/repository-driven-portfolio");
  await expect(page.locator(".editor-tab.project-tab .editor-tab-close").first()).toBeVisible();
  const close = await hitBox(".editor-tab.project-tab .editor-tab-close");
  expect(close.width, "tab close width").toBeGreaterThanOrEqual(26);
  expect(close.height, "tab close height").toBeGreaterThanOrEqual(26);
});

// A coarse pointer is the case the 44px floor exists for, so it is asserted in a
// real touch context rather than inferred from the desktop box. The overlay is a
// pseudo-element, so the effective target is the control plus its negative insets.
test.describe("coarse pointer", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 } });

  test("the editor tab close offers a 44px touch target without growing the tab row", async ({ page }) => {
    await page.goto("/notes");
    await page.locator('a[href^="/notes/"]').first().click();
    await page.waitForSelector(".editor-tab-close");

    const measured = await page.evaluate(() => {
      const element = document.querySelector(".editor-tab-close")!;
      const box = element.getBoundingClientRect();
      const after = getComputedStyle(element, "::after");
      const inset = (value: string) => -(parseFloat(value) || 0);
      const present = after.content && after.content !== "none";
      const grow = present
        ? { top: inset(after.top), right: inset(after.right), bottom: inset(after.bottom), left: inset(after.left) }
        : { top: 0, right: 0, bottom: 0, left: 0 };
      return {
        coarse: matchMedia("(pointer: coarse)").matches,
        width: box.width + grow.left + grow.right,
        height: box.height + grow.top + grow.bottom,
        visualWidth: box.width,
        tabRowHeight: document.querySelector(".tabs-row")!.getBoundingClientRect().height,
      };
    });

    expect(measured.coarse, "test context is a coarse pointer").toBe(true);
    expect(measured.width, "effective touch width").toBeGreaterThanOrEqual(44);
    expect(measured.height, "effective touch height").toBeGreaterThanOrEqual(44);
    // The icon and the tab strip must not have grown to achieve it.
    expect(measured.visualWidth, "visual close icon stays compact").toBeLessThanOrEqual(28);
    expect(measured.tabRowHeight, "tab row height unchanged").toBeLessThanOrEqual(37);
  });
});

test("an editor tab can be closed with the keyboard alone", async ({ page }) => {
  await page.goto("/notes");
  await page.locator('a[href^="/notes/"]').first().click();
  await expect(page.locator(".editor-tab.project-tab")).toHaveCount(1);

  const closeButton = page.locator(".editor-tab.project-tab .editor-tab-close").first();
  // A real button: reachable, focusable, and operable without a pointer.
  await expect(closeButton).toHaveJSProperty("tagName", "BUTTON");
  await closeButton.focus();
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator(".editor-tab.project-tab")).toHaveCount(0);
  await expect(page.locator(".editor-tab.active")).toHaveText("main.cpp");
});

test("the Home tab exposes no close control", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".editor-tab").first()).toBeVisible();
  expect(await page.locator(".editor-tab").first().locator(".editor-tab-close").count()).toBe(0);
});

// ---- v5.5.0 Null: zero dead ends ----

// Alias resolution is pure, so it is asserted directly rather than through the UI.
test("technology aliases resolve to canonical keys", () => {
  const cases: [string, string[]][] = [
    ["android", ["android"]], ["Android", ["android"]], ["Android SDK", ["android"]],
    ["Android Studio", ["android"]], ["android-app", ["android"]], ["android-application", ["android"]],
    ["C#", ["csharp"]], ["C# 12", ["csharp"]], ["csharp", ["csharp"]],
    [".NET 8", ["dotnet"]], [".NET 9", ["dotnet"]], ["dotnet CLI", ["dotnet"]],
    ["Nuxt", ["nuxt"]], ["Nuxt 3", ["nuxt"]], ["Nuxt 4", ["nuxt"]], ["nuxt3", ["nuxt"]], ["nuxtjs", ["nuxt"]],
    ["Vue", ["vue"]], ["Vue 3", ["vue"]], ["Vue 3.5", ["vue"]], ["vue3", ["vue"]], ["vuejs", ["vue"]],
    ["PostgreSQL", ["postgresql"]], ["Postgres", ["postgresql"]],
    ["Qt", ["qt"]], ["QML", ["qml"]],
  ];
  for (const [input, expected] of cases) {
    expect(canonicalKeys(input), `${input} should resolve to ${expected.join("+")}`).toEqual(expected);
  }

  // Related but distinct technologies must never be collapsed into one.
  expect(canonicalKeys("C# / .NET"), "C# / .NET names two technologies").toEqual(["csharp", "dotnet"]);
  expect(canonicalKeys("Qt / QML"), "Qt / QML names two technologies").toEqual(["qt", "qml"]);
  expect(canonicalKeys("Nuxt/Vue"), "Nuxt/Vue names two technologies").toEqual(["nuxt", "vue"]);
  expect(canonicalKeys("csharp")).not.toEqual(canonicalKeys(".NET 8"));

  // A descriptive concept is not a technology and resolves to nothing.
  expect(canonicalKeys("Repository-driven portfolio")).toEqual([]);

  // Labels stay human-readable regardless of the key.
  expect(technologyLabel("dotnet")).toBe(".NET");
  expect(technologyLabel("csharp")).toBe("C#");
});

test("the palette exposes one filter command per technology", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+Shift+P");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.type("Filter projects by");
  await page.waitForTimeout(700);

  const labels: string[] = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] [role="option"], [role="dialog"] li, [role="dialog"] button')]
    .map(node => (node.textContent || "").replace(/\s+/g, " ").trim())
    .filter(text => /^Filter projects by /.test(text))
    .map(text => text.replace(/^Filter projects by /, "").replace(/technology$/, "").trim()));

  expect(labels.length, "filter commands exist").toBeGreaterThan(0);
  expect(new Set(labels).size, "no duplicated technology filter").toBe(labels.length);
  // The alias explosion that produced six Android entries must not return.
  const androidish = labels.filter(label => /android/i.test(label));
  expect(androidish.length, `one Android filter, saw ${androidish.join(" / ")}`).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
});

test("a filter that matches nothing explains itself and can be cleared", async ({ page }) => {
  await page.goto("/projects");
  const search = page.locator('input[aria-label="Search projects"]').first();
  await search.fill("zzzq-no-project-matches-this");
  await expect(page.locator(".project-empty")).toBeVisible();
  await expect(page.locator(".project-empty")).toContainText(/no project matches/i);
  expect(await page.locator(".project-card").count()).toBe(0);

  await page.locator(".project-empty button").click();
  await expect(page.locator(".project-empty")).toHaveCount(0);
  expect(await page.locator(".project-card").count()).toBeGreaterThan(0);
  await expect(search).toHaveValue("");
});

for (const width of [320, 390]) {
  test(`the zero-result state does not overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/projects");
    await page.locator('input[aria-label="Search projects"]').first().fill("zzzq-no-project-matches-this");
    await expect(page.locator(".project-empty")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("the project filter lives in the URL and survives Back and Forward", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForSelector(".project-card");
  const total = await page.locator(".project-card").count();

  await page.locator(".stack-explorer button", { hasText: "Vue" }).first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get("stack")).toBe("vue");
  const filtered = await page.locator(".project-card").count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(total);

  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("stack")).toBe(null);
  await expect.poll(() => page.locator(".project-card").count()).toBe(total);

  await page.goForward();
  await expect.poll(() => new URL(page.url()).searchParams.get("stack")).toBe("vue");
  await expect.poll(() => page.locator(".project-card").count()).toBe(filtered);
});

test("a filtered URL opened directly restores its filter", async ({ page }) => {
  await page.goto("/projects?stack=vue");
  await page.waitForSelector(".project-card");
  await expect.poll(() => page.locator("select[aria-label='Filter by technology']").first().inputValue()).toBe("vue");
  expect(await page.locator(".project-card").count()).toBeGreaterThan(0);
  // An alias must never appear in the address; only the canonical key.
  expect(new URL(page.url()).searchParams.get("stack")).toBe("vue");
});

test("every public-repo skill claim resolves to a real project", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForSelector(".project-card");

  const available: string[] = await page.evaluate(() => [...document.querySelectorAll("select[aria-label='Filter by technology'] option")]
    .map(option => (option as HTMLOptionElement).value)
    .filter(value => value !== "all"));

  for (const skill of skillCatalog.filter(item => item.evidence.includes("public-repo"))) {
    expect(available, `${skill.label} claims public-repo evidence`).toContain(skill.key);
  }
  // A skill with no public project must not pretend to have one.
  const professionalOnly = skillCatalog.filter(item => !item.evidence.includes("public-repo"));
  expect(professionalOnly.length, "some skills are professional-only").toBeGreaterThan(0);
  for (const skill of professionalOnly) {
    expect(available, `${skill.label} must not claim public-repo evidence`).not.toContain(skill.key);
  }
});

test("professional-only skills render as text, not as project links", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.waitForSelector(".skill-card");

  const cpp = page.locator(".skill-chip", { hasText: "C++" }).first();
  await expect(cpp).toBeVisible();
  await expect(cpp).toHaveJSProperty("tagName", "SPAN");
  await expect(cpp).toContainText("Professional");

  const typescript = page.locator("button.skill-chip-linked", { hasText: "TypeScript" }).first();
  await expect(typescript).toBeVisible();
  await expect(typescript).toContainText("Public work");
});

test("continue exploring offers deterministic, valid destinations", async ({ page }) => {
  await page.goto("/notes/repository-driven-portfolio");
  const block = page.locator(".continue-exploring");
  await expect(block).toBeVisible();

  const links = block.locator("a.continue-exploring-link");
  const count = await links.count();
  expect(count, "at least one suggestion").toBeGreaterThan(0);
  expect(count, "at most three suggestions").toBeLessThanOrEqual(3);

  // The note names osameh.dev explicitly, so the explicit relation ranks first.
  await expect(links.first()).toHaveAttribute("href", "/projects/osameh.dev");
  await expect(links.first()).toContainText("This note is about it");

  // Ordering is stable across reloads: no randomness, no personalization.
  // Compared by href, which is the stable identity - a project title is read
  // from repository metadata and legitimately changes once that arrives.
  const hrefs = async () => page.locator(".continue-exploring a.continue-exploring-link").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
  const before = await hrefs();
  await page.reload();
  await expect(page.locator(".continue-exploring a.continue-exploring-link").first()).toBeVisible();
  expect(await hrefs()).toEqual(before);
});

test("a continue exploring link opens through the editor tab lifecycle", async ({ page }) => {
  await page.goto("/notes/repository-driven-portfolio");
  const link = page.locator(".continue-exploring a.continue-exploring-link").first();
  await link.click();

  await expect(page).toHaveURL(/\/projects\/osameh\.dev$/);
  await expect(page.locator(".editor-tab.active")).toContainText("osameh.dev");

  // The lifecycle must not duplicate a tab for content already open.
  const ids = await page.evaluate(() => [...document.querySelectorAll(".editor-tab")].map(tab => (tab as HTMLElement).dataset.tabId || "home"));
  expect(new Set(ids).size, "no duplicate editor tabs").toBe(ids.length);
});

for (const width of [320, 412]) {
  test(`continue exploring stacks without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/notes/repository-driven-portfolio");
    await expect(page.locator(".continue-exploring")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("superseded portfolio claims are gone", () => {
  const metadata = readFileSync(new URL("../../portfolio.json", import.meta.url), "utf8");
  expect(metadata, "the product is English-only").not.toContain("Internationalization architecture");
  expect(metadata, "there is one Command Palette, not a Universal Search").not.toContain("Universal search");
});

// Ranking is proved against a fixed source rather than live content, so the
// priority order stays asserted even as case studies and notes are published.
// The live surfaces are covered separately by the Hirava content tests below.
test("related content ranking is deterministic across every surface", () => {
  const source: RelatedSource = {
    projects: [
      { name: "alpha", title: "Alpha", hint: "Nuxt module", technologies: ["Nuxt 3", "TypeScript"] },
      { name: "beta", title: "Beta", hint: "Android app", technologies: ["Kotlin", "android-app"] },
      { name: "gamma", title: "Gamma", hint: "Desktop", technologies: ["C# 12", "WPF"] },
    ],
    notes: [
      { slug: "note-a", title: "Note A", hint: "Engineering note", tags: ["Nuxt"], relatedProjects: ["alpha"] },
      { slug: "note-b", title: "Note B", hint: "Engineering note", tags: ["Nuxt"] },
      { slug: "note-c", title: "Note C", hint: "Engineering note", tags: ["Cassandra"] },
    ],
    caseStudies: [
      { id: "client-x", title: "Client X", hint: "Client case study", stack: ["Kotlin"], relatedProjects: ["beta"], relatedNotes: ["note-c"] },
    ],
  };

  // A client case study: explicit relations outrank a shared technology, and the
  // block never exceeds three items.
  const caseStudy = relatedToCaseStudy("client-x", source);
  expect(caseStudy.length).toBeLessThanOrEqual(3);
  expect(caseStudy[0].href).toBe("/projects/beta");
  expect(caseStudy[0].reason).toBe("Built for this engagement");
  expect(caseStudy.map(item => item.href)).toContain("/notes/note-c");

  // A note: the project it explicitly names ranks above a note sharing a tag.
  const note = relatedToNote("note-a", source, "note-b");
  expect(note[0].href).toBe("/projects/alpha");
  expect(note[0].reason).toBe("This note is about it");

  // A project: the note written about it outranks a project sharing a technology.
  const project = relatedToProject("alpha", source);
  expect(project[0].href).toBe("/notes/note-a");
  expect(project[0].reason).toBe("Written about this project");

  // Unrelated content is never invented.
  expect(relatedToProject("gamma", source).map(item => item.href)).not.toContain("/notes/note-a");

  // Deterministic: identical input, identical output, every time.
  expect(relatedToCaseStudy("client-x", source)).toEqual(caseStudy);
  expect(relatedToNote("note-a", source, "note-b")).toEqual(note);
});

// The filter has exactly one canonical address. An alias is rewritten to its
// canonical key and an unrecognised value is dropped, on first load and equally
// through history navigation - the two used to disagree, which left the controls
// reading "All technologies" beside an empty result.
test("an alias in the filter URL is rewritten to its canonical key", async ({ page }) => {
  await page.goto("/projects?stack=Android");
  await page.waitForSelector(".project-card, .project-empty");

  await expect.poll(() => new URL(page.url()).searchParams.get("stack")).toBe("android");
  await expect.poll(() => page.locator("select[aria-label='Filter by technology']").first().inputValue()).toBe("android");
  expect(await page.locator(".project-card").count()).toBeGreaterThan(0);
  await expect(page.locator(".project-empty")).toHaveCount(0);
});

test("an unrecognised filter key is dropped rather than shown as a broken state", async ({ page }) => {
  // Uncaught exceptions and script errors only. The preview server runs no PHP,
  // so /api/* resource 404s are an artefact of the environment, not the page.
  const errors: string[] = [];
  page.on("pageerror", error => errors.push("uncaught: " + String(error)));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Failed to load resource/i.test(text)) return;
    errors.push(text);
  });

  await page.goto("/projects?stack=this-does-not-exist");
  await page.waitForSelector(".project-card");

  // The address is cleaned, the full list is shown, and nothing claims to be empty.
  await expect.poll(() => new URL(page.url()).searchParams.get("stack")).toBe(null);
  await expect.poll(() => page.locator("select[aria-label='Filter by technology']").first().inputValue()).toBe("all");
  expect(await page.locator(".project-card").count()).toBeGreaterThan(0);
  await expect(page.locator(".project-empty")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors, "no console or page errors").toEqual([]);
});

test("history navigation resolves the filter key the same way a fresh load does", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForSelector(".project-card");
  const total = await page.locator(".project-card").count();

  // Push an alias directly into history, then come back to it.
  await page.evaluate(() => history.pushState({}, "", "/projects?stack=Android"));
  await page.evaluate(() => history.pushState({}, "", "/projects"));
  await page.goBack();

  // Restored through popstate: canonical key, matching control, real results.
  await expect.poll(() => new URL(page.url()).searchParams.get("stack")).toBe("android");
  await expect.poll(() => page.locator("select[aria-label='Filter by technology']").first().inputValue()).toBe("android");
  const filtered = await page.locator(".project-card").count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThanOrEqual(total);
  await expect(page.locator(".project-empty")).toHaveCount(0);
});

// ---- v5.6.0 Raven: engineering trust & live signals ----

// Provenance is generated at build time, so it is asserted against the
// generated metadata rather than against whatever branch happens to be checked
// out when the test runs.
test("build info links the exact deployed commit", async ({ page }) => {
  await page.goto("/");
  await page.locator(".status-build-button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const link = page.locator(".build-commit-link");
  await expect(link).toBeVisible();

  const href = await link.getAttribute("href");
  const shown = (await link.innerText()).trim();
  const title = await link.getAttribute("title");

  expect(href, "links the public commit page").toBe(`https://github.com/osameh15/osameh.dev/commit/${BUILD_COMMIT}`);
  expect(title, "the full SHA is available on hover").toBe(BUILD_COMMIT);
  expect(shown, "only the short SHA is shown").toContain(BUILD_COMMIT_SHORT!);
  expect(shown.length, "the full SHA is not printed on screen").toBeLessThan(20);
  await expect(link).toHaveAttribute("aria-label", new RegExp(BUILD_COMMIT_SHORT!));

  // The release tag does not exist until after production acceptance, so a
  // release link could only ever be a broken promise.
  expect(await page.getByRole("dialog").locator('a[href*="/releases/tag/"]').count(), "no release link is shipped").toBe(0);
  await page.keyboard.press("Escape");
});

test("the deployed commit link is keyboard reachable", async ({ page }) => {
  await page.goto("/");
  await page.locator(".status-build-button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Reached by real keyboard traversal, because :focus-visible - and therefore
  // the focus ring - is only guaranteed for keyboard-initiated focus.
  let reached = false;
  for (let step = 0; step < 20 && !reached; step++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.classList.contains("build-commit-link") ?? false);
  }
  expect(reached, "the commit link is in the dialog tab order").toBe(true);

  const indicator = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return { outline: style.outlineStyle, width: style.outlineWidth, shadow: style.boxShadow };
  });
  expect(indicator.outline !== "none" || indicator.shadow !== "none", "focus is visible").toBe(true);
  await page.keyboard.press("Escape");
});

test("projects show curated lifecycle, never a date-derived one", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForSelector(".project-card");

  const lifecycles = await page.locator(".project-lifecycle").allInnerTexts();
  // The preview server serves no repository metadata, so a lifecycle is shown
  // only where metadata is available - and never invented when it is not.
  for (const value of lifecycles) {
    // The surrounding .project-type rule renders this uppercase; the value is
    // what matters, not the casing the stylesheet applies.
    expect(["active", "stable", "maintained", "legacy"], `unexpected lifecycle "${value}"`).toContain(value.trim().toLowerCase());
  }

  // Meaning must not be carried by colour alone.
  const cards = await page.locator(".project-card").count();
  expect(cards).toBeGreaterThan(0);
  const withoutMetadata = await page.evaluate(() =>
    [...document.querySelectorAll(".project-card")].filter(card => !card.querySelector(".project-lifecycle")).length);
  expect(withoutMetadata + lifecycles.length).toBe(cards);
});

test("the engineering timeline ranks releases above routine pushes", async ({ page }) => {
  await page.goto("/activity");
  await page.waitForSelector(".activity-entry");

  const entries = await page.evaluate(() => [...document.querySelectorAll(".activity-entry")].map(entry => ({
    source: (entry as HTMLElement).dataset.activitySource,
    type: (entry as HTMLElement).querySelector(".activity-node")?.getAttribute("data-activity-type"),
    date: (entry.querySelector("small")?.textContent || "").trim(),
    href: entry.getAttribute("href"),
  })));

  expect(entries.length).toBeGreaterThan(0);
  expect(entries.length, "the timeline stays compact").toBeLessThanOrEqual(8);

  // Local records are present, and they are not outranked by push noise.
  const firstPush = entries.findIndex(entry => entry.type === "push");
  const firstRelease = entries.findIndex(entry => entry.type === "release");
  if (firstPush !== -1 && firstRelease !== -1) {
    expect(firstRelease, "a release outranks a push on the same day").toBeLessThan(firstPush);
  }
  expect(entries.some(entry => entry.source === "release"), "portfolio releases appear").toBe(true);
  expect(entries.some(entry => entry.source === "note"), "engineering notes appear").toBe(true);

  // Deterministic: the same data always produces the same order.
  const before = entries.map(entry => entry.href ?? entry.date);
  await page.reload();
  await page.waitForSelector(".activity-entry");
  const after = await page.evaluate(() => [...document.querySelectorAll(".activity-entry")].map(entry => entry.getAttribute("href") ?? (entry.querySelector("small")?.textContent || "").trim()));
  expect(after).toEqual(before);
});

test("the timeline survives a GitHub outage", async ({ page }) => {
  await page.route("**/api/github/activity*", route => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  await page.goto("/activity");
  await page.waitForSelector(".activity-entry");

  // Local releases and notes are unaffected by GitHub being unavailable.
  const sources = await page.evaluate(() => [...document.querySelectorAll(".activity-entry")].map(entry => (entry as HTMLElement).dataset.activitySource));
  expect(sources.length, "the timeline is not emptied").toBeGreaterThan(0);
  expect(sources.every(source => source !== "github"), "no GitHub entries remain").toBe(true);
  await expect(page.locator(".activity-degraded")).toBeVisible();
});

test("a timeline note opens through the editor tab lifecycle", async ({ page }) => {
  await page.goto("/activity");
  await page.waitForSelector(".activity-entry");
  const note = page.locator('.activity-entry[data-activity-source="note"]').first();
  const href = await note.getAttribute("href");
  expect(href).toMatch(/^\/notes\//);

  await note.click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  const ids = await page.evaluate(() => [...document.querySelectorAll(".editor-tab")].map(tab => (tab as HTMLElement).dataset.tabId || "home"));
  expect(new Set(ids).size, "no duplicate editor tabs").toBe(ids.length);
});

for (const width of [320, 360, 390, 412]) {
  test(`the engineering timeline stays readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/activity");
    await page.waitForSelector(".activity-entry");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("the source explorer separates an empty tree from an unavailable one", async ({ page }) => {
  // Unavailable: the upstream answered with a fault.
  await page.route("**/api/github/tree/**", route => route.fulfill({ status: 502, contentType: "application/json", body: "{}" }));
  await page.goto("/projects/osameh.dev");
  await page.locator(".source-workbench").scrollIntoViewIfNeeded();
  await expect(page.locator(".source-tree")).toContainText(/currently unavailable/i, { timeout: 20_000 });
  await expect(page.locator(".source-tree")).not.toContainText(/no previewable source files/i);

  // Empty: the upstream answered correctly with nothing to show.
  await page.unroute("**/api/github/tree/**");
  await page.route("**/api/github/tree/**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ repo: "osameh.dev", branch: "main", entryPoints: [], files: [] }),
  }));
  await page.goto("/projects/osameh.dev");
  await page.locator(".source-workbench").scrollIntoViewIfNeeded();
  await expect(page.locator(".source-tree")).toContainText(/no previewable source files/i, { timeout: 20_000 });
});

test("a first service worker installation shows no update toast", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(2500);
  // A first visit has no previous controller, so a controller arriving is an
  // installation rather than an update.
  await expect(page.locator(".action-toast-action")).toHaveCount(0);
});

test("a newer build offers a reload without forcing one", async ({ page }) => {
  await page.goto("/");
  let reloaded = false;
  page.on("framenavigated", () => { reloaded = true; });
  await page.waitForTimeout(1200);
  reloaded = false;

  // Raise the event the service worker registration dispatches when a new
  // controller replaces an existing one.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("portfolio:build-updated")));

  const action = page.locator(".action-toast-action");
  await expect(action).toBeVisible();
  await expect(action).toHaveText(/reload/i);
  await expect(action).toHaveJSProperty("tagName", "BUTTON");

  // It must wait for the visitor rather than reloading on its own.
  await page.waitForTimeout(1500);
  expect(reloaded, "no forced refresh").toBe(false);
  await expect(action).toBeVisible();

  await action.focus();
  await expect(action).toBeFocused();
  await action.click();
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator(".action-toast-action")).toHaveCount(0);
});

test("the update toast can be dismissed", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("portfolio:build-updated")));
  await expect(page.locator(".action-toast-action")).toBeVisible();
  await page.locator(".action-toast-dismiss").click();
  await expect(page.locator(".action-toast-action")).toHaveCount(0);
});

test("a github release event is not shown twice", async ({ page }) => {
  // The GitHub activity payload carries id, type, repo, message, created_at and
  // url - no tag and no version - so the deterministic key is the repository:
  // this portfolio's releases are documented locally and that record is
  // authoritative. No date matching, no title matching.
  await page.route("**/api/github/activity*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([
      // Same shape the live proxy returns for a portfolio release.
      { id: "dup", type: "ReleaseEvent", repo: "osameh.dev", message: "Published a release", created_at: "2026-09-12T14:29:05Z", url: "https://github.com/osameh15/osameh.dev" },
      { id: "push", type: "PushEvent", repo: "osameh.dev", message: "Pushed 1 commit(s)", created_at: "2026-09-12T15:00:00Z", url: "https://github.com/osameh15/osameh.dev" },
      // Another repository has no local release record, so it is genuine news -
      // and it shares its date with a documented portfolio release, which a
      // date-based rule would have wrongly suppressed.
      { id: "other", type: "ReleaseEvent", repo: "other-repo", message: "Published a release", created_at: "2026-09-12T09:00:00Z", url: "https://github.com/osameh15/other-repo" },
    ]),
  }));
  await page.goto("/activity");
  await page.waitForSelector(".activity-entry");

  const entries = await page.evaluate(() => [...document.querySelectorAll(".activity-entry")].map(entry => ({
    type: entry.querySelector(".activity-node")?.getAttribute("data-activity-type"),
    title: entry.querySelector("b")?.textContent?.trim(),
  })));

  // The portfolio release appears once, from the authoritative local record.
  expect(entries.filter(entry => entry.type === "github-release" && entry.title === "osameh.dev").length,
    "the duplicate portfolio release event is suppressed").toBe(0);
  expect(entries.some(entry => entry.type === "release"), "the local release record remains").toBe(true);

  // A different repository's release survives, proving this is not date matching.
  expect(entries.some(entry => entry.type === "github-release" && entry.title === "other-repo"),
    "an unrelated release on the same day is kept").toBe(true);

  // Pushes are untouched.
  expect(entries.some(entry => entry.type === "push"), "pushes are untouched").toBe(true);

  // Distinct local releases stay distinct.
  const releases = entries.filter(entry => entry.type === "release").map(entry => entry.title);
  expect(new Set(releases).size, "distinct releases are not collapsed").toBe(releases.length);
});

// ---- v5.6.1 Raven: Hirava case study and its two Engineering Notes ----
//
// Content is published from two places at once - the typed modules the
// application renders, and the JSON indexes the PHP document layer and the
// sitemaps read. Nothing enforced their agreement before, so a note that
// rendered perfectly could still be missing its canonical document.

const HIRAVA_NOTES = ["architecting-hirava-recruitment-marketplace", "designing-trust-into-hiring-workflows"];
const notesIndexFixture: Array<Record<string, unknown>> = JSON.parse(readFileSync(new URL("../../frontend/public/notes-index.json", import.meta.url), "utf8"));
const caseStudyIndexFixture: Array<Record<string, unknown>> = JSON.parse(readFileSync(new URL("../../frontend/public/case-studies-index.json", import.meta.url), "utf8"));

test("published content agrees across the rendered modules and the indexed documents", () => {
  const slugs = engineeringNotes.map(note => note.slug);
  expect(new Set(slugs).size, "note slugs are unique").toBe(slugs.length);
  expect(slugs).toEqual(notesIndexFixture.map(note => note.slug));

  for (const note of engineeringNotes) {
    const indexed = notesIndexFixture.find(item => item.slug === note.slug)!;
    expect(indexed, `${note.slug} is an indexed document`).toBeTruthy();
    expect({ title: indexed.title, summary: indexed.summary, publishedAt: indexed.publishedAt, updatedAt: indexed.updatedAt, readingMinutes: indexed.readingMinutes, tags: indexed.tags })
      .toEqual({ title: note.title, summary: note.summary, publishedAt: note.publishedAt, updatedAt: note.updatedAt, readingMinutes: note.readingMinutes, tags: note.tags });
    expect(note.slug).toMatch(/^[a-z0-9-]+$/);
    expect(note.readingMinutes).toBeGreaterThan(0);
    expect(note.tags.length).toBeGreaterThan(0);
    const markdown = readFileSync(new URL(`../../frontend/public/notes-content/${note.slug}.md`, import.meta.url), "utf8");
    expect(markdown.split(/\s+/).length, `${note.slug} has real content`).toBeGreaterThan(200);
  }

  const ids = clientCaseStudies.map(study => study.id);
  expect(new Set(ids).size, "case study ids are unique").toBe(ids.length);
  expect(ids).toEqual(caseStudyIndexFixture.map(study => study.id));
  for (const study of clientCaseStudies) {
    const indexed = caseStudyIndexFixture.find(item => item.id === study.id)!;
    expect({ title: indexed.title, summary: indexed.summary, stack: indexed.stack, siteUrl: indexed.siteUrl })
      .toEqual({ title: study.title, summary: study.summary, stack: study.stack, siteUrl: study.siteUrl });
  }

  for (const slug of HIRAVA_NOTES) expect(slugs, `${slug} is published`).toContain(slug);
});

test("engineering notes are authored newest first", () => {
  const dates = engineeringNotes.map(note => note.publishedAt);
  expect(dates, "the authored order is the published order, newest first").toEqual([...dates].sort().reverse());
  expect(engineeringNotes[0].publishedAt).toBe(dates.reduce((newest, date) => (date > newest ? date : newest)));
  // Order is authored, never sorted at runtime: adjacency, the index, the
  // palette and the terminal all read this one array.
  expect(readFileSync(new URL("../../frontend/src/features/notes/notesData.ts", import.meta.url), "utf8")).not.toContain(".sort(");
});

test("the Hirava case study states what is built and never claims what is not", () => {
  const hirava = clientCaseStudies.find(study => study.id === "hirava")!;
  expect(hirava, "Hirava is published as a client case study").toBeTruthy();

  // A temporary development preview, addressed exactly, over HTTPS.
  expect(hirava.siteUrl).toBe("https://hirava.osameh.dev");
  expect(new URL(hirava.siteUrl!).protocol).toBe("https:");
  expect(hirava.siteLabel, "the link is not sold as a production site").toBe("Open live preview");

  // Explicit relations resolve, and nothing is invented.
  expect(hirava.relatedNotes).toEqual(HIRAVA_NOTES);
  for (const slug of hirava.relatedNotes!) expect(engineeringNotes.some(note => note.slug === slug)).toBe(true);
  expect(hirava.relatedProjects, "no public repository is claimed").toBeUndefined();
  for (const slug of HIRAVA_NOTES) {
    expect(engineeringNotes.find(note => note.slug === slug)!.relatedCaseStudies).toEqual(["hirava"]);
  }

  const prose = [hirava.summary, hirava.problem, ...hirava.constraints, ...hirava.solution, ...hirava.decisions, ...hirava.outcomes, ...hirava.lessons,
    readFileSync(new URL(`../../frontend/public/notes-content/${HIRAVA_NOTES[0]}.md`, import.meta.url), "utf8"),
    readFileSync(new URL(`../../frontend/public/notes-content/${HIRAVA_NOTES[1]}.md`, import.meta.url), "utf8")].join("\n");

  // The status is stated, not implied.
  expect(hirava.projectType).toContain("in development");
  expect(hirava.summary).toMatch(/frontend is implemented/i);
  expect(hirava.summary).toMatch(/backend is planned/i);

  // The verified current stack is what the Hirava repository actually declares.
  // Hirava installs nuxt ^3.17.6 with future.compatibilityVersion: 4, so the
  // installed framework is Nuxt 3 running in Nuxt 4 compatibility mode.
  for (const technology of ["Nuxt 3.17.6 (Nuxt 4 compatibility mode)", "Vue 3.5", "TypeScript", "Tailwind CSS"]) expect(hirava.stack).toContain(technology);
  expect(hirava.stack, "Nuxt 4 is not the installed package").not.toContain("Nuxt 4");
  expect(hirava.stack, "an unbuilt backend is not part of the current stack").not.toContain("Go");
  expect(hirava.stack).not.toContain("PostgreSQL");
  expect(prose, "the planned backend is labelled planned").toMatch(/planned/i);

  // Prototype presentation figures are never reported as business results.
  for (const figure of ["5K+", "1.2K+", "86%"]) expect(prose, `${figure} is prototype content`).not.toContain(figure);
  expect(prose).not.toMatch(/\b(placements? (?:made|delivered)|revenue of|customers already)\b/i);
});

test("current Hirava content states the installed framework and backend enforcement exactly", () => {
  const hirava = clientCaseStudies.find(study => study.id === "hirava")!;
  const indexedStudy = caseStudyIndexFixture.find(item => item.id === "hirava")!;
  const noteBodies = HIRAVA_NOTES.map(slug => readFileSync(new URL(`../../frontend/public/notes-content/${slug}.md`, import.meta.url), "utf8"));
  const noteMetadata = HIRAVA_NOTES.map(slug => engineeringNotes.find(note => note.slug === slug)!);
  const siteChangelog = /\{ version: "5\.6\.1"[^\n]*/.exec(readFileSync(new URL("../../frontend/src/data/portfolioData.ts", import.meta.url), "utf8"))?.[0] || "";
  expect(siteChangelog, "the site changelog entry is readable").not.toBe("");

  const surfaces: Array<[string, string]> = [
    ["case study", Object.values(hirava).flat().filter(value => typeof value === "string").join("\n")],
    ["case study index", JSON.stringify(indexedStudy)],
    ...noteMetadata.map(note => [`${note.slug} metadata`, `${note.title}\n${note.summary}`] as [string, string]),
    ...noteBodies.map((body, index) => [`${HIRAVA_NOTES[index]}.md`, body] as [string, string]),
    ["site changelog 5.6.1", siteChangelog],
  ];

  // Nuxt 4 is allowed only where it is qualified: compatibility mode, a
  // compatible architecture, its behaviour/defaults, or an explicit negation.
  const QUALIFIED_NUXT_4 = [/Nuxt 4 compatibility mode/gi, /Nuxt 4-compatible/gi, /Nuxt 4 behaviour and defaults/gi, /is not Nuxt 4\b/gi];
  // No backend exists, so nothing may claim present-tense server enforcement.
  const PRESENT_ENFORCEMENT = [
    /\b(?:the\s+)?(?:server|backend|API)\s+(?:re-?validates|enforces|rejects|verifies|guarantees)\b/i,
    /\b(?:is|are)\s+(?:enforced|re-?validated)\s+(?:by|on|in)\s+the\s+(?:server|backend|API)\b/i,
  ];

  for (const [label, text] of surfaces) {
    const unqualified = QUALIFIED_NUXT_4.reduce((remaining, allowed) => remaining.replace(allowed, ""), text);
    expect(unqualified, `${label} presents Nuxt 4 as the installed framework`).not.toMatch(/Nuxt\s*4\b/i);
    for (const pattern of PRESENT_ENFORCEMENT) expect(text, `${label} claims present-tense backend enforcement`).not.toMatch(pattern);
  }

  // The guards must actually bite: an unqualified claim is rejected.
  const rejects = (text: string) => /Nuxt\s*4\b/i.test(QUALIFIED_NUXT_4.reduce((remaining, allowed) => remaining.replace(allowed, ""), text));
  expect(rejects("The Nuxt 4 frontend is implemented")).toBe(true);
  expect(rejects("Nuxt 3.17.6 in Nuxt 4 compatibility mode")).toBe(false);
  expect(PRESENT_ENFORCEMENT.some(pattern => pattern.test("the client disables the button and the server re-validates"))).toBe(true);
  expect(PRESENT_ENFORCEMENT.some(pattern => pattern.test("the future backend must re-validate the rule"))).toBe(false);

  // The exact installed framework is stated where the stack is described.
  expect(hirava.summary).toContain("Nuxt 3.17.6 with Nuxt 4 compatibility mode");
  expect(noteBodies[0]).toContain("Nuxt 3.17.6");
  expect(noteBodies[0]).toContain("compatibilityVersion: 4");
  expect(noteMetadata[0].title).toBe("Architecting Hirava: A Two-Sided Recruitment Marketplace in Nuxt 4 Compatibility Mode");

  // The five-candidate cap is frontend-modelled and future-backend-enforced.
  for (const body of noteBodies) expect(body).toMatch(/future backend must re-validate/i);
  expect(hirava.solution.join(" ")).toMatch(/planned backend must re-validate/i);
});

test("Hirava and its notes resolve to each other through the shared related-content model", () => {
  const source: RelatedSource = {
    projects: [],
    notes: engineeringNotes.map(note => ({ slug: note.slug, title: note.title, hint: "Engineering note", tags: note.tags, relatedProjects: note.relatedProjects, relatedCaseStudies: note.relatedCaseStudies })),
    caseStudies: clientCaseStudies.map(study => ({ id: study.id, title: study.title, hint: "Client case study", stack: study.stack, relatedProjects: study.relatedProjects, relatedNotes: study.relatedNotes })),
  };

  const fromCaseStudy = relatedToCaseStudy("hirava", source);
  expect(fromCaseStudy.length).toBeLessThanOrEqual(3);
  expect(fromCaseStudy.slice(0, 2).map(item => item.href).sort()).toEqual(HIRAVA_NOTES.map(slug => `/notes/${slug}`).sort());
  expect(fromCaseStudy[0].reason).toBe("Written about this engagement");

  for (const slug of HIRAVA_NOTES) {
    const fromNote = relatedToNote(slug, source);
    expect(fromNote.length).toBeLessThanOrEqual(3);
    expect(fromNote.map(item => item.href)).toContain("/case-studies/hirava");
    expect(fromNote.find(item => item.href === "/case-studies/hirava")!.reason).toBe("Discussed in this note");
    expect(relatedToNote(slug, source), "deterministic").toEqual(fromNote);
  }
  expect(relatedToCaseStudy("hirava", source), "deterministic").toEqual(fromCaseStudy);
});

test("both new notes reach the engineering timeline through the existing pipeline", async ({ page }) => {
  // No activity entry is authored for a note: the timeline reads the same
  // engineeringNotes array the Notes index renders, so publishing is enough.
  await page.route("**/api/github/activity*", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify([{ id: "push", type: "PushEvent", repo: "osameh.dev", message: "Pushed 1 commit(s)", created_at: "2026-09-13T15:00:00Z", url: "https://github.com/osameh15/osameh.dev" }]),
  }));
  await page.goto("/activity");
  await page.waitForSelector(".activity-entry");

  const entries = await page.evaluate(() => [...document.querySelectorAll(".activity-entry")].map(entry => ({
    type: entry.querySelector(".activity-node")?.getAttribute("data-activity-type"),
    title: entry.querySelector("b")?.textContent?.trim(),
    href: entry.getAttribute("href"),
  })));

  for (const slug of HIRAVA_NOTES) {
    const note = engineeringNotes.find(item => item.slug === slug)!;
    const matches = entries.filter(entry => entry.title === note.title);
    expect(matches.length, `${slug} appears exactly once`).toBe(1);
    expect(matches[0].type).toBe("note");
    expect(matches[0].href).toBe(`/notes/${slug}`);
  }
  const titles = entries.map(entry => `${entry.type}:${entry.title}`);
  expect(new Set(titles).size, "no duplicated timeline entries").toBe(titles.length);
});

test("the new documents are canonical, indexed exactly once, and add no new URL class", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  expect(new Set(urls).size, "no duplicate sitemap URLs").toBe(urls.length);
  for (const slug of HIRAVA_NOTES) expect(urls).toContain(`https://osameh.dev/notes/${slug}`);

  // Client case studies already have independent canonical documents, so Hirava
  // follows that contract instead of introducing a URL shape of its own.
  expect(urls).toContain("https://osameh.dev/case-studies/hirava");
  const classes = new Set(urls.map(url => new URL(url).pathname.split("/")[1] || "/"));
  expect([...classes].sort()).toEqual(["/", "case-studies", "notes", "projects"]);
});

for (const slug of ["architecting-hirava-recruitment-marketplace", "designing-trust-into-hiring-workflows"]) {
  test(`the note ${slug} renders with its table of contents, neighbours and relations`, async ({ page }) => {
    await page.goto(`/notes/${slug}`);
    const note = engineeringNotes.find(item => item.slug === slug)!;
    await expect(page.locator("h1#note-detail-title")).toHaveText(note.title);
    await expect(page.locator(".note-markdown")).toBeVisible();
    expect(await page.locator(".note-toc button").count(), "the table of contents is built from real headings").toBeGreaterThan(4);

    // Adjacency follows the authoritative newest-first order, and each side
    // that exists is a real anchor rather than a disabled control.
    const { previous, next } = adjacentNotes(slug);
    for (const [direction, neighbour] of [["previous", previous], ["next", next]] as const) {
      const link = page.locator(`.note-adjacent-link.note-adjacent-${direction}`);
      if (!neighbour) { await expect(link).toHaveCount(0); continue; }
      await expect(link).toHaveAttribute("href", `/notes/${neighbour.slug}`);
    }

    const related = page.locator(".continue-exploring a.continue-exploring-link");
    await expect(related.first()).toBeVisible();
    expect(await related.count()).toBeLessThanOrEqual(3);
    expect(await related.evaluateAll(nodes => nodes.map(node => node.getAttribute("href")))).toContain("/case-studies/hirava");
  });
}

test("the Hirava case study opens from its own address with an honest live-preview link", async ({ page }) => {
  await page.goto("/case-studies/hirava");
  const modal = page.locator('[role="dialog"].case-study-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator("#case-study-title")).toHaveText("Hirava");
  await expect(modal).toContainText("in development");

  const preview = modal.locator("a.case-study-live-link");
  await expect(preview).toHaveAttribute("href", "https://hirava.osameh.dev");
  await expect(preview).toHaveAttribute("target", "_blank");
  await expect(preview).toHaveAttribute("rel", /noreferrer/);
  await expect(preview).toContainText("Open live preview");

  const related = modal.locator(".continue-exploring a.continue-exploring-link");
  const hrefs = await related.evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
  for (const slug of HIRAVA_NOTES) expect(hrefs).toContain(`/notes/${slug}`);

  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
});

test("the new content is discoverable through the existing Command Palette", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Command Palette" }).click();
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await palette.getByRole("textbox").fill("hirava");
  await expect(palette.getByRole("option").first()).toBeVisible();
  const options = await palette.getByRole("option").allInnerTexts();
  expect(options.some(option => /Case study: Hirava/i.test(option)), "the case study is offered").toBe(true);
  expect(options.some(option => /Read note: Architecting Hirava/i.test(option)), "the note is offered").toBe(true);

  // Natural queries reach the same content through the one existing index.
  for (const [query, expected] of [
    ["recruitment", /Case study: Hirava|Read note: Architecting Hirava/i],
    ["recruiter", /Case study: Hirava|Read note: (Architecting Hirava|Designing trust)/i],
    ["trust", /Read note: Designing trust into hiring workflows/i],
  ] as const) {
    await palette.getByRole("textbox").fill(query);
    await expect(palette.getByRole("option").first()).toBeVisible();
    const found = await palette.getByRole("option").allInnerTexts();
    expect(found.some(option => expected.test(option)), `"${query}" reaches Hirava content`).toBe(true);
  }
});

test("the notes index lists every published note", async ({ page }) => {
  await page.goto("/notes");
  await expect(page.locator(".notes-count")).toHaveText(`${engineeringNotes.length} notes`);
  for (const slug of HIRAVA_NOTES) {
    await expect(page.locator(`.note-card[data-note-slug="${slug}"]`)).toBeVisible();
  }
});

for (const width of [320, 360, 390, 412]) {
  test(`the Hirava content fits ${width}px without horizontal overflow`, async ({ page }) => {
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.setViewportSize({ width, height: 844 });

    await page.goto(`/notes/${HIRAVA_NOTES[1]}`);
    await expect(page.locator(".note-markdown")).toBeVisible();
    expect(await overflow(), "note document").toBeLessThanOrEqual(1);

    await page.goto("/case-studies/hirava");
    await expect(page.locator('[role="dialog"].case-study-modal')).toBeVisible();
    expect(await overflow(), "case study modal").toBeLessThanOrEqual(1);
  });
}

// ---- v5.6.3 Raven: async layout stability across an open dialog ----
//
// Opening a case study freezes the workspace and closing it restores where the
// user was. Until 5.6.3 the origin was an absolute scroll coordinate, which goes
// stale when content ABOVE the viewport finishes loading while the dialog is
// open: the page came back shifted by exactly how much that content grew
// (measured at 580px on staging and 588px on production during 5.6.2
// acceptance). The origin now also carries a visual anchor, so restoration puts
// the element the user was looking at back at the same viewport offset.
//
// GitHub project data is only the deterministic reproducer. Nothing in the
// restoration path knows about GitHub; the test grows real content above the
// origin while the dialog holds the body lock.

const SLOW_REPO_BLURB =
  "A production service with an unusually long repository description, used here only to make each project card measurably taller than the checked-in fallback card so the Projects section above the reading position grows by a real, painted amount while a dialog is open.";
const SLOW_REPOS = Array.from({ length: 6 }, (unused, index) => ({
  id: 900 + index,
  name: `delayed-repo-${index}`,
  description: SLOW_REPO_BLURB,
  language: "TypeScript",
  topics: ["react", "typescript", "php", "devops", "accessibility"],
  stargazers_count: index,
  forks_count: 0,
  archived: false,
  updated_at: `2026-08-0${index + 1}T00:00:00Z`,
  fork: false,
  default_branch: "main",
}));

/**
 * Holds the repository request open until the returned function is called.
 *
 * Every other GitHub endpoint is refused so exactly one asynchronous layout
 * change happens, at the moment the test chooses. `outcome` covers the failure
 * path: a portfolio that falls back to embedded projects must restore just as
 * exactly as one that receives live data.
 */
async function deferProjectData(page: import("@playwright/test").Page, outcome: "resolve" | "fail" = "resolve") {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/github/**", async route => {
    const url = route.request().url();
    if (!/\/api\/github(\/repos|\.php)/.test(url)) return route.abort();
    await held;
    if (outcome === "fail") return route.abort();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SLOW_REPOS) });
  });
  return release;
}

/** Height of the Projects section, which sits above every anchor used below. */
const projectsHeight = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.getElementById("work")?.getBoundingClientRect().height ?? 0);

/** Puts `id` at roughly `line` and lets any stabilization finish. */
async function parkAt(page: import("@playwright/test").Page, id: string, line: number) {
  await page.evaluate(({ target, top }) => {
    const node = document.getElementById(target)!;
    window.scrollBy({ top: node.getBoundingClientRect().top - top, left: 0, behavior: "instant" as ScrollBehavior });
  }, { target: id, top: line });
  await waitForSectionSettled(page);
  await nextFrames(page);
}

for (const width of [1280, 390]) {
  for (const close of ["Escape", "close button", "Browser Back"] as const) {
    test(`a case study closed with ${close} keeps its visual anchor when project data lands while it is open at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width <= 720 ? 844 : 720 });
      const release = await deferProjectData(page);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator(".project-card").first()).toBeVisible();

      // The user is reading Experience, which sits below the Projects section
      // that is about to grow.
      await parkAt(page, "experience", 300);
      const anchorBefore = await sectionTop(page, "experience");
      const heightBefore = await projectsHeight(page);

      await page.evaluate(openPaletteShortcut);
      const palette = page.getByRole("dialog", { name: "Command Palette" });
      await expect(palette).toBeVisible();
      await palette.getByRole("textbox").fill("amorella beauty");
      await expect(palette.getByRole("option").first()).toContainText("Amorella Beauty");
      await palette.getByRole("textbox").press("Enter");

      const modal = page.locator('[role="dialog"].case-study-modal');
      await expect(modal).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");

      // The race under test: content above the origin finishes loading while the
      // dialog is open, so the stored coordinate goes stale before it is used.
      release();
      await expect.poll(() => projectsHeight(page), { timeout: 10_000 })
        .not.toBe(heightBefore);
      const heightAfter = await projectsHeight(page);
      expect(Math.abs(heightAfter - heightBefore), "the layout above the origin really moved").toBeGreaterThan(20);

      if (close === "Escape") await page.keyboard.press("Escape");
      else if (close === "close button") await modal.getByRole("button", { name: /close/i }).click();
      else await page.goBack();

      await expect(modal).toBeHidden();
      await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
      await waitForSectionSettled(page);
      await nextFrames(page);

      const anchorAfter = await sectionTop(page, "experience");
      expect(
        Math.abs(anchorAfter! - anchorBefore!),
        `the anchor moved from ${anchorBefore} to ${anchorAfter} after ${heightAfter - heightBefore}px of growth above it`,
      ).toBeLessThanOrEqual(2);
    });
  }
}

test("a case study restores its anchor when project data was already settled", async ({ page }) => {
  const release = await deferProjectData(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".project-card").first()).toBeVisible();
  release();
  await expect.poll(() => projectsHeight(page), { timeout: 10_000 }).toBeGreaterThan(0);
  await parkAt(page, "experience", 300);
  const anchorBefore = await sectionTop(page, "experience");

  await page.evaluate(openPaletteShortcut);
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  await palette.getByRole("textbox").fill("amorella beauty");
  await palette.getByRole("textbox").press("Enter");
  const modal = page.locator('[role="dialog"].case-study-modal');
  await expect(modal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await nextFrames(page);

  expect(Math.abs((await sectionTop(page, "experience"))! - anchorBefore!), "a settled layout is restored exactly").toBeLessThanOrEqual(2);
});

test("a failed project request still restores the case-study anchor", async ({ page }) => {
  const release = await deferProjectData(page, "fail");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".project-card").first()).toBeVisible();
  await parkAt(page, "experience", 300);
  const anchorBefore = await sectionTop(page, "experience");

  await page.evaluate(openPaletteShortcut);
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  await palette.getByRole("textbox").fill("amorella beauty");
  await palette.getByRole("textbox").press("Enter");
  const modal = page.locator('[role="dialog"].case-study-modal');
  await expect(modal).toBeVisible();

  // The request fails while the dialog is open: the fallback stays, so nothing
  // above the origin moves and restoration must still be exact.
  release();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await nextFrames(page);

  expect(Math.abs((await sectionTop(page, "experience"))! - anchorBefore!), "a GitHub failure does not move the restored view").toBeLessThanOrEqual(2);
});

test("late layout growth does not override where the user scrolled after closing", async ({ page }) => {
  const release = await deferProjectData(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".project-card").first()).toBeVisible();
  await parkAt(page, "experience", 300);

  await page.evaluate(openPaletteShortcut);
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  await palette.getByRole("textbox").fill("amorella beauty");
  await palette.getByRole("textbox").press("Enter");
  const modal = page.locator('[role="dialog"].case-study-modal');
  await expect(modal).toBeVisible();
  release();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).not.toBe("fixed");
  await nextFrames(page);

  // User input after the restore always wins; nothing may pull it back.
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(0);
  const afterUserScroll = await page.evaluate(() => Math.round(window.scrollY));
  await page.waitForTimeout(1_200);
  expect(Math.abs(await page.evaluate(() => Math.round(window.scrollY)) - afterUserScroll), "no delayed correction after user input").toBeLessThanOrEqual(2);
});

// ---- Status bar language switcher ----
//
// The status bar already named the active code language. It is now the control
// that changes it, so the choice is reachable without opening the File menu.

const languageTrigger = (page: import("@playwright/test").Page) => page.locator(".status-language-trigger");
const languageMenu = (page: import("@playwright/test").Page) => page.locator(".status-language-menu");

test("the status bar language indicator opens a menu above the bar and switches language", async ({ page }) => {
  await page.goto("/");
  const trigger = languageTrigger(page);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.click();
  const menu = languageMenu(page);
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  // It must open upward: the status bar is pinned to the bottom of the viewport,
  // so a menu rendered below it would be off screen.
  const menuBox = (await menu.boundingBox())!;
  const barBox = (await page.locator(".status-bar").boundingBox())!;
  expect(menuBox.y + menuBox.height, "the menu sits above the status bar").toBeLessThanOrEqual(barBox.y + 2);
  expect(menuBox.y).toBeGreaterThanOrEqual(0);

  // Every selectable language is offered, with the active one marked.
  const options = menu.getByRole("menuitemradio");
  await expect(options).toHaveCount(7);
  await expect(menu.locator('button[aria-checked="true"]')).toHaveCount(1);

  await menu.getByRole("menuitemradio", { name: /^C\+\+/ }).click();
  await expect(menu).toBeHidden();
  await expect(trigger).toContainText("C++ mode");

  // The choice is a stored workspace preference, like theme and font.
  await page.reload();
  await expect(languageTrigger(page)).toContainText("C++ mode");
  expect(await page.evaluate(() => localStorage.getItem("portfolio-language"))).toBe("cpp");
});

test("the status bar language menu closes on Escape and on an outside click, without closing a tab", async ({ page }) => {
  await page.goto(`/notes/${HIRAVA_NOTES[0]}`);
  await expect(page.locator(".note-markdown")).toBeVisible();
  const openTab = await activeTabId(page);

  await languageTrigger(page).click();
  await expect(languageMenu(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(languageMenu(page)).toBeHidden();
  // Escape belongs to the open menu; the editor tab behind it must survive.
  expect(await activeTabId(page), "Escape closed the menu only").toBe(openTab);
  await expect(page.locator(".note-markdown")).toBeVisible();

  await languageTrigger(page).click();
  await expect(languageMenu(page)).toBeVisible();
  await page.mouse.click(400, 300);
  await expect(languageMenu(page)).toBeHidden();
});

const CODE_LANGUAGE_LABELS = Object.values(codeProfiles).map(profile => profile.label);
const menuLabels = async (page: import("@playwright/test").Page) =>
  (await languageMenu(page).getByRole("menuitemradio").allInnerTexts()).map(text => text.trim().split("\n")[0].trim());

test("the status bar selector offers exactly the configured programming languages", async ({ page }) => {
  await page.goto("/");
  await languageTrigger(page).click();
  // The authoritative list is codeProfiles. A second, drifting list is the
  // failure this pins: JavaScript was deliberately removed and must stay out.
  expect(await menuLabels(page)).toEqual(CODE_LANGUAGE_LABELS);
  expect(await menuLabels(page)).not.toContain("JavaScript");
  await expect(languageMenu(page).locator('button[aria-checked="true"]')).toHaveCount(1);
});

test("the File menu and the status bar share one programming-language state", async ({ page }) => {
  await page.goto("/");
  const fileGroup = page.locator(".file-menu-popover .menu-group", { hasText: "Programming language" });

  // File menu -> Go reaches the status bar.
  await page.locator(".file-menu-trigger").click();
  await fileGroup.getByRole("button", { name: "Go" }).click();
  await expect(languageTrigger(page)).toContainText("Go");

  // Status bar -> Java reaches the File menu's checked state.
  await page.keyboard.press("Escape");
  await languageTrigger(page).click();
  await languageMenu(page).getByRole("menuitemradio", { name: /^Java/ }).click();
  await expect(languageTrigger(page)).toContainText("Java");
  await page.locator(".file-menu-trigger").click();
  await expect(fileGroup.getByRole("button", { name: "Java" }).locator("svg"), "the File menu shows Java as selected").toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("portfolio-language")), "one storage key, one state").toBe("java");
});

test("the status bar language selector is keyboard navigable", async ({ page }) => {
  await page.goto("/");
  await languageTrigger(page).click();
  const menu = languageMenu(page);
  // Focus starts on the active language so keyboard users begin at the current
  // selection rather than at the top of the list.
  await expect(menu.locator('button[aria-checked="true"]')).toBeFocused();
  await page.keyboard.press("Home");
  await expect(menu.getByRole("menuitemradio").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitemradio").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(menu.getByRole("menuitemradio").first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitemradio").last()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(languageTrigger(page)).toContainText(CODE_LANGUAGE_LABELS[CODE_LANGUAGE_LABELS.length - 1]);
});

test("the programming-language selector introduces no site localization", async ({ page }) => {
  await page.goto("/");
  const documentLanguage = await page.evaluate(() => document.documentElement.lang);
  await languageTrigger(page).click();
  await languageMenu(page).getByRole("menuitemradio", { name: /^Go/ }).click();

  // Code presentation only: no document language change, no locale route, no
  // second storage key, and the interface copy stays English.
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(documentLanguage);
  await expect(page).toHaveURL(/\/$/);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.filter(key => /locale|i18n|\bfa\b/i.test(key)), `unexpected localization state: ${keys.join(", ")}`).toEqual([]);
  expect(keys).toContain("portfolio-language");
  await expect(page.locator(".nav-links"), "interface copy stays English").toContainText(/case studies/i);
  // The English-only guard forbids a button named "Language:", since that is
  // what a locale switcher would be called. This control must never match it.
  await expect(page.getByRole("button", { name: /Language:/i }), "must not read as a locale switcher").toHaveCount(0);
});

for (const width of [320, 360, 390, 412]) {
  test(`the status bar language selector stays usable and clipped to ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const trigger = languageTrigger(page);
    await expect(trigger, "the selector is reachable on phones").toBeVisible();
    await trigger.click();
    const menu = languageMenu(page);
    await expect(menu).toBeVisible();

    const box = (await menu.boundingBox())!;
    const bar = (await page.locator(".status-bar").boundingBox())!;
    expect(box.y + box.height, "opens upward, never below the viewport").toBeLessThanOrEqual(bar.y + 2);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

// ---- Engineering Notes index: progressive disclosure ----
//
// Notes already batch like Projects (6, then 6 more). With six published notes
// nothing is hidden, so production correctly renders no control. These pin that
// production behaviour and the contracts Load More must never affect; the
// batching rule itself is proved deterministically in the quality gates.

const NOTES_BATCH = 6;

test("the notes index renders the first batch in canonical newest-first order", async ({ page }) => {
  const published = [...engineeringNotes].map(note => Date.parse(note.publishedAt));
  expect([...published].sort((a, b) => b - a), "notes are authored newest first").toEqual(published);

  await page.goto("/notes");
  const cards = page.locator(".note-card");
  await expect(cards).toHaveCount(Math.min(NOTES_BATCH, engineeringNotes.length));
  const rendered = await cards.evaluateAll(list => list.map(card => (card as HTMLElement).dataset.noteSlug));
  expect(rendered, "the visible subset is a prefix of the canonical list, never re-sorted")
    .toEqual(engineeringNotes.slice(0, NOTES_BATCH).map(note => note.slug));
});

test("Load More appears only while notes remain hidden", async ({ page }) => {
  await page.goto("/notes");
  const control = page.locator(".notes-load-more button");
  if (engineeringNotes.length > NOTES_BATCH) {
    await expect(control).toBeVisible();
    await expect(control).toContainText(`${NOTES_BATCH} / ${engineeringNotes.length}`);
    const before = await page.evaluate(() => Math.round(window.scrollY));
    await control.click();
    await expect(page.locator(".note-card")).toHaveCount(Math.min(NOTES_BATCH * 2, engineeringNotes.length));
    expect(Math.abs(await page.evaluate(() => Math.round(window.scrollY)) - before), "revealing a batch must not jump the page").toBeLessThanOrEqual(2);
  } else {
    await expect(control, `all ${engineeringNotes.length} notes fit the first batch`).toHaveCount(0);
    await expect(page.locator(".note-card")).toHaveCount(engineeringNotes.length);
  }
});

test("progressive disclosure never limits routing, search or note-to-note navigation", async ({ page }) => {
  // Every published note keeps a working direct route and palette entry,
  // whether or not the index happens to be showing it.
  for (const note of engineeringNotes) {
    await page.goto(`/notes/${note.slug}`);
    await expect(page.locator(".note-markdown"), `${note.slug} is directly routable`).toBeVisible();
  }

  const last = engineeringNotes[engineeringNotes.length - 1];
  await page.goto(`/notes/${last.slug}`);
  const { previous } = adjacentNotes(last.slug);
  if (previous) {
    // Previous/Next walks the full authored list, not the visible subset.
    await expect(page.locator(".note-adjacent-link[data-adjacent='previous']")).toHaveAttribute("href", `/notes/${previous.slug}`);
  }

  await page.goto("/");
  await page.evaluate(openPaletteShortcut);
  const palette = page.getByRole("dialog", { name: "Command Palette" });
  await expect(palette).toBeVisible();
  await palette.getByRole("textbox").fill(last.title.slice(0, 18));
  await expect(palette.getByRole("option").first(), "a note outside the first batch is still searchable").toBeVisible();
});
