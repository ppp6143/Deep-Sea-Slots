import { useEffect, useState } from 'react';
import { SPRITES } from '../assets/sprites';
import type { ZukanEntry } from '../types/game';
import { ZUKAN_TEXTS } from '../utils/zukanCookie';
import { CATALOG_ORDER, getSymbolNo, SYMS } from '../utils/symbols';
import styles from '../styles/App.module.css';

interface Props {
  open: boolean;
  entries: ZukanEntry[];
  selectedId: number;
  onSelect: (id: number) => void;
  onClose: () => void;
  symbolSources: CanvasImageSource[];
}

const ZUKAN_ART_IMAGES: Partial<Record<number, string>> = {
  0: '/zukan-art/shironagasu-kujira.png',
  1: '/zukan-art/hojiro-zame.png',
  2: '/zukan-art/tako.png',
  3: '/zukan-art/umigame.png',
  4: '/zukan-art/kumanomi.png',
  5: '/zukan-art/conch-shell.png',
  6: '/zukan-art/coral.png',
  7: '/zukan-art/tatsunootoshigo.png',
  8: '/zukan-art/chouchin-ankou.png',
  9: '/zukan-art/daiou-ika.png',
};

function splitDescription(text: string): [string, string] {
  const clean = text?.trim() ?? '';
  if (!clean) return ['', ''];
  const parts = clean.split('。').map((v) => v.trim()).filter(Boolean);
  if (parts.length >= 2) return [`${parts[0]}。`, `${parts[1]}。`];
  return [clean, ''];
}

function padNo(id: number): string {
  return String(id).padStart(2, '0');
}

export function ZukanModal({ open, entries, selectedId, onSelect, onClose, symbolSources }: Props) {
  const entry = entries[selectedId];
  const isPurchased = !!entry?.purchased;
  const hasAchievement = !!entry?.unlocked;
  const sortedEntries = CATALOG_ORDER.map((id) => entries[id]).filter(Boolean);
  const [artVisible, setArtVisible] = useState(false);
  const artSrc = isPurchased ? ZUKAN_ART_IMAGES[selectedId] : undefined;
  const [desc1, desc2] = isPurchased ? splitDescription(ZUKAN_TEXTS[selectedId] ?? '') : ['', ''];

  useEffect(() => {
    setArtVisible(false);
  }, [selectedId, artSrc]);

  if (!open) return null;

  return (
    <div className={styles.overlaySheet} onClick={onClose}>
      <div className={`${styles.sheetPanel} ${styles.zukanRetroPanel}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHeader}>
          <div className={styles.sheetTitle}><img src={SPRITES.zukan} alt="" /> DEEP SEA ZUKAN</div>
          <button className={styles.sheetClose} onClick={onClose}>CLOSE</button>
        </div>

        <div className={styles.zukanHero}>
          <div className={styles.zukanHeroArt}>
            {isPurchased && artSrc ? (
              <img
                src={artSrc}
                alt={SYMS[selectedId].name}
                className={`${styles.zukanHeroImage} ${artVisible ? styles.zukanArtVisible : ''}`}
                onLoad={() => setArtVisible(true)}
                onError={() => setArtVisible(false)}
              />
            ) : null}
          </div>
          <div className={styles.zukanHeroMeta}>
            <span className={styles.zukanNo}>No.{padNo(getSymbolNo(selectedId))}</span>
            <span className={styles.zukanName}>{isPurchased ? SYMS[selectedId].name : '????'}</span>
          </div>
        </div>

        <div className={styles.zukanInfoRow}>
          <div className={styles.zukanInfoText}>
            <div>{isPurchased ? desc1 : 'ショップで購入した図鑑のみ表示される。'}</div>
            <div>{isPurchased ? desc2 : hasAchievement ? 'このシンボルは3x達成済み。ショップで購入可能。' : 'まずは有効ラインで3つ揃えて実績を解除しよう。'}</div>
          </div>
          <div className={styles.zukanScoreText}>3x達成: {entry?.count3x ?? 0}回</div>
        </div>

        <div className={styles.zukanCollection}>
          <div className={styles.zukanCollectionTitle}>COLLECTION</div>
          <div className={styles.zukanCollectionGrid}>
            {sortedEntries.map((it) => {
              const selected = it.symbolId === selectedId;
              const purchased = !!it.purchased;
              const cls = [
                styles.zukanCollectionCell,
                selected ? styles.zukanCollectionCellSelected : '',
                !purchased ? styles.zukanCollectionCellLocked : '',
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={it.symbolId}
                  type="button"
                  className={cls}
                  onClick={() => onSelect(it.symbolId)}
                  aria-pressed={selected}
                >
                  <div className={styles.zukanCollectionThumb}>
                    {purchased ? (
                      <canvas
                        width={40}
                        height={40}
                        ref={(node) => {
                          if (!node) return;
                          const ctx = node.getContext('2d');
                          if (!ctx) return;
                          ctx.clearRect(0, 0, 40, 40);
                          ctx.imageSmoothingEnabled = false;
                          ctx.drawImage(symbolSources[it.symbolId], 0, 0, 40, 40);
                        }}
                      />
                    ) : (
                      <div className={styles.zukanLockedMark}>
                        <img src={SPRITES.locked} alt="" />
                        <span>?</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.zukanCollectionLabel}>
                    {purchased ? SYMS[it.symbolId].name : `No.${padNo(getSymbolNo(it.symbolId))}`}
                  </div>
                </button>
              );
            })}
          </div>

          <div className={styles.zukanLegend}>
            <div className={styles.zukanLegendItem}><span className={`${styles.zukanLegendSwatch} ${styles.zukanLegendSwatchSelected}`} /> 選択中</div>
            <div className={styles.zukanLegendItem}><span className={`${styles.zukanLegendSwatch} ${styles.zukanLegendSwatchLocked}`} /> 未解放</div>
          </div>
        </div>
      </div>
    </div>
  );
}
