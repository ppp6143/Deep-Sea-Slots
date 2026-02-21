import { useCallback, useEffect, useRef, useState } from 'react';
import { BonusScreen } from './components/BonusScreen';
import { CharacterPanel } from './components/CharacterPanel';
import { Controls } from './components/Controls';
import { GameCanvas } from './components/GameCanvas';
import { InfoBar } from './components/InfoBar';
import { Overlays } from './components/Overlays';
import { PaySymbol } from './components/PaySymbol';
import { useAudio } from './hooks/useAudio';
import { useGameState } from './hooks/useGameState';
import { useKeyboard } from './hooks/useKeyboard';
import styles from './styles/App.module.css';
import type { Particle } from './types/game';
import { activeLines, evalLines, isBonus, isJackpot, LINES } from './utils/paylines';
import { initSymbolCache } from './utils/renderCache';
import { BONUS_SYM, makeReelSet, SYMS } from './utils/symbols';

interface SnapState {
  active: boolean;
  reel: 0 | 1 | 2;
  start: number;
  dist: number;
  target: number;
  elapsed: number;
  duration: number;
}

const MAIN_SPEEDS: [number, number, number] = [0.32, 0.3, 0.28];
const BONUS_SPEEDS: [number, number, number] = [0.3, 0.28, 0.26];

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

function comboMult(combo: number): number {
  if (combo >= 5) return 4;
  if (combo >= 3) return 2;
  if (combo >= 2) return 1.5;
  return 1;
}

export default function App() {
  const { state, dispatch } = useGameState();
  const audio = useAudio();
  const [symbols, setSymbols] = useState<CanvasImageSource[]>([]);
  const [ptOpen, setPtOpen] = useState(false);
  const [bonusMsg, setBonusMsg] = useState('');

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

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    void initSymbolCache(true).then((cache) => setSymbols(cache));
  }, []);

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

  const startBonus = useCallback(() => {
    dispatch({ type: 'BONUS_START' });
    bonusPosRef.current = [0, 0, 0];
    bonusRunningRef.current = [false, false, false];
    bonusSnapRef.current = null;
    setBonusMsg('');
    audio.bonus();
    setChar('ダイオウイカ3体！\nボーナス発動！！', 'excited');
  }, [audio, dispatch, setChar]);

  const finishMainSpin = useCallback(() => {
    const s = stateRef.current;
    const lines = activeLines(s.bet);
    const grid = getGrid(mainPosRef.current, stripsRef.current);
    const { total, wins } = evalLines(grid, lines, s.bet);
    const jp = isJackpot(wins);
    const bonus = isBonus(grid, lines, BONUS_SYM);

    if (total > 0) {
      const nextCombo = s.combo + 1;
      const mult = comboMult(nextCombo);
      const final = Math.floor(total * mult);
      dispatch({ type: 'SPIN_WIN', amount: final, combo: nextCombo });
      dispatch({ type: 'SET_MESSAGE', message: `+${final} コイン！${mult > 1 ? ` (${mult}倍)` : ''}` });
      dispatch({ type: 'SET_CHAR', mood: 'excited', text: `コンボ ${nextCombo}連！ ${mult}倍！` });
      audio.win(final);
      spawnParticles(final);

      if (jp) {
        dispatch({ type: 'SHOW_JACKPOT', value: true });
        audio.jackpot();
      }
    } else {
      dispatch({ type: 'SPIN_LOSE' });
      dispatch({ type: 'SET_MESSAGE', message: rnd(['はずれ...', '惜しい！', '次は来る！']) });
      dispatch({ type: 'SET_CHAR', mood: 'sad', text: rnd(['うぅ...', 'ドンマイ！', '次こそ！']) });
    }

    if (bonus) {
      setTimeout(startBonus, 500);
    }
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
    const target = mod(Math.round(mainPosRef.current[r]), L);
    const snap = createSnap(mainPosRef.current[r], target, L);
    snap.reel = r;
    mainSnapRef.current = snap;
    audio.coin();
  }, [audio, dispatch]);

  const doMainSpin = useCallback(() => {
    const s = stateRef.current;
    if (s.isSpinning) return;
    if (s.freeSpin === 0 && s.coins < s.bet) {
      dispatch({ type: 'SET_MESSAGE', message: 'コイン不足です' });
      return;
    }

    audio.unlock();
    audio.spin();
    const free = s.freeSpin > 0;
    dispatch({ type: 'SPIN_START', free });
    dispatch({ type: 'SET_MESSAGE', message: '' });
    setChar(free ? 'フリースピン！' : rnd(['行くぞ！', '当たれ〜！', 'ドキドキ...']));
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
    const { total } = evalLines(grid, LINES, s.bet);
    const won = total > 0 ? total * 2 : 0;
    dispatch({ type: 'BONUS_SPIN_FINISH', won });
    if (won > 0) {
      setBonusMsg(`+${won} コイン！ (2倍)`);
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
    if (stateRef.current.bonusActive) handleBonusAction();
    else handleSpin();
  });

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

  if (symbols.length < 10) {
    return <div className={styles.app}><div className={styles.wrap}><div className={styles.title}>Loading...</div></div></div>;
  }

  return (
    <div className={styles.app}>
      <div className={styles.wrap}>
        <div className={styles.title}>⚓ DEEP SEA SLOTS ⚓</div>
        <div className={styles.machine}>
          <InfoBar coins={state.coins} win={state.win} combo={state.combo} free={state.freeSpin} />
          <div className={styles.reelsOuter}>
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
              isSpinning={state.isSpinning}
              combo={state.combo}
              onFrame={onFrame}
            />
          </div>
          <Controls
            bet={state.bet}
            linesCount={state.linesCount}
            stopState={state.stopState}
            disabled={state.bonusActive}
            onBet={(bet) => dispatch({ type: 'SET_BET', bet })}
            onSpin={handleSpin}
          />
          <div className={styles.msg}>{state.message}</div>
        </div>

        <button className={styles.ptToggle} onClick={() => setPtOpen((v) => !v)}>📜 配当表</button>
        <div className={`${styles.payTable} ${ptOpen ? styles.open : ''}`}>
          <div className={styles.ptTitle}>🐠 PAY TABLE 🐠</div>
          {SYMS.map((s, i) => (
            <div key={s.name} className={styles.ptRow}>
              <span className={styles.ptSym}><PaySymbol source={symbols[i]} /></span>
              <span>{s.name}</span>
              <span className={styles.ptPay}>{i === 9 ? 'BONUS発動！' : `2x:${s.pay2} / 3x:${s.pay3}`}</span>
            </div>
          ))}
        </div>

        <CharacterPanel text={state.charText} mood={state.charMood} />

        <Overlays open={state.jackpotOn} onClose={closeJackpot} sub={`クジラ3揃い！ +${state.win} コイン`} />

        <BonusScreen
          open={state.bonusActive}
          free={state.bonusFree}
          total={state.bonusWon}
          stopState={state.bonusStopState}
          winMsg={bonusMsg}
          onAction={handleBonusAction}
          onEnd={endBonus}
        />
      </div>
    </div>
  );
}

