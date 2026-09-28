import type { JSX } from "react";
import { Navigate } from "react-router-dom";
import { readLastLocation } from "../state/persist";

const DEFAULT_BOOK_ID = "PSA";
const DEFAULT_CHAPTER = 23;

export function RootRedirect(): JSX.Element {
  const last = readLastLocation();
  const bookId = last?.bookId ?? DEFAULT_BOOK_ID;
  const chapter = last?.chapter ?? DEFAULT_CHAPTER;
  return <Navigate to={`/read/${bookId}/${chapter}/ai`} replace />;
}
