import { useCallback, useEffect, useRef, useState } from 'react';
import { CharacterPanel } from './components/CharacterPanel';
import { Controls } from './components/Controls';
import { GameCanvas } from './components/GameCanvas';
import { InfoBar } from './components/InfoBar';
import { Overlays } from './components/Overlays';
import { PaySymbol } from './components/PaySymbol';
import { ReelFrame } from './components/ReelFrame';
import { ShopModal } from './components/ShopModal';
import { ZukanModal } from './components/ZukanModal';
import { useAudio, type NormalBgmId } from './hooks/useAudio';
import { useGameState } from './hooks/useGameState';
import { useKeyboard } from './hooks/useKeyboard';
import styles from './styles/App.module.css';
import type { Particle, WinLine, ZukanEntry } from './types/game';
import { SPRITES } from './assets/sprites';
import { activeLines, bonusTriggerLevel, evalLines, isJackpot } from './utils/paylines';
import { initSymbolCache } from './utils/renderCache';
import { BONUS_SYM, getSymbolNo, makeReelSet, PAYTABLE_ORDER, SYMS } from './utils/symbols';
import { loadZukan, REEL_EFFICIENCY_LV1_ID, REEL_EFFICIENCY_LV2_ID, saveZukan, SHOP_PRICES, syncZukanUnlockRules, ZUKAN_NAMES } from './utils/zukanCookie';

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

type SpecialBonusKind = 'treasure' | 'mendako' | 'gusokumushi' | 'ryuguu';
type SpecialBonusPhase = 'inactive' | 'intro' | 'spinning' | 'resultFlash' | 'readyExit';

interface SpecialBonusState {
  phase: SpecialBonusPhase;
  kind: SpecialBonusKind;
  reward: number;
  lockUntil: number;
}

type SpecialBonusImageSet = [HTMLImageElement | null, HTMLImageElement | null, HTMLImageElement | null];
type SpecialBonusImageMap = Record<SpecialBonusKind, SpecialBonusImageSet>;
type SpecialBonusSheetMap = Record<SpecialBonusKind, HTMLImageElement | null>;

function specialBonusName(kind: SpecialBonusKind): string {
  switch (kind) {
    case 'mendako':
      return 'メンダコ';
    case 'gusokumushi':
      return 'ダイオウグソクムシ';
    case 'ryuguu':
      return 'リュウグウノツカイ';
    default:
      return '宝箱';
  }
}

