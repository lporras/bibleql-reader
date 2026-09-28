// The renderer loads from file:// in production, where `navigator.clipboard`
// isn't guaranteed to be available (it's gated on a secure context). Fall back
// to the old selection-and-execCommand trick so copy works either way.
function copyViaSelection(text: string): void {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } catch {
    // nothing else to try
  } finally {
    area.remove();
  }
}

export function copyText(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => copyViaSelection(text));
    return;
  }
  copyViaSelection(text);
}
