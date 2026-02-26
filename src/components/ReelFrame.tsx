import styles from '../styles/App.module.css';

interface Props {
  bet: 1 | 2 | 3;
  stopState: number;
  pressedReel: number | null;
  goldMode?: boolean;
}

/**
 * Padding-top added to .reelStage (must match CSS).
 * Pushes the canvas down so the top "3" marker has room above.
 */
const REEL_PAD = 32;

/**
 * Diagonal offset: extrapolated diagonal line from cell centres to marker
 * column at ~26px from the reel edge.  240 * 26 / 402 ≈ 15.5 → use 16.
 */
const DIAG_OFFSET = 16;

/** Row-centre Y positions inside the 240px reel area, offset by REEL_PAD. */
const ROW_Y_ABS = [REEL_PAD + 40, REEL_PAD + 120, REEL_PAD + 200]; // 72, 152, 232

/** Diagonal "3" marker positions: extrapolated line intersections. */
const DIAG_TOP = REEL_PAD - DIAG_OFFSET;            // 16
const DIAG_BOT = REEL_PAD + 240 + DIAG_OFFSET;      // 288

interface MarkerDef {
  label: string;
  y: number;
  bet: 1 | 2 | 3;
  color: string;
}

/** Left markers, top to bottom: 3, 2, 1, 2, 3 */
const SIDE_MARKERS: MarkerDef[] = [
  { label: '3', y: DIAG_TOP, bet: 3, color: '#ffd700' },
  { label: '2', y: ROW_Y_ABS[0], bet: 2, color: '#00ff88' },
  { label: '1', y: ROW_Y_ABS[1], bet: 1, color: '#00e5ff' },
  { label: '2', y: ROW_Y_ABS[2], bet: 2, color: '#00ff88' },
  { label: '3', y: DIAG_BOT, bet: 3, color: '#ffd700' },
];

export function ReelFrame({ bet, stopState, pressedReel, goldMode = false }: Props) {
  return (
    <>
      {/* Left markers */}
      <div className={`${styles.paylineMarkers} ${styles.left}`}>
        {SIDE_MARKERS.map((m, i) => {
          const active = bet >= m.bet;
          return (
            <span
              key={i}
              className={`${styles.plMarker} ${active ? styles.plMarkerOn : ''}`}
              style={{
                top: `${m.y}px`,
                '--pl-color': m.color,
              } as React.CSSProperties}
            >
              {m.label}
            </span>
          );
        })}
      </div>

      {/* Right markers */}
      <div className={`${styles.paylineMarkers} ${styles.right}`}>
        {SIDE_MARKERS.map((m, i) => {
          const active = bet >= m.bet;
          return (
            <span
              key={i}
              className={`${styles.plMarker} ${active ? styles.plMarkerOn : ''}`}
              style={{
                top: `${m.y}px`,
                '--pl-color': m.color,
              } as React.CSSProperties}
            >
              {m.label}
            </span>
          );
        })}
      </div>

      {/* Reel stop buttons */}
      <div className={styles.reelStopRow}>
        {[0, 1, 2].map((i) => {
          const pressed = pressedReel === i;
          const stopped = stopState > i + 1 || (stopState === i + 1 && pressed);
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className={`${styles.reelStopCap} ${goldMode ? styles.reelStopCapGold : ''} ${stopped ? styles.stopped : ''} ${pressed ? styles.pressed : ''}`}
            />
          );
        })}
      </div>
    </>
  );
}
