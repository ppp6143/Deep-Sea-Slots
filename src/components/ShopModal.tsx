import { SPRITES } from '../assets/sprites';
import type { ZukanEntry } from '../types/game';
import { CATALOG_ORDER, getSymbolNo } from '../utils/symbols';
import { REEL_EFFICIENCY_LV1_ID, REEL_EFFICIENCY_LV2_ID, SHOP_PRICES, ZUKAN_NAMES } from '../utils/zukanCookie';
import styles from '../styles/App.module.css';

interface Props {
  open: boolean;
  entries: ZukanEntry[];
  coins: number;
  onClose: () => void;
  onPurchase: (symbolId: number) => void;
  symbolSources: CanvasImageSource[];
}

const SPECIAL_MINI_SPRITES: Partial<Record<number, string>> = {
  10: SPRITES.mendakoMini,
  11: SPRITES.gusokumushiMini,
  12: SPRITES.ryuguuMini,
};

export function ShopModal({ open, entries, coins, onClose, onPurchase, symbolSources }: Props) {
  if (!open) return null;
  const baseEntries = CATALOG_ORDER.map((id) => entries[id]).filter(Boolean);
  const upgrades = [entries[REEL_EFFICIENCY_LV1_ID], entries[REEL_EFFICIENCY_LV2_ID]].filter(Boolean);
  const sortedEntries = [...baseEntries, ...upgrades];

  return (
    <div className={styles.overlaySheet} onClick={onClose}>
      <div className={styles.sheetPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHeader}>
          <div className={styles.sheetTitle}><img src={SPRITES.shop} alt="" /> DEEP SEA SHOP</div>
          <button className={styles.sheetClose} onClick={onClose}>CLOSE</button>
        </div>
        <div className={styles.shopCoins}>所持コイン: {coins}</div>
        <div className={styles.shopList}>
          {sortedEntries.map((entry) => {
            const price = SHOP_PRICES[entry.symbolId];
            const hasAchievement = entry.unlocked;
            const canBuy = hasAchievement && !entry.purchased && coins >= price;
            const buttonLabel = entry.purchased ? '購入済み' : hasAchievement ? '購入' : '未達成';
            const no = String(getSymbolNo(entry.symbolId)).padStart(2, '0');
            const isPlayableSymbol = entry.symbolId < symbolSources.length;
            const isSpecialZukan = entry.symbolId >= 10 && entry.symbolId <= 12;
            const isUpgrade1 = entry.symbolId === REEL_EFFICIENCY_LV1_ID;
            const isUpgrade2 = entry.symbolId === REEL_EFFICIENCY_LV2_ID;
            const isUpgradeItem = isUpgrade1 || isUpgrade2;
            const visibleName = isSpecialZukan && !hasAchievement ? '???' : (ZUKAN_NAMES[entry.symbolId] ?? `ITEM ${no}`);
            const specialMini = SPECIAL_MINI_SPRITES[entry.symbolId];

            return (
              <div key={entry.symbolId} className={styles.shopRow}>
                <div className={styles.shopIcon}>
                  {isUpgrade1 ? (
                    <img src={SPRITES.reelEfficiency} alt="" />
                  ) : isUpgrade2 ? (
                    <img src={SPRITES.reelEfficiency2} alt="" />
                  ) : hasAchievement ? (
                    isPlayableSymbol ? (
                      <canvas
                        width={40}
                        height={40}
                        ref={(node) => {
                          if (!node) return;
                          const ctx = node.getContext('2d');
                          if (!ctx) return;
                          ctx.clearRect(0, 0, 40, 40);
                          ctx.imageSmoothingEnabled = false;
                          ctx.drawImage(symbolSources[entry.symbolId], 0, 0, 40, 40);
                        }}
                      />
                    ) : (
                      <img className={specialMini ? styles.specialMiniIcon : ''} src={specialMini ?? SPRITES.bookClosed} alt="" />
                    )
                  ) : (
                    <img src={SPRITES.locked} alt="" />
                  )}
                </div>
                <div className={styles.shopMeta}>
                  <div>{isUpgradeItem ? visibleName : `No.${no} ${visibleName}`}</div>
                  <div>価格: {price} コイン</div>
                  <div>
                    {isUpgrade1
                      ? (entry.purchased ? '効果: 2揃い配当 +1（適用中）' : '効果: 2揃い配当 +1')
                      : isUpgrade2
                        ? (entry.purchased ? '効果: 2揃い配当 +2（適用中）' : '効果: 2揃い配当 +2（Lv1と加算）')
                        : entry.symbolId < 10
                          ? (hasAchievement ? `3x達成済み (${entry.count3x})` : '3x達成で購入可能')
                          : (hasAchievement ? 'No.01-10図鑑解放済み' : 'No.01-10図鑑解放で購入可能')}
                  </div>
                </div>
                <button className={styles.shopBuyBtn} disabled={!canBuy} onClick={() => onPurchase(entry.symbolId)}>
                  {buttonLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
