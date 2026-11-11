import { useEffect, useRef, useState, type JSX, type KeyboardEvent, type TouchEvent } from "react";
import { useAppState } from "../../state/AppStateContext";
import { STR } from "../../data/strings";
import { CloseIcon } from "../icons";
import { Sidebar } from "./Sidebar";
import styles from "./SidebarDrawer.module.scss";

interface SidebarDrawerProps {
  open: boolean;
  onClose(): void;
}

// A swipe this far left (or a quick flick past FLICK_PX) dismisses the panel;
// anything shorter springs back.
const DISMISS_FRACTION = 0.3;
const FLICK_PX = 40;
const FLICK_MS = 250;
// Movement before a touch commits to being a horizontal drag or a scroll.
const SLOP_PX = 8;

interface Drag {
  x: number;
  y: number;
  t: number;
  dx: number;
  mode: "pending" | "drag" | "scroll";
}

// The book sidebar as an off-canvas panel, for widths where the reader has no
// room for it as a column (portrait tablets, phones). Stays mounted through
// its exit transition, then unmounts so the sidebar's queries don't run while
// it's shut.
export function SidebarDrawer({ open, onClose }: SidebarDrawerProps): JSX.Element | null {
  const { state } = useAppState();
  const t = STR[state.locale];
  const [mounted, setMounted] = useState(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Focus moves into the panel on open and back to whatever opened it (the
  // reader heading) once it's gone.
  useEffect(() => {
    if (!open || !mounted) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, [open, mounted]);

  if (!mounted) return null;

  function setOffset(px: number | null): void {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transform = px === null ? "" : `translateX(${px}px)`;
    panel.dataset.dragging = px === null ? "false" : "true";
  }

  function handleTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    drag.current = { x: touch.clientX, y: touch.clientY, t: event.timeStamp, dx: 0, mode: "pending" };
  }

  function handleTouchMove(event: TouchEvent): void {
    const d = drag.current;
    if (!d || d.mode === "scroll") return;
    const touch = event.touches[0];
    const dx = touch.clientX - d.x;
    const dy = touch.clientY - d.y;
    if (d.mode === "pending") {
      if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return;
      d.mode = Math.abs(dx) > Math.abs(dy) ? "drag" : "scroll";
      if (d.mode === "scroll") return;
    }
    // Only leftward: the panel is already flush with the screen edge.
    d.dx = Math.min(0, dx);
    setOffset(d.dx);
  }

  function handleTouchEnd(event: TouchEvent): void {
    const d = drag.current;
    drag.current = null;
    if (!d || d.mode !== "drag") return;
    const width = panelRef.current?.offsetWidth ?? 1;
    const flick = d.dx < -FLICK_PX && event.timeStamp - d.t < FLICK_MS;
    setOffset(null);
    if (flick || d.dx < -width * DISMISS_FRACTION) onClose();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <div className={styles.root} data-state={open ? "open" : "closed"} onKeyDown={handleKeyDown}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={t.browseBooks}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onTransitionEnd={(event) => {
          if (event.target === panelRef.current && event.propertyName === "transform" && !open) setMounted(false);
        }}
      >
        <div className={styles.header}>
          <span className={styles.title}>{t.browseBooks}</span>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            title={t.close}
            aria-label={t.close}
          >
            <CloseIcon />
          </button>
        </div>
        <Sidebar inDrawer onChapterSelect={onClose} />
      </div>
    </div>
  );
}
