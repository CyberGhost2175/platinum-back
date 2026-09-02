export const PRODUCT_SKU_PREFIX = 'PT';

export function formatProductSku(sequence: number): string {
  return `${PRODUCT_SKU_PREFIX}-${String(sequence).padStart(6, '0')}`;
}

export function isProductSku(value: string): boolean {
  return /^PT-\d{6}$/i.test(value.trim());
}

/** Unique tags for units created together with a SKU (`PT-000001-01`, …). */
export function initialItemTags(sku: string, qty: number): string[] {
  if (!Number.isInteger(qty) || qty < 1) {
    return [];
  }
  const base = sku.length <= 61 ? sku : sku.slice(0, 61);
  return Array.from({ length: qty }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    return `${base}-${n}`;
  });
}
