import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Clock, Store, TrendingUp, UserCheck, Wallet } from 'lucide-react';
import { BarChart } from '../components/BarChart';
import {
  Card,
  EmptyState,
  PageTitle,
  PrimaryButton,
  SectionTitle,
  Skeleton,
  StatCard,
} from '../components/ui';
import { useCollection } from '../hooks/useCollection';
import { mapPayment, mapShop, mapSub } from '../lib/mappers';
import { formatRs, startOfMonth } from '../lib/format';

export function DashboardPage() {
  const { rows: shops, loading: l1 } = useCollection('users', mapShop);
  const { rows: payments, loading: l2 } = useCollection('payments', mapPayment);
  const { rows: subs, loading: l3 } = useCollection('subscriptions', mapSub);
  const reduce = useReducedMotion();

  const stats = useMemo(() => {
    const now = Date.now();
    const week = now + 7 * 86400000;
    const monthStart = startOfMonth();
    return {
      total: shops.length,
      pending: shops.filter((s) => s.status === 'pending').length,
      active: shops.filter((s) => s.status === 'active' || s.status === 'trial').length,
      expiring: subs.filter((s) => s.expiresAt > now && s.expiresAt <= week).length,
      grace: shops.filter((s) => s.status === 'grace').length,
      revenue: payments.filter((p) => p.paidAt >= monthStart).reduce((a, p) => a + p.amount, 0),
      signupsByWeek: buildWeeklySignups(shops),
    };
  }, [shops, payments, subs]);

  const attention = useMemo(() => {
    const items: { label: string; to: string; cta: string }[] = [];
    if (stats.pending > 0) {
      items.push({
        label: `${stats.pending} shop${stats.pending === 1 ? '' : 's'} waiting for approval`,
        to: '/approvals',
        cta: 'Review',
      });
    }
    if (stats.expiring > 0) {
      items.push({
        label: `${stats.expiring} subscription${stats.expiring === 1 ? '' : 's'} expiring in 7 days`,
        to: '/subscriptions',
        cta: 'Extend',
      });
    }
    if (stats.grace > 0) {
      items.push({
        label: `${stats.grace} shop${stats.grace === 1 ? '' : 's'} in grace period`,
        to: '/users',
        cta: 'View',
      });
    }
    return items;
  }, [stats]);

  const loading = l1 || l2 || l3;

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageTitle title="Dashboard" subtitle="Live counts, revenue, and items that need action" />
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[100px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total shops" value={stats.total} icon={Store} delay={0} />
          <StatCard label="Pending approval" value={stats.pending} tone="warn" icon={UserCheck} delay={0.05} />
          <StatCard label="Active / trial" value={stats.active} tone="sale" icon={TrendingUp} delay={0.1} />
          <StatCard label="Expiring in 7 days" value={stats.expiring} tone="warn" icon={Clock} delay={0.15} />
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Signups per week</SectionTitle>
          <div className="mt-4">
            {loading ? <Skeleton className="h-[140px]" /> : <BarChart data={stats.signupsByWeek} />}
          </div>
        </Card>
        <Card>
          <SectionTitle>Monthly revenue</SectionTitle>
          <p className="mt-4 flex items-center gap-2 text-[28px] font-bold tracking-tight text-brand">
            <Wallet className="h-6 w-6 opacity-80" strokeWidth={2} aria-hidden />
            {formatRs(stats.revenue)}
          </p>
          <p className="mt-2 text-sm text-muted">From payments recorded this month</p>
        </Card>
      </div>
      <Card className="mt-6">
        <SectionTitle>Needs attention</SectionTitle>
        {attention.length === 0 ? (
          <EmptyState message="All clear — nothing urgent right now." />
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {attention.map((item, i) => (
              <motion.li
                key={item.label}
                initial={reduce ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : i * 0.06 }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/80 bg-muted-bg/50 px-4 py-3 text-sm"
              >
                <span className="font-medium text-ink">{item.label}</span>
                <Link to={item.to}>
                  <PrimaryButton>{item.cta}</PrimaryButton>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function buildWeeklySignups(shops: ReturnType<typeof mapShop>[]) {
  const buckets: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - i * 7);
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 7 * 86400000;
    const label = start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const value = shops.filter((s) => (s.createdAt ?? 0) >= start.getTime() && (s.createdAt ?? 0) < end).length;
    buckets.push({ label, value });
  }
  return buckets;
}
