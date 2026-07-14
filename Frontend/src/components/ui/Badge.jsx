import React from 'react';

export const Badge = ({
  children,
  variant = 'default',
  className = ''
}) => {
  const variants = {
    default: 'bg-white/5 text-slate-300 border border-white/5',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
