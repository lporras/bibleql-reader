import { useMemo, type JSX } from "react";
import { parseAiText, type AiInline } from "../../lib/aiText";
import styles from "./AiText.module.scss";

function Inlines({ inlines }: { inlines: AiInline[] }): JSX.Element {
  return (
    <>
      {inlines.map((i, n) =>
        i.bold ? <strong key={n}>{i.text}</strong> : i.italic ? <em key={n}>{i.text}</em> : <span key={n}>{i.text}</span>
      )}
    </>
  );
}

// An assistant answer as paragraphs and lists (lib/aiText.ts reads them out
// of whatever shape the model replied in). Text only — no HTML from the
// answer ever reaches the DOM.
export function AiText({ text }: { text: string }): JSX.Element {
  const blocks = useMemo(() => parseAiText(text), [text]);
  return (
    <div className={styles.text}>
      {blocks.map((b, n) =>
        b.kind === "p" ? (
          <p key={n}>
            <Inlines inlines={b.inlines} />
          </p>
        ) : b.kind === "ul" ? (
          <ul key={n}>
            {b.items.map((item, k) => (
              <li key={k}>
                <Inlines inlines={item} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={n} start={b.start}>
            {b.items.map((item, k) => (
              <li key={k}>
                <Inlines inlines={item} />
              </li>
            ))}
          </ol>
        )
      )}
    </div>
  );
}
