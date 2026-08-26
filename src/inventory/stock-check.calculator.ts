export function diffScannedTags(
  expectedTags: readonly string[],
  scannedTags: readonly string[],
): { missing: string[]; extra: string[] } {
  const expected = [...new Set(expectedTags.map((tag) => tag.trim()).filter(Boolean))];
  const scanned = [...new Set(scannedTags.map((tag) => tag.trim()).filter(Boolean))];
  const scannedSet = new Set(scanned);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((tag) => !scannedSet.has(tag)),
    extra: scanned.filter((tag) => !expectedSet.has(tag)),
  };
}
