import styles from '../styles/App.module.css';

interface Props {
  bet: 1 | 2 | 3;
  linesCount: 1 | 3 | 5;
  stopState: number;
  bonusActive: boolean;
  onBet: (bet: 1 | 2 | 3) => void;
  onSpin: () => void;
  onMax: () => void;
}

export function Controls({ bet, linesCount, stopState, bonusActive, onBet, onSpin, onMax }: Props) {
  const spinLabel = stopState === 0 ? (bonusActive ? 'FREE SPIN!' : 'SPIN') : `STOP  ${['左', '中', '右'][stopState - 1] ?? ''}`;
  const maxLabel = bonusActive ? 'ボーナス終了' : 'MAX';
  return (
    <div className={styles.controls}>
      <div className={styles.betRow}>
        <span className={styles.betLabel}>BET:</span>
        <button disabled={bonusActive} className={`${styles.betBtn} ${bet === 1 ? styles.on : ''}`} onClick={() => onBet(1)}>1</button>
        <button disabled={bonusActive} className={`${styles.betBtn} ${bet === 2 ? styles.on : ''}`} onClick={() => onBet(2)}>2</button>
        <button disabled={bonusActive} className={`${styles.betBtn} ${bet === 3 ? styles.on : ''}`} onClick={() => onBet(3)}>3</button>
        <span className={styles.betLabel}>LINES:</span>
        <span className={styles.linesVal}>{linesCount}</span>
      </div>
        <div className={styles.actionRow}>
          <button className={styles.maxBtn} onPointerDown={(e) => { e.preventDefault(); onMax(); }}>{maxLabel}</button>
          <button className={styles.spinBtn} onPointerDown={(e) => { e.preventDefault(); onSpin(); }}>{spinLabel}</button>
        </div>
      <div className={styles.keyHint}>[ SPACE ] SPIN / STOP</div>
    </div>
  );
}
