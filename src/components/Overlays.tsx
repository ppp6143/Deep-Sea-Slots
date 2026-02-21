import { useEffect, useRef } from 'react';
import styles from '../styles/App.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  sub: string;
}

function drawPixelWhale(ctx: CanvasRenderingContext2D): void {
  const px = 6;
  const W = 48;
  const H = 30;
  ctx.clearRect(0, 0, W * px, H * px);

  const put = (x: number, y: number, c: string): void => {
    ctx.fillStyle = c;
    ctx.fillRect(x * px, y * px, px, px);
  };

  const body = '#58c3ff';
  const body2 = '#42a8e8';
  const dark = '#1f4d82';
  const belly = '#d8f0ff';
  const nose = '#9ee6ff';
  const eye = '#081f33';
  const glow = '#bff6ff';

  const cx = 24;
  const drawSpan = (y: number, hw: number, color: string): void => {
    for (let x = cx - hw; x <= cx + hw; x += 1) put(x, y, color);
  };

  for (let y = 6; y <= 18; y += 1) {
    const t = Math.abs(12 - y);
    const hw = Math.max(5, 15 - t);
    drawSpan(y, hw, body);
  }
  for (let y = 11; y <= 20; y += 1) {
    const t = Math.abs(15 - y);
    const hw = Math.max(4, 13 - t);
    drawSpan(y, hw, dark);
  }
  for (let y = 11; y <= 18; y += 1) {
    const t = Math.abs(14 - y);
    const hw = Math.max(3, 9 - t);
    drawSpan(y, hw, belly);
  }
  for (let y = 4; y <= 7; y += 1) {
    const hw = 3 - Math.abs(5 - y);
    drawSpan(y, hw + 1, nose);
  }
  put(cx - 1, 8, nose);
  put(cx, 8, glow);
  put(cx + 1, 8, nose);

  for (let y = 9; y <= 12; y += 1) {
    put(cx - 10, y, body2);
    put(cx - 11, y, body2);
    put(cx + 10, y, body2);
    put(cx + 11, y, body2);
  }
  for (let y = 10; y <= 13; y += 1) {
    put(cx - 14, y, body2);
    put(cx + 14, y, body2);
  }

  for (let y = 20; y <= 24; y += 1) {
    const hw = Math.max(1, 4 - Math.abs(22 - y));
    drawSpan(y, hw, body2);
  }

  put(cx - 5, 10, eye);
  put(cx + 5, 10, eye);
  put(cx - 6, 10, glow);
  put(cx + 6, 10, glow);
  put(cx - 2, 11, dark);
  put(cx - 1, 11, dark);
  put(cx + 1, 11, dark);
  put(cx + 2, 11, dark);

  ctx.fillStyle = 'rgba(170, 238, 255, 0.18)';
  ctx.fillRect((cx - 6) * px, 6 * px, 12 * px, 2 * px);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(6 * px, 24 * px, 36 * px, 3 * px);
}

export function Overlays({ open, onClose, sub }: Props) {
  const whaleRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open || !whaleRef.current) return;
    const c = whaleRef.current;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawPixelWhale(ctx);
  }, [open]);

  if (!open) return null;
  return (
    <div className={styles.jpOverlay}>
      <div className={styles.jpPanel}>
        <canvas ref={whaleRef} className={styles.jpWhale} width={288} height={180} />
        <div className={styles.jpText}>JACKPOT!!</div>
        <div className={styles.jpSub}>{sub}</div>
        <div className={styles.jpHint}>[ SPACE ] でも続行</div>
        <button className={styles.jpClose} onClick={onClose}>続ける</button>
      </div>
    </div>
  );
}
