import type { JSX } from "react";
import { STR, type Locale } from "../../../data/strings";
import { splitTemplate } from "../../../lib/format";
import type { Attribution } from "../model/types";
import styles from "./PhotoCredit.module.scss";

interface PhotoCreditProps {
  locale: Locale;
  attribution: Attribution;
  className?: string;
}

/**
 * The one place the required "Photo by {photographer} on Unsplash" phrase
 * is rendered, with both names as links. Used under every search-result
 * thumbnail, under every curated thumbnail, and for the selected
 * background — the Unsplash guidelines want the photographer and Unsplash
 * attributed and linked wherever a photo is shown, so having a single
 * renderer keeps those three places from drifting apart.
 *
 * Word order comes from the translated template (`photoBy`), not from
 * this component — hence splitTemplate rather than string interpolation
 * (the links can't be interpolated into a string).
 */
export function PhotoCredit({ locale, attribution, className }: PhotoCreditProps): JSX.Element {
  const t = STR[locale];
  const parts = splitTemplate(t.photoBy, ["s", "l"]);

  const slots: Record<string, { text: string; url?: string }> = {
    s: { text: attribution.photographerName, url: attribution.photographerUrl },
    l: { text: attribution.sourceName, url: attribution.sourceUrl }
  };

  return (
    <span className={className ? `${styles.credit} ${className}` : styles.credit}>
      {parts.map((part, index) => {
        if (part.type === "text") return <span key={index}>{part.text}</span>;
        const slot = slots[part.key];
        // Both URLs are optional on Attribution — fall back to plain text
        // rather than rendering a dead link.
        if (!slot.url) return <span key={index}>{slot.text}</span>;
        return (
          <a key={index} href={slot.url} target="_blank" rel="noreferrer">
            {slot.text}
          </a>
        );
      })}
    </span>
  );
}
