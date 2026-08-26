import { BadRequestException } from '@nestjs/common';
import { GoldTone } from './enums/gold-tone.enum';
import { MetalCategory } from './enums/metal-category.enum';

export function assertGoldTone(
  metalCategory: MetalCategory,
  goldTone: GoldTone | null | undefined,
): GoldTone | null {
  if (metalCategory === MetalCategory.GOLD) {
    if (!goldTone) {
      throw new BadRequestException('goldTone is required for gold products');
    }
    return goldTone;
  }
  if (goldTone) {
    throw new BadRequestException('goldTone is only allowed for gold products');
  }
  return null;
}
