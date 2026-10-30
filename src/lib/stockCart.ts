import type { Product, SaleLine } from '../data/types';

export function cartQtyForProduct(cart: SaleLine[], productId: string) {
  return cart.find((line) => line.productId === productId)?.qty ?? 0;
}

export function canAddProductToCart(
  product: Product,
  cart: SaleLine[],
  addQty = 1,
): { ok: true } | { ok: false; message: string } {
  if (product.stock <= 0) {
    return { ok: false, message: `${product.name} is out of stock.` };
  }
  const inCart = cartQtyForProduct(cart, product.id);
  const remaining = product.stock - inCart;
  if (addQty > remaining) {
    return {
      ok: false,
      message:
        remaining <= 0
          ? `${product.name}: no more stock left for this bill.`
          : `${product.name}: only ${remaining} ${product.unit} left.`,
    };
  }
  return { ok: true };
}

export function tryMergeCartLine(cart: SaleLine[], product: Product, qty: number, unitPrice: number): SaleLine[] | null {
  const check = canAddProductToCart(product, cart, qty);
  if (!check.ok) return null;
  const existing = cart.find((line) => line.productId === product.id);
  if (existing) {
    const nextQty = existing.qty + qty;
    return cart.map((line) =>
      line.productId === product.id
        ? { ...line, qty: nextQty, lineTotal: Math.round(nextQty * unitPrice) }
        : line,
    );
  }
  return [
    ...cart,
    {
      productId: product.id,
      name: product.name,
      qty,
      unitPrice,
      lineTotal: Math.round(qty * unitPrice),
    },
  ];
}

export function lowStockProducts(products: Product[], threshold = 5) {
  return products.filter((p) => p.stock > 0 && p.stock <= threshold);
}

export function outOfStockProducts(products: Product[]) {
  return products.filter((p) => p.stock <= 0);
}
