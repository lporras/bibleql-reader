import { useState, type JSX } from "react";
import { STR, type Locale } from "../../../data/strings";
import { Spinner } from "../../../components/Spinner";
import { PhotoCredit } from "./PhotoCredit";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useUnsplashSearch } from "../queries/useUnsplashSearch";
import { selectUnsplashBackground } from "../providers/UnsplashProvider";
import type { Background } from "../model/types";
import styles from "./UnsplashSearch.module.scss";

interface UnsplashSearchProps {
  locale: Locale;
  onChangeBackground(background: Background): void;
}

export function UnsplashSearch({ locale, onChangeBackground }: UnsplashSearchProps): JSX.Element {
  const t = STR[locale];
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 400);

  const { data: pages, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, error } = useUnsplashSearch(debouncedQuery);
  const results = pages?.flatMap((page) => page.results) ?? [];

  return (
    <div className={styles.wrap}>
      <input
        type="search"
        className={styles.input}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t.searchUnsplash}
        aria-label={t.searchUnsplash}
      />

      {isLoading && (
        <div className={styles.spinnerRow}>
          <Spinner />
        </div>
      )}

      {error && <p className={styles.notice}>{t.searchError}</p>}

      {!isLoading && !error && debouncedQuery && results.length === 0 && <p className={styles.notice}>{t.searchEmpty}</p>}

      {results.length > 0 && (
        // Keyed on the search term (not on pagination) — forces React to
        // fully tear down and rebuild this subtree on a new search rather
        // than diffing it item-by-item against the previous term's grid.
        // Without this, a new search's 24 results share this container
        // with the previous search's, and only differ by which `id`s
        // are present; a plain per-item `key` *should* be enough for
        // React to unmount/remount every changed slot on its own, but in
        // practice this was intermittently showing a new search's photo
        // painted over an old one that hadn't been cleared yet — a stale
        // DOM node/paint issue a full remount sidesteps entirely, whatever
        // its exact cause. "Load More" appends pages under the *same*
        // term, so it isn't affected by this key and keeps existing
        // thumbnails stable.
        <div className={styles.grid} key={debouncedQuery}>
          {results.map((result) => (
            // figure/figcaption rather than a credit inside the button:
            // the credit contains links, and an <a> can't be nested in a
            // <button>. They're siblings so both stay clickable.
            <figure className={styles.card} key={result.id}>
              <button
                type="button"
                className={styles.thumb}
                aria-label={t.useAsBackground}
                onClick={() => onChangeBackground(selectUnsplashBackground(result))}
              >
                <img src={result.thumbnailUrl} alt="" />
              </button>
              <figcaption>
                <PhotoCredit locale={locale} attribution={result.attribution} />
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {hasNextPage && (
        <button type="button" className={styles.moreButton} onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? t.loading : t.more}
        </button>
      )}
    </div>
  );
}
