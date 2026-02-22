import { useEffect, useRef, useState } from 'react';
import styles from '../styles/App.module.css';

interface Props {
  coins: number;
  win: number;
  combo: number;
  free: number;
  bonusActive?: boolean;
}

export function InfoBar({ coins, win, combo, free, bonusActive = false }: Props) {
  const mult = combo >= 5 ? 2 : combo >= 3 ? 1.5 : combo >= 2 ? 1.25 : 1;
  const [displayCoins, setDisplayCoins] = useState(coins);
  const displayRef = useRef(coins);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    displayRef.current = displayCoins;
  }, [displayCoins]);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const from = displayRef.current;
    const to = coins;
    if (to <= from) {
      setDisplayCoins(to);
      return;
    }

    const delta = to - from;
    const duration = Math.min(1200, Math.max(260, delta * 7));
    const start = performance.now();

    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / duration);
      setDisplayCoins(Math.floor(from + delta * (1 - (1 - p) ** 2)));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [coins]);

  return (
    <div className={styles.infoBar}>
      <div className={styles.infoBox}><div className={styles.infoLabel}>COINS</div><div className={`${styles.infoVal} ${displayCoins !== coins ? styles.countUp : ''}`}>{displayCoins}</div></div>
      <div className={styles.infoBox}><div className={styles.infoLabel}>WIN</div><div className={styles.infoVal}>{win}</div></div>
      <div className={styles.infoBox}><div className={styles.infoLabel}>COMBO</div><div className={`${styles.infoVal} ${combo >= 2 ? styles.hot : ''}`}>{combo >= 2 ? `x${mult}` : 'x1'}</div></div>
      <div className={styles.infoBox}><div className={styles.infoLabel}>{bonusActive ? 'FREE SPIN' : 'FREE'}</div><div className={styles.infoVal}>{free}</div></div>
    </div>
  );
}
