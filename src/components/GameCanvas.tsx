import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { Particle } from '../types/game';
import styles from '../styles/App.module.css';

interface RuntimeRefs {
  mainPos: MutableRefObject<[number, number, number]>;
  bonusPos: MutableRefObject<[number, number, number]>;
  strips: MutableRefObject<[number[], number[], number[]]>;
  bonusStrips: MutableRefObject<[number[], number[], number[]]>;
  particles: MutableRefObject<Particle[]>;
}

interface Props {
  runtime: RuntimeRefs;
  symbols: CanvasImageSource[];
  bonusActive: boolean;
  reachOn: boolean;
  isSpinning: boolean;
  combo: number;
  onFrame: (dt: number) => void;
  className?: string;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  s: number;
  dx: number;
  a: number;
}

export function GameCanvas({ runtime, symbols, bonusActive, reachOn, isSpinning, combo, onFrame, className }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef(0);
  const GLASS_ALPHA = 0.16;
  const GLASS_DOT_ALPHA = 0.1;
  const bubbles = useMemo<Bubble[]>(() => Array.from({ length: bonusActive ? 14 : 24 }, () => ({
    x: Math.random() * 520,
    y: 360 + Math.random() * 300,
    r: 2 + Math.random() * 6,
    s: 0.25 + Math.random() * 0.7,
    dx: (Math.random() - 0.5) * 0.25,
    a: 0.1 + Math.random() * 0.2,
  })), [bonusActive]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (now: number): void => {
      const dt = Math.min(34, now - last);
      last = now;
      timeRef.current += dt * 0.001;
      onFrame(dt);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#010815');
      gradient.addColorStop(0.5, '#020e20');
      gradient.addColorStop(1, '#041628');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      const t = timeRef.current;
      const caustic = (bonusActive ? 0.03 : 0.06) + Math.sin(t * 1.7) * (bonusActive ? 0.01 : 0.02);
      ctx.fillStyle = `rgba(0,190,255,${caustic})`;
      const causticCount = bonusActive ? 2 : 3;
      for (let i = 0; i < causticCount; i += 1) {
        const cx = ((t * (bonusActive ? 24 : 40) + i * 120) % (w + 80)) - 40;
        ctx.fillRect(cx, 0, bonusActive ? 20 : 26, h);
      }

      ctx.strokeStyle = 'rgba(0,200,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      bubbles.forEach((b) => {
        b.y -= b.s;
        b.x += b.dx;
        if (b.y < -20) {
          b.y = h + 20;
          b.x = Math.random() * w;
        }
        ctx.moveTo(b.x + b.r, b.y);
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      });
      ctx.stroke();

      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      const scanStep = bonusActive ? 5 : 3;
      for (let y = 0; y < h; y += scanStep) ctx.fillRect(0, y, w, 1);

      const reelAreaX = 0;
      const reelAreaY = 0;
      const reelAreaW = w;
      const reelAreaH = 240;
      const reelGap = 3;
      const reelW = (reelAreaW - reelGap * 2) / 3;
      const cellH = 80;
      const drawPos = bonusActive ? runtime.bonusPos.current : runtime.mainPos.current;
      const drawStrips = bonusActive ? runtime.bonusStrips.current : runtime.strips.current;

      ctx.fillStyle = '#000';
      ctx.fillRect(reelAreaX, reelAreaY, reelAreaW, reelAreaH);

      for (let r = 0; r < 3; r += 1) {
        const x = reelAreaX + r * (reelW + reelGap);
        const y = reelAreaY;
        const strip = drawStrips[r];
        const L = strip.length;
        const pos = drawPos[r];
        const top = ((Math.floor(pos) % L) + L) % L;
        const frac = pos - Math.floor(pos);

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, reelW, 240);
        ctx.clip();
        ctx.fillStyle = '#010914';
        ctx.fillRect(x, y, reelW, 240);

        for (let i = 0; i < 4; i += 1) {
          const sym = strip[(top + i) % L];
          const img = symbols[sym];
          const dy = y + (i - frac) * cellH;
          if (img) {
            ctx.drawImage(img, x + (reelW - 64) / 2, dy + 8, 64, 64);
          }
        }
        ctx.restore();

      }

      const sep1 = reelW;
      const sep2 = reelW * 2 + reelGap;
      ctx.fillStyle = 'rgba(0,229,255,0.38)';
      ctx.fillRect(sep1, reelAreaY, reelGap, reelAreaH);
      ctx.fillRect(sep2, reelAreaY, reelGap, reelAreaH);

      // CRT-like glass overlay: subtle tint + pixel grain + reflection.
      ctx.save();
      ctx.fillStyle = `rgba(185,220,255,${GLASS_ALPHA})`;
      ctx.fillRect(reelAreaX, reelAreaY, reelAreaW, reelAreaH);

      // Coarser dot grain for a chunkier pixel-glass look.
      ctx.fillStyle = `rgba(230,245,255,${GLASS_DOT_ALPHA})`;
      const dotStep = bonusActive ? 7 : 5;
      for (let gy = reelAreaY + 1; gy < reelAreaY + reelAreaH; gy += dotStep) {
        for (let gx = reelAreaX + ((gy / dotStep) % 2) * 2; gx < reelAreaX + reelAreaW; gx += dotStep) {
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      const glare = ctx.createLinearGradient(reelAreaX, reelAreaY, reelAreaX + reelAreaW, reelAreaY + reelAreaH);
      glare.addColorStop(0, 'rgba(255,255,255,0.22)');
      glare.addColorStop(0.12, 'rgba(255,255,255,0.06)');
      glare.addColorStop(0.4, 'rgba(255,255,255,0)');
      glare.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glare;
      ctx.fillRect(reelAreaX, reelAreaY, reelAreaW, reelAreaH);

      const topShade = ctx.createLinearGradient(reelAreaX, reelAreaY, reelAreaX, reelAreaY + 24);
      topShade.addColorStop(0, 'rgba(255,255,255,0.24)');
      topShade.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = topShade;
      ctx.fillRect(reelAreaX, reelAreaY, reelAreaW, 24);

      const bottomShade = ctx.createLinearGradient(reelAreaX, reelAreaY + reelAreaH - 28, reelAreaX, reelAreaY + reelAreaH);
      bottomShade.addColorStop(0, 'rgba(0,0,0,0)');
      bottomShade.addColorStop(1, 'rgba(0,0,0,0.26)');
      ctx.fillStyle = bottomShade;
      ctx.fillRect(reelAreaX, reelAreaY + reelAreaH - 28, reelAreaW, 28);

      ctx.strokeStyle = 'rgba(255,255,255,0.17)';
      ctx.strokeRect(reelAreaX + 1.5, reelAreaY + 1.5, reelAreaW - 3, reelAreaH - 3);
      ctx.restore();

      ctx.fillStyle = `rgba(255,255,255,${isSpinning ? 0.08 : 0.04})`;
      ctx.fillRect(0, reelAreaH * 0.5 - 1, reelAreaW, 2);

      if (reachOn) {
        const pulse = 0.6 + Math.sin(t * 14) * 0.4;
        ctx.fillStyle = `rgba(255,80,80,${pulse})`;
        ctx.font = '16px "Press Start 2P"';
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 12;
        ctx.fillText('REACH', reelAreaX + reelAreaW / 2 - 46, reelAreaY + reelAreaH / 2);
        ctx.shadowBlur = 0;
      }

      const arr = runtime.particles.current;
      runtime.particles.current = arr.filter((p) => p.life > 0);
      runtime.particles.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(p.x + p.size * 0.22, p.y + p.size * 0.22, p.size * 0.2, p.size * 0.2);
        if (p.size > 7) {
          ctx.fillRect(p.x - 1, p.y + p.size * 0.5, p.size + 2, 1);
          ctx.fillRect(p.x + p.size * 0.5, p.y - 1, 1, p.size + 2);
        }
      });
      ctx.globalAlpha = 1;

      if (combo >= 2) {
        const boost = Math.min(combo, 6);
        for (let i = 0; i < boost; i += 1) {
          const sx = ((t * 80 + i * 57) % w) | 0;
          const sy = (22 + Math.sin(t * 3 + i) * 10) | 0;
          ctx.fillStyle = 'rgba(255,215,0,0.65)';
          ctx.fillRect(sx, sy, 2, 2);
        }
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [bubbles, bonusActive, combo, isSpinning, onFrame, runtime, symbols, reachOn]);

  return <canvas ref={ref} className={className ?? styles.gameCanvas} />;
}

