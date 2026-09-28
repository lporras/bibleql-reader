import { useState, type JSX, type KeyboardEvent } from "react";
import type { FontDefinition } from "../model/fonts";
import styles from "./FontPicker.module.scss";

interface FontPickerProps {
  fonts: FontDefinition[];
  value: FontDefinition;
  label: string;
  onChange(font: FontDefinition): void;
}

// A native <select> can't be screenshotted/verified reliably (its open
// list renders as a separate OS-level surface on macOS) and font styling
// of its options is inconsistently supported across platforms. This is a
// bespoke dropdown instead — same shape as Sidebar/TranslationCombo.tsx —
// so every font name renders in its own typeface, in the page itself,
// everywhere.
export function FontPicker({ fonts, value, label, onChange }: FontPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === "Escape") setOpen(false);
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        style={{ fontFamily: value.family }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 130)}
        onKeyDown={handleKeyDown}
      >
        {value.label}
      </button>
      {open && (
        <div className={styles.dropdown} role="listbox" aria-label={label}>
          {fonts.map((font) => (
            <button
              key={font.id}
              type="button"
              role="option"
              aria-selected={font.id === value.id}
              className={styles.item}
              data-active={font.id === value.id}
              style={{ fontFamily: font.family }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(font);
                setOpen(false);
              }}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
