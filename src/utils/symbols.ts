import type { SymbolDef } from '../types/game';

export const SYMS: SymbolDef[] = [
  { name: 'シロナガスクジラ', pay2: 0, pay3: 150, weight: 3 },
  { name: 'ホオジロザメ', pay2: 0, pay3: 50, weight: 8 },
  { name: 'タコ', pay2: 0, pay3: 20, weight: 14 },
  { name: 'ウミガメ', pay2: 0, pay3: 10, weight: 14 },
  { name: 'クマノミ', pay2: 5, pay3: 0, weight: 24 },
  { name: 'コンク貝', pay2: 4, pay3: 0, weight: 28 },
  { name: 'コーラル', pay2: 3, pay3: 0, weight: 36 },
  { name: 'タツノオトシゴ', pay2: 0, pay3: 30, weight: 18 },
  { name: 'チョウチンアンコウ', pay2: 0, pay3: 40, weight: 11 },
  { name: 'ダイオウイカ', pay2: 0, pay3: 0, weight: 10 },
];

export const BONUS_SYM = 9;
export const PAYTABLE_ORDER = [0, 1, 8, 7, 2, 3, 4, 5, 6, 9] as const;
export const CATALOG_ORDER = ([...PAYTABLE_ORDER].reverse() as number[]).concat([10, 11, 12]);
export const SYMBOL_NO_BY_ID: Record<number, number> = Object.fromEntries(
  CATALOG_ORDER.map((id, index) => [id, index + 1]),
) as Record<number, number>;

export function getSymbolNo(symbolId: number): number {
  return SYMBOL_NO_BY_ID[symbolId] ?? symbolId + 1;
}

// 0=クジラ 1=サメ 2=タコ 3=カメ 4=クマノミ 5=コンク 6=コーラル 7=タツノオト 8=アンコウ 9=イカ
// 各リール30シンボル固定配列 — 目押し可能な短縮リール
const REEL_1: number[] = [
  6, 4, 5, 7, 6, 3, 1, 6, 4, 5,
  6, 2, 9, 4, 6, 0, 5, 8, 3, 7,
  6, 4, 1, 5, 3, 9, 7, 8, 2, 6,
];

const REEL_2: number[] = [
  6, 5, 4, 8, 6, 3, 7, 5, 6, 1,
  4, 6, 9, 5, 2, 6, 0, 4, 7, 3,
  6, 5, 1, 8, 4, 9, 3, 7, 2, 6,
];

const REEL_3: number[] = [
  6, 4, 7, 5, 6, 1, 3, 4, 6, 8,
  5, 9, 6, 2, 4, 7, 0, 6, 5, 3,
  1, 6, 9, 4, 8, 5, 7, 2, 3, 6,
];

export const REEL_STRIPS: [number[], number[], number[]] = [REEL_1, REEL_2, REEL_3];
