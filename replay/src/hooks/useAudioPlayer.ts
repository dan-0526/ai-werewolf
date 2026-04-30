import { useCallback, useEffect, useRef } from 'react';
import { Howl } from 'howler';
import type { ReplayEvent } from '../types';

const audioCache = new Map<string, Howl>();

export function useAudioPlayer(dataDir: string) {
  const currentHowlRef = useRef<Howl | null>(null);

  // 预加载所有音频
  const preload = useCallback((events: ReplayEvent[]) => {
    for (const event of events) {
      if (event.audio) {
        const url = `${dataDir}/${event.audio.file}`;
        if (!audioCache.has(url)) {
          audioCache.set(url, new Howl({ src: [url], preload: true }));
        }
      }
    }
  }, [dataDir]);

  // 播放音频，返回 Promise
  const play = useCallback((audioFile: string): Promise<void> => {
    return new Promise((resolve) => {
      const url = `${dataDir}/${audioFile}`;
      const howl = audioCache.get(url);
      if (!howl) { resolve(); return; }

      // 停止上一个
      if (currentHowlRef.current) {
        currentHowlRef.current.stop();
      }

      currentHowlRef.current = howl;
      howl.once('end', () => resolve());
      howl.once('loaderror', () => resolve());
      howl.play();
    });
  }, [dataDir]);

  const stop = useCallback(() => {
    if (currentHowlRef.current) {
      currentHowlRef.current.stop();
      currentHowlRef.current = null;
    }
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { preload, play, stop };
}
