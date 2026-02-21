import styles from '../styles/App.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  sub: string;
}

export function Overlays({ open, onClose, sub }: Props) {
  if (!open) return null;
  return (
    <div className={styles.jpOverlay}>
      <div className={styles.jpIcon}>🐋</div>
      <div className={styles.jpText}>JACKPOT!!</div>
      <div className={styles.jpSub}>{sub}</div>
      <button className={styles.jpClose} onClick={onClose}>続ける</button>
    </div>
  );
}
