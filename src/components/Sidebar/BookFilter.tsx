import type { ChangeEvent, JSX } from "react";
import styles from "./BookFilter.module.scss";

interface BookFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function BookFilter({ value, onChange, placeholder }: BookFilterProps): JSX.Element {
  return (
    <input
      className={styles.input}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}
