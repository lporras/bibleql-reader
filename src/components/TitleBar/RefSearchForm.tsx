import { useState, type FormEvent, type JSX } from "react";
import { useAppState } from "../../state/AppStateContext";
import { useOpenRef } from "../../hooks/useOpenRef";
import { parseRef } from "../../lib/refs";
import { STR } from "../../data/strings";
import { SearchIcon } from "../icons";
import styles from "./RefSearchForm.module.scss";

export function RefSearchForm(): JSX.Element {
  const { state } = useAppState();
  const t = STR[state.locale];
  const openRef = useOpenRef();
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!parseRef(value)) return;
    openRef(value);
    setValue("");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {/* Looks and behaves like a text field, so it must not drag the
          window: "deep" on the title bar would otherwise make this
          box's padding and icon draggable (only the <input> itself is
          auto-excluded). Was `-webkit-app-region: no-drag` under Electron. */}
      <div className={styles.box} data-tauri-drag-region="false">
        <SearchIcon className={styles.icon} />
        <input
          className={styles.input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t.refPlaceholder}
        />
      </div>
    </form>
  );
}
