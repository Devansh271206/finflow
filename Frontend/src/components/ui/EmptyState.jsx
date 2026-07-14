import React from 'react';
import { Database } from 'lucide-react';
import Button from './Button';

export const EmptyState = ({
  icon: Icon = Database,
  title = "No data found",
  description = "There are no records to display matching your current query or filters.",
  actionText,
  onAction,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/10 rounded-3xl bg-white/[0.01] ${className}`}>
      <div className="p-4 rounded-full bg-white/5 text-slate-500 mb-4">
        <Icon size={28} />
      </div>
      <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mb-5 leading-relaxed">{description}</p>
      {actionText && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
