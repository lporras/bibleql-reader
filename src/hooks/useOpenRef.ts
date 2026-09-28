import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { parseRef } from "../lib/refs";

// Shared navigation target for the ref-search box, concordance hits, search
// hits, and AI-answer reference chips — all of these just need to land on a
// parsed reference, optionally highlighting a verse range.
export function useOpenRef(): (text: string) => void {
  const navigate = useNavigate();
  const { panel = "ai" } = useParams();

  return useCallback(
    (text: string) => {
      const parsed = parseRef(text);
      if (!parsed) return;
      const qs = parsed.from ? `?from=${parsed.from}&to=${parsed.to ?? parsed.from}` : "";
      navigate(`/read/${parsed.bookId}/${parsed.chapter}/${panel}${qs}`);
    },
    [navigate, panel]
  );
}
