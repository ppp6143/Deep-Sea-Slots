import styles from '../styles/App.module.css';

interface Props {
  bet: 1 | 2 | 3;
  stopState: number;
  pressedReel: number | null;
}

function activeForLine(lineId: 1 | 2 | 3, bet: 1 | 2 | 3): boolean {
  if (lineId === 1) return bet >= 1;
  if (lineId === 2) return bet >= 2;
  return bet >= 3;
}

export function ReelFrame({ bet, stopState, pressedReel }: Props) {
  const l1 = activeForLine(1, bet);
  const l2 = activeForLine(2, bet);
  const l3 = activeForLine(3, bet);

  return (
    <>
      <div className={`${styles.lineMarks} ${styles.left}`}>
        <span className={`${styles.mark} ${l3 ? styles.markOn : ''}`}>3</span>
        <span className={`${styles.mark} ${l2 ? styles.markOn : ''}`}>2</span>
        <span className={`${styles.mark} ${l1 ? styles.markOn : ''}`}>1</span>
        <span className={`${styles.mark} ${l2 ? styles.markOn : ''}`}>2</span>
        <span className={`${styles.mark} ${l3 ? styles.markOn : ''}`}>3</span>
      </div>

      <div className={`${styles.lineMarks} ${styles.right}`}>
        <span className={`${styles.mark} ${l3 ? styles.markOn : ''}`}>3</span>
        <span className={`${styles.mark} ${l2 ? styles.markOn : ''}`}>2</span>
        <span className={`${styles.mark} ${l1 ? styles.markOn : ''}`}>1</span>
        <span className={`${styles.mark} ${l2 ? styles.markOn : ''}`}>2</span>
        <span className={`${styles.mark} ${l3 ? styles.markOn : ''}`}>3</span>
      </div>

      <div className={styles.reelStopRow}>
        {[0, 1, 2].map((i) => {
          const pressed = pressedReel === i;
          // Keep the lamp glow on the final button during the press/snap frame before stopState resets.
          const stopped = stopState > i + 1 || (stopState === i + 1 && pressed);
          return (
            <button key={i} type="button" tabIndex={-1} aria-hidden="true" className={`${styles.reelStopCap} ${stopped ? styles.stopped : ''} ${pressed ? styles.pressed : ''}`} />
          );
        })}
      </div>
    </>
  );
}
