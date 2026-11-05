import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  CreditCard,
  Puzzle,
  Store,
  Tags,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { GradientStatLink, IconLinkTile, SoftPanel } from '../components/ApkTiles';
import { EmptyState, PageTitle, PrimaryButton, SectionTitle, Skeleton } from '../components/ui';
import { useCollection } from '../hooks/useCollection';
import { mapPayment, mapShop, mapSub } from '../lib/mappers';
import { formatRs, startOfMonth } from '../lib/format';

const QUICK = [
  { to: '/approvals', label: 'Approvals', hint: 'New shops', Icon: UserCheck, tone: 'orange' as const },
  { to: '/users', label: 'Shops', hint: 'Features', Icon: Store, tone: 'blue' as const },
  { to: '/plans', label: 'Plans', hint: 'Basic/Std', Icon: Tags, tone: 'teal' as const },
  { to: '/features', label: 'Features', hint: 'Add-ons', Icon: Puzzle, tone: 'purple' as const },
  { to: '/subscriptions', label: 'Subs', hint: 'Activate', Icon: CreditCard, tone: 'green' as const },
  { to: '/payments', label: 'Payments', hint: 'Cash in', Icon: Wallet, tone: 'red' as const },
];

export function DashboardPage() {
  const { rows: shops, loading: l1 } = useCollection('users', mapShop);
  const { rows: payments, loading: l2 } = useCollection('payments', mapPayment);
  const { rows: subs, loading: l3 } = useCollection('subscriptions', mapSub);

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

  const metricCards = [
    { label: 'Total shops', value: String(stats.total), tone: 'purple' as const, Icon: Store, to: '/users' },
    { label: 'Pending approval', value: String(stats.pending), tone: 'orange' as const, Icon: UserCheck, to: '/approvals' },
    { label: 'Active / trial', value: String(stats.active), tone: 'teal' as const, Icon: TrendingUp, to: '/users' },
    { label: 'Expiring (7d)', value: String(stats.expiring), tone: 'red' as const, Icon: Clock, to: '/subscriptions' },
    { label: 'Month revenue', value: formatRs(stats.revenue), tone: 'green' as const, Icon: Wallet, to: '/payments' },
  ];

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageTitle title="Dashboard" subtitle="Tap an icon — same colours & cards as the KadaBook app" />

      <SectionTitle>Quick actions</SectionTitle>
      <div className="mb-7 mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK.map((q, i) => (
          <IconLinkTile
            key={q.to}
            to={q.to}
            label={q.label}
            hint={q.hint}
            Icon={q.Icon}
            tone={q.tone}
            delay={i * 0.04}
          />
        ))}
      </div>

      <SectionTitle>Today at a glance</SectionTitle>
      {loading ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[118px] rounded-[16px]" />
          ))}
        </div>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {metricCards.map((m, i) => (
            <GradientStatLink
              key={m.label}
              to={m.to}
              label={m.label}
              value={m.value}
              Icon={m.Icon}
              tone={m.tone}
              delay={0.1 + i * 0.05}
            />
          ))}
        </div>
      )}

      <SoftPanel className="mt-6">
        <SectionTitle>Needs attention</SectionTitle>
        {attention.length === 0 ? (
          <EmptyState message="All clear — nothing urgent right now." />
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {attention.map((item) => (
              <li
                key={item.label}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-gradient-top/70 px-4 py-3 text-sm"
              >
                <span className="font-semibold text-ink">{item.label}</span>
                <Link to={item.to}>
                  <PrimaryButton>{item.cta}</PrimaryButton>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SoftPanel>
    </div>
  );
}
