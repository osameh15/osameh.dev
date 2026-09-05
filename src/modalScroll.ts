import { useLayoutEffect, useRef } from "react";

type SavedBodyState = {
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

// One entry per dialog currently holding the shared body lock. The restore
// position belongs to the entry that asked for it, so a dialog stacked on top
// with no restore position of its own cannot overwrite what the dialog
// underneath it is going to restore to.
type LockEntry = { id: number; restore: { x: number; y: number } | null };

const lockStack: LockEntry[] = [];
let nextLockId = 0;
let saved: SavedBodyState | null = null;
// Workspace position captured when the first lock was taken. The body is
// `position: fixed` for as long as any dialog is open, so this is the only
// truthful reading of where the page actually sits behind the dialogs.
let frozenScrollX = 0;
let frozenScrollY = 0;

/**
 * Scroll position of the workspace behind any open dialog.
 *
 * While a modal holds the lock the body is frozen and `window.scrollY` reads 0.
 * Navigation that records an origin to return to later must read through this
 * helper, otherwise it stores 0 while a dialog is open and then "restores" the
 * user to the top of the page instead of where they were.
 */
export function getWorkspaceScrollPosition(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  if (lockStack.length > 0) return { x: frozenScrollX, y: frozenScrollY };
  return { x: window.scrollX, y: window.scrollY };
}

function removeLockEntry(lockId: number): LockEntry | null {
  const index = lockStack.findIndex(entry => entry.id === lockId);
  if (index === -1) return null;
  return lockStack.splice(index, 1)[0];
}

function acquireBodyScrollLock(lockId: number, restorePosition?: { x: number; y: number }) {
  const body = document.body;
  const root = document.documentElement;
  if (lockStack.length === 0) {
    frozenScrollX = window.scrollX;
    frozenScrollY = window.scrollY;
    saved = {
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

    const scrollbar = Math.max(0, window.innerWidth - root.clientWidth);

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
  removeLockEntry(lockId);
  lockStack.push({ id: lockId, restore: restorePosition ? { x: restorePosition.x, y: restorePosition.y } : null });

  return () => {
    const entry = removeLockEntry(lockId);
    if (!entry || lockStack.length !== 0 || !saved) return;
    const state = saved;
    // The dialog being released last decides where the workspace lands. A
    // dialog that never asked for a restore position falls back to wherever
    // the workspace was frozen, never to another dialog's target.
    const target = entry.restore ?? { x: frozenScrollX, y: frozenScrollY };
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
    window.scrollTo(target.x, target.y);
    root.style.scrollBehavior = state.rootScrollBehavior;
  };
}

export function useModalScrollLock(open: boolean, restorePosition?: { x: number; y: number }) {
  // The restore target is read at lock time and revised in place afterwards.
  // Keeping it out of the effect dependencies is what stops a changed restore
  // coordinate from unlocking the body, scrolling the page and re-locking.
  const restoreRef = useRef(restorePosition);
  const lockIdRef = useRef(0);
  restoreRef.current = restorePosition;
  if (lockIdRef.current === 0) lockIdRef.current = ++nextLockId;
  const lockId = lockIdRef.current;
  const restoreX = restorePosition?.x;
  const restoreY = restorePosition?.y;

  useLayoutEffect(() => {
    if (!open) return;
    return acquireBodyScrollLock(lockId, restoreRef.current);
  }, [open, lockId]);

  useLayoutEffect(() => {
    if (!open || restoreX === undefined || restoreY === undefined) return;
    const entry = lockStack.find(item => item.id === lockId);
    if (entry) entry.restore = { x: restoreX, y: restoreY };
  }, [open, lockId, restoreX, restoreY]);
}

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const modalViewportSelector = ".modal-scroll-viewport";

// Explicit dialog stack. Escape and the focus trap belong to the most recently
// opened dialog only, so a Command Palette opened over a Case Study closes
// itself and leaves the Case Study open. DOM order cannot express this: a
// dialog opened later may render earlier in the tree, and every dialog listens
// on window in the capture phase, where listeners fire in registration order.
const modalStack: number[] = [];
let nextModalId = 0;

function removeModal(id: number) {
  const index = modalStack.lastIndexOf(id);
  if (index !== -1) modalStack.splice(index, 1);
}

function pushModal(id: number) {
  removeModal(id);
  modalStack.push(id);
}

function isTopModal(id: number) {
  return modalStack.length > 0 && modalStack[modalStack.length - 1] === id;
}

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
  const modalIdRef = useRef(0);
  closeRef.current = onClose;
  if (modalIdRef.current === 0) modalIdRef.current = ++nextModalId;
  const modalId = modalIdRef.current;

  if (open && !wasOpenRef.current && typeof document !== "undefined") {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpenRef.current = open;
  useModalScrollLock(open, restorePosition);

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    pushModal(modalId);
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
      // Every open dialog has a listener here. Only the topmost may act, so an
      // older dialog can never consume the event and close ahead of the dialog
      // the user is actually looking at.
      if (!isTopModal(modalId)) return;
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
      removeModal(modalId);
      window.cancelAnimationFrame(measureFrame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown, true);
      const returnFocus = returnFocusRef.current;
      returnFocusRef.current = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [open, modalId]);

  return dialogRef;
}
