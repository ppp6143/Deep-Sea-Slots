import type { SymbolDef } from '../types/game';

export const SYMS: SymbolDef[] = [
  { name: 'シロナガスクジラ', pay2: 50, pay3: 500, weight: 3 },
  { name: 'ホオジロザメ', pay2: 30, pay3: 200, weight: 8 },
  { name: 'タコ', pay2: 15, pay3: 80, weight: 14 },
  { name: 'ウミガメ', pay2: 15, pay3: 70, weight: 14 },
  { name: 'クマノミ', pay2: 8, pay3: 30, weight: 24 },
  { name: 'コンク貝', pay2: 6, pay3: 20, weight: 28 },
  { name: 'コーラル', pay2: 4, pay3: 12, weight: 36 },
  { name: 'タツノオトシゴ', pay2: 10, pay3: 50, weight: 18 },
  { name: 'チョウチンアンコウ', pay2: 20, pay3: 120, weight: 11 },
  { name: 'ダイオウイカ', pay2: 0, pay3: 0, weight: 4 },
];

export const BONUS_SYM = 9;

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
