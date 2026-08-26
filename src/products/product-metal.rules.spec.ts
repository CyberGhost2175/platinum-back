import { BadRequestException } from '@nestjs/common';
import { GoldTone } from './enums/gold-tone.enum';
import { MetalCategory } from './enums/metal-category.enum';
import { assertGoldTone } from './product-metal.rules';

describe('assertGoldTone', () => {
  it('requires a gold tone for gold products', () => {
    expect(assertGoldTone(MetalCategory.GOLD, GoldTone.RED)).toBe(GoldTone.RED);
    expect(() => assertGoldTone(MetalCategory.GOLD, null)).toThrow(
      BadRequestException,
    );
  });

  it('forbids a gold tone for non-gold products', () => {
    expect(assertGoldTone(MetalCategory.SILVER, null)).toBeNull();
    expect(() =>
      assertGoldTone(MetalCategory.SILVER, GoldTone.WHITE),
    ).toThrow(BadRequestException);
  });
});
