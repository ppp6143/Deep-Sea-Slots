import { useMemo, useReducer } from 'react';
import type { GameAction, GameState } from '../types/game';

const initialState: GameState = {
  coins: 100,
  bet: 1,
  win: 0,
  combo: 0,
  freeSpin: 0,
  isSpinning: false,
  stopState: 0,
  isSnapping: false,
  bonusActive: false,
  bonusFree: 0,
  bonusWon: 0,
  bonusPointMult: 2,
  bonusStopState: 0,
  bonusSnapping: false,
  message: 'コインを賭けてSPINを押そう！',
  reachOn: false,
  jackpotOn: false,
  charMood: 'happy',
  charText: 'ガンバレ！',
  linesCount: 1,
};

const INITIAL_COINS = 100;

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'HYDRATE_PROFILE':
      return {
        ...state,
        coins: action.coins,
        freeSpin: action.bonusEntries,
      };
    case 'RESTART_GAME':
      return {
        ...state,
        coins: INITIAL_COINS,
        win: 0,
        combo: 0,
        isSpinning: false,
        stopState: 0,
        isSnapping: false,
        bonusActive: false,
        bonusFree: 0,
        bonusWon: 0,
        bonusPointMult: 2,
        bonusStopState: 0,
        bonusSnapping: false,
        reachOn: false,
        jackpotOn: false,
        message: 'コインを賭けてSPINを押そう！',
        charMood: 'happy',
        charText: 'ガンバレ！',
      };
    case 'SET_BET':
      return { ...state, bet: action.bet, linesCount: action.bet === 1 ? 1 : action.bet === 2 ? 3 : 5 };
    case 'SET_MESSAGE':
      return { ...state, message: action.message };
    case 'SET_CHAR':
      return { ...state, charMood: action.mood, charText: action.text };
    case 'SET_COINS':
      return { ...state, coins: Math.max(0, Math.floor(action.value)) };
    case 'SPIN_START':
      return {
        ...state,
        isSpinning: true,
        stopState: 1,
        isSnapping: false,
        reachOn: false,
        win: 0,
        coins: action.free ? state.coins : state.coins - state.bet,
      };
    case 'SET_STOP_STATE':
      return { ...state, stopState: action.value };
    case 'SET_SPINNING':
      return { ...state, isSpinning: action.value };
    case 'SET_SNAPPING':
      return { ...state, isSnapping: action.value };
    case 'SET_REACH':
      return { ...state, reachOn: action.value };
    case 'SPIN_WIN':
      return { ...state, win: action.amount, coins: state.coins + action.amount, combo: action.combo };
    case 'SPIN_LOSE':
      return { ...state, combo: 0, win: 0 };
    case 'SHOW_JACKPOT':
      return { ...state, jackpotOn: action.value };
    case 'SET_FREE':
      return { ...state, freeSpin: action.value };
    case 'BONUS_START':
      return {
        ...state,
        freeSpin: state.freeSpin + 1,
        bonusActive: true,
        bonusFree: 8,
        bonusWon: 0,
        bonusPointMult: action.pointMult,
        bonusStopState: 0,
        bonusSnapping: false,
      };
    case 'BONUS_SPIN_START':
      return {
        ...state,
        bonusFree: Math.max(0, state.bonusFree - 1),
        bonusStopState: 1,
        bonusSnapping: false,
      };
    case 'BONUS_STOP_STATE':
      return { ...state, bonusStopState: action.value };
    case 'BONUS_SNAPPING':
      return { ...state, bonusSnapping: action.value };
    case 'BONUS_SPIN_FINISH':
      return { ...state, bonusWon: state.bonusWon + action.won, coins: state.coins + action.won, win: action.won, bonusStopState: 0 };
    case 'BONUS_END':
      return { ...state, bonusActive: false, bonusStopState: 0, bonusSnapping: false };
    default:
      return state;
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return useMemo(() => ({ state, dispatch }), [state]);
}
