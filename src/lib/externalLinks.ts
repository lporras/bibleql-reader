import { openUrl } from "@tauri-apps/plugin-opener";

// Was src/main/externalLinks.ts, which patched Electron's window-open and
// will-navigate behaviour from the main process. A Tauri webview has the
// same problem from the other direction: an <a> click would navigate the
// app itself away to unsplash.com, with no address bar and no way back.
//
// That matters for compliance, not just polish: the Unsplash API
// guidelines require a working "link back to their Unsplash profile" (the
// attribution links in features/image-creator/components/PhotoCredit.tsx),
// and a chromeless in-app view is a poor substitute for the user's own
// browser.
//
// There's no main process to put this in any more, so it's a single
// delegated listener installed once from main.tsx. Same policy as before:
// never navigate in-app, hand https off to the system browser, drop
// everything else (file:, about:, custom schemes) silently.

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function attachExternalLinkHandling(): void {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as Element | null)?.closest?.("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    // In-app HashRouter links ("#/read/..." and anything same-document)
    // must keep working normally.
    const resolved = new URL(href, window.location.href);
    if (resolved.origin === window.location.origin) return;

    // Anything leaving this origin never navigates the webview.
    event.preventDefault();
    if (isHttps(resolved.href)) void openUrl(resolved.href);
  });
}
