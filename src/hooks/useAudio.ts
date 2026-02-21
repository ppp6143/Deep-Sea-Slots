import { useMemo, useRef } from 'react';

export type NormalBgmId = 'abyss' | 'p1' | 'p2';
type BgmPresetId = NormalBgmId | 'bonus_kraken_parade';
type Step = number | null;

type BgmPreset = {
  id: BgmPresetId;
  name: string;
  mode: 'normal' | 'bonus';
  tempo?: number;
  lead?: Step[];
  bass?: Step[];
  audioSrc?: string;
  volume?: number;
};

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
  startNormalBgm: (id: NormalBgmId) => void;
  playBonusBgm: () => void;
  resumeNormalBgm: () => void;
  stopBgm: () => void;
  normalBgmPresets: Array<{ id: NormalBgmId; name: string }>;
}

function c(...bars: Step[][]): Step[] {
  return bars.flat();
}

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const BGMS: BgmPreset[] = [
  {
    id: 'abyss',
    name: 'Abyss Drift',
    mode: 'normal',
    tempo: 94,
    lead: c(
      [64, null, 67, null, 69, null, 67, null, 64, null, 62, null, 60, null, 62, null],
      [64, null, 67, null, 71, null, 67, null, 64, null, 62, null, 60, null, 62, null],
      [64, null, 67, null, 69, null, 67, null, 64, null, 62, null, 60, null, 62, null],
      [67, null, 71, null, 72, null, 71, null, 69, null, 67, null, 64, null, 62, null],
      [64, null, 67, null, 69, null, 67, null, 64, null, 62, null, 60, null, 62, null],
      [64, null, 67, null, 71, null, 67, null, 64, null, 62, null, 60, null, 62, null],
      [72, null, 71, null, 69, null, 67, null, 64, null, 67, null, 69, null, 71, null],
      [67, null, 64, null, 62, null, 60, null, 62, null, 64, null, 60, null, 62, null],
      [64, null, 67, null, 69, null, 67, null, 64, null, 62, null, 60, null, 62, null],
      [67, null, 71, null, 72, null, 71, null, 69, null, 67, null, 64, null, 62, null],
      [64, null, 67, null, 71, null, 67, null, 64, null, 62, null, 60, null, 62, null],
      [64, null, 67, null, 69, null, 67, null, 64, null, 62, null, 60, null, 62, null],
    ),
    bass: c(
      [36, null, null, null, 38, null, null, null, 41, null, null, null, 38, null, null, null],
      [36, null, null, null, 38, null, null, null, 43, null, null, null, 40, null, null, null],
      [36, null, null, null, 38, null, null, null, 41, null, null, null, 38, null, null, null],
      [43, null, null, null, 45, null, null, null, 43, null, null, null, 41, null, null, null],
      [36, null, null, null, 38, null, null, null, 41, null, null, null, 38, null, null, null],
      [36, null, null, null, 38, null, null, null, 43, null, null, null, 40, null, null, null],
      [45, null, null, null, 43, null, null, null, 41, null, null, null, 40, null, null, null],
      [41, null, null, null, 40, null, null, null, 38, null, null, null, 36, null, null, null],
      [36, null, null, null, 38, null, null, null, 41, null, null, null, 38, null, null, null],
      [43, null, null, null, 45, null, null, null, 43, null, null, null, 41, null, null, null],
      [36, null, null, null, 38, null, null, null, 43, null, null, null, 40, null, null, null],
      [36, null, null, null, 38, null, null, null, 41, null, null, null, 38, null, null, null],
    ),
  },
  { id: 'p1', name: 'P1', mode: 'normal', audioSrc: '/audio/P1.mp3', volume: 0.2 },
  { id: 'p2', name: 'P2', mode: 'normal', audioSrc: '/audio/P2.mp3', volume: 0.2 },
  {
    id: 'bonus_kraken_parade',
    name: 'Bonus Kraken Parade',
    mode: 'bonus',
    tempo: 128,
    lead: c(
      [72, 75, 79, null, 82, null, 79, null, 75, null, 72, null, 75, null, 79, null],
      [72, 75, 79, null, 84, null, 79, null, 75, null, 72, null, 75, null, 79, null],
      [74, 77, 81, null, 84, null, 81, null, 77, null, 74, null, 77, null, 81, null],
      [72, 75, 79, null, 82, null, 79, null, 75, null, 72, null, 75, null, 79, null],
      [72, 75, 79, null, 84, null, 79, null, 75, null, 72, null, 75, null, 79, null],
    ),
    bass: c(
      [43, null, 43, null, 47, null, 47, null, 41, null, 41, null, 43, null, 43, null],
      [43, null, 43, null, 48, null, 48, null, 41, null, 41, null, 43, null, 43, null],
      [45, null, 45, null, 48, null, 48, null, 43, null, 43, null, 45, null, 45, null],
      [43, null, 43, null, 47, null, 47, null, 41, null, 41, null, 43, null, 43, null],
      [43, null, 43, null, 48, null, 48, null, 41, null, 41, null, 43, null, 43, null],
    ),
  },
];

