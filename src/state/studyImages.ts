import { newId } from "../lib/id";
import { STUDY_IMAGE_SCHEME, studyImageIds } from "./study";
import type { Study } from "../types/study";

// Images attached to study bodies. They're kept in IndexedDB rather than as
// data: URLs in the HTML: the studies store is one localStorage JSON blob
// (~5 MB for the whole origin), and once a write overflows it, every later
// edit is silently lost. A study body refers to an image as
// `study-image:<id>` (see STUDY_IMAGE_SCHEME); the editor's node view and the
// PDF export both resolve that through here.

const DB_NAME = "biblereader";
const STORE = "studyImages";

/** Longest side, in pixels, an attached image is stored at. Plenty for a printed page. */
const MAX_SIDE = 1600;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed"))), type, quality)
  );
}

/** Decodes an image file (throws if it isn't one) and draws it, at most `maxSide` px, onto a canvas. */
export async function drawImage(source: Blob, maxSide: number, background?: string): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/**
 * Stores a picked, pasted or dropped image (downscaled) and returns the
 * `src` to put in the body. Photos stay JPEG; anything else becomes PNG so
 * a logo's transparency survives.
 */
export async function saveStudyImage(file: Blob): Promise<string> {
  const canvas = await drawImage(file, MAX_SIDE);
  const blob = file.type === "image/jpeg" ? await toBlob(canvas, "image/jpeg", 0.88) : await toBlob(canvas, "image/png");
  const id = newId();
  await request("readwrite", (store) => store.put(blob, id));
  return `${STUDY_IMAGE_SCHEME}${id}`;
}

/** The stored image behind a `study-image:` src, or null if it's gone. */
export async function loadStudyImage(src: string): Promise<Blob | null> {
  if (!src.startsWith(STUDY_IMAGE_SCHEME)) return null;
  const blob = await request<Blob | undefined>("readonly", (store) => store.get(src.slice(STUDY_IMAGE_SCHEME.length)));
  return blob ?? null;
}

// One object URL per image for the session: the editor re-creates node views
// on every undo/redo and study switch, and each would otherwise mint a new one.
const objectUrls = new Map<string, Promise<string | null>>();

/** A URL an <img> can show: an object URL for stored images, anything else as-is. */
export function studyImageUrl(src: string): Promise<string | null> {
  if (!src.startsWith(STUDY_IMAGE_SCHEME)) return Promise.resolve(src);
  let url = objectUrls.get(src);
  if (!url) {
    url = loadStudyImage(src)
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null);
    objectUrls.set(src, url);
  }
  return url;
}

/** Deletes stored images that no study body refers to any more. */
export async function pruneStudyImages(studies: Study[]): Promise<void> {
  try {
    const keep = new Set(studies.flatMap((s) => studyImageIds(s.descriptionHtml)));
    const keys = await request("readonly", (store) => store.getAllKeys());
    const stale = keys.filter((key) => !keep.has(String(key)));
    if (!stale.length) return;
    await Promise.all(stale.map((key) => request("readwrite", (store) => store.delete(key))));
  } catch {
    // IndexedDB unavailable: nothing was stored, so nothing to prune.
  }
}
