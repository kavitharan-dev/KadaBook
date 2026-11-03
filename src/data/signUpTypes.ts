import type { ShopType } from './types';

export type SignUpInput = {
  shopName: string;
  ownerName: string;
  phone: string;
  district: string;
  shopType: ShopType;
};
