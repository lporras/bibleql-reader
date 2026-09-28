import { useEffect, useState } from "react";

export function useViewportWidth(): number {
  const [vw, setVw] = useState<number>(() => (typeof window === "undefined" ? 1440 : window.innerWidth));

  useEffect(() => {
    const onResize = (): void => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return vw;
}
