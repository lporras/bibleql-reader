import { webPlatform } from "./web";
import { tauriPlatform } from "./tauri";
import type { PlatformCapabilities } from "./types";

// Single seam for platform-specific behavior. Most capabilities
// (file picker, clipboard) are plain Chromium/WebKit/web-platform
// behavior and serve any shell unchanged; `saveImage` is the one piece
// that needs a real Tauri adapter.
export function getPlatform(): PlatformCapabilities {
  return { ...webPlatform, ...tauriPlatform };
}

export type { PlatformCapabilities, PickedFile, SaveImageRequest, SaveImageResult } from "./types";
