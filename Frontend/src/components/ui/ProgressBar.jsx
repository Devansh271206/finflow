import React from 'react';
import { motion } from 'framer-motion';

export const ProgressBar = ({
  value,
  max = 100,
  color = 'emerald', // emerald, blue, amber, purple, rose, pink
  className = ''
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const colors = {
    emerald: 'bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.3)]',
    blue: 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]',
    amber: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]',
    purple: 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]',
    rose: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]',
    pink: 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]'
  };

  const trackColor = 'bg-white/5';

  return (
    <div className={`w-full ${className}`}>
      <div className={`h-2 w-full rounded-full overflow-hidden ${trackColor}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${colors[color]}`}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
