// Measured section stabilization.
//
// Opening a section address (/notes, /case-studies, Browser Back to one, or
// returning Home to the section a tab belongs to) places that section under the
// sticky IDE chrome. Content above it can still change height afterwards -
// fonts, images, repository data, a view mounting - and push it out of view.
//
// This used to be handled by re-snapping to the section's absolute position at
// 60, 220, 500 and 900ms. An absolute re-snap cannot tell layout movement from
// navigation it did not start, so find-in-page, screen-reader navigation and
// in-page anchors could be pulled back. Scroll events cannot tell either: the
// application's own smooth scrolls emit them, which is why a scroll-listener
// version of this broke Browser Back restoration outright.
//
// A transaction therefore measures instead of re-snapping:
//
//   start     place the section, <html data-section-settling="placing">
//   confirm   re-check placement in later frames until it holds (bounded),
//             then data-section-settling="compensating"
//   baseline  record the section's position in the document
//   observe   ResizeObserver on the elements that can move it
//   adjust    scroll by exactly how far the section moved in the document
//   finish    after a quiet period with no layout change, or a hard ceiling
//   cleanup   observer, frame, timers and the attribute - always
//
// Wherever the viewport sits relative to the section - where placement put it,
// or wherever anything else moved it - is preserved. Native scroll anchoring is
// switched off only while the attribute is present (see a11y-phantom.css), so
// the browser and this compensation never both correct the same change.

export type SectionStabilization = { cancel: () => void };

type StabilizeOptions = {
  /** Where the section should sit below the viewport top, under the sticky chrome. */
  stickyOffset: () => number;
  /** End the transaction after this long without a layout change. */
  quietMs?: number;
  /** Hard ceiling on one transaction, however long the layout keeps changing. */
  maxMs?: number;
  /** Called exactly once when the transaction ends, for any reason. */
  onEnd?: () => void;
};

const QUIET_MS = 800;
const MAX_MS = 4000;
/** Frames the initial placement may take to hold before compensation starts regardless. */
const MAX_PLACEMENT_FRAMES = 8;

const documentTop = (element: Element) => element.getBoundingClientRect().top + window.scrollY;

// The site sets scroll-behavior: smooth. Placement and compensation must land in
// the frame the layout moved, so every stabilizer scroll is explicitly instant.
const scrollInstantlyBy = (top: number) => window.scrollBy({ top, left: 0, behavior: "instant" });

export function stabilizeSection(id: string, options: StabilizeOptions): SectionStabilization {
  const target = document.getElementById(id);
  if (!target) return { cancel: () => {} };

  const root = document.documentElement;
  let ended = false;
  let frame = 0;
  let quietTimer = 0;
  let maxTimer = 0;
  let observer: ResizeObserver | null = null;
  let lastTop = 0;
  let placed = false;
  let placementFrames = 0;
  let onTargetFrames = 0;

  const end = () => {
    if (ended) return;
    ended = true;
    observer?.disconnect();
    observer = null;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    window.clearTimeout(quietTimer);
    window.clearTimeout(maxTimer);
    delete root.dataset.sectionSettling;
    options.onEnd?.();
  };

  /** Moves the section to its offset; reports whether it got there. A document not yet tall enough can stop it short. */
  const place = (element: HTMLElement) => {
    const error = element.getBoundingClientRect().top - options.stickyOffset();
    if (Math.abs(error) > 0.5) scrollInstantlyBy(error);
    return Math.abs(element.getBoundingClientRect().top - options.stickyOffset()) <= 1;
  };

  const restartQuietPeriod = () => {
    window.clearTimeout(quietTimer);
    quietTimer = window.setTimeout(end, options.quietMs ?? QUIET_MS);
  };

  const measure = () => {
    frame = 0;
    if (ended) return;
    // React can replace the section element; always measure the live one.
    const current = document.getElementById(id);
    if (!current) return;
    if (!placed) {
      // The initial placement is confirmed in later frames, not assumed. A
      // smooth scroll still animating from the view being left - opening a note
      // scrolls to the top - applies one more step after an instant scroll, and
      // a document not yet tall enough can stop placement short. Finishing the
      // placement is still the original navigation. It counts as held after two
      // consecutive frames on target, and is bounded either way.
      if (Math.abs(current.getBoundingClientRect().top - options.stickyOffset()) <= 1) {
        onTargetFrames += 1;
      } else {
        onTargetFrames = 0;
        place(current);
      }
      placementFrames += 1;
      placed = onTargetFrames >= 2 || placementFrames >= MAX_PLACEMENT_FRAMES;
      if (placed) root.dataset.sectionSettling = "compensating";
      if (!placed) {
        lastTop = documentTop(current);
        restartQuietPeriod();
        schedule();
        return;
      }
    } else {
      const delta = documentTop(current) - lastTop;
      if (Math.abs(delta) >= 0.5) scrollInstantlyBy(delta);
    }
    lastTop = documentTop(current);
    restartQuietPeriod();
  };

  // Several size changes in one frame are one layout change.
  const schedule = () => {
    if (!ended && !frame) frame = window.requestAnimationFrame(measure);
  };

  root.dataset.sectionSettling = "placing";
  place(target);
  lastTop = documentTop(target);

  if (typeof ResizeObserver !== "undefined") {
    // Only elements whose size can move the section: at every level from the
    // section up to <body>, the ancestor itself and everything before it. A
    // view switch changes chrome and padding outside the section's own
    // container, so observing the container alone missed real movement (Browser
    // Back landed 10px off on desktop and 52px off on mobile). Border-box sizes
    // make padding changes count. Changes below the section measure as zero.
    // ponytail: margin-only changes on an ancestor are not observable this way;
    // add a MutationObserver on class/style attributes if one ever matters.
    observer = new ResizeObserver(schedule);
    for (let node: Element | null = target; node && node !== root; node = node.parentElement) {
      if (node !== target) observer.observe(node, { box: "border-box" });
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        observer.observe(sibling, { box: "border-box" });
      }
    }
  }

  maxTimer = window.setTimeout(end, options.maxMs ?? MAX_MS);
  restartQuietPeriod();
  schedule();
  return { cancel: end };
}
