import { useEffect, useState } from "react";

/**
 * Delays reflecting `value` until it's stopped changing for `delayMs` —
 * used to keep the Unsplash search box from firing a request per
 * keystroke (spec §27: "Only issue the API request after a short
 * debounce").
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
