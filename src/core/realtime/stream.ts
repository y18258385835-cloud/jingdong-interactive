import type { RealtimeSnapshot } from './types';

export type SnapshotDecision =
  | { accepted: true; snapshot: RealtimeSnapshot; needsCompensation: boolean }
  | { accepted: false; reason: 'duplicate' | 'out-of-scope' };

/** Keeps a published screen monotonic when a socket retries or delivers frames out of order. */
export function decideSnapshot(
  current: RealtimeSnapshot | null,
  next: RealtimeSnapshot,
): SnapshotDecision {
  if (current && (current.tenantId !== next.tenantId || current.sourceId !== next.sourceId)) {
    if (current.sourceType === 'mock' && current.sequence === 0) {
      return { accepted: true, snapshot: next, needsCompensation: false };
    }
    return { accepted: false, reason: 'out-of-scope' };
  }
  if (current && next.sequence <= current.sequence) {
    return { accepted: false, reason: 'duplicate' };
  }
  return {
    accepted: true,
    snapshot: next,
    needsCompensation: Boolean(current && next.sequence > current.sequence + 1),
  };
}
