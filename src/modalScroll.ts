import { useLayoutEffect } from "react";

type SavedBodyState = {
  scrollX: number;
  scrollY: number;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyPaddingRight: string;
  bodyOverscroll: string;
  rootOverflow: string;
  rootOverscroll: string;
  rootScrollBehavior: string;
};

let lockCount = 0;
let saved: SavedBodyState | null = null;

function acquireBodyScrollLock() {
  const body = document.body;
  const root = document.documentElement;
  if (lockCount === 0) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
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
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
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

export function useModalScrollLock(open: boolean) {
  useLayoutEffect(() => {
    if (!open) return;
    return acquireBodyScrollLock();
  }, [open]);
}
