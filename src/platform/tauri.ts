import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { IS_IOS } from "./host";
import type { PlatformCapabilities, SaveDocumentRequest, SaveImageRequest, SaveImageResult } from "./types";

// The only capability that genuinely needs the shell: a webview has no
// filesystem access of its own, so the native "Save As" dialog and disk
// write go through Tauri's dialog + fs plugins. Everything else in
// PlatformCapabilities is plain web platform behaviour — see platform/web.ts.
//
// On desktop, `writeFile` requires the chosen path to fall inside the
// `fs:allow-write-file` scope declared in src-tauri/capabilities/default.json;
// that scope lists the user directories a save dialog can realistically land
// in. On Android the dialog hands back a SAF `content://` URI rather than a
// path, and the fs plugin's mobile `resolve_file` takes its URL branch — which
// opens the URI through the Kotlin side and skips the path scope entirely — so
// those globs neither help nor hinder there.
async function saveBytes(
  data: Uint8Array,
  suggestedName: string,
  filter: { name: string; extensions: string[] },
  what: string
): Promise<SaveImageResult> {
  // Desktop resolves to null when the user dismisses the dialog, but Android's
  // DialogPlugin *rejects* with "File picker cancelled" instead (it maps
  // Activity.RESULT_CANCELED onto invoke.reject). Both mean the same thing to
  // the caller, so normalise the rejection into a null rather than letting it
  // surface as a save failure.
  let filePath: string | null;
  try {
    filePath = await save({
      defaultPath: suggestedName,
      filters: [filter]
    });
  } catch (err) {
    const message = (err as { message?: string }).message ?? String(err);
    if (/cancel/i.test(message)) return { canceled: true };
    throw new Error(`Couldn't save the ${what}: ${message}`);
  }

  if (!filePath) return { canceled: true };

  try {
    await writeFile(filePath, data);
  } catch (err) {
    const message = (err as { message?: string }).message ?? String(err);
    throw new Error(`Couldn't save the ${what}: ${message}`);
  }

  return { canceled: false, filePath };
}

// On iOS the save dialog is the Files picker, but people expect an exported
// image in Photos, which isn't part of the file system. The share sheet's
// "Save Image" puts it there (and offers Messages, AirDrop, …) with no native
// code — it does need NSPhotoLibraryAddUsageDescription in Info.plist
// (src-tauri/gen/apple/project.yml), or iOS kills the app when it's tapped.
// `navigator.share` needs a recent user gesture; if rendering took long
// enough for WebKit to refuse (NotAllowedError), fall back to the Files
// picker rather than failing the save.
async function shareImage(request: SaveImageRequest): Promise<SaveImageResult | null> {
  const file = new File([request.data as BlobPart], request.suggestedName, { type: request.mimeType });
  if (!navigator.canShare?.({ files: [file] })) return null;
  try {
    await navigator.share({ files: [file] });
    return { canceled: false };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "AbortError") return { canceled: true };
    if (name === "NotAllowedError") return null;
    throw new Error(`Couldn't share the image: ${(err as { message?: string }).message ?? String(err)}`);
  }
}

async function saveImage(request: SaveImageRequest): Promise<SaveImageResult> {
  if (IS_IOS) {
    const shared = await shareImage(request);
    if (shared) return shared;
  }
  const ext = request.mimeType === "image/png" ? "png" : "jpg";
  return saveBytes(request.data, request.suggestedName, { name: "Image", extensions: [ext] }, "image");
}

function saveDocument(request: SaveDocumentRequest): Promise<SaveImageResult> {
  return saveBytes(request.data, request.suggestedName, { name: "PDF", extensions: ["pdf"] }, "document");
}

// iOS has no documented way to hand a file to another app's viewer (the
// opener's open_path there is a UIApplication.open, which does nothing for a
// file), so show it in Quick Look — the local plugin in src-tauri/plugins/.
function openFile(filePath: string): Promise<void> {
  if (IS_IOS) return invoke("plugin:quicklook|preview", { path: filePath });
  return openPath(filePath);
}

export const tauriPlatform: Pick<PlatformCapabilities, "saveImage" | "saveDocument" | "openFile"> = {
  saveImage,
  saveDocument,
  openFile
};
