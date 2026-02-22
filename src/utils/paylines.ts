import type { EvalResult, WinLine } from '../types/game';
import { SYMS } from './symbols';

export const LINES: number[][] = [
  [1, 1, 1],
  [0, 0, 0],
  [2, 2, 2],
  [0, 1, 2],
  [2, 1, 0],
];

export function activeLines(bet: 1 | 2 | 3): number[][] {
  if (bet === 1) return [LINES[0]];
  if (bet === 2) return LINES.slice(0, 3);
  return LINES;
}

export function evalLines(
  grid: number[][],
  lines: number[][],
  _bet: 1 | 2 | 3,
  opts?: { pay2Bonus?: number },
): EvalResult {
  let total = 0;
  let pay2BonusTotal = 0;
  const wins: WinLine[] = [];
  const pay2Bonus = Math.max(0, Math.floor(opts?.pay2Bonus ?? 0));

  lines.forEach((line) => {
    const s0 = grid[0][line[0]];
    const s1 = grid[1][line[1]];
    const s2 = grid[2][line[2]];

    if (s0 === s1 && s1 === s2) {
      const pay = SYMS[s0].pay3 > 0 ? SYMS[s0].pay3 : SYMS[s0].pay2;
      total += pay;
      wins.push({ line, syms: [s0, s1, s2], pay, count: 3 });
    } else if (s0 === s1 && SYMS[s0].pay2 > 0) {
      const pay = SYMS[s0].pay2 + pay2Bonus;
      total += pay;
      pay2BonusTotal += pay2Bonus;
      wins.push({ line, syms: [s0, s1, s2], pay, count: 2 });
    } else if (s1 === s2 && SYMS[s1].pay2 > 0) {
      const pay = SYMS[s1].pay2 + pay2Bonus;
      total += pay;
      pay2BonusTotal += pay2Bonus;
      wins.push({ line, syms: [s0, s1, s2], pay, count: 2 });
    }
  });

  return { total, wins, pay2BonusTotal };
}

export function isJackpot(wins: WinLine[]): boolean {
  return wins.some((w) => w.syms[0] === 0 && w.count === 3);
}

export function isBonus(grid: number[][], lines: number[][], bonusSym: number): boolean {
  return lines.some((line) => {
    const s0 = grid[0][line[0]];
    const s1 = grid[1][line[1]];
    const s2 = grid[2][line[2]];
    return s0 === bonusSym && s1 === bonusSym && s2 === bonusSym;
  });
}

export function bonusTriggerLevel(grid: number[][], lines: number[][], bonusSym: number): 0 | 3 {
  let level: 0 | 3 = 0;
  lines.forEach((line) => {
    const s0 = grid[0][line[0]];
    const s1 = grid[1][line[1]];
    const s2 = grid[2][line[2]];
    if (s0 === bonusSym && s1 === bonusSym && s2 === bonusSym) {
      level = 3;
      return;
    }
  });
  return level;
}
