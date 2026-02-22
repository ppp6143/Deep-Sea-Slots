import type { ZukanEntry } from '../types/game';
import { BONUS_SYM, SYMS } from './symbols';

const ZUKAN_COOKIE_KEY = 'deepsea_zukan';

export const SHOP_PRICES: Record<number, number> = Object.fromEntries(
  SYMS.map((sym, id) => [
    id,
    id === BONUS_SYM ? 2000 : (sym.pay3 > 0 ? sym.pay3 : sym.pay2) * 10,
  ]),
) as Record<number, number>;

export const ZUKAN_TEXTS: Record<number, string> = {
  0: '世界最大の動物。深海でも悠々と泳ぐ。',
  1: '高速で泳ぐ大型のサメ。鋭い感覚を持つ。',
  2: '知能が高く、体色を変えることもできる。',
  3: '長寿でのんびり。甲羅で身を守る。',
  4: '共生で有名な小型の魚。鮮やかな体色。',
  5: '大きな巻き貝。重い殻で身を守る。',
  6: '海の森を作るサンゴ。色彩が豊か。',
  7: '細長い体でゆらゆら漂う不思議な魚。',
  8: '発光器を持つ深海魚。暗闇で獲物を誘う。',
  9: '巨大なイカ。深海の伝説級シンボル。',
};

function readCookie(name: string): string | null {
  const token = `${name}=`;
  const parts = document.cookie.split(';').map((v) => v.trim());
  for (const p of parts) {
    if (p.startsWith(token)) return p.slice(token.length);
  }
  return null;
}

export function makeDefaultZukan(): ZukanEntry[] {
  return Array.from({ length: 10 }, (_, i) => ({
    symbolId: i,
    unlocked: false,
    purchased: false,
    count3x: 0,
  }));
}

export function loadZukan(): ZukanEntry[] {
  try {
    const raw = readCookie(ZUKAN_COOKIE_KEY);
    if (!raw) return makeDefaultZukan();
    const data = JSON.parse(decodeURIComponent(raw)) as ZukanEntry[];
    if (!Array.isArray(data) || data.length !== 10) return makeDefaultZukan();
    return makeDefaultZukan().map((_, i) => {
      const d = data[i];
      return {
        symbolId: i,
        unlocked: !!d?.unlocked,
        purchased: !!d?.purchased,
        count3x: Math.max(0, Math.floor(d?.count3x ?? 0)),
      };
    });
  } catch {
    return makeDefaultZukan();
  }
}

export function saveZukan(data: ZukanEntry[]): void {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${ZUKAN_COOKIE_KEY}=${encodeURIComponent(JSON.stringify(data))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}
