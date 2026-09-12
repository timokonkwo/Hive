import styles from './landing.module.css';

/** Keep complete text in the HTML; motion is applied only after hydration. */
export function RevealLines({ lines }: { lines: string[] }) {
  return lines.map(line => <span className={styles.revealLine} data-reveal-line key={line}><span data-reveal-item>{line}</span></span>);
}
