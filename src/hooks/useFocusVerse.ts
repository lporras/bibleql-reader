import { useEffect, type RefObject } from "react";

// Scrolls the reader so the cited verse sits near the top of the column.
// `resolvedAt` should change each time fresh passage data arrives (e.g. a
// query's `dataUpdatedAt`), so the scroll re-runs once the target verse
// actually exists in the DOM, not just when `fromVerse` changes.
export function useFocusVerse(
  containerRef: RefObject<HTMLDivElement | null>,
  fromVerse: number | null,
  resolvedAt: number | undefined
): void {
  useEffect(() => {
    if (!fromVerse || !containerRef.current) return;
    const box = containerRef.current;
    const raf = requestAnimationFrame(() => {
      const el = box.querySelector(`[data-verse="${fromVerse}"]`);
      if (!el) return;
      box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 72;
    });
    return () => cancelAnimationFrame(raf);
  }, [containerRef, fromVerse, resolvedAt]);
}
