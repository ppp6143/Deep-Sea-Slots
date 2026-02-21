import type { SymbolDef } from '../types/game';

export const SYMS: SymbolDef[] = [
  { name: 'シロナガスクジラ', pay2: 50, pay3: 500, weight: 3 },
  { name: 'ホオジロザメ', pay2: 30, pay3: 200, weight: 8 },
  { name: 'タコ', pay2: 4, pay3: 40, weight: 14 },
  { name: 'ウミガメ', pay2: 4, pay3: 35, weight: 14 },
  { name: 'クマノミ', pay2: 0, pay3: 15, weight: 24 },
  { name: 'コンク貝', pay2: 0, pay3: 10, weight: 28 },
  { name: 'コーラル', pay2: 0, pay3: 6, weight: 36 },
  { name: 'タツノオトシゴ', pay2: 5, pay3: 25, weight: 18 },
  { name: 'チョウチンアンコウ', pay2: 20, pay3: 120, weight: 11 },
  { name: 'ダイオウイカ', pay2: 0, pay3: 0, weight: 10 },
];

export const BONUS_SYM = 9;
export const PAYTABLE_ORDER = [0, 1, 8, 7, 2, 3, 4, 5, 6, 9] as const;

export function makeStrip(): number[] {
  const arr: number[] = [];
  SYMS.forEach((s, i) => {
    for (let w = 0; w < s.weight; w += 1) arr.push(i);
  });

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function makeReelSet(): [number[], number[], number[]] {
  return [makeStrip(), makeStrip(), makeStrip()];
}
