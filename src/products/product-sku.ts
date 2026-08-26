export const PRODUCT_SKU_PREFIX = 'PT';

export function formatProductSku(sequence: number): string {
  return `${PRODUCT_SKU_PREFIX}-${String(sequence).padStart(6, '0')}`;
}

export function isProductSku(value: string): boolean {
  return /^PT-\d{6}$/i.test(value.trim());
}