const MAIN_SPEEDS: [number, number, number] = [0.32, 0.3, 0.28];
const BONUS_SPEEDS: [number, number, number] = [0.3, 0.28, 0.26];
const TOP3_IDS = new Set([0, 1, 8]);
const SPECIAL_BONUS_CHANCE = 0.01;
// Pixel-per-frame-equivalent speeds tuned to feel close to normal reel motion.
const TREASURE_SPEEDS: [number, number, number] = [25.6, 24, 22.4];
const TREASURE_CELL_H = 240;

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
  const [zukanOpen, setZukanOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [zukanSelectedId, setZukanSelectedId] = useState(0);
  const [zukanData, setZukanData] = useState<ZukanEntry[]>(() => loadZukan());
  const [specialBonus, setSpecialBonus] = useState<SpecialBonusState>({ phase: 'inactive', kind: 'treasure', reward: 100, lockUntil: 0 });
  const [specialBonusGlow, setSpecialBonusGlow] = useState(false);
  const [specialReelImages, setSpecialReelImages] = useState<SpecialBonusImageMap>({
    treasure: [null, null, null],
    mendako: [null, null, null],
    gusokumushi: [null, null, null],
    ryuguu: [null, null, null],
  });
  const [specialReelSheets, setSpecialReelSheets] = useState<SpecialBonusSheetMap>({
    treasure: null,
    mendako: null,
    gusokumushi: null,
    ryuguu: null,
  });
  const [specialBonusStopState, setSpecialBonusStopState] = useState<0 | 1 | 2 | 3 | 4>(0);

  const stateRef = useRef(state);
  const stripsRef = useRef<[number[], number[], number[]]>(makeReelSet());
  const bonusStripsRef = useRef<[number[], number[], number[]]>(makeReelSet());
  const mainPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const bonusPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const runningRef = useRef<[boolean, boolean, boolean]>([false, false, false]);
  const bonusRunningRef = useRef<[boolean, boolean, boolean]>([false, false, false]);
  const mainSnapRef = useRef<SnapState | null>(null);
  const bonusSnapRef = useRef<SnapState | null>(null);
  const treasurePosRef = useRef<[number, number, number]>([0, 0, 0]);
  const treasureRunningRef = useRef<[boolean, boolean, boolean]>([false, false, false]);
  const treasureSnapRef = useRef<SnapState | null>(null);
  const treasureStopStateRef = useRef<0 | 1 | 2 | 3 | 4>(0);
  const treasurePressedReelRef = useRef<number | null>(null);
  const forceSpecialAfterNextNormalSpinRef = useRef(false);
  const armSpecialAfterNormalSpinRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const forcedMainSymbolRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    saveZukan(syncZukanUnlockRules(zukanData));
  }, [zukanData]);

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
    let cancelled = false;
    const files: Record<SpecialBonusKind, [string, string, string]> = {
      treasure: ['treasure-left.png', 'treasure-center.png', 'treasure-right.png'],
      mendako: ['mendako-left.png', 'mendako-center.png', 'mendako-right.png'],
      gusokumushi: ['gusokumushi-left.png', 'gusokumushi-center.png', 'gusokumushi-right.png'],
      ryuguu: ['ryuguu-left.png', 'ryuguu-center.png', 'ryuguu-right.png'],
    };
    const next: SpecialBonusImageMap = {
      treasure: [null, null, null],
      mendako: [null, null, null],
      gusokumushi: [null, null, null],
      ryuguu: [null, null, null],
    };
    const jobs = (Object.entries(files) as Array<[SpecialBonusKind, [string, string, string]]>).flatMap(([kind, arr]) =>
      arr.map((name, i) => ({ kind, i: i as 0 | 1 | 2, src: `/special/${name}` })),
    );
    let loaded = 0;
    jobs.forEach(({ kind, i, src }) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        next[kind][i] = img;
        loaded += 1;
        if (loaded === jobs.length) setSpecialReelImages({ ...next });
      };
      img.onerror = () => {
        if (cancelled) return;
        loaded += 1;
        if (loaded === jobs.length) setSpecialReelImages({ ...next });
      };
      img.src = src;
    });
    const sheetFiles: Record<SpecialBonusKind, string> = {
      treasure: 'treasure.png',
      mendako: 'mendako.png',
      gusokumushi: 'gusokumushi.png',
      ryuguu: 'ryuguu.png',
    };
    const nextSheets: SpecialBonusSheetMap = {
      treasure: null,
      mendako: null,
      gusokumushi: null,
      ryuguu: null,
    };
    (Object.entries(sheetFiles) as Array<[SpecialBonusKind, string]>).forEach(([kind, name]) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        nextSheets[kind] = img;
        setSpecialReelSheets((prev) => ({ ...prev, [kind]: img }));
      };
      img.onerror = () => {
        // optional file
      };
      img.src = `/special/${name}`;
    });
    return () => {
      cancelled = true;
    };
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

  const rollSpecialBonusKind = useCallback((): { kind: SpecialBonusKind; reward: number } => {
    const candidates: Array<{ kind: SpecialBonusKind; reward: number }> = [{ kind: 'treasure', reward: 100 }];
    if (zukanData[10]?.purchased) candidates.push({ kind: 'mendako', reward: 250 });
    if (zukanData[11]?.purchased) candidates.push({ kind: 'gusokumushi', reward: 500 });
    if (zukanData[12]?.purchased) candidates.push({ kind: 'ryuguu', reward: 1000 });
    return candidates[(Math.random() * candidates.length) | 0];
  }, [zukanData]);

  const enterSpecialBonus = useCallback((forced = false) => {
    const pick = rollSpecialBonusKind();
    const lockUntil = performance.now() + 1500;
    treasurePosRef.current = [0, 0, 0];
    treasureRunningRef.current = [false, false, false];
    treasureSnapRef.current = null;
    treasureStopStateRef.current = 0;
    treasurePressedReelRef.current = null;
    setSpecialBonusStopState(0);
    setPressedReel(null);
    setSpecialBonusGlow(true);
    setSpecialBonus({ phase: 'intro', kind: pick.kind, reward: pick.reward, lockUntil });
    dispatch({ type: 'SET_MESSAGE', message: forced ? 'シークレット演出準備中…' : '特別演出発生！' });
    setChar(pick.kind === 'treasure' ? '宝箱チャンス！' : '隠しキャラ演出！', 'excited');
    audio.reach();

    window.setTimeout(() => {
      treasureRunningRef.current = [true, true, true];
      treasureStopStateRef.current = 1;
      setSpecialBonusStopState(1);
      setSpecialBonus((prev) => {
        if (prev.phase !== 'intro') return prev;
        return { ...prev, phase: 'spinning', lockUntil: 0 };
      });
      dispatch({ type: 'SET_MESSAGE', message: '特別演出！ STOPで止めよう' });
      audio.spin();
    }, 1500);
  }, [audio, dispatch, rollSpecialBonusKind, setChar]);

  const leaveSpecialBonus = useCallback(() => {
    treasureRunningRef.current = [false, false, false];
    treasureSnapRef.current = null;
    treasureStopStateRef.current = 0;
    treasurePressedReelRef.current = null;
    setSpecialBonusStopState(0);
    setPressedReel(null);
    setSpecialBonusGlow(false);
    setSpecialBonus({ phase: 'inactive', kind: 'treasure', reward: 100, lockUntil: 0 });
    dispatch({ type: 'SET_MESSAGE', message: '' });
    setChar('通常モードへ戻るよ', 'happy');
  }, [dispatch, setChar]);

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

  const applyZukanAchievements = useCallback((wins: WinLine[]) => {
    let unlockedNew = false;
    setZukanData((prev) => {
      const next = prev.map((e) => ({ ...e }));
      let changed = false;
      wins.forEach((win) => {
        if (win.count !== 3) return;
        const symId = win.syms[0];
        const entry = next[symId];
        if (!entry) return;
        if (!entry.unlocked) {
          entry.unlocked = true;
          unlockedNew = true;
          changed = true;
        }
        entry.count3x += 1;
        changed = true;
      });
      return changed ? next : prev;
    });
    if (unlockedNew) {
      setChar('3つ揃え達成！ショップで購入できるよ！', 'excited');
      dispatch({ type: 'SET_MESSAGE', message: 'ショップに新しい図鑑が追加！' });
    }
  }, [dispatch, setChar]);

  const handlePurchase = useCallback((symbolId: number) => {
    const entry = zukanData[symbolId];
    if (!entry) return;
    const price = SHOP_PRICES[symbolId];
    if (!entry.unlocked || entry.purchased || stateRef.current.coins < price) return;
    setZukanData((prev) => syncZukanUnlockRules(prev.map((e) => (e.symbolId === symbolId ? { ...e, purchased: true } : e))));
    dispatch({ type: 'SET_COINS', value: stateRef.current.coins - price });
    dispatch({ type: 'SET_MESSAGE', message: `${ZUKAN_NAMES[symbolId] ?? `No.${symbolId + 1}`} を購入！ (-${price})` });
    setChar('ショップで購入したよ！', 'happy');
    audio.coin();
  }, [audio, dispatch, setChar, zukanData]);

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
    const pay2Bonus = (zukanData[REEL_EFFICIENCY_LV1_ID]?.purchased ? 1 : 0)
      + (zukanData[REEL_EFFICIENCY_LV2_ID]?.purchased ? 2 : 0);
    const { total, wins, pay2BonusTotal } = evalLines(grid, lines, s.bet, { pay2Bonus });
    const jp = isJackpot(wins);
    const bonusLevel = bonusTriggerLevel(grid, lines, BONUS_SYM);
    const top3Win = wins.find((w) => w.count === 3 && TOP3_IDS.has(w.syms[0])) ?? null;
    const isSquidTriple = bonusLevel === 3;

    if (wins.length > 0) applyZukanAchievements(wins);

    if (total > 0) {
      const nextCombo = s.combo + 1;
      const mult = comboMult(nextCombo);
      const final = Math.floor(total * mult);
      const finalEfficiencyBonus = pay2BonusTotal > 0
        ? Math.max(0, final - Math.floor((total - pay2BonusTotal) * mult))
        : 0;
      dispatch({ type: 'SPIN_WIN', amount: final, combo: nextCombo });
      dispatch({
        type: 'SET_MESSAGE',
        message: `+${final} コイン！${mult > 1 ? ` (${mult}倍)` : ''}${finalEfficiencyBonus > 0 ? ` [効率化 +${finalEfficiencyBonus}]` : ''}`,
      });
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
    if (armSpecialAfterNormalSpinRef.current) {
      armSpecialAfterNormalSpinRef.current = false;
      forceSpecialAfterNextNormalSpinRef.current = true;
      dispatch({ type: 'SET_MESSAGE', message: '次のSPINで特別演出が発生！' });
      setChar('次はシークレット演出だよ！', 'excited');
    }
  }, [applyZukanAchievements, audio, cleanupMainSpin, dispatch, spawnParticles, startBonus, zukanData]);

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

  const finalizeSpecialBonus = useCallback(() => {
    setSpecialBonusGlow(true);
    setSpecialBonus((prev) => ({ ...prev, phase: 'resultFlash', lockUntil: performance.now() + 2000 }));
    dispatch({ type: 'SET_MESSAGE', message: `${specialBonusName(specialBonus.kind)} BONUS!` });
    setChar(`${specialBonusName(specialBonus.kind)}出現！`, 'excited');
    audio.jackpot();
    spawnParticles(specialBonus.reward + 120);

    window.setTimeout(() => {
      dispatch({ type: 'SET_COINS', value: stateRef.current.coins + specialBonus.reward });
      dispatch({ type: 'SET_WIN', value: specialBonus.reward });
      dispatch({ type: 'SET_MESSAGE', message: `${specialBonusName(specialBonus.kind)} BONUS +${specialBonus.reward} コイン！ [SPINで戻る]` });
      setChar(`+${specialBonus.reward} コイン獲得！`, 'happy');
      audio.coinStream(specialBonus.reward);
      setSpecialBonus((prev) => (prev.phase === 'inactive' ? prev : { ...prev, phase: 'readyExit', lockUntil: 0 }));
    }, 2000);
  }, [audio, dispatch, setChar, specialBonus.kind, specialBonus.reward, spawnParticles]);

  const stopNextSpecial = useCallback(() => {
    if (specialBonus.phase !== 'spinning') return;
    const r = (treasureStopStateRef.current - 1) as 0 | 1 | 2;
    if (r < 0 || r > 2) return;
    treasureRunningRef.current[r] = false;
    treasurePressedReelRef.current = r;
    setPressedReel(r);
    window.setTimeout(() => {
      treasurePressedReelRef.current = null;
      setPressedReel((v) => (v === r ? null : v));
    }, 170);
    audio.coin();
    const snap = createSnap(treasurePosRef.current[r], 0, TREASURE_CELL_H);
    snap.reel = r;
    snap.duration = 120;
    treasureSnapRef.current = snap;
  }, [audio, finalizeSpecialBonus, specialBonus.phase]);

  const handleSpecialAction = useCallback(() => {
    if (specialBonus.phase === 'inactive') return false;
    if (performance.now() < specialBonus.lockUntil) return true;
    if (specialBonus.phase === 'spinning') {
      stopNextSpecial();
      return true;
    }
    if (specialBonus.phase === 'readyExit') {
      leaveSpecialBonus();
      return true;
    }
    return true;
  }, [leaveSpecialBonus, specialBonus.lockUntil, specialBonus.phase, stopNextSpecial]);

  const handleSpin = useCallback(() => {
    if (handleSpecialAction()) return;
    if (stateRef.current.isSnapping) return;
    if (stateRef.current.stopState === 0) {
      const forcedSpecial = forceSpecialAfterNextNormalSpinRef.current;
      const shouldSpecial = forcedSpecial || Math.random() < SPECIAL_BONUS_CHANCE;
      if (shouldSpecial) {
        forceSpecialAfterNextNormalSpinRef.current = false;
        enterSpecialBonus(forcedSpecial);
        return;
      }
      doMainSpin();
    }
    else if (stateRef.current.stopState >= 1 && stateRef.current.stopState <= 3) stopNextMain();
  }, [doMainSpin, enterSpecialBonus, handleSpecialAction, stopNextMain]);

  const finishBonusSpin = useCallback(() => {
    const s = stateRef.current;
    const grid = getGrid(bonusPosRef.current, bonusStripsRef.current);
    const pay2Bonus = (zukanData[REEL_EFFICIENCY_LV1_ID]?.purchased ? 1 : 0)
      + (zukanData[REEL_EFFICIENCY_LV2_ID]?.purchased ? 2 : 0);
    const { total, wins, pay2BonusTotal } = evalLines(grid, activeLines(s.bet), s.bet, { pay2Bonus });
      if (wins.length > 0) applyZukanAchievements(wins);
      const won = total > 0 ? total * s.bonusPointMult : 0;
      const bonusEfficiency = pay2BonusTotal * s.bonusPointMult;
      dispatch({ type: 'BONUS_SPIN_FINISH', won });
      if (won > 0) {
        setBonusMsg(`+${won} コイン！ (${s.bonusPointMult}倍)${bonusEfficiency > 0 ? ` [効率化 +${bonusEfficiency}]` : ''}`);
        audio.win(total);
        setChar(`+${won} コイン！`, 'excited');
        spawnParticles(won);
    } else {
      setBonusMsg('はずれ...');
    }
  }, [applyZukanAchievements, audio, dispatch, setChar, spawnParticles, zukanData]);

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
    const forceMap: Record<string, number> = { sss1: 0, hhh1: 1, ttt1: 8, ddd1: 9 };
    const debugCoinsSeed = 'ppp6143';
    const forceSpecialSeed = 'bbb1';
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
      if (now - lastAt > maxGapMs) cmdBuffer = '';
      lastAt = now;

      cmdBuffer = (cmdBuffer + key).slice(-8);

      if (cmdBuffer.endsWith(debugCoinsSeed)) {
        const nextCoins = Math.max(0, Math.floor(stateRef.current.coins + 10000));
        dispatch({ type: 'SET_COINS', value: nextCoins });
        dispatch({ type: 'SET_MESSAGE', message: 'デバッグ: +10000 コイン' });
        setChar('+10000 コイン！ テスト用だよ', 'excited');
        audio.coin();
        cmdBuffer = '';
        return;
      }

      if (cmdBuffer.endsWith(forceSpecialSeed)) {
        armSpecialAfterNormalSpinRef.current = true;
        dispatch({ type: 'SET_MESSAGE', message: 'bbb1: 次の通常スピン終了後に特別演出を予約' });
        setChar('次の次で特別演出を見せるよ！', 'excited');
        audio.reach();
        cmdBuffer = '';
        return;
      }

      const forcedId = forceMap[cmdBuffer.slice(-4)];
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
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [audio, dispatch, setChar]);

  const onFrame = useCallback((dt: number) => {
    const scale = dt / 16.666;

    for (let i = 0; i < 3; i += 1) {
      if (runningRef.current[i]) {
        mainPosRef.current[i] = mod(mainPosRef.current[i] + MAIN_SPEEDS[i] * scale, stripsRef.current[i].length);
      }
      if (bonusRunningRef.current[i]) {
        bonusPosRef.current[i] = mod(bonusPosRef.current[i] + BONUS_SPEEDS[i] * scale, bonusStripsRef.current[i].length);
      }
      if (treasureRunningRef.current[i]) {
        treasurePosRef.current[i] = mod(treasurePosRef.current[i] + TREASURE_SPEEDS[i] * scale, TREASURE_CELL_H);
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

    const ts = treasureSnapRef.current;
    if (ts && ts.active) {
      ts.elapsed += dt;
      const p = Math.min(1, ts.elapsed / ts.duration);
      const ease = 1 - (1 - p) ** 3;
      const r = ts.reel;
      treasurePosRef.current[r] = mod(ts.start + ts.dist * ease, TREASURE_CELL_H);
      if (p >= 1) {
        treasurePosRef.current[r] = mod(ts.target, TREASURE_CELL_H);
        treasureSnapRef.current = null;
        const next = (treasureStopStateRef.current + 1) as 1 | 2 | 3 | 4;
        treasureStopStateRef.current = next;
        setSpecialBonusStopState(next);
        if (next === 4) finalizeSpecialBonus();
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
  const specialActive = specialBonus.phase !== 'inactive';
  const specialResulting = specialBonus.phase === 'resultFlash' || specialBonus.phase === 'readyExit';
  const specialSpinLocked = specialBonus.phase === 'intro' || specialBonus.phase === 'resultFlash';
  const uiStopState = state.bonusActive ? state.bonusStopState : specialActive ? specialBonusStopState : state.stopState;
  const betLocked = state.isSpinning || state.stopState > 0 || state.isSnapping || state.bonusActive || state.bonusStopState > 0 || state.bonusSnapping || specialActive;

  return (
    <div className={styles.app}>
      <div className={styles.wrap}>
        <div className={styles.title}>
          <span className={styles.titleIcon}>⚓</span>
          <span className={styles.titleText}>DEEP SEA SLOTS</span>
          <span className={styles.titleIcon}>⚓</span>
        </div>
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
            <div className={`${styles.reelStage} ${specialBonusGlow ? styles.reelStageGold : ''} ${specialResulting ? styles.reelStageGoldFlash : ''}`}>
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
                isSpinning={state.isSpinning || state.bonusStopState > 0 || specialBonus.phase === 'spinning'}
                combo={state.combo}
                onFrame={onFrame}
                specialBonusPhase={specialBonus.phase}
                specialBonusKind={specialBonus.kind}
                specialTreasurePos={treasurePosRef}
                specialTreasureImages={specialReelImages[specialBonus.kind]}
                specialTreasureSheet={specialReelSheets[specialBonus.kind]}
              />
              <ReelFrame
                bet={state.bet}
                stopState={uiStopState}
                pressedReel={pressedReel}
                goldMode={specialActive}
              />
            </div>
          </div>
          <Controls
            bet={state.bet}
            linesCount={state.linesCount}
            stopState={uiStopState}
            bonusActive={state.bonusActive}
            betLocked={betLocked}
            showRestart={showRestart}
            onBet={(bet) => dispatch({ type: 'SET_BET', bet })}
            onSpin={state.bonusActive ? handleBonusAction : handleSpin}
            onMax={specialActive ? () => {} : state.bonusActive ? endBonus : () => dispatch({ type: 'SET_BET', bet: 3 })}
            onRestart={restartFromZero}
            message={specialActive ? state.message : state.bonusActive ? (bonusMsg || state.message) : state.message}
            leftDisabled={specialActive}
            spinDisabled={specialSpinLocked}
          />
          <div className={styles.topFeatureRow}>
            <button className={`${styles.iconBtn} ${styles.iconOnlyBtn}`} aria-label="図鑑" disabled={betLocked} onClick={() => setZukanOpen(true)}>
              <img src={SPRITES.zukan} alt="" />
            </button>
            <button className={`${styles.iconBtn} ${styles.iconOnlyBtn}`} aria-label="ショップ" disabled={betLocked} onClick={() => setShopOpen(true)}>
              <img src={SPRITES.shop} alt="" />
            </button>
            <button className={`${styles.iconBtn} ${styles.iconOnlyBtn}`} aria-label="BGM" disabled={specialActive} onClick={() => setMusicOpen((v) => !v)}>
              <span className={styles.iconBtnGlyph}>♪</span>
            </button>
          </div>
          {musicOpen && !specialActive && (
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

        <button className={styles.ptToggle} disabled={specialActive} onClick={() => setPtOpen((v) => !v)}>📜 配当表</button>
        <div className={`${styles.payTable} ${ptOpen ? styles.open : ''}`}>
          <div className={styles.ptTitle}>🐠 PAY TABLE 🐠</div>
          {PAYTABLE_ORDER.map((id) => {
            const s = SYMS[id];
            return (
            <div key={`${s.name}-${id}`} className={styles.ptRow}>
              <span className={styles.ptSym}><PaySymbol source={symbols[id]} /></span>
              <span>{`No.${String(getSymbolNo(id)).padStart(2, '0')} ${s.name}`}</span>
              <span className={styles.ptPay}>{id === 9 ? '3x:4倍BONUS' : `2x:${s.pay2} / 3x:${s.pay3}`}</span>
            </div>
          )})}
        </div>

        <CharacterPanel text={state.charText} mood={state.charMood} />

        <Overlays open={state.jackpotOn} onClose={closeJackpot} sub={`クジラ3揃い！ +${state.win} コイン`} />
        <ZukanModal
          open={zukanOpen}
          entries={zukanData}
          selectedId={zukanSelectedId}
          onSelect={setZukanSelectedId}
          onClose={() => setZukanOpen(false)}
          symbolSources={symbols}
        />
        <ShopModal
          open={shopOpen}
          entries={zukanData}
          coins={state.coins}
          onClose={() => setShopOpen(false)}
          onPurchase={handlePurchase}
          symbolSources={symbols}
        />

      </div>
    </div>
  );
}


