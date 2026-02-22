import { useCallback, useEffect, useRef, useState } from 'react';
import { CharacterPanel } from './components/CharacterPanel';
import { Controls } from './components/Controls';
import { GameCanvas } from './components/GameCanvas';
import { InfoBar } from './components/InfoBar';
import { Overlays } from './components/Overlays';
import { PaySymbol } from './components/PaySymbol';
import { ReelFrame } from './components/ReelFrame';
import { useAudio, type NormalBgmId } from './hooks/useAudio';
import { useGameState } from './hooks/useGameState';
import { useKeyboard } from './hooks/useKeyboard';
import styles from './styles/App.module.css';
import type { Particle } from './types/game';
import { activeLines, bonusTriggerLevel, evalLines, isJackpot } from './utils/paylines';
import { initSymbolCache } from './utils/renderCache';
import { BONUS_SYM, makeReelSet, PAYTABLE_ORDER, SYMS } from './utils/symbols';

interface SnapState {
  active: boolean;
  reel: 0 | 1 | 2;
  start: number;
  dist: number;
  target: number;
  elapsed: number;
  duration: number;
}

interface SpecialFxState {
  text: string;
  kind: 'top3' | 'squid';
}

const MAIN_SPEEDS: [number, number, number] = [0.32, 0.3, 0.28];
const BONUS_SPEEDS: [number, number, number] = [0.3, 0.28, 0.26];
const TOP3_IDS = new Set([0, 1, 8]);

function mod(v: number, m: number): number {
  return ((v % m) + m) % m;
}

function rnd(arr: string[]): string {
  return arr[(Math.random() * arr.length) | 0];
}

function getGrid(pos: [number, number, number], strips: [number[], number[], number[]]): number[][] {
  return [0, 1, 2].map((r) => {
    const strip = strips[r];
    const L = strip.length;
    const top = mod(Math.floor(pos[r]), L);
    return [strip[top], strip[(top + 1) % L], strip[(top + 2) % L]];
  });
}

