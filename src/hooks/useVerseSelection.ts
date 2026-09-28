import { useCallback, useEffect, useMemo, useState } from "react";

export interface VerseSelectionApi {
  selected: Set<number>;
  isSelected(n: number): boolean;
  /** Click (no modifier): toggle a single verse. Shift-click: extend a
   *  range from the last-touched verse. Cmd/Ctrl-click: toggle without
   *  disturbing the rest of the selection (same as a plain click here —
   *  kept as its own branch so callers can wire either explicitly). */
  toggle(n: number, extend: boolean): void;
  clear(): void;
  count: number;
}

/**
 * Multi-verse selection for the current chapter. There's no existing
 * selection mechanism to reuse (the app only ever had a read-only
 * `?from`/`?to` highlight) — this is new, chapter-scoped state that
 * clears whenever the reading location changes, so a stale selection
 * from a previous chapter never leaks into "Create Image".
 */
export function useVerseSelection(bookId: string, chapter: number): VerseSelectionApi {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [anchor, setAnchor] = useState<number | null>(null);

  useEffect(() => {
    setSelected(new Set());
    setAnchor(null);
  }, [bookId, chapter]);

  const toggle = useCallback(
    (n: number, extend: boolean) => {
      setSelected((prev) => {
        if (extend && anchor !== null) {
          const [from, to] = anchor <= n ? [anchor, n] : [n, anchor];
          const next = new Set(prev);
          for (let v = from; v <= to; v++) next.add(v);
          return next;
        }
        const next = new Set(prev);
        if (next.has(n)) next.delete(n);
        else next.add(n);
        return next;
      });
      setAnchor(n);
    },
    [anchor]
  );

  const clear = useCallback(() => {
    setSelected(new Set());
    setAnchor(null);
  }, []);

  const isSelected = useCallback((n: number) => selected.has(n), [selected]);

  return useMemo(
    () => ({ selected, isSelected, toggle, clear, count: selected.size }),
    [selected, isSelected, toggle, clear]
  );
}
