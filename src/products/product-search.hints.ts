import { GoldTone } from './enums/gold-tone.enum';
import { ItemCategory } from './enums/item-category.enum';
import { MetalCategory } from './enums/metal-category.enum';

function hit(term: string, aliases: string[]) {
  if (term.length < 2) return false;
  return aliases.some((alias) => alias.includes(term) || term.includes(alias));
}

export function productSearchHints(raw: string): {
  metals: MetalCategory[];
  categories: ItemCategory[];
  tones: GoldTone[];
} {
  const term = raw.toLowerCase().trim();
  const metals: MetalCategory[] = [];
  const categories: ItemCategory[] = [];
  const tones: GoldTone[] = [];

  if (hit(term, ['gold', 'золот', 'золото'])) metals.push(MetalCategory.GOLD);
  if (hit(term, ['silver', 'серебр', 'серебро'])) metals.push(MetalCategory.SILVER);
  if (hit(term, ['diamond', 'diamonds', 'бриллиант'])) {
    metals.push(MetalCategory.DIAMONDS);
  }

  if (hit(term, ['ring', 'rings', 'кольц', 'кольцо'])) {
    categories.push(ItemCategory.RINGS);
  }
  if (hit(term, ['earring', 'earrings', 'серьг'])) {
    categories.push(ItemCategory.EARRINGS);
  }
  if (hit(term, ['stud', 'studs', 'пусет'])) categories.push(ItemCategory.STUDS);
  if (hit(term, ['necklace', 'necklaces', 'колье'])) {
    categories.push(ItemCategory.NECKLACES);
  }
  if (hit(term, ['bracelet', 'bracelets', 'браслет'])) {
    categories.push(ItemCategory.BRACELETS);
  }
  if (hit(term, ['chain', 'chains', 'цеп', 'цепи'])) {
    categories.push(ItemCategory.CHAINS);
  }

  if (hit(term, ['yellow', 'жёлт', 'желт'])) tones.push(GoldTone.YELLOW);
  if (hit(term, ['white', 'бел', 'белое'])) tones.push(GoldTone.WHITE);
  if (hit(term, ['red', 'красн', 'красное'])) tones.push(GoldTone.RED);

  return { metals, categories, tones };
}
