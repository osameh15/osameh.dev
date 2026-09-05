import { useLayoutEffect, useRef } from "react";

type SavedBodyState = {
  scrollX: number;
  scrollY: number;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyBoxSizing: string;
  bodyPaddingRight: string;
  bodyOverscroll: string;
  rootOverflow: string;
  rootOverscroll: string;
  rootScrollBehavior: string;
};

let lockCount = 0;
let saved: SavedBodyState | null = null;

function acquireBodyScrollLock(restorePosition?: { x: number; y: number }) {
  const body = document.body;
  const root = document.documentElement;
  if (lockCount === 0) {
    const frozenScrollX = window.scrollX;
    const frozenScrollY = window.scrollY;
    const scrollX = restorePosition?.x ?? frozenScrollX;
    const scrollY = restorePosition?.y ?? frozenScrollY;
    const scrollbar = Math.max(0, window.innerWidth - root.clientWidth);
    saved = {
      scrollX,
      scrollY,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyBoxSizing: body.style.boxSizing,
      bodyPaddingRight: body.style.paddingRight,
      bodyOverscroll: body.style.overscrollBehavior,
      rootOverflow: root.style.overflow,
      rootOverscroll: root.style.overscrollBehavior,
      rootScrollBehavior: root.style.scrollBehavior,
    };

    // Mark the modal state before locking. App-level delayed section-scroll
    // stabilizers listen for this event and cancel themselves instead of
    // moving the page behind an open dialog.
    root.dataset.modalOpen = "true";
    window.dispatchEvent(new Event("portfolio:modal-open"));

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    // Freeze where the document is rendered right now, while keeping an
    // optional pre-modal restore target for deterministic close behavior.
    body.style.top = `-${frozenScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.boxSizing = "border-box";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
  }
  lockCount += 1;

  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount !== 0 || !saved) return;
    const state = saved;
    saved = null;

    body.style.overflow = state.bodyOverflow;
    body.style.position = state.bodyPosition;
    body.style.top = state.bodyTop;
    body.style.left = state.bodyLeft;
    body.style.right = state.bodyRight;
    body.style.width = state.bodyWidth;
    body.style.boxSizing = state.bodyBoxSizing;
    body.style.paddingRight = state.bodyPaddingRight;
    body.style.overscrollBehavior = state.bodyOverscroll;
    root.style.overflow = state.rootOverflow;
    root.style.overscrollBehavior = state.rootOverscroll;
    delete root.dataset.modalOpen;

    // Restore without smooth scrolling so closing a modal cannot create a
    // visible bounce/repeat. Preserve the page's previous scroll-behavior.
    root.style.scrollBehavior = "auto";
    window.scrollTo(state.scrollX, state.scrollY);
    root.style.scrollBehavior = state.rootScrollBehavior;
  };
}

export function useModalScrollLock(open: boolean, restorePosition?: { x: number; y: number }) {
  const restoreX = restorePosition?.x;
  const restoreY = restorePosition?.y;
  useLayoutEffect(() => {
    if (!open) return;
    return acquireBodyScrollLock(restoreX === undefined || restoreY === undefined ? undefined : { x: restoreX, y: restoreY });
  }, [open, restoreX, restoreY]);
}

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const modalViewportSelector = ".modal-scroll-viewport";

function measureModalViewports(dialog: HTMLElement) {
  const viewports = Array.from(dialog.querySelectorAll<HTMLElement>(modalViewportSelector));
  if (!viewports.length) viewports.push(dialog);
  for (const viewport of viewports) {
    const style = getComputedStyle(viewport);
    const borders = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const consumed = Math.max(0, viewport.offsetWidth - viewport.clientWidth - borders);
    viewport.style.setProperty("--modal-scrollbar-width", `${consumed}px`);
  }
}

export function useModalDialog<T extends HTMLElement>(open: boolean, onClose: () => void, restorePosition?: { x: number; y: number }) {
  const dialogRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  closeRef.current = onClose;

  if (open && !wasOpenRef.current && typeof document !== "undefined") {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpenRef.current = open;
  useModalScrollLock(open, restorePosition);

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    measureModalViewports(dialog);
    const measureFrame = window.requestAnimationFrame(() => measureModalViewports(dialog));
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measureModalViewports(dialog));
    resizeObserver?.observe(dialog);
    dialog.querySelectorAll<HTMLElement>(modalViewportSelector).forEach(viewport => resizeObserver?.observe(viewport));
    const mutationObserver = new MutationObserver(() => measureModalViewports(dialog));
    mutationObserver.observe(dialog, { childList: true, subtree: true });
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter(element => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
    const focusDialog = () => {
      if (!dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
    };
    focusDialog();
    const focusFrame = window.requestAnimationFrame(focusDialog);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog.focus({ preventScroll: true }); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const activeInside = dialog.contains(document.activeElement) && document.activeElement !== dialog;
      if (event.shiftKey && (!activeInside || document.activeElement === first)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (!activeInside || document.activeElement === last)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(measureFrame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown, true);
      const returnFocus = returnFocusRef.current;
      returnFocusRef.current = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [open]);

  return dialogRef;
}
