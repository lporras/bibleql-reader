// Platform-neutral capabilities the UI can use without depending on the
// desktop shell directly. Domain code (the Image Creator, in particular)
// must go through this interface, not Tauri's plugin APIs, so it stays
// portable across shells (and runs in a plain browser under the E2E
// suite). See docs/platform-abstraction.md.

export interface PickedFile {
  fileName: string;
  mimeType: string;
  /**
   * An object URL (`URL.createObjectURL`), not a base64 data URL — this
   * avoids ~37% base64 bloat and a giant string in memory for large
   * photos (spec §27). The caller is responsible for revoking it via
   * `URL.revokeObjectURL` once the asset is no longer needed (see
   * `features/image-creator/assets/imageAssets.ts`).
   */
  objectUrl: string;
  width: number;
  height: number;
}

export interface SaveImageRequest {
  data: Uint8Array;
  suggestedName: string;
  mimeType: "image/png" | "image/jpeg";
}

export interface SaveImageResult {
  canceled: boolean;
  filePath?: string;
}

export interface PlatformCapabilities {
  /**
   * Opens a picker for a single local image and returns it decoded
   * (intrinsic dimensions resolved) or null if the user cancelled.
   */
  pickImageFile(): Promise<PickedFile | null>;

  /**
   * Native "Save As" dialog + disk write (spec §15/§16). Needs real OS
   * access a webview doesn't have on its own, so this is the one
   * capability backed by the Tauri shell — see platform/tauri.ts.
   */
  saveImage(request: SaveImageRequest): Promise<SaveImageResult>;

  /**
   * Copies image bytes to the system clipboard. Uses the standard Async
   * Clipboard API (`navigator.clipboard.write`) — a normal web platform
   * capability, not shell-specific, so it needs no IPC and works
   * unchanged in any Chromium/WebKit-based shell.
   */
  copyImageToClipboard(data: Uint8Array, mimeType: "image/png"): Promise<void>;
}
