import { useEffect, useRef } from 'react';
import styles from '../styles/App.module.css';
import type { Mood } from '../types/game';

interface Props {
  text: string;
  mood: Mood;
}

export function CharacterPanel({ text, mood }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 64, 64);
    const S = 4;
    const F = (x: number, y: number, w: number, h: number, c: string): void => {
      ctx.fillStyle = c;
      ctx.fillRect(x * S, y * S, w * S, h * S);
    };

    const body = mood === 'excited' ? '#FF44AA' : mood === 'worried' ? '#AA88CC' : '#FF88CC';
    F(4, 5, 8, 7, body); F(3, 7, 10, 5, body);
    F(2, 3, 2, 4, '#FF44AA'); F(12, 3, 2, 4, '#FF44AA');
    F(1, 2, 1, 3, '#FF6699'); F(13, 2, 1, 3, '#FF6699');
    F(5, 5, 6, 5, body);
    if (mood === 'happy' || mood === 'excited') {
      F(6, 6, 2, 1, '#000'); F(9, 6, 2, 1, '#000');
      F(7, 7, 1, 1, '#000'); F(10, 7, 1, 1, '#000');
    } else {
      F(6, 6, 2, 2, '#000'); F(9, 6, 2, 2, '#000');
      F(7, 6, 1, 1, '#fff'); F(10, 6, 1, 1, '#fff');
    }
    if (mood === 'sad') {
      F(7, 10, 3, 1, '#000'); F(6, 9, 1, 1, '#000'); F(10, 9, 1, 1, '#000');
    } else {
      F(7, 9, 3, 1, '#000');
    }
    F(5, 8, 1, 1, '#FFAACC'); F(11, 8, 1, 1, '#FFAACC');
    F(5, 12, 6, 2, body);
    F(4, 13, 2, 2, '#FF44AA'); F(10, 13, 2, 2, '#FF44AA');
    F(4, 11, 2, 2, body); F(10, 11, 2, 2, body);
  }, [mood]);

  useEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    el.classList.add(styles.on);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      el.classList.remove(styles.on);
    }, 2600);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [text, mood]);

  return (
    <div className={styles.charPanel}>
      <div ref={bubbleRef} className={styles.charBubble}>{text}</div>
      <canvas ref={ref} className={styles.charSprite} width={64} height={64} />
    </div>
  );
}