type SavedPos = { step: number; audioTime: number };
const FADE_MS = 180;

export function useAudio(): AudioApi {
  const acRef = useRef<AudioContext | null>(null);
  const bgmTimerRef = useRef<number | null>(null);
  const bgmPresetRef = useRef<BgmPreset | null>(null);
  const bgmStepRef = useRef(0);
  const bgmNextRef = useRef(0);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentIdRef = useRef<BgmPresetId | null>(null);
  const normalIdRef = useRef<NormalBgmId>('abyss');
  const savedNormalPosRef = useRef<SavedPos>({ step: 0, audioTime: 0 });
  const synthGainRef = useRef(1);
  const fadeTimerRef = useRef<number | null>(null);

  const getAC = (): AudioContext => {
    if (!acRef.current) acRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
    return acRef.current;
  };

  const note = (freq: number, start: number, dur: number, type: OscillatorType, vol: number): void => {
    try {
      const ac = getAC();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g);
      g.connect(ac.destination);
      o.type = type;
      o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.start(start);
      o.stop(start + dur + 0.02);
    } catch {
      // ignore
    }
  };

  const tone = (freq: number, dur: number, type: OscillatorType = 'square', vol = 0.25, delay = 0): void => {
    note(freq, getAC().currentTime + delay, dur, type, vol);
  };

  const clearFade = (): void => {
    if (fadeTimerRef.current != null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const fadeValue = (from: number, to: number, ms: number, onTick: (v: number) => void, onDone?: () => void): void => {
    clearFade();
    const start = performance.now();
    onTick(from);
    fadeTimerRef.current = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / ms);
      onTick(from + (to - from) * p);
      if (p >= 1) {
        clearFade();
        onDone?.();
      }
    }, 16);
  };

  const stopCurrent = (): void => {
    clearFade();
    if (bgmTimerRef.current != null) {
      window.clearInterval(bgmTimerRef.current);
      bgmTimerRef.current = null;
    }
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current = null;
    }
    bgmPresetRef.current = null;
    currentIdRef.current = null;
    synthGainRef.current = 1;
  };

  const captureNormalPos = (): void => {
    const id = currentIdRef.current;
    if (!id) return;
    const preset = BGMS.find((p) => p.id === id);
    if (!preset || preset.mode !== 'normal') return;
    if (preset.audioSrc) {
      savedNormalPosRef.current.audioTime = bgmAudioRef.current?.currentTime ?? 0;
      return;
    }
    savedNormalPosRef.current.step = bgmStepRef.current;
  };

  const startPreset = (id: BgmPresetId, resume = false): void => {
    const preset = BGMS.find((p) => p.id === id);
    if (!preset) return;
    stopCurrent();

    if (preset.audioSrc) {
      const a = new Audio(preset.audioSrc);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      if (resume) a.currentTime = Math.max(0, savedNormalPosRef.current.audioTime);
      void a.play().catch(() => {
        // gesture required on some devices
      });
      bgmAudioRef.current = a;
      currentIdRef.current = id;
      fadeValue(0, preset.volume ?? 0.2, FADE_MS, (v) => {
        if (bgmAudioRef.current === a) bgmAudioRef.current.volume = Math.max(0, v);
      });
      return;
    }

    if (!preset.tempo || !preset.lead || !preset.bass) return;
    const ac = getAC();
    if (ac.state === 'suspended') void ac.resume();

    bgmPresetRef.current = preset;
    synthGainRef.current = 0;
    bgmStepRef.current = resume ? savedNormalPosRef.current.step : 0;
    bgmNextRef.current = ac.currentTime + 0.02;
    const stepSec = 60 / preset.tempo / 2;
    currentIdRef.current = id;

    bgmTimerRef.current = window.setInterval(() => {
      const currentPreset = bgmPresetRef.current;
      if (!currentPreset || !currentPreset.lead || !currentPreset.bass) return;
      const acNow = getAC();
      while (bgmNextRef.current < acNow.currentTime + 0.13) {
        const idx = bgmStepRef.current % currentPreset.lead.length;
        const lead = currentPreset.lead[idx];
        const bass = currentPreset.bass[idx];
        const g = synthGainRef.current;
        if (lead != null) note(midiToFreq(lead), bgmNextRef.current, stepSec * 0.95, 'square', 0.07 * g);
        if (bass != null) note(midiToFreq(bass), bgmNextRef.current, stepSec * 0.92, 'triangle', 0.09 * g);
        if (idx % 4 === 0 && lead != null) note(midiToFreq(lead) * 2, bgmNextRef.current, 0.045, 'square', 0.03 * g);
        bgmStepRef.current += 1;
        bgmNextRef.current += stepSec;
      }
    }, 40);
    fadeValue(0, 1, FADE_MS, (v) => {
      synthGainRef.current = Math.max(0, Math.min(1, v));
    });
  };

  const transitionToPreset = (id: BgmPresetId, resume = false): void => {
    const currentAudio = bgmAudioRef.current;
    const hasSynth = bgmTimerRef.current != null;
    if (!currentAudio && !hasSynth) {
      startPreset(id, resume);
      return;
    }
    if (currentAudio) {
      const startVol = currentAudio.volume;
      fadeValue(startVol, 0, FADE_MS, (v) => {
        if (bgmAudioRef.current) bgmAudioRef.current.volume = Math.max(0, v);
      }, () => {
        startPreset(id, resume);
      });
      return;
    }
    const startGain = synthGainRef.current;
    fadeValue(startGain, 0, FADE_MS, (v) => {
      synthGainRef.current = Math.max(0, v);
    }, () => {
      startPreset(id, resume);
    });
  };

  const startNormalBgm = (id: NormalBgmId): void => {
    normalIdRef.current = id;
    savedNormalPosRef.current = { step: 0, audioTime: 0 };
    transitionToPreset(id, false);
  };

  const playBonusBgm = (): void => {
    captureNormalPos();
    transitionToPreset('bonus_kraken_parade', false);
  };

  const resumeNormalBgm = (): void => {
    transitionToPreset(normalIdRef.current, true);
  };

  const stopBgm = (): void => {
    const currentAudio = bgmAudioRef.current;
    if (currentAudio) {
      const startVol = currentAudio.volume;
      fadeValue(startVol, 0, FADE_MS, (v) => {
        if (bgmAudioRef.current) bgmAudioRef.current.volume = Math.max(0, v);
      }, () => {
        stopCurrent();
      });
    } else if (bgmTimerRef.current != null) {
      const startGain = synthGainRef.current;
      fadeValue(startGain, 0, FADE_MS, (v) => {
        synthGainRef.current = Math.max(0, v);
      }, () => {
        stopCurrent();
      });
    } else {
      stopCurrent();
    }
    savedNormalPosRef.current = { step: 0, audioTime: 0 };
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
      startNormalBgm,
      playBonusBgm,
      resumeNormalBgm,
      stopBgm,
      normalBgmPresets: BGMS.filter((p) => p.mode === 'normal').map((p) => ({ id: p.id as NormalBgmId, name: p.name })),
    }),
    [],
  );
}
