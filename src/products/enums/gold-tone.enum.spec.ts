import { GoldTone, GOLD_TONE_LABELS, goldToneOptions } from './gold-tone.enum';

describe('goldToneOptions', () => {
  it('labels yellow gold as жёлтое, not золотое', () => {
    expect(GOLD_TONE_LABELS[GoldTone.YELLOW]).toBe('Жёлтое');
    expect(goldToneOptions()).toEqual([
      { value: GoldTone.RED, label: 'Красное' },
      { value: GoldTone.YELLOW, label: 'Жёлтое' },
      { value: GoldTone.WHITE, label: 'Белое' },
    ]);
  });
});
