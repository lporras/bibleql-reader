import type { JSX } from "react";
import styles from "./Spinner.module.scss";

export function Spinner(): JSX.Element {
  return <span className={styles.spinner} />;
}
