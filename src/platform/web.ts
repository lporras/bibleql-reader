import type { PickedFile, PlatformCapabilities } from "./types";

// A hidden <input type="file"> already opens the real native OS picker in
// Chromium and WebKit, so this needs no IPC and works unchanged inside any
// Chromium/WebKit-based webview (including the Tauri shell). Don't
// reach for the Tauri dialog plugin here — it would add shell coupling
// and preload surface to buy nothing over this.
function readAsPickedFile(file: File): Promise<PickedFile> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected file isn't a readable image."));
    };
    img.onload = () => {
      resolve({
        fileName: file.name,
        mimeType: file.type,
        objectUrl,
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.src = objectUrl;
  });
}

function pickImageFile(): Promise<PickedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    // No native cancel event exists for <input type="file">; resolve to
    // null if the window regains focus without a change ever firing.
    let settled = false;
    function onFocus(): void {
      window.removeEventListener("focus", onFocus);
      setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 300);
    }
    window.addEventListener("focus", onFocus);

    input.onchange = () => {
      window.removeEventListener("focus", onFocus);
      const file = input.files?.[0];
      if (!file) {
        settled = true;
        resolve(null);
        return;
      }
      readAsPickedFile(file).then((picked) => {
        settled = true;
        resolve(picked);
      }, reject);
    };

    input.click();
  });
}

// Copying an image to the system clipboard is a standard web platform
// capability (Async Clipboard API) — not shell-specific, so it needs
// no IPC and belongs here alongside pickImageFile, not in platform/tauri.ts.
async function copyImageToClipboard(data: Uint8Array, mimeType: "image/png"): Promise<void> {
  // TS's DOM lib types `Uint8Array` as generic over `ArrayBufferLike`
  // (which includes SharedArrayBuffer), while `BlobPart` wants one backed
  // specifically by `ArrayBuffer` — a typing mismatch only, since every
  // caller here constructs `data` from `Blob.arrayBuffer()`, never a
  // SharedArrayBuffer.
  const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: mimeType });
  await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]);
}

export const webPlatform: Pick<PlatformCapabilities, "pickImageFile" | "copyImageToClipboard"> = {
  pickImageFile,
  copyImageToClipboard
};
