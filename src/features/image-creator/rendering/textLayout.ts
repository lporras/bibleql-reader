// Greedy word-wrap for the Canvas 2D export renderer. The DOM editor gets
// wrapping for free from the browser (TextBox.tsx is a plain
// `white-space: pre-wrap` box); Canvas 2D has no such layout engine, so
// this is the one place that reimplements it — deliberately simple
// (single greedy pass, break-on-space) rather than trying to replicate
// every CSS text-wrapping nuance.

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }

  return lines;
}
