import type { JSX } from "react";
import { STR, type Locale } from "../../../data/strings";
import { DEFAULT_FONT, FONTS } from "../model/fonts";
import type { TextElement } from "../model/types";
import { FontPicker } from "./FontPicker";
import styles from "./PropertiesPanel.module.scss";

interface PropertiesPanelProps {
  locale: Locale;
  element: TextElement | null;
  onUpdate(patch: Partial<TextElement>): void;
}

const ALIGN_OPTIONS: TextElement["textAlign"][] = ["left", "center", "right"];

export function PropertiesPanel({ locale, element, onUpdate }: PropertiesPanelProps): JSX.Element {
  const t = STR[locale];

  if (!element) {
    return (
      <div className={styles.panel}>
        <div className={styles.sectionTitle}>{t.properties}</div>
        <p className={styles.help}>{t.noElementSelected}</p>
      </div>
    );
  }

  const alignLabel: Record<TextElement["textAlign"], string> = {
    left: t.alignLeft,
    center: t.alignCenter,
    right: t.alignRight
  };

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>{t.properties}</div>

      <p className={styles.help}>{t.editTextHint}</p>

      <label className={styles.field}>
        <span>{t.font}</span>
        <FontPicker
          fonts={FONTS}
          value={FONTS.find((f) => f.family === element.fontFamily) ?? DEFAULT_FONT}
          label={t.font}
          onChange={(font) => onUpdate({ fontFamily: font.family })}
        />
      </label>

      <label className={styles.field}>
        <span>{t.fontSize}</span>
        <input
          type="range"
          min={0.015}
          max={0.12}
          step={0.002}
          value={element.fontSize}
          aria-label={t.fontSize}
          onChange={(event) => onUpdate({ fontSize: Number(event.target.value) })}
        />
      </label>

      <label className={styles.field}>
        <span>{t.color}</span>
        <input
          type="color"
          value={element.color}
          aria-label={t.color}
          onChange={(event) => onUpdate({ color: event.target.value })}
        />
      </label>

      <div className={styles.field}>
        <span>{t.align}</span>
        <div className={styles.alignGroup}>
          {ALIGN_OPTIONS.map((align) => (
            <button
              key={align}
              type="button"
              className={styles.alignButton}
              aria-pressed={element.textAlign === align}
              aria-label={alignLabel[align]}
              title={alignLabel[align]}
              onClick={() => onUpdate({ textAlign: align })}
            >
              {alignLabel[align][0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