function findNearestTopForSymbol(strip: number[], pos: number, symbolId: number): number {
  const L = strip.length;
  const current = mod(Math.round(pos), L);
  let best = current;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < L; i += 1) {
    if (strip[(i + 1) % L] !== symbolId) continue;
    const d = Math.abs(i - current);
    const score = Math.min(d, L - d);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function comboMult(combo: number): number {
  if (combo >= 5) return 2;
  if (combo >= 3) return 1.5;
  if (combo >= 2) return 1.25;
  return 1;
}

export default function App() {
  const { state, dispatch } = useGameState();
  const audio = useAudio();
  const [symbols, setSymbols] = useState<CanvasImageSource[]>([]);
  const [ptOpen, setPtOpen] = useState(false);
  const [bonusMsg, setBonusMsg] = useState('');
  const [pressedReel, setPressedReel] = useState<number | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [specialFx, setSpecialFx] = useState<SpecialFxState | null>(null);
  const [normalBgm, setNormalBgm] = useState<NormalBgmId>('abyss');
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);

  const stateRef = useRef(state);
  const stripsRef = useRef<[number[], number[], number[]]>(makeReelSet());
  const bonusStripsRef = useRef<[number[], number[], number[]]>(makeReelSet());
  const mainPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const bonusPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const runningRef = useRef<[boolean, boolean, boolean]>([false, false, false]);
  const bonusRunningRef = useRef<[boolean, boolean, boolean]>([false, false, false]);
  const mainSnapRef = useRef<SnapState | null>(null);
  const bonusSnapRef = useRef<SnapState | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const forcedMainSymbolRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    return () => {
      audio.stopBgm();
    };
  }, [audio]);

  useEffect(() => {
    if (musicMuted) return;
    audio.startNormalBgm(normalBgm);
  }, [audio, musicMuted, normalBgm]);

  const prevBonusActiveRef = useRef(false);
  useEffect(() => {
    const prev = prevBonusActiveRef.current;
    const now = state.bonusActive;
    if (!musicMuted) {
      if (!prev && now) audio.playBonusBgm();
      if (prev && !now) audio.resumeNormalBgm();
    }
    prevBonusActiveRef.current = now;
  }, [audio, musicMuted, state.bonusActive]);

  useEffect(() => {
    void initSymbolCache(true).then((cache) => setSymbols(cache));
  }, []);

  useEffect(() => {
    let disposed = false;
    const loadProfile = async (): Promise<void> => {
      try {
        const res = await fetch('/api/player', { method: 'GET' });
        if (!res.ok) return;
        const data = (await res.json()) as { coins?: number; bonusEntries?: number };
        if (disposed) return;
        const coins = Number.isFinite(data.coins) ? Math.max(0, data.coins as number) : 100;
        const bonusEntries = Number.isFinite(data.bonusEntries) ? Math.max(0, data.bonusEntries as number) : 0;
        dispatch({ type: 'HYDRATE_PROFILE', coins, bonusEntries });
      } catch {
        // keep local defaults if server read fails
      } finally {
        if (!disposed) setProfileReady(true);
      }
    };
    void loadProfile();
    return () => {
      disposed = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!profileReady) return;
    const timer = window.setTimeout(() => {
      void fetch('/api/player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coins: state.coins,
          bonusEntries: state.freeSpin,
        }),
      }).catch(() => {
        // non-fatal
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [profileReady, state.coins, state.freeSpin]);

  const setChar = useCallback((text: string, mood: 'idle' | 'happy' | 'excited' | 'worried' | 'sad' = 'happy') => {
    dispatch({ type: 'SET_CHAR', mood, text });
  }, [dispatch]);

  const spawnParticles = useCallback((amount: number) => {
    const n = Math.min(window.innerWidth < 600 ? 30 : 80, 12 + ((amount / 4) | 0));
    const colors = ['#FFD700', '#FFEA00', '#FFAA00', '#00E5FF'];
    for (let i = 0; i < n; i += 1) {
      particlesRef.current.push({
        x: 160 + (Math.random() - 0.5) * 180,
        y: 160,
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 12 - 2,
        size: 4 + Math.random() * 6,
        color: colors[(Math.random() * colors.length) | 0],
        life: 1,
        decay: 0.014 + Math.random() * 0.02,
      });
    }
  }, []);

  const cleanupMainSpin = useCallback(() => {
    dispatch({ type: 'SET_SPINNING', value: false });
    dispatch({ type: 'SET_STOP_STATE', value: 0 });
    dispatch({ type: 'SET_SNAPPING', value: false });
    dispatch({ type: 'SET_REACH', value: false });
    runningRef.current = [false, false, false];
    mainSnapRef.current = null;
  }, [dispatch]);

  const startBonus = useCallback((level: 2 | 3 = 2) => {
    const pointMult = level === 3 ? 4 : 2;
    dispatch({ type: 'BONUS_START', pointMult });
    bonusPosRef.current = [0, 0, 0];
    bonusRunningRef.current = [false, false, false];
    bonusSnapRef.current = null;
    setBonusMsg('');
    audio.bonus();
    setChar(level === 3 ? 'ダイオウイカ3体！\nポイント2倍ボーナス！' : 'ボーナス発動！！', 'excited');
  }, [audio, dispatch, setChar]);

  const finishMainSpin = useCallback(() => {
    const s = stateRef.current;
    const lines = activeLines(s.bet);
    const grid = getGrid(mainPosRef.current, stripsRef.current);
    const { total, wins } = evalLines(grid, lines, s.bet);
    const jp = isJackpot(wins);
    const bonusLevel = bonusTriggerLevel(grid, lines, BONUS_SYM);
    const top3Win = wins.find((w) => w.count === 3 && TOP3_IDS.has(w.syms[0])) ?? null;
    const isSquidTriple = bonusLevel === 3;

    if (total > 0) {
      const nextCombo = s.combo + 1;
      const mult = comboMult(nextCombo);
      const final = Math.floor(total * mult);
      dispatch({ type: 'SPIN_WIN', amount: final, combo: nextCombo });
      dispatch({ type: 'SET_MESSAGE', message: `+${final} コイン！${mult > 1 ? ` (${mult}倍)` : ''}` });
      dispatch({ type: 'SET_CHAR', mood: 'excited', text: `コンボ ${nextCombo}連！ ${mult}倍！` });
      audio.win(final);
      audio.coinStream(final);
      spawnParticles(final);

      if (top3Win) {
        const topId = top3Win.syms[0] as 0 | 1 | 8;
        audio.topThreeHit(topId);
        setSpecialFx({ kind: 'top3', text: topId === 0 ? 'WHALE LEGEND!!' : topId === 1 ? 'SHARK ATTACK!!' : 'ANGLER SHOCK!!' });
        window.setTimeout(() => setSpecialFx(null), 1800);
        spawnParticles(final + 80);
      }

      if (jp) {
        dispatch({ type: 'SHOW_JACKPOT', value: true });
        audio.jackpot();
      }
      if (isSquidTriple) {
        audio.squidTriple();
        setSpecialFx({ kind: 'squid', text: 'KRAKEN RUSH!! x4 BONUS' });
        window.setTimeout(() => setSpecialFx(null), 1800);
        spawnParticles(final + 120);
      }
    } else {
      dispatch({ type: 'SPIN_LOSE' });
      if (bonusLevel > 0) {
        const msg = 'ダイオウイカ3体！ 超ボーナス！';
        dispatch({ type: 'SET_MESSAGE', message: msg });
        dispatch({ type: 'SET_CHAR', mood: 'excited', text: msg });
        audio.squidTriple();
        setSpecialFx({ kind: 'squid', text: 'KRAKEN RUSH!! x4 BONUS' });
        window.setTimeout(() => setSpecialFx(null), 1800);
        spawnParticles(120);
      } else {
        dispatch({ type: 'SET_MESSAGE', message: rnd(['はずれ...', '惜しい！', '次は来る！']) });
        dispatch({ type: 'SET_CHAR', mood: 'sad', text: rnd(['うぅ...', 'ドンマイ！', '次こそ！']) });
      }
    }

    if (bonusLevel === 3) {
      setTimeout(() => startBonus(3), 500);
    }
    forcedMainSymbolRef.current = null;
    cleanupMainSpin();
  }, [audio, cleanupMainSpin, dispatch, spawnParticles, startBonus]);

  const createSnap = (start: number, target: number, L: number): SnapState => {
    let dist = mod(target - start, L);
    if (dist > L * 0.3) dist -= L;
    return { active: true, reel: 0, start, dist, target, elapsed: 0, duration: 150 };
  };

  const stopNextMain = useCallback(() => {
    const s = stateRef.current;
    const r = (s.stopState - 1) as 0 | 1 | 2;
    if (r < 0 || r > 2) return;

    runningRef.current[r] = false;
    dispatch({ type: 'SET_SNAPPING', value: true });
    const L = stripsRef.current[r].length;
    const forced = forcedMainSymbolRef.current;
    const target = forced == null
      ? mod(Math.round(mainPosRef.current[r]), L)
      : findNearestTopForSymbol(stripsRef.current[r], mainPosRef.current[r], forced);
    const snap = createSnap(mainPosRef.current[r], target, L);
    snap.reel = r;
    mainSnapRef.current = snap;
    setPressedReel(r);
    window.setTimeout(() => setPressedReel((v) => (v === r ? null : v)), 170);
    audio.coin();
  }, [audio, dispatch]);

  const doMainSpin = useCallback(() => {
    const s = stateRef.current;
    if (s.isSpinning) return;
    if (s.coins < s.bet) {
      dispatch({ type: 'SET_MESSAGE', message: 'コイン不足です' });
      return;
    }

    audio.unlock();
    audio.spin();
    forcedMainSymbolRef.current = null;
    dispatch({ type: 'SPIN_START', free: false });
    dispatch({ type: 'SET_MESSAGE', message: '' });
    setChar(rnd(['行くぞ！', '当たれ〜！', 'ドキドキ...']));
    runningRef.current = [true, true, true];
    mainSnapRef.current = null;
  }, [audio, dispatch, setChar]);

  const handleSpin = useCallback(() => {
    if (stateRef.current.isSnapping) return;
    if (stateRef.current.stopState === 0) doMainSpin();
    else if (stateRef.current.stopState >= 1 && stateRef.current.stopState <= 3) stopNextMain();
  }, [doMainSpin, stopNextMain]);

  const finishBonusSpin = useCallback(() => {
    const s = stateRef.current;
    const grid = getGrid(bonusPosRef.current, bonusStripsRef.current);
    const { total } = evalLines(grid, activeLines(s.bet), s.bet);
      const won = total > 0 ? total * s.bonusPointMult : 0;
      dispatch({ type: 'BONUS_SPIN_FINISH', won });
      if (won > 0) {
        setBonusMsg(`+${won} コイン！ (${s.bonusPointMult}倍)`);
        audio.win(total);
        setChar(`+${won} コイン！`, 'excited');
        spawnParticles(won);
    } else {
      setBonusMsg('はずれ...');
    }
  }, [audio, dispatch, setChar, spawnParticles]);

  const stopNextBonus = useCallback(() => {
    const s = stateRef.current;
    const r = (s.bonusStopState - 1) as 0 | 1 | 2;
    if (r < 0 || r > 2) return;

    bonusRunningRef.current[r] = false;
    dispatch({ type: 'BONUS_SNAPPING', value: true });
    const L = bonusStripsRef.current[r].length;
    const target = mod(Math.round(bonusPosRef.current[r]), L);
    const snap = createSnap(bonusPosRef.current[r], target, L);
    snap.reel = r;
    bonusSnapRef.current = snap;
    setPressedReel(r);
    window.setTimeout(() => setPressedReel((v) => (v === r ? null : v)), 170);
    audio.coin();
  }, [audio, dispatch]);

  const doBonusSpin = useCallback(() => {
    const s = stateRef.current;
    if (s.bonusFree <= 0) return;
    audio.spin();
    dispatch({ type: 'BONUS_SPIN_START' });
    setBonusMsg('');
    bonusRunningRef.current = [true, true, true];
  }, [audio, dispatch]);

  const endBonus = useCallback(() => {
    const s = stateRef.current;
    dispatch({ type: 'BONUS_END' });
    dispatch({ type: 'SET_MESSAGE', message: `ボーナス終了！ 獲得: ${s.bonusWon} コイン` });
    setChar(`ボーナス終了 +${s.bonusWon}`, 'happy');
    spawnParticles(s.bonusWon);
  }, [dispatch, setChar, spawnParticles]);

  const restartFromZero = useCallback(() => {
    runningRef.current = [false, false, false];
    bonusRunningRef.current = [false, false, false];
    mainSnapRef.current = null;
    bonusSnapRef.current = null;
    particlesRef.current = [];
    dispatch({ type: 'RESTART_GAME' });
  }, [dispatch]);

  const handleBonusAction = useCallback(() => {
    if (stateRef.current.bonusSnapping) return;
    if (stateRef.current.bonusStopState === 0) {
      if (stateRef.current.bonusFree <= 0) {
        endBonus();
      } else {
        doBonusSpin();
      }
    } else if (stateRef.current.bonusStopState >= 1 && stateRef.current.bonusStopState <= 3) {
      stopNextBonus();
    }
  }, [doBonusSpin, endBonus, stopNextBonus]);

  useKeyboard(() => {
    if (stateRef.current.jackpotOn) {
      dispatch({ type: 'SHOW_JACKPOT', value: false });
      return;
    }
    if (stateRef.current.bonusActive) handleBonusAction();
    else handleSpin();
  });

  useEffect(() => {
    const secret = 'pikurusu';
    const forceMap: Record<string, number> = { sss1: 0, hhh1: 1, ttt1: 8, ddd1: 9 };
    let index = 0;
    let lastAt = 0;
    let cmdBuffer = '';
    const maxGapMs = 1200;
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      const now = Date.now();
      const key = e.key.toLowerCase();
      if (key.length !== 1 || !/[a-z0-9]/.test(key)) {
        return;
      }
      if (now - lastAt > maxGapMs) index = 0;
      lastAt = now;

      cmdBuffer = (cmdBuffer + key).slice(-4);
      const forcedId = forceMap[cmdBuffer];
      if (forcedId != null) {
        const canForce = !stateRef.current.bonusActive && stateRef.current.isSpinning && stateRef.current.stopState === 1;
        if (canForce) {
          forcedMainSymbolRef.current = forcedId;
          dispatch({ type: 'SET_MESSAGE', message: '隠しコマンド成功！ 強制揃え準備中...' });
          setChar('シークレット発動！', 'excited');
          audio.reach();
        } else {
          dispatch({ type: 'SET_MESSAGE', message: '隠しコマンドは回転開始直後に入力してね' });
        }
        cmdBuffer = '';
      }

      if (key < 'a' || key > 'z') return;
      if (key === secret[index]) {
        index += 1;
        if (index >= secret.length) {
          index = 0;
          if (!stateRef.current.bonusActive) {
            startBonus();
          }
        }
        return;
      }

      index = key === secret[0] ? 1 : 0;
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [audio, dispatch, setChar, startBonus]);

  const onFrame = useCallback((dt: number) => {
    const scale = dt / 16.666;

    for (let i = 0; i < 3; i += 1) {
      if (runningRef.current[i]) {
        mainPosRef.current[i] = mod(mainPosRef.current[i] + MAIN_SPEEDS[i] * scale, stripsRef.current[i].length);
      }
      if (bonusRunningRef.current[i]) {
        bonusPosRef.current[i] = mod(bonusPosRef.current[i] + BONUS_SPEEDS[i] * scale, bonusStripsRef.current[i].length);
      }
    }

    const snap = mainSnapRef.current;
    if (snap && snap.active) {
      snap.elapsed += dt;
      const p = Math.min(1, snap.elapsed / snap.duration);
      const ease = 1 - (1 - p) ** 3;
      const r = snap.reel;
      const L = stripsRef.current[r].length;
      mainPosRef.current[r] = mod(snap.start + snap.dist * ease, L);
      if (p >= 1) {
        mainPosRef.current[r] = mod(snap.target, L);
        mainSnapRef.current = null;

        const current = stateRef.current;
        const next = (current.stopState + 1) as 1 | 2 | 3 | 4;
        dispatch({ type: 'SET_STOP_STATE', value: next });
        dispatch({ type: 'SET_SNAPPING', value: false });

        if (r === 0) {
          const lines = activeLines(current.bet);
          const g = getGrid(mainPosRef.current, stripsRef.current);
          const reach = lines.some((line) => g[0][line[0]] === g[1][line[1]]);
          dispatch({ type: 'SET_REACH', value: reach });
          if (reach) {
            audio.reach();
            setChar('リーチ！！ もう1個！！', 'worried');
          }
        }

        if (r === 1) {
          const lines = activeLines(current.bet);
          const g = getGrid(mainPosRef.current, stripsRef.current);
          const stillReach = lines.some((line) => g[0][line[0]] === g[1][line[1]]);
          if (!stillReach) dispatch({ type: 'SET_REACH', value: false });
        }

        if (next === 4) finishMainSpin();
      }
    }

    const bs = bonusSnapRef.current;
    if (bs && bs.active) {
      bs.elapsed += dt;
      const p = Math.min(1, bs.elapsed / bs.duration);
      const ease = 1 - (1 - p) ** 3;
      const r = bs.reel;
      const L = bonusStripsRef.current[r].length;
      bonusPosRef.current[r] = mod(bs.start + bs.dist * ease, L);
      if (p >= 1) {
        bonusPosRef.current[r] = mod(bs.target, L);
        bonusSnapRef.current = null;

        const current = stateRef.current;
        const next = (current.bonusStopState + 1) as 1 | 2 | 3 | 4;
        dispatch({ type: 'BONUS_STOP_STATE', value: next });
        dispatch({ type: 'BONUS_SNAPPING', value: false });
        if (next === 4) finishBonusSpin();
      }
    }
  }, [audio, dispatch, finishBonusSpin, finishMainSpin, setChar]);

  const closeJackpot = useCallback(() => {
    dispatch({ type: 'SHOW_JACKPOT', value: false });
  }, [dispatch]);

  const chooseNormalBgm = useCallback((id: NormalBgmId) => {
    audio.unlock();
    setNormalBgm(id);
    setMusicMuted(false);
    setMusicOpen(false);
  }, [audio]);

  const muteBgm = useCallback(() => {
    audio.stopBgm();
    setMusicMuted(true);
    setMusicOpen(false);
  }, [audio]);

  if (symbols.length < 10) {
    return <div className={styles.app}><div className={styles.wrap}><div className={styles.title}>Loading...</div></div></div>;
  }

  const showRestart = !state.bonusActive && !state.isSpinning && state.stopState === 0 && state.coins <= 0;
  const betLocked = state.isSpinning || state.stopState > 0 || state.isSnapping || state.bonusActive || state.bonusStopState > 0 || state.bonusSnapping;

  return (
    <div className={styles.app}>
      <div className={styles.wrap}>
        <div className={styles.title}>⚓ DEEP SEA SLOTS ⚓</div>
        <div className={styles.machine}>
          {state.bonusActive && <div className={styles.bonusFx} aria-hidden="true" />}
          {specialFx && (
            <div className={`${styles.specialFx} ${specialFx.kind === 'squid' ? styles.specialSquid : styles.specialTop3}`}>
              {specialFx.text}
            </div>
          )}
          <InfoBar
            coins={state.coins}
            win={state.win}
            combo={state.combo}
            free={state.bonusActive ? state.bonusFree : state.freeSpin}
            bonusActive={state.bonusActive}
          />
          <div className={styles.reelsOuter}>
            <div className={styles.reelStage}>
              <GameCanvas
                runtime={{
                  mainPos: mainPosRef,
                  bonusPos: bonusPosRef,
                  strips: stripsRef,
                  bonusStrips: bonusStripsRef,
                  particles: particlesRef,
                }}
                symbols={symbols}
                bonusActive={state.bonusActive}
                reachOn={state.reachOn}
                isSpinning={state.isSpinning || state.bonusStopState > 0}
                combo={state.combo}
                onFrame={onFrame}
              />
              <ReelFrame
                bet={state.bet}
                stopState={state.bonusActive ? state.bonusStopState : state.stopState}
                pressedReel={pressedReel}
              />
            </div>
          </div>
          <Controls
            bet={state.bet}
            linesCount={state.linesCount}
            stopState={state.bonusActive ? state.bonusStopState : state.stopState}
            bonusActive={state.bonusActive}
            betLocked={betLocked}
            showRestart={showRestart}
            onBet={(bet) => dispatch({ type: 'SET_BET', bet })}
            onSpin={state.bonusActive ? handleBonusAction : handleSpin}
            onMax={state.bonusActive ? endBonus : () => dispatch({ type: 'SET_BET', bet: 3 })}
            onRestart={restartFromZero}
            onMusic={() => setMusicOpen((v) => !v)}
            message={state.bonusActive ? (bonusMsg || state.message) : state.message}
          />
          {musicOpen && (
            <div className={styles.musicPopup}>
              <div className={styles.musicTitle}>BGM SELECT</div>
              <div className={styles.musicList}>
                {audio.normalBgmPresets.map((p) => (
                  <button
                    key={p.id}
                    className={`${styles.musicItem} ${!musicMuted && normalBgm === p.id ? styles.musicActive : ''}`}
                    onClick={() => chooseNormalBgm(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
                <button className={styles.musicMute} onClick={muteBgm}>MUTE</button>
              </div>
            </div>
          )}
        </div>

        <button className={styles.ptToggle} onClick={() => setPtOpen((v) => !v)}>📜 配当表</button>
        <div className={`${styles.payTable} ${ptOpen ? styles.open : ''}`}>
          <div className={styles.ptTitle}>🐠 PAY TABLE 🐠</div>
          {PAYTABLE_ORDER.map((id) => {
            const s = SYMS[id];
            return (
            <div key={`${s.name}-${id}`} className={styles.ptRow}>
              <span className={styles.ptSym}><PaySymbol source={symbols[id]} /></span>
              <span>{s.name}</span>
              <span className={styles.ptPay}>{id === 9 ? '3x:4倍BONUS' : `2x:${s.pay2} / 3x:${s.pay3}`}</span>
            </div>
          )})}
        </div>

        <CharacterPanel text={state.charText} mood={state.charMood} />

        <Overlays open={state.jackpotOn} onClose={closeJackpot} sub={`クジラ3揃い！ +${state.win} コイン`} />

      </div>
    </div>
  );
}


