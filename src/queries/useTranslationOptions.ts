import { useMemo } from "react";
import { useTranslations } from "./useTranslations";
import { useOfflineInstalled } from "./useOfflineInstalled";
import { FALLBACK_TRANSLATIONS } from "../data/fallbackTranslations";
import { readCachedTranslations } from "../state/persist";
import { mergeInstalled, pickTranslationSource } from "../lib/offline";

export interface LabeledTranslation {
  identifier: string;
  label: string;
}

export interface TranslationOptions {
  options: LabeledTranslation[];
  labelOf(id: string): string;
}

// Names alone, disambiguated only where two editions share one display name.
// Offline, the list comes from the last one fetched, and downloaded
// translations are always included.
export function useTranslationOptions(): TranslationOptions {
  const { data } = useTranslations();
  const { installed } = useOfflineInstalled();
  const cached = useMemo(() => readCachedTranslations(), []);
  const source = useMemo(
    () => mergeInstalled(pickTranslationSource(data, cached, FALLBACK_TRANSLATIONS), installed),
    [data, cached, installed]
  );

  return useMemo(() => {
    const nameCount: Record<string, number> = {};
    source.forEach((x) => {
      nameCount[x.name] = (nameCount[x.name] ?? 0) + 1;
    });
    const options = source
      .map((x) => ({
        identifier: x.identifier,
        label: nameCount[x.name] > 1 ? `${x.name} (${x.identifier})` : x.name
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const labelOf = (id: string): string => options.find((o) => o.identifier === id)?.label ?? id;
    return { options, labelOf };
  }, [source]);
}
