import styles from '../styles/App.module.css';

interface Props {
  coins: number;
  win: number;
  combo: number;
  free: number;
  bonusActive?: boolean;
}

export function InfoBar({ coins, win, combo, free, bonusActive = false }: Props) {
  const mult = combo >= 5 ? 4 : combo >= 3 ? 2 : combo >= 2 ? 1.5 : 1;
  return (
    <div className={styles.infoBar}>
      <div className={styles.infoBox}><div className={styles.infoLabel}>COINS</div><div className={styles.infoVal}>{coins}</div></div>
      <div className={styles.infoBox}><div className={styles.infoLabel}>WIN</div><div className={styles.infoVal}>{win}</div></div>
      <div className={styles.infoBox}><div className={styles.infoLabel}>COMBO</div><div className={`${styles.infoVal} ${combo >= 2 ? styles.hot : ''}`}>{combo >= 2 ? `x${mult}` : 'x1'}</div></div>
      <div className={styles.infoBox}><div className={styles.infoLabel}>{bonusActive ? 'FREE SPIN' : 'FREE'}</div><div className={styles.infoVal}>{free}</div></div>
    </div>
  );
}
