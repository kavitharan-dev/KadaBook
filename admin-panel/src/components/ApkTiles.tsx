import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { APK_GRADIENTS, APK_ICON_WASH, type ApkGradientKey } from '../lib/apkTheme';

/** Big icon shortcut — APK HomeActionTile feel. */
export function IconLinkTile({
  to,
  label,
  hint,
  Icon,
  tone = 'blue',
  delay = 0,
}: {
  to: string;
  label: string;
  hint?: string;
  Icon: LucideIcon;
  tone?: ApkGradientKey;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={to}
        className="apk-press apk-card flex flex-col items-center gap-2.5 px-3 py-4 text-center no-underline transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl', APK_ICON_WASH[tone])}>
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </span>
        <span className="text-[13px] font-bold text-ink">{label}</span>
        {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
      </Link>
    </motion.div>
  );
}

/** Gradient metric card — APK GradientStatCard. */
export function GradientStatLink({
  to,
  label,
  value,
  cta = 'Open',
  Icon,
  tone = 'blue',
  delay = 0,
}: {
  to: string;
  label: string;
  value: string;
  cta?: string;
  Icon: LucideIcon;
  tone?: ApkGradientKey;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link
        to={to}
        className="apk-press apk-shimmer relative flex h-full min-h-[118px] flex-col overflow-hidden rounded-[16px] p-4 text-white no-underline shadow-[0_10px_28px_rgba(29,95,224,0.22)]"
        style={{ background: APK_GRADIENTS[tone] }}
      >
        <span
          className="pointer-events-none absolute -right-4 -top-6 h-24 w-24 rounded-full bg-white/15"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-8 left-8 h-20 w-20 rounded-full bg-white/10"
          aria-hidden
        />
        <div className="relative z-[1] flex items-start justify-between gap-2">
          <div className="text-[12px] font-semibold text-white/90">{label}</div>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
            <Icon className="h-4 w-4" strokeWidth={2.25} />
          </span>
        </div>
        <div className="relative z-[1] mt-3 text-[28px] font-bold leading-none tracking-tight">{value}</div>
        <div className="relative z-[1] mt-auto pt-3 text-[11px] font-semibold text-white/90">{cta} ›</div>
      </Link>
    </motion.div>
  );
}

export function SoftPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('apk-card p-5', className)}>{children}</section>;
}
