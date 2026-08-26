import { diffScannedTags } from './stock-check.calculator';

describe('diffScannedTags', () => {
  it('detects missing and extra tags', () => {
    expect(
      diffScannedTags(['TAG-1', 'TAG-2', 'TAG-3'], ['TAG-1', 'TAG-4']),
    ).toEqual({
      missing: ['TAG-2', 'TAG-3'],
      extra: ['TAG-4'],
    });
  });

  it('ignores duplicates and blank tags', () => {
    expect(diffScannedTags([' TAG-1 ', 'TAG-1'], ['TAG-1', '', 'TAG-1'])).toEqual({
      missing: [],
      extra: [],
    });
  });
});
