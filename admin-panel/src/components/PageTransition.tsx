import { motion, useReducedMotion } from 'framer-motion';
import { useLocation, Outlet } from 'react-router-dom';

export function PageTransition() {
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-0 flex-1"
    >
      <Outlet />
    </motion.div>
  );
}
