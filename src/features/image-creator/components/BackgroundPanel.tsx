import { useState, type JSX } from "react";
import { STR, type Locale } from "../../../data/strings";
import { ImageIcon } from "../../../components/icons";
import { CURATED_IMAGES } from "../data/curatedImages";
import { pickLocalBackground } from "../providers/localImage";
import { selectCuratedBackground } from "../providers/curatedImages";
import { HAS_UNSPLASH_KEY } from "../providers/UnsplashProvider";
import { UnsplashSearch } from "./UnsplashSearch";
import { PhotoCredit } from "./PhotoCredit";
import type { Background } from "../model/types";
import styles from "./BackgroundPanel.module.scss";

interface BackgroundPanelProps {
  locale: Locale;
  background: Background | null;
  onChangeBackground(background: Background): void;
  onChangeCrop(crop: Background["crop"]): void;
  onChangeOverlay(overlay: NonNullable<Background["overlay"]>): void;
}

type BackgroundTab = "unsplash" | "curated" | "disk";

export function BackgroundPanel({ locale, background, onChangeBackground, onChangeCrop, onChangeOverlay }: BackgroundPanelProps): JSX.Element {
  const t = STR[locale];
  const [tab, setTab] = useState<BackgroundTab>("curated");
  const [busy, setBusy] = useState(false);

  async function handleChoose(): Promise<void> {
    setBusy(true);
    try {
      const picked = await pickLocalBackground();
      if (picked) onChangeBackground(picked);
    } finally {
      setBusy(false);
    }
  }

  const overlay = background?.overlay ?? { enabled: false, color: "#000000", opacity: 0.35 };

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>{t.background}</div>

      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" className={styles.tab} data-active={tab === "curated"} onClick={() => setTab("curated")}>
          {t.curatedTab}
        </button>
        <button type="button" role="tab" className={styles.tab} data-active={tab === "unsplash"} onClick={() => setTab("unsplash")}>
          {t.searchTab}
        </button>
        <button type="button" role="tab" className={styles.tab} data-active={tab === "disk"} onClick={() => setTab("disk")}>
          {t.diskTab}
        </button>
      </div>

      {tab === "unsplash" &&
        (HAS_UNSPLASH_KEY ? (
          <UnsplashSearch locale={locale} onChangeBackground={onChangeBackground} />
        ) : (
          <p className={styles.help}>{t.unsplashOffline}</p>
        ))}

      {tab === "curated" && (
        <div className={styles.curatedGrid}>
          {CURATED_IMAGES.map((image) => (
            // See UnsplashSearch.tsx — the credit holds links, so it sits
            // beside the button rather than inside it.
            <figure className={styles.card} key={image.id}>
              <button
                type="button"
                className={styles.curatedThumb}
                aria-label={t.useAsBackground}
                onClick={() => onChangeBackground(selectCuratedBackground(image))}
              >
                <img src={image.thumbUrl} alt="" loading="lazy" />
              </button>
              <figcaption>
                <PhotoCredit locale={locale} attribution={image.attribution} />
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {tab === "disk" && (
        <button type="button" className={styles.chooseButton} onClick={handleChoose} disabled={busy}>
          <ImageIcon size={14} />
          {t.uploadFromDisk}
        </button>
      )}

      {!background && <p className={styles.help}>{t.noBackground}</p>}

      {background?.attribution && (
        <p className={styles.attribution} data-testid="selected-attribution">
          <PhotoCredit locale={locale} attribution={background.attribution} />
        </p>
      )}

      {background && (
        <>
          <label className={styles.field}>
            <span>{t.overlay}</span>
            <input
              type="checkbox"
              checked={overlay.enabled}
              aria-label={t.overlay}
              onChange={(event) => onChangeOverlay({ ...overlay, enabled: event.target.checked })}
            />
          </label>

          {overlay.enabled && (
            <label className={styles.field}>
              <span>{t.overlay}</span>
              <input
                type="range"
                min={0}
                max={0.7}
                step={0.05}
                value={overlay.opacity}
                aria-label={t.overlay}
                onChange={(event) => onChangeOverlay({ ...overlay, opacity: Number(event.target.value) })}
              />
            </label>
          )}

          <label className={styles.field}>
            <span>{t.zoom}</span>
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.05}
              value={background.crop.scale}
              aria-label={t.zoom}
              onChange={(event) => onChangeCrop({ ...background.crop, scale: Number(event.target.value) })}
            />
          </label>

          <label className={styles.field}>
            <span>{t.positionX}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={background.crop.x}
              aria-label={t.positionX}
              onChange={(event) => onChangeCrop({ ...background.crop, x: Number(event.target.value) })}
            />
          </label>

          <label className={styles.field}>
            <span>{t.positionY}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={background.crop.y}
              aria-label={t.positionY}
              onChange={(event) => onChangeCrop({ ...background.crop, y: Number(event.target.value) })}
            />
          </label>
        </>
      )}
    </div>
  );
}
