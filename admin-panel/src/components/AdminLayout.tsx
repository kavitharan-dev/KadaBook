import { NavLink, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { navForRole } from '../lib/roles';
import { NAV_ICONS } from './NavIcons';
import { PageTransition } from './PageTransition';

export function AdminLayout() {
  const { admin, signOut } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const items = navForRole(admin!.role);

  return (
    <div className="flex min-h-screen bg-muted-bg">
      <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col bg-sidebar px-3 py-5 text-sidebar-muted">
        <div className="mb-6 flex items-center gap-3 px-2">
          <motion.div
            initial={reduce ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white shadow-lg shadow-brand/30"
          >
            KB
          </motion.div>
          <div>
            <div className="text-sm font-semibold text-white">KadaBook</div>
            <div className="text-[11px] text-sidebar-muted">Admin Panel</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {items.map((item, index) => {
            const Icon = NAV_ICONS[item.label];
            return (
              <motion.div
                key={item.path}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : index * 0.04 }}
              >
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'group flex h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-semibold no-underline transition-all duration-200',
                      isActive
                        ? 'bg-brand text-white shadow-md shadow-brand/25'
                        : 'text-sidebar-muted hover:bg-white/[0.06] hover:text-white',
                    )
                  }
                >
                  {Icon ? (
                    <Icon className="h-5 w-5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </motion.div>
            );
          })}
        </nav>
        <div className="mt-3 border-t border-white/10 pt-4">
          <div className="px-2 text-sm font-medium text-white">{admin?.name}</div>
          <div className="px-2 text-[11px] capitalize text-sidebar-muted">{admin?.role.replace('_', ' ')}</div>
          <button
            type="button"
            onClick={() => signOut().then(() => navigate('/login'))}
            className="mt-3 flex w-full items-center gap-2 rounded-lg border border-white/15 px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex min-h-screen min-w-0 flex-1 flex-col bg-muted-bg">
        <div className="border-b border-line/80 bg-surface/60 px-6 py-4 backdrop-blur-sm lg:px-8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">KadaBook Admin</p>
        </div>
        <div className="flex-1 px-6 py-6 lg:px-8 lg:py-8">
          <PageTransition />
        </div>
      </main>
    </div>
  );
}
