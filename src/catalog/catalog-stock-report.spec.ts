import { assembleStockReport } from './catalog-stock-report';
import { GoldTone } from '../products/enums/gold-tone.enum';
import { ItemCategory } from '../products/enums/item-category.enum';
import { MetalCategory } from '../products/enums/metal-category.enum';

describe('assembleStockReport', () => {
  it('sums remaining grams by metal, supplier and category, and ranks products', () => {
    const report = assembleStockReport(
      [
        row({
          productId: 'p1',
          sku: 'PT-1',
          name: 'Кольцо',
          supplierId: 's1',
          supplierName: 'Алтын',
          metalCategory: MetalCategory.GOLD,
          goldTone: GoldTone.YELLOW,
          itemCategory: ItemCategory.RINGS,
          units: 2,
          grams: 10,
          weight: '5.000',
        }),
        row({
          productId: 'p2',
          sku: 'PT-2',
          name: 'Серьги',
          supplierId: 's2',
          supplierName: 'Байтерек',
          metalCategory: MetalCategory.GOLD,
          goldTone: GoldTone.WHITE,
          itemCategory: ItemCategory.EARRINGS,
          units: 1,
          grams: 3,
          weight: '3.000',
        }),
        row({
          productId: 'p3',
          sku: 'PT-3',
          name: 'Цепь',
          supplierId: 's1',
          supplierName: 'Алтын',
          metalCategory: MetalCategory.SILVER,
          goldTone: null,
          itemCategory: ItemCategory.CHAINS,
          units: 1,
          grams: 8,
          weight: '8.000',
        }),
      ],
      2,
    );

    expect(report.totals.grams).toBe('21.000');
    expect(report.totals.units).toBe(4);
    expect(report.totals.skuCount).toBe(3);
    expect(report.totals.goldGrams).toBe('13.000');
    expect(report.totals.silverGrams).toBe('8.000');
    expect(report.bySupplier[0]).toEqual(
      expect.objectContaining({ name: 'Алтын', grams: '18.000', units: 3, skuCount: 2 }),
    );
    expect(report.byCategory[0].key).toBe(ItemCategory.RINGS);
    expect(report.byGoldTone[0]).toEqual(
      expect.objectContaining({ key: GoldTone.YELLOW, grams: '10.000', share: 76.9 }),
    );
    expect(report.most[0].sku).toBe('PT-1');
    expect(report.least[0].sku).toBe('PT-2');
  });

  it('returns zeros when the warehouse is empty', () => {
    const report = assembleStockReport([]);
    expect(report.totals.goldGrams).toBe('0.000');
    expect(report.bySupplier).toEqual([]);
    expect(report.most).toEqual([]);
  });
});

function row(
  value: Parameters<typeof assembleStockReport>[0][number],
): Parameters<typeof assembleStockReport>[0][number] {
  return value;
}
