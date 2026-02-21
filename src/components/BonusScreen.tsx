import styles from '../styles/App.module.css';

interface Props {
  open: boolean;
  free: number;
  total: number;
  stopState: number;
  winMsg: string;
  onAction: () => void;
  onEnd: () => void;
}

export function BonusScreen({ open, free, total, stopState, winMsg, onAction, onEnd }: Props) {
  if (!open) return null;
  const label = stopState === 0 ? (free <= 0 ? 'FINISH!' : 'FREE SPIN!') : `STOP  ${['左', '中', '右'][stopState - 1] ?? ''}`;

  return (
    <div className={styles.bonusOverlay}>
      <div className={styles.bonusTitle}>BONUS GAME</div>
      <div className={styles.bonusStats}>
        <div className={styles.bonusStat}><span>FREE SPINS</span><strong>{free}</strong></div>
        <div className={styles.bonusStat}><span>獲得コイン</span><strong>{total}</strong></div>
      </div>
      <div className={styles.bonusMsg}>{winMsg}</div>
      <button className={styles.bonusBtn} onPointerDown={(e) => { e.preventDefault(); onAction(); }}>{label}</button>
      <button className={styles.bonusExit} onClick={onEnd}>ボーナス終了</button>
    </div>
  );
}
