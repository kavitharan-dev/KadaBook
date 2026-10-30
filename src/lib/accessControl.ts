import type { AccessFeature, AccessMatrix, ShopStatus } from './shopAccessTypes';
import { DEFAULT_ACCESS_MATRIX } from './shopAccessTypes';

export function mergeAccessMatrix(raw: Partial<AccessMatrix> | undefined): AccessMatrix {
  const base = DEFAULT_ACCESS_MATRIX;
  if (!raw) return base;
  const out = { ...base };
  (Object.keys(base) as ShopStatus[]).forEach((status) => {
    out[status] = { ...base[status], ...(raw[status] ?? {}) };
  });
  return out;
}

export function canAccessFeature(
  feature: AccessFeature,
  status: ShopStatus,
  matrix: AccessMatrix,
  overrides?: Partial<Record<AccessFeature, boolean>>,
): boolean {
  if (overrides && feature in overrides) {
    return Boolean(overrides[feature]);
  }
  return Boolean(matrix[status]?.[feature]);
}
