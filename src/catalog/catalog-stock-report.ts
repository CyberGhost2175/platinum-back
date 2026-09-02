import { GoldTone } from '../products/enums/gold-tone.enum';
import { ItemCategory } from '../products/enums/item-category.enum';
import { MetalCategory } from '../products/enums/metal-category.enum';

export type StockReportRow = {
  productId: string;
  sku: string;
  name: string;
  weight: string;
  metalCategory: MetalCategory;
  goldTone: GoldTone | null;
  itemCategory: ItemCategory;
  supplierId: string;
  supplierName: string;
  units: number;
  grams: number;
};

export type StockReportBucket = {
  key: string;
  name: string;
  grams: string;
  units: number;
  skuCount: number;
  share: number;
};

export type StockReportProduct = {
  productId: string;
  sku: string;
  name: string;
  supplierName: string;
  metalCategory: MetalCategory;
  goldTone: GoldTone | null;
  itemCategory: ItemCategory;
  units: number;
  grams: string;
  weight: string;
};

export type StockReport = {
  totals: {
    grams: string;
    units: number;
    skuCount: number;
    goldGrams: string;
    silverGrams: string;
    diamondsGrams: string;
  };
  byMetal: StockReportBucket[];
  byGoldTone: StockReportBucket[];
  bySupplier: StockReportBucket[];
  byCategory: StockReportBucket[];
  most: StockReportProduct[];
  least: StockReportProduct[];
};

export function formatStockGrams(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0.000';
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

export function assembleStockReport(
  rows: StockReportRow[],
  productLimit = 8,
): StockReport {
  const limit = Math.min(50, Math.max(1, productLimit));
  const totalGrams = sum(rows, (row) => row.grams);
  const totalUnits = sum(rows, (row) => row.units);
  const goldRows = rows.filter((row) => row.metalCategory === MetalCategory.GOLD);
  const goldGrams = sum(goldRows, (row) => row.grams);

  const ranked = [...rows].sort(
    (a, b) => b.grams - a.grams || b.units - a.units || a.name.localeCompare(b.name, 'ru'),
  );

  return {
    totals: {
      grams: formatStockGrams(totalGrams),
      units: totalUnits,
      skuCount: rows.length,
      goldGrams: formatStockGrams(goldGrams),
      silverGrams: formatStockGrams(
        sum(
          rows.filter((row) => row.metalCategory === MetalCategory.SILVER),
          (row) => row.grams,
        ),
      ),
      diamondsGrams: formatStockGrams(
        sum(
          rows.filter((row) => row.metalCategory === MetalCategory.DIAMONDS),
          (row) => row.grams,
        ),
      ),
    },
    byMetal: finalizeBuckets(collect(rows, (row) => row.metalCategory), totalGrams),
    byGoldTone: finalizeBuckets(
      collect(goldRows, (row) => row.goldTone),
      goldGrams,
    ),
    bySupplier: finalizeBuckets(
      collect(rows, (row) => row.supplierId, (row) => row.supplierName),
      totalGrams,
    ),
    byCategory: finalizeBuckets(
      collect(rows, (row) => row.itemCategory),
      totalGrams,
    ),
    most: ranked.slice(0, limit).map(toProduct),
    least: [...ranked].reverse().slice(0, limit).map(toProduct),
  };
}

function sum(rows: StockReportRow[], pick: (row: StockReportRow) => number) {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function collect(
  rows: StockReportRow[],
  keyOf: (row: StockReportRow) => string | null | undefined,
  nameOf: (row: StockReportRow) => string = (row) => keyOf(row) ?? '',
) {
  const map = new Map<
    string,
    { key: string; name: string; grams: number; units: number; skuCount: number }
  >();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const current = map.get(key) ?? {
      key,
      name: nameOf(row) || key,
      grams: 0,
      units: 0,
      skuCount: 0,
    };
    current.grams += row.grams;
    current.units += row.units;
    current.skuCount += 1;
    map.set(key, current);
  }
  return map;
}

function finalizeBuckets(
  map: Map<string, { key: string; name: string; grams: number; units: number; skuCount: number }>,
  totalGrams: number,
): StockReportBucket[] {
  return [...map.values()]
    .sort(
      (a, b) =>
        b.grams - a.grams ||
        b.units - a.units ||
        a.name.localeCompare(b.name, 'ru'),
    )
    .map((item) => ({
      key: item.key,
      name: item.name,
      grams: formatStockGrams(item.grams),
      units: item.units,
      skuCount: item.skuCount,
      share: totalGrams <= 0 ? 0 : Math.round((item.grams / totalGrams) * 1000) / 10,
    }));
}

function toProduct(row: StockReportRow): StockReportProduct {
  return {
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    supplierName: row.supplierName,
    metalCategory: row.metalCategory,
    goldTone: row.goldTone,
    itemCategory: row.itemCategory,
    units: row.units,
    grams: formatStockGrams(row.grams),
    weight: row.weight,
  };
}
