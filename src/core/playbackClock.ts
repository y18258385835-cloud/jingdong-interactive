import { startTransition, useEffect, useState } from 'react';

// The editor shell and the preview canvas have different frame-rate needs.
// Keep the high-frequency playback clock outside App state so only consumers
// that need animation frames subscribe to it.
let playbackTime = 0;
const subscribers = new Map<() => void, { minInterval: number; lastNotifiedAt: number }>();

export function getPlaybackClockTime(): number {
  return playbackTime;
}

export function subscribePlaybackClock(subscriber: () => void): () => void {
  subscribers.set(subscriber, { minInterval: 0, lastNotifiedAt: 0 });
  return () => {
    subscribers.delete(subscriber);
  };
}

export function setPlaybackClockTime(time: number): void {
  if (!Number.isFinite(time) || time === playbackTime) return;
  playbackTime = time;
  const now = performance.now();
  subscribers.forEach((subscription, subscriber) => {
    if (now - subscription.lastNotifiedAt < subscription.minInterval) return;
    subscription.lastNotifiedAt = now;
    subscriber();
  });
}

/**
 * Lets each playback surface choose a frame budget. The playhead can follow
 * RAF updates while a layer-heavy canvas leaves room for video compositing.
 */
export function usePlaybackClockTime(
  fallbackTime: number,
  isPlaying: boolean,
  maxFps = 0,
): number {
  const [clockTime, setClockTime] = useState(() => playbackTime);

  useEffect(() => {
    if (!isPlaying) {
      setClockTime(fallbackTime);
      return;
    }

    let active = true;
    const subscriber = () => {
      const nextTime = playbackTime;
      // Canvas rendering is substantial work. Keeping it in a transition stops
      // the external clock from synchronously blocking media and compositor UI.
      startTransition(() => {
        if (active) setClockTime((previous) => previous === nextTime ? previous : nextTime);
      });
    };

    subscribers.set(subscriber, {
      minInterval: maxFps > 0 ? 1000 / maxFps : 0,
      lastNotifiedAt: 0,
    });
    subscriber();

    return () => {
      active = false;
      subscribers.delete(subscriber);
    };
  }, [fallbackTime, isPlaying, maxFps]);

  return isPlaying ? clockTime : fallbackTime;
}
