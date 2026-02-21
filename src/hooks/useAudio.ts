import { useMemo, useRef } from 'react';

export interface AudioApi {
  unlock: () => void;
  spin: () => void;
  win: (amount: number) => void;
  topThreeHit: (symbolId: 0 | 1 | 8) => void;
  squidTriple: () => void;
  coinStream: (amount: number) => void;
  reach: () => void;
  jackpot: () => void;
  bonus: () => void;
  coin: () => void;
}

export function useAudio(): AudioApi {
  const acRef = useRef<AudioContext | null>(null);

  const getAC = (): AudioContext => {
    if (!acRef.current) acRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
    return acRef.current;
  };

  const tone = (freq: number, dur: number, type: OscillatorType = 'square', vol = 0.25, delay = 0): void => {
    try {
      const ac = getAC();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g);
      g.connect(ac.destination);
      o.type = type;
      o.frequency.value = freq;
      const t0 = ac.currentTime + delay;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch {
      // ignore
    }
  };

  return useMemo(
    () => ({
      unlock: () => {
        if (getAC().state === 'suspended') void getAC().resume();
      },
      spin: () => {
        for (let i = 0; i < 6; i += 1) tone(180 + i * 40, 0.06, 'square', 0.1, i * 0.05);
      },
      win: (amount: number) => {
        if (amount > 200) {
          [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, 'square', 0.3, i * 0.1));
          setTimeout(() => [659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'square', 0.32, i * 0.08)), 500);
        } else {
          [440, 523, 659].forEach((f, i) => tone(f, 0.12, 'square', 0.22, i * 0.08));
        }
      },
      topThreeHit: (symbolId: 0 | 1 | 8) => {
        const melody = symbolId === 0
          ? [523, 659, 784, 1047, 1319, 1568, 1319, 1047, 784]
          : symbolId === 1
            ? [392, 494, 587, 740, 988, 1175, 988, 740, 587]
            : [440, 554, 659, 880, 988, 1319, 988, 880, 659];
        melody.forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, i * 0.13));
      },
      squidTriple: () => {
        [185, 220, 277, 330, 415, 554, 740, 988].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.28, i * 0.1));
        [740, 988, 1319].forEach((f, i) => tone(f, 0.28, 'square', 0.2, 0.95 + i * 0.08));
      },
      coinStream: (amount: number) => {
        const hits = Math.max(6, Math.min(26, (amount / 8) | 0));
        for (let i = 0; i < hits; i += 1) {
          const d = i * 0.038;
          tone(1175 + ((i % 3) * 120), 0.045, 'square', 0.1, d);
          tone(1480 + ((i % 2) * 90), 0.03, 'triangle', 0.06, d + 0.02);
        }
      },
      reach: () => {
        tone(300, 0.09, 'sawtooth', 0.18);
        setTimeout(() => tone(400, 0.09, 'sawtooth', 0.18), 110);
        setTimeout(() => tone(550, 0.14, 'sawtooth', 0.22), 220);
      },
      jackpot: () => {
        [523, 659, 784, 1047, 1319, 1047, 784, 659, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.38, i * 0.11));
      },
      bonus: () => {
        [220, 277, 330, 440, 554, 659, 880].forEach((f, i) => tone(f, 0.14, 'triangle', 0.28, i * 0.09));
      },
      coin: () => {
        tone(1047, 0.06, 'square', 0.12);
        tone(1319, 0.06, 'square', 0.12, 0.05);
      },
    }),
    [],
  );
}
