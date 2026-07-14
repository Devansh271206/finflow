import React from 'react';

export const Input = React.forwardRef(({
  label,
  type = 'text',
  error,
  icon: Icon,
  className = '',
  ...props
}, ref) => {
  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-4 text-slate-500 pointer-events-none">
            <Icon size={18} />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={`
            w-full rounded-xl bg-white/5 border text-white text-sm transition-all duration-200 outline-none
            placeholder:text-slate-600
            ${Icon ? 'pl-11 pr-4' : 'px-4'}
            py-3
            ${error 
              ? 'border-rose-500/50 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30' 
              : 'border-white/10 focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30'
            }
          `}
          {...props}
        />
      </div>
      {error && (
        <span className="text-xs text-rose-500 font-medium">
          {error.message || error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
