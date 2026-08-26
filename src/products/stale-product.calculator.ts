export function isStaleDate(
  createdAt: Date,
  thresholdDays: number,
  now: Date = new Date(),
): boolean {
  const ageMs = now.getTime() - createdAt.getTime();
  return ageMs >= thresholdDays * 24 * 60 * 60 * 1000;
}
