import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
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

function saveImage(request: SaveImageRequest): Promise<SaveImageResult> {
  const ext = request.mimeType === "image/png" ? "png" : "jpg";
  return saveBytes(request.data, request.suggestedName, { name: "Image", extensions: [ext] }, "image");
}

function saveDocument(request: SaveDocumentRequest): Promise<SaveImageResult> {
  return saveBytes(request.data, request.suggestedName, { name: "PDF", extensions: ["pdf"] }, "document");
}

export const tauriPlatform: Pick<PlatformCapabilities, "saveImage" | "saveDocument"> = { saveImage, saveDocument };
