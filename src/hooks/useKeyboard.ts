import { useEffect } from 'react';

export function useKeyboard(onSpace: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.code !== 'Space') return;
      e.preventDefault();
      onSpace();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSpace]);
}
