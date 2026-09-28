export interface StrippedContext {
  pre: string;
  hit: string;
  post: string;
}

const MARK_RE = /^([\s\S]*?)<mark>([\s\S]*?)<\/mark>([\s\S]*)$/;

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

// GraphQL concordance context comes back with the matched word wrapped in
// <mark></mark> — split it into the parts around the highlight.
export function stripMarkContext(context: string): StrippedContext {
  const ctx = String(context || "");
  const m = ctx.match(MARK_RE);
  if (!m) return { pre: stripTags(ctx), hit: "", post: "" };
  return { pre: stripTags(m[1]), hit: stripTags(m[2]), post: stripTags(m[3]) };
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`%${key}`, value), template);
}

export type TemplatePart = { type: "text"; text: string } | { type: "slot"; key: string };

// fillTemplate's counterpart for when the substituted values aren't
// strings but JSX — an <a> per slot, say. Splitting rather than
// interpolating keeps word order in the translation instead of the
// component: "Photo by %s on %l" and "Foto de %s en %l" both come back as
// alternating text/slot parts the caller renders in order.
//
// Only the keys passed in are treated as slots; any other "%x" stays
// literal text.
export function splitTemplate(template: string, keys: readonly string[]): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let buffer = "";
  // Longest first, so a short key can't shadow a longer one that starts
  // with it (keys ["s", "source"] must match "%source" as "source").
  const byLength = [...keys].sort((a, b) => b.length - a.length);

  for (let i = 0; i < template.length; i += 1) {
    const key = template[i] === "%" ? byLength.find((k) => template.startsWith(k, i + 1)) : undefined;
    if (key === undefined) {
      buffer += template[i];
      continue;
    }
    if (buffer) parts.push({ type: "text", text: buffer });
    buffer = "";
    parts.push({ type: "slot", key });
    i += key.length;
  }

  if (buffer) parts.push({ type: "text", text: buffer });
  return parts;
}
