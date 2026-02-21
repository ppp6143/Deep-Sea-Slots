import { drawSym } from './drawSym';

function makeCanvas(offscreenPreferred: boolean): OffscreenCanvas | HTMLCanvasElement {
  if (offscreenPreferred && typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(64, 64);
  }
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  return c;
}

export async function initSymbolCache(offscreenPreferred: boolean): Promise<CanvasImageSource[]> {
  const cache: CanvasImageSource[] = [];
  for (let i = 0; i < 10; i += 1) {
    const c = makeCanvas(offscreenPreferred);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) continue;
    drawSym(ctx as unknown as CanvasRenderingContext2D, i);
    cache.push(c as unknown as CanvasImageSource);
  }
  return cache;
}
