import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { LogOut } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { NAV_SECTIONS, navForRole } from '../lib/roles';
import { NAV_ICONS } from './NavIcons';
import { PageTransition } from './PageTransition';

const MOBILE_PRIMARY = ['/', '/approvals', '/users', '/subscriptions', '/payments'];

export function AdminLayout() {
  const { admin, signOut } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const allowed = new Set(navForRole(admin!.role).map((i) => i.path));
  const mobileItems = navForRole(admin!.role)
    .filter((i) => MOBILE_PRIMARY.includes(i.path))
    .slice(0, 5);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-hairline bg-surface/90 px-4 backdrop-blur-md lg:px-6">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-md"
            style={{ background: 'linear-gradient(145deg, #1E40AF, #1D5FE0, #3B82F6)' }}
          >
            KB
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight text-ink">KadaBook</div>
            <div className="text-[11px] font-medium text-muted">Admin · same as app</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[11px] text-muted">Signed in</div>
            <div className="text-sm font-semibold text-ink">{admin?.name ?? 'Admin'}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
            {(admin?.name ?? 'A').trim().charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[232px] shrink-0 flex-col border-r border-hairline bg-surface/80 backdrop-blur-sm lg:flex">
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {NAV_SECTIONS.map((section, si) => {
              const items = section.items.filter((i) => allowed.has(i.path));
              if (!items.length) return null;
              return (
                <div key={section.label} className="mb-5">
                  <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    {section.label}
                  </div>
                  <div className="flex flex-col gap-1">
                    {items.map((item, ii) => {
                      const Icon = NAV_ICONS[item.label];
                      return (
                        <motion.div
                          key={item.path}
                          initial={reduce ? false : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: reduce ? 0 : si * 0.04 + ii * 0.03 }}
                        >
                          <NavLink
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) =>
                              clsx(
                                'apk-press group flex items-center gap-3 rounded-2xl px-2.5 py-2.5 no-underline transition',
                                isActive
                                  ? 'bg-brand text-white shadow-[0_8px_20px_rgba(29,95,224,0.28)]'
                                  : 'text-ink/80 hover:bg-brand-soft hover:text-brand',
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span
                                  className={clsx(
                                    'flex h-9 w-9 items-center justify-center rounded-xl transition',
                                    isActive ? 'bg-white/20 text-white' : 'bg-keypad text-brand group-hover:bg-white',
                                  )}
                                >
                                  {Icon ? <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} /> : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-bold leading-tight">
                                    {item.label}
                                  </span>
                                  <span
                                    className={clsx(
                                      'block truncate text-[10px] font-medium',
                                      isActive ? 'text-white/80' : 'text-muted',
                                    )}
                                  >
                                    {item.hint}
                                  </span>
                                </span>
                              </>
                            )}
                          </NavLink>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="border-t border-hairline p-3">
            <button
              type="button"
              onClick={() => signOut().then(() => navigate('/login'))}
              className="apk-press flex w-full items-center justify-center gap-2 rounded-2xl bg-expense-wash px-3 py-2.5 text-sm font-bold text-expense transition hover:opacity-90"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8 lg:pt-6">
          <PageTransition />
        </main>
      </div>

      {/* Mobile icon dock — APK tab-bar feel */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
          {mobileItems.map((item) => {
            const Icon = NAV_ICONS[item.label];
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  clsx(
                    'apk-press flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 no-underline',
                    isActive ? 'text-brand' : 'text-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={clsx(
                        'flex h-9 w-9 items-center justify-center rounded-xl',
                        isActive ? 'bg-brand-soft' : 'bg-transparent',
                      )}
                    >
                      {Icon ? <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} /> : null}
                    </span>
                    <span className="truncate text-[10px] font-bold">{item.short}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
