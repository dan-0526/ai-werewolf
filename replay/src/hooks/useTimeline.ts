import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReplayEvent } from '../types';

export interface TimelineState {
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
  events: ReplayEvent[];
  history: ReplayEvent[];
}

export interface TimelineControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (index: number) => void;
  setSpeed: (speed: number) => void;
}

export function useTimeline(
  events: ReplayEvent[],
  onEventStart?: (event: ReplayEvent) => void,
): [TimelineState, TimelineControls] {
  const [state, setState] = useState<TimelineState>({
    currentIndex: -1,
    isPlaying: false,
    speed: 1,
    events,
    history: [],
  });

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const stateRef = useRef(state);
  stateRef.current = state;

  // 同步 ref，解决 setState 异步导致 toggle 判断错误的问题
  const isPlayingRef = useRef(false);
  const speedRef = useRef(1);

  useEffect(() => {
    setState((s) => ({ ...s, events }));
  }, [events]);

  const advance = useCallback(() => {
    // 如果已暂停，不再推进
    if (!isPlayingRef.current) return;

    const s = stateRef.current;
    const nextIndex = s.currentIndex + 1;

    if (nextIndex >= s.events.length) {
      isPlayingRef.current = false;
      setState((prev) => ({ ...prev, isPlaying: false }));
      return;
    }

    const event = s.events[nextIndex];
    setState((prev) => ({
      ...prev,
      currentIndex: nextIndex,
      isPlaying: true,
      history: [...prev.history, event],
    }));

    onEventStart?.(event);

    const delay = event.displayDurationMs / speedRef.current;
    timerRef.current = setTimeout(advance, delay);
  }, [onEventStart]);

  const play = useCallback(() => {
    isPlayingRef.current = true;
    setState((s) => ({ ...s, isPlaying: true }));
    advance();
  }, [advance]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) pause();
    else play();
  }, [play, pause]);

  const seekTo = useCallback((index: number) => {
    isPlayingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    const history = stateRef.current.events.slice(0, index + 1);
    setState((s) => ({
      ...s,
      currentIndex: index,
      history,
      isPlaying: false,
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    speedRef.current = speed;
    setState((s) => ({ ...s, speed }));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [state, { play, pause, toggle, seekTo, setSpeed }];
}
