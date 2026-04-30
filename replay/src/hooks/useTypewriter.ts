import { useCallback, useEffect, useRef, useState } from 'react';

interface TypewriterState {
  displayText: string;
  isTyping: boolean;
}

export function useTypewriter(): [TypewriterState, (text: string, durationMs: number) => void, () => void] {
  const [state, setState] = useState<TypewriterState>({ displayText: '', isTyping: false });
  const rafRef = useRef<number>();
  const startTimeRef = useRef(0);
  const textRef = useRef('');
  const durationRef = useRef(0);

  const start = useCallback((text: string, durationMs: number) => {
    // 取消上一个
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    textRef.current = text;
    durationRef.current = Math.max(durationMs, 500); // 最少 500ms
    startTimeRef.current = performance.now();
    setState({ displayText: '', isTyping: true });

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / durationRef.current, 1);
      const charCount = Math.floor(progress * textRef.current.length);
      const displayText = textRef.current.slice(0, charCount);

      setState({ displayText, isTyping: progress < 1 });

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setState({ displayText: '', isTyping: false });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return [state, start, reset];
}
