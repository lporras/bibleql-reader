import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { PlatformCapabilities, SaveImageRequest, SaveImageResult } from "./types";

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
async function saveImage(request: SaveImageRequest): Promise<SaveImageResult> {
  const ext = request.mimeType === "image/png" ? "png" : "jpg";

  // Desktop resolves to null when the user dismisses the dialog, but Android's
  // DialogPlugin *rejects* with "File picker cancelled" instead (it maps
  // Activity.RESULT_CANCELED onto invoke.reject). Both mean the same thing to
  // the caller, so normalise the rejection into a null rather than letting it
  // surface as a save failure.
  let filePath: string | null;
  try {
    filePath = await save({
      defaultPath: request.suggestedName,
      filters: [{ name: "Image", extensions: [ext] }]
    });
  } catch (err) {
    const message = (err as { message?: string }).message ?? String(err);
    if (/cancel/i.test(message)) return { canceled: true };
    throw new Error(`Couldn't save the image: ${message}`);
  }

  if (!filePath) return { canceled: true };

  try {
    await writeFile(filePath, request.data);
  } catch (err) {
    const message = (err as { message?: string }).message ?? String(err);
    throw new Error(`Couldn't save the image: ${message}`);
  }

  return { canceled: false, filePath };
}

export const tauriPlatform: Pick<PlatformCapabilities, "saveImage"> = { saveImage };
