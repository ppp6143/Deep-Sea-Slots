import type { ZukanEntry } from '../types/game';
import { BONUS_SYM, SYMS } from './symbols';

const ZUKAN_COOKIE_KEY = 'deepsea_zukan';

export const BASE_SYMBOL_COUNT = 10;
export const ZUKAN_ITEM_COUNT = 13;
export const EXTRA_ZUKAN_IDS = [10, 11, 12] as const;

export const ZUKAN_NAMES: Record<number, string> = {
  0: 'シロナガスクジラ',
  1: 'ホオジロザメ',
  2: 'タコ',
  3: 'ウミガメ',
  4: 'クマノミ',
  5: 'コンク貝',
  6: 'コーラル',
  7: 'タツノオトシゴ',
  8: 'チョウチンアンコウ',
  9: 'ダイオウイカ',
  10: 'メンダコ',
  11: 'ダイオウグソクムシ',
  12: 'リュウグウノツカイ',
};

export const SHOP_PRICES: Record<number, number> = Object.fromEntries([
  ...SYMS.map((sym, id) => [id, id === BONUS_SYM ? 2000 : (sym.pay3 > 0 ? sym.pay3 : sym.pay2) * 10]),
  [10, 500],
  [11, 1000],
  [12, 2000],
]) as Record<number, number>;

export const ZUKAN_TEXTS: Record<number, string> = {
  0: '世界最大級のクジラ。圧倒的な体格で海を進む。深海の伝説級シンボル。',
  1: '鋭い歯をもつ大型のサメ。素早い動きで獲物を狙う。',
  2: '柔らかな体と吸盤をもつ知能の高い生き物。器用に隠れる。',
  3: '長寿でのんびり泳ぐ海の旅人。硬い甲羅で身を守る。',
  4: 'イソギンチャクと共生するカラフルな魚。縄張り意識が強い。',
  5: '巻貝の一種。殻は丈夫で、海底の砂地でも目立つ。',
  6: '海の森をつくるサンゴ。多くの生き物の住処になる。',
  7: '細長い体で漂うように泳ぐ魚。姿勢を保つのが得意。',
  8: '発光器をもつ深海魚。暗い海で獲物をおびき寄せる。',
  9: '巨大な深海のイカ。3体揃いで特別ボーナスを呼び込む。',
  10: '丸くてやわらかな姿の深海タコ。ひらひらしたヒレで泳ぐ。',
  11: '巨大な等脚類。海底で静かに待ち、長期間食べないこともある。',
  12: '細長く銀色に輝く深海魚。海面近くで目撃されることもある。',
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
  return Array.from({ length: ZUKAN_ITEM_COUNT }, (_, i) => ({
    symbolId: i,
    unlocked: false,
    purchased: false,
    count3x: 0,
  }));
}

function applyExtraUnlockRule(entries: ZukanEntry[]): ZukanEntry[] {
  const allBasePurchased = entries.slice(0, BASE_SYMBOL_COUNT).every((e) => e.purchased);
  return entries.map((entry) => {
    if (!EXTRA_ZUKAN_IDS.includes(entry.symbolId as (typeof EXTRA_ZUKAN_IDS)[number])) return entry;
    return {
      ...entry,
      unlocked: allBasePurchased,
      count3x: 0,
    };
  });
}

export function syncZukanUnlockRules(data: ZukanEntry[]): ZukanEntry[] {
  return applyExtraUnlockRule(data);
}

export function loadZukan(): ZukanEntry[] {
  try {
    const raw = readCookie(ZUKAN_COOKIE_KEY);
    if (!raw) return makeDefaultZukan();
    const data = JSON.parse(decodeURIComponent(raw)) as ZukanEntry[];
    if (!Array.isArray(data)) return makeDefaultZukan();

    const next = makeDefaultZukan().map((_, i) => {
      const d = data[i];
      return {
        symbolId: i,
        unlocked: !!d?.unlocked,
        purchased: !!d?.purchased,
        count3x: Math.max(0, Math.floor(d?.count3x ?? 0)),
      };
    });
    return applyExtraUnlockRule(next);
  } catch {
    return makeDefaultZukan();
  }
}

export function saveZukan(data: ZukanEntry[]): void {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${ZUKAN_COOKIE_KEY}=${encodeURIComponent(JSON.stringify(data))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}
