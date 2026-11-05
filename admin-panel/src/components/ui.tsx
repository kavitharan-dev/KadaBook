import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { statusBadgeClass, statusLabel } from '../lib/status';
import type { ShopStatus } from '../types/models';

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 apk-fade-up">
      <h1 className="text-[24px] font-bold tracking-tight text-ink">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={clsx('apk-card p-5', className)}>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  tone = 'brand',
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: string | number;
  tone?: 'brand' | 'warn' | 'sale' | 'neutral';
  icon?: LucideIcon;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const wash =
    tone === 'warn'
      ? 'border-amber-200/80 bg-warn'
      : tone === 'sale'
        ? 'border-emerald-200/80 bg-emerald-50'
        : tone === 'neutral'
          ? 'border-line bg-surface'
          : 'border-brand/15 bg-brand-soft';

  const valueColor =
    tone === 'warn' ? 'text-warn-ink' : tone === 'sale' ? 'text-sale' : tone === 'neutral' ? 'text-ink' : 'text-brand';

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.35 }}
      className={clsx('rounded-[14px] border p-5', wash)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-muted">{label}</div>
        {Icon ? (
          <Icon className="h-[18px] w-[18px] shrink-0 opacity-50" strokeWidth={2} aria-hidden />
        ) : null}
      </div>
      <div className={clsx('mt-2 text-[28px] font-bold leading-none tracking-tight', valueColor)}>{value}</div>
    </motion.div>
  );
}

export function StatusBadge({ status }: { status: ShopStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
        statusBadgeClass(status),
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function PrimaryButton({
  children,
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...props}
      className={clsx(
        'apk-press inline-flex h-10 items-center justify-center rounded-2xl bg-brand px-4 text-[13px] font-bold text-white shadow-[0_6px_16px_rgba(29,95,224,0.28)] transition hover:bg-[#1546a8] disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        'apk-press inline-flex h-10 items-center justify-center rounded-2xl border border-line bg-surface px-4 text-[13px] font-semibold text-ink transition hover:bg-brand-soft hover:text-brand',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-line/70', className)} />;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="apk-card overflow-x-auto">
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-12 text-center text-sm text-muted">{message}</p>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold text-ink">{children}</h2>;
}
