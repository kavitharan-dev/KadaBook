/** Same gradient families as APK `DashboardCards.gradients`. */
export const APK_GRADIENTS = {
  blue: 'linear-gradient(145deg, #1E40AF 0%, #2563EB 48%, #3B82F6 100%)',
  purple: 'linear-gradient(145deg, #6D28D9 0%, #8B5CF6 48%, #A855F7 100%)',
  teal: 'linear-gradient(145deg, #0F766E 0%, #14A38E 48%, #2DD4BF 100%)',
  orange: 'linear-gradient(145deg, #EA580C 0%, #F97316 48%, #FBBF24 100%)',
  green: 'linear-gradient(145deg, #15803D 0%, #22A447 48%, #4ADE80 100%)',
  red: 'linear-gradient(145deg, #DC2626 0%, #EF4444 48%, #F87171 100%)',
} as const;

export type ApkGradientKey = keyof typeof APK_GRADIENTS;

/** Soft icon chip washes (APK sale/expense/brand soft). */
export const APK_ICON_WASH: Record<ApkGradientKey, string> = {
  blue: 'bg-brand-soft text-brand',
  purple: 'bg-[#F3EEFF] text-product',
  teal: 'bg-[#E6F7F4] text-[#0F766E]',
  orange: 'bg-warn text-warn-ink',
  green: 'bg-sale-wash text-sale-text',
  red: 'bg-expense-wash text-expense',
};
