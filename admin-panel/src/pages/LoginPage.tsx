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
    <div className="flex min-h-screen bg-canvas">
      <motion.div
        initial={reduce ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden w-[44%] flex-col justify-between bg-sidebar p-12 text-white lg:flex"
      >
        <div>
          <div className="text-lg font-bold">KadaBook Admin</div>
          <p className="mt-4 max-w-sm text-sm text-sidebar-muted">
            Manage shop approvals, subscriptions, payments, and app settings for all KadaBook merchants.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">Design reference: KadaBook Admin Panel.html</p>
      </motion.div>
      <div className="flex flex-1 items-center justify-center bg-muted-bg p-6">
        <motion.form
          onSubmit={submit}
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md rounded-[14px] border border-line bg-surface p-8 shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
        >
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Admin email and password only.</p>
          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <label className="mt-6 block text-sm font-medium">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Password
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <PrimaryButton type="submit" disabled={busy} className="mt-6 w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </PrimaryButton>
        </motion.form>
      </div>
    </div>
  );
}
