// Split out of UnsplashProvider.ts (which calls `createApi` at module
// scope) so this guard is importable/testable without
// __UNSPLASH_ACCESS_KEY__ being defined — same reasoning as
// mapUnsplashPhoto.ts.

export const UNSPLASH_API_ORIGIN = "https://api.unsplash.com";

/**
 * Whether a URL is safe to send the access key to as a download-tracking
 * ping. The ping has to use the API-provided `links.download_location`
 * verbatim (that's what carries the signed `ixid`), which means the URL
 * comes from a response body rather than being built here — and we attach
 * `Authorization: Client-ID ...` to it by hand. Without this check, an
 * unexpected or tampered `download_location` would hand the access key to
 * whatever host it names, so restrict it to the one endpoint it can
 * legitimately be: `https://api.unsplash.com/photos/:id/download`.
 */
export function isTrackableDownloadLocation(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.origin === UNSPLASH_API_ORIGIN && parsed.pathname.endsWith("/download");
}
