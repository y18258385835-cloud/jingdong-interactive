export function isTimelineTimeVisible(
  currentTime: number,
  startTime: number = 0,
  duration: number = 0,
): boolean {
  if (!Number.isFinite(currentTime) || !Number.isFinite(startTime)) return false;
  if (duration === Number.POSITIVE_INFINITY) return currentTime >= startTime;
  if (!Number.isFinite(duration) || duration <= 0) return false;

  return currentTime >= startTime && currentTime < startTime + duration;
}
