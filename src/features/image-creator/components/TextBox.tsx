import { useEffect, useRef, useState, type FocusEvent, type JSX, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { fontSizePx, clamp01 } from "../model/coords";
import type { TextElement } from "../model/types";
import styles from "./TextBox.module.scss";

const NUDGE = 0.005;
const NUDGE_LARGE = 0.02;

interface TextBoxProps {
  element: TextElement;
  selected: boolean;
  containerWidth: number;
  containerHeight: number;
  onSelect(): void;
  onMove(x: number, y: number): void;
  onResize(width: number): void;
  onChangeText(text: string): void;
}

export function TextBox({
  element,
  selected,
  containerWidth,
  containerHeight,
  onSelect,
  onMove,
  onResize,
  onChangeText
}: TextBoxProps): JSX.Element {
  const dragState = useRef<{ startX: number; startY: number; elX: number; elY: number } | null>(null);
  const resizeState = useRef<{ startX: number; elWidth: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  // Clicking away from the canvas fires both a native `blur` on this node
  // AND a `selected` prop change (the canvas deselects on background
  // click) in the same tick, which can call commitEdit() twice before
  // React re-renders in between — `editing` (state) reads as stale/true
  // for both calls, so the guard needs a ref, not state.
  const committedRef = useRef(true);

  // A verse can run long — this is how the user shortens it to a
  // "resumed" version: double-click enters edit mode, typing replaces
  // the selected text in place, directly on the canvas.
  useEffect(() => {
    if (!editing) return;
    const node = contentRef.current;
    if (!node) return;
    committedRef.current = false;
    // Own the DOM content imperatively while editing, rather than via
    // the `{element.text}` child below — if React re-renders for any
    // unrelated reason mid-edit, diffing against the (stale) old prop
    // value would stomp whatever the user has typed so far.
    node.textContent = element.text;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // Deliberately keyed on `editing` alone — this should run once when
    // edit mode is entered, not on every `element.text` change (which
    // would fight the user's in-progress typing).
  }, [editing]);

  // Deselecting elsewhere (e.g. clicking the canvas background) should
  // still commit whatever was mid-edit rather than silently discard it.
  // Deliberately keyed on `selected` alone, for the same reason as above.
  useEffect(() => {
    if (!selected && editing) commitEdit();
  }, [selected]);

  function commitEdit(): void {
    if (committedRef.current) return;
    committedRef.current = true;
    const node = contentRef.current;
    const text = node?.textContent ?? "";
    // Clear the DOM node's content before handing it back to React.
    // While `editing` was true, React deliberately stops reconciling
    // this node's children (its documented behavior for contentEditable
    // elements), so the native, user-typed text node is still sitting in
    // the DOM. If we don't remove it here, the next render (children =
    // the now-updated `element.text`) inserts its own text node
    // alongside that leftover one instead of replacing it — the typed
    // text ends up duplicated.
    if (node) node.textContent = "";
    setEditing(false);
    if (text !== element.text) onChangeText(text);
  }

  function handleDoubleClick(event: MouseEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    setEditing(true);
  }

  function handleBlur(_event: FocusEvent<HTMLDivElement>): void {
    if (editing) commitEdit();
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (editing) return; // let the browser place the text cursor normally
    if (containerWidth === 0 || containerHeight === 0) return;
    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { startX: event.clientX, startY: event.clientY, elX: element.x, elY: element.y };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!dragState.current) return;
    const { startX, startY, elX, elY } = dragState.current;
    const dx = (event.clientX - startX) / containerWidth;
    const dy = (event.clientY - startY) / containerHeight;
    onMove(clamp01(elX + dx), clamp01(elY + dy));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleResizePointerDown(event: PointerEvent<HTMLDivElement>): void {
    event.stopPropagation();
    if (containerWidth === 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeState.current = { startX: event.clientX, elWidth: element.width };
  }

  function handleResizePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!resizeState.current) return;
    const { startX, elWidth } = resizeState.current;
    const dx = (event.clientX - startX) / containerWidth;
    const maxWidth = 1 - element.x;
    onResize(Math.min(maxWidth, Math.max(0.05, elWidth + dx)));
  }

  function handleResizePointerUp(event: PointerEvent<HTMLDivElement>): void {
    resizeState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (editing) {
      if (event.key === "Escape") {
        event.preventDefault();
        commitEdit();
      }
      // Any other key: let contentEditable's normal typing/caret
      // behavior handle it — don't nudge position, don't preventDefault.
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setEditing(true);
      return;
    }

    const step = event.shiftKey ? NUDGE_LARGE : NUDGE;
    switch (event.key) {
      case "ArrowLeft":
        onMove(clamp01(element.x - step), element.y);
        event.preventDefault();
        break;
      case "ArrowRight":
        onMove(clamp01(element.x + step), element.y);
        event.preventDefault();
        break;
      case "ArrowUp":
        onMove(element.x, clamp01(element.y - step));
        event.preventDefault();
        break;
      case "ArrowDown":
        onMove(element.x, clamp01(element.y + step));
        event.preventDefault();
        break;
      default:
        break;
    }
  }

  return (
    <div
      ref={contentRef}
      className={selected ? `${styles.box} ${styles.selected}` : styles.box}
      style={{
        left: `${element.x * 100}%`,
        top: `${element.y * 100}%`,
        width: `${element.width * 100}%`,
        fontFamily: element.fontFamily,
        fontSize: `${fontSizePx(element.fontSize, containerHeight)}px`,
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle,
        color: element.color,
        opacity: element.opacity,
        textAlign: element.textAlign,
        lineHeight: element.lineHeight,
        cursor: editing ? "text" : undefined
      }}
      tabIndex={0}
      role="textbox"
      aria-readonly={!editing}
      aria-multiline
      aria-label={element.text || element.kind}
      contentEditable={editing}
      suppressContentEditableWarning
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onFocus={onSelect}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {!editing && element.text}
      {selected && !editing && (
        <div
          className={styles.resizeHandle}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        />
      )}
    </div>
  );
}
