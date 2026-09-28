import { useMemo, useState, type JSX, type KeyboardEvent } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useTranslationOptions } from "../../queries/useTranslationOptions";
import { STR } from "../../data/strings";
import { normalize } from "../../lib/refs";
import styles from "./TranslationCombo.module.scss";

interface TranslationComboProps {
  which: "a" | "b";
}

const MAX_ITEMS = 60;

export function TranslationCombo({ which }: TranslationComboProps): JSX.Element {
  const { state, actions } = useAppState();
  const t = STR[state.locale];
  const { options, labelOf } = useTranslationOptions();
  const current = which === "b" ? state.transB : state.transA;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const q = normalize(query.trim());
    return options
      .filter((o) => !q || normalize(o.label).indexOf(q) > -1 || normalize(o.identifier).indexOf(q) > -1)
      .slice(0, MAX_ITEMS);
  }, [options, query]);

  function select(identifier: string): void {
    if (which === "b") actions.setTransB(identifier);
    else actions.setTransA(identifier);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (items.length) select(items[0].identifier);
  }

  return (
    <div className={styles.wrap}>
      <input
        className={styles.input}
        value={open ? query : labelOf(current)}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => {
          // Delay so a click on a dropdown item registers before we close it.
          setTimeout(() => setOpen(false), 130);
        }}
        onKeyDown={handleKeyDown}
        placeholder={t.pickTranslation}
      />
      {open && (
        <div className={styles.dropdown}>
          {items.map((o) => (
            <button
              key={o.identifier}
              type="button"
              className={styles.item}
              data-active={o.identifier === current}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(o.identifier)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
