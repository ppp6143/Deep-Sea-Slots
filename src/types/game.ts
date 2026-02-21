export type Mood = 'idle' | 'happy' | 'excited' | 'worried' | 'sad';

export type StopState = 0 | 1 | 2 | 3 | 4;

export interface SymbolDef {
  name: string;
  pay2: number;
  pay3: number;
  weight: number;
}

export interface WinLine {
  line: number[];
  syms: number[];
  pay: number;
  count: 2 | 3;
}

export interface EvalResult {
  total: number;
  wins: WinLine[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  decay: number;
  color: string;
}

export interface Bubble {
  x: number;
  y: number;
  r: number;
  s: number;
  dx: number;
  a: number;
}

export interface GameState {
  coins: number;
  bet: 1 | 2 | 3;
  win: number;
  combo: number;
  freeSpin: number;
  isSpinning: boolean;
  stopState: StopState;
  isSnapping: boolean;
  bonusActive: boolean;
  bonusFree: number;
  bonusWon: number;
  bonusPointMult: number;
  bonusStopState: StopState;
  bonusSnapping: boolean;
  message: string;
  reachOn: boolean;
  jackpotOn: boolean;
  charMood: Mood;
  charText: string;
  linesCount: 1 | 3 | 5;
}

export type GameAction =
  | { type: 'SET_BET'; bet: 1 | 2 | 3 }
  | { type: 'SET_MESSAGE'; message: string }
  | { type: 'SET_CHAR'; mood: Mood; text: string }
  | { type: 'SPIN_START'; free: boolean }
  | { type: 'SET_STOP_STATE'; value: StopState }
  | { type: 'SET_SPINNING'; value: boolean }
  | { type: 'SET_SNAPPING'; value: boolean }
  | { type: 'SET_REACH'; value: boolean }
  | { type: 'SPIN_WIN'; amount: number; combo: number }
  | { type: 'SPIN_LOSE' }
  | { type: 'SHOW_JACKPOT'; value: boolean }
  | { type: 'SET_FREE'; value: number }
  | { type: 'BONUS_START'; pointMult: number }
  | { type: 'BONUS_SPIN_START' }
  | { type: 'BONUS_STOP_STATE'; value: StopState }
  | { type: 'BONUS_SNAPPING'; value: boolean }
  | { type: 'BONUS_SPIN_FINISH'; won: number }
  | { type: 'BONUS_END' };
