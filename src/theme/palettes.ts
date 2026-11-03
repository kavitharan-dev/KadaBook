import { colors as light } from './colors';

export type ColorPalette = { [K in keyof typeof light]: string };

export const lightPalette: ColorPalette = { ...light };

/** Dark theme — surfaces use slate, text stays high contrast (not black-on-black). */
export const darkPalette: ColorPalette = {
  gradientTop: '#0F172A',
  white: '#1E293B',
  ink: '#F1F5F9',
  brand: '#60A5FA',
  muted: '#CBD5E1',
  line: '#334155',
  placeholder: '#64748B',
  barYellow: '#FBBF24',
  barOrange: '#FB923C',
  ground: '#0F172A',
  window: '#1E3A5F',
  tree: '#34D399',
  trunk: '#A78BFA',
  sale: '#22C55E',
  saleText: '#86EFAC',
  saleWash: '#14532D',
  expense: '#F97316',
  expenseText: '#FCA5A5',
  expenseWash: '#450A0A',
  product: '#A78BFA',
  profitText: '#93C5FD',
  hairline: '#334155',
  canvas: '#0F172A',
  rowLine: '#293548',
  keypad: '#273449',
  danger: '#F87171',
  onFill: '#FFFFFF',
};
