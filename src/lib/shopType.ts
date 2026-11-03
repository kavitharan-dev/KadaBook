export type ShopType = 'retail' | 'kitchen';

export function isShopType(value: unknown): value is ShopType {
  return value === 'retail' || value === 'kitchen';
}

/** Old accounts with no type keep kitchen tools visible until they choose. */
export function effectiveShopType(value: unknown): ShopType {
  return isShopType(value) ? value : 'kitchen';
}

export function usesKitchenStock(shopType: ShopType | unknown) {
  return effectiveShopType(shopType) === 'kitchen';
}

export const SHOP_TYPE_LABEL: Record<ShopType, string> = {
  retail: 'Retail shop',
  kitchen: 'Kitchen / Restaurant',
};

export const SHOP_TYPE_HELP: Record<ShopType, string> = {
  retail: 'Sales, products, expenses, credit. No kitchen raw materials.',
  kitchen: 'Everything in retail, plus Kitchen & Stock, recipes and COGS.',
};
