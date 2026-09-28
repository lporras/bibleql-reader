import { useMemo } from "react";
import { useTranslations } from "./useTranslations";
import { FALLBACK_TRANSLATIONS } from "../data/fallbackTranslations";
import type { TranslationSummary } from "../types/bible";

export interface LabeledTranslation {
  identifier: string;
  label: string;
}

export interface TranslationOptions {
  options: LabeledTranslation[];
  labelOf(id: string): string;
}

// Names alone, disambiguated only where two editions share one display name.
export function useTranslationOptions(): TranslationOptions {
  const { data } = useTranslations();
  const source: TranslationSummary[] = data && data.length ? data : FALLBACK_TRANSLATIONS;

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
