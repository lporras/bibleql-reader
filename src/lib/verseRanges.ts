// Encodes a set of (possibly non-contiguous) verse numbers as a compact,
// URL-safe string ("16-17,20") and back. Shared by the Reader's
// multi-select UI, the "Create Image" handoff URL, and the Image
// Creator's own display formatting — one place owns this format so it
// doesn't drift between producer and consumer.

export function encodeVerses(verses: Iterable<number>): string {
  const sorted = Array.from(new Set(verses)).sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    if (start !== undefined) {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    }
    start = current;
    prev = current;
  }

  return parts.join(",");
}

export function decodeVerses(encoded: string): number[] {
  if (!encoded.trim()) return [];
  const result = new Set<number>();

  for (const rawPart of encoded.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const from = Number(rangeMatch[1]);
      const to = Number(rangeMatch[2]);
      for (let n = Math.min(from, to); n <= Math.max(from, to); n++) result.add(n);
      continue;
    }
    const n = Number(part);
    if (Number.isFinite(n) && n > 0) result.add(n);
  }

  return Array.from(result).sort((a, b) => a - b);
}

/** "16, 17, 20" -> "16-17, 20" for display, grouping consecutive runs. */
export function formatVerseList(verses: number[]): string {
  return encodeVerses(verses).split(",").join(", ");
}
