import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PrimaryButton } from '../components/ui';

export function LoginPage() {
  const { signIn, denied, user, admin, ready } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();

  if (ready && user && admin) {
    return <Navigate to="/" replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      push('Signed in');
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      push(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (denied) {
      setError(denied);
      push(denied, 'error');
    }
  }, [denied, push]);

  return (
    <div className="flex min-h-screen">
      <motion.div
        initial={reduce ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative hidden w-[46%] flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(165deg, #1E40AF 0%, #1D5FE0 42%, #3B82F6 100%)' }}
      >
        <span className="pointer-events-none absolute -right-10 top-16 h-56 w-56 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -bottom-16 left-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative z-[1]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lg font-bold text-brand shadow-lg">
            KB
          </div>
          <div className="mt-8 text-3xl font-bold tracking-tight">KadaBook</div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
            Admin with the same blue, soft cards, and icon actions as the shop app. Live shops stay open until you
            Save a feature pack.
          </p>
        </div>
        <p className="relative z-[1] text-xs text-white/70">APK colours · icon-first · easy handle</p>
      </motion.div>
      <div className="flex flex-1 items-center justify-center bg-canvas p-6">
        <motion.form
          onSubmit={submit}
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="apk-card w-full max-w-md p-8"
        >
          <h1 className="text-xl font-bold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Admin email and password only.</p>
          {error ? (
            <p className="mt-4 rounded-2xl bg-expense-wash px-3 py-2 text-sm text-expense" role="alert">
              {error}
            </p>
          ) : null}
          <label className="mt-6 block text-sm font-semibold text-ink">
            Email
            <input
              className="mt-1.5 w-full rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-ink">
            Password
            <input
              className="mt-1.5 w-full rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <PrimaryButton type="submit" disabled={busy} className="mt-6 w-full rounded-2xl">
            {busy ? 'Signing in…' : 'Sign in'}
          </PrimaryButton>
        </motion.form>
      </div>
    </div>
  );
}
