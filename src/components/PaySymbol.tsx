import { useEffect, useRef } from 'react';

interface Props {
  source: CanvasImageSource;
}

export function PaySymbol({ source }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 28, 28);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, 28, 28);
  }, [source]);

  return <canvas ref={ref} width={28} height={28} style={{ imageRendering: 'pixelated' }} />;
}
