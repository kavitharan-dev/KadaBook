/** Intro finishes by ~1.15s. Loops start only after that. */
export const timings = {
  logoFromY: -40,
  logoDamping: 10,
  logoFadeMs: 450,
  barStartMs: 300,
  barStaggerMs: 120,
  barDurationMs: 400,
  fadeDistance: 16,
  fadeMs: 400,
  copyDelayMs: 500,
  formDelayMs: 750,
  pulseDelayMs: 1200,
  pulseHalfMs: 900,
  pulseScale: 1.03,
  floatHalfMs: 1500,
  floatY: -6,
  /** Login screen's logo/wordmark/tagline: pop in, hold, then collapse away. */
  brandPopFromScale: 0.55,
  brandPopDamping: 9,
  brandPopFadeMs: 380,
  brandHoldMs: 950,
  brandHideMs: 420,
} as const;
