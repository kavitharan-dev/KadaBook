import { motion, useReducedMotion } from 'framer-motion';

export function BarChart({
  data,
  maxHeight = 110,
}: {
  data: { label: string; value: number }[];
  maxHeight?: number;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex h-[140px] items-end gap-2 border-b border-line pb-1">
      {data.map((bar, i) => {
        const h = Math.max(bar.value > 0 ? 8 : 4, (bar.value / max) * maxHeight);
        return (
          <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <motion.div
              className="w-4 rounded-[3px] bg-brand"
              initial={reduce ? { height: h } : { height: 0 }}
              animate={{ height: h }}
              transition={{ delay: reduce ? 0 : i * 0.05, duration: 0.45, ease: 'easeOut' }}
            />
            <span className="truncate text-[10px] text-muted">{bar.label}</span>
          </div>
        );
      })}
    </div>
  );
}
