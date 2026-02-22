import { SPRITES } from '../assets/sprites';
import type { ZukanEntry } from '../types/game';
import { CATALOG_ORDER, getSymbolNo } from '../utils/symbols';
import { SHOP_PRICES, ZUKAN_NAMES } from '../utils/zukanCookie';
import styles from '../styles/App.module.css';

interface Props {
  open: boolean;
  entries: ZukanEntry[];
  coins: number;
  onClose: () => void;
  onPurchase: (symbolId: number) => void;
  symbolSources: CanvasImageSource[];
}

export function ShopModal({ open, entries, coins, onClose, onPurchase, symbolSources }: Props) {
  if (!open) return null;
  const sortedEntries = CATALOG_ORDER.map((id) => entries[id]).filter(Boolean);

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
            const isSpecialZukan = entry.symbolId >= 10;
            const visibleName = isSpecialZukan && !hasAchievement
              ? '???'
              : (ZUKAN_NAMES[entry.symbolId] ?? `ITEM ${no}`);

            return (
              <div key={entry.symbolId} className={styles.shopRow}>
                <div className={styles.shopIcon}>
                  {hasAchievement ? (
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
                      <img src={SPRITES.bookClosed} alt="" />
                    )
                  ) : (
                    <img src={SPRITES.locked} alt="" />
                  )}
                </div>
                <div className={styles.shopMeta}>
                  <div>{`No.${no} ${visibleName}`}</div>
                  <div>価格: {price} コイン</div>
                  <div>
                    {entry.symbolId < 10
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
