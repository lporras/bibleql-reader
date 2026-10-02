import { webPlatform } from "./web";
import { tauriPlatform } from "./tauri";
import type { PlatformCapabilities } from "./types";

// Single seam for platform-specific behavior. Most capabilities
// (file picker, clipboard) are plain Chromium/WebKit/web-platform
// behavior and serve any shell unchanged; saving files and opening them
// in their default app are the pieces that need a real Tauri adapter.
export function getPlatform(): PlatformCapabilities {
  return { ...webPlatform, ...tauriPlatform };
}

export type {
  PlatformCapabilities,
  PickedFile,
  SaveDocumentRequest,
  SaveImageRequest,
  SaveImageResult
} from "./types";
