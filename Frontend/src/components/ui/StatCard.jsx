import React from 'react';
import Card from './Card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendType = 'up', // up, down, neutral
  subtext,
  iconBg = 'bg-white/5',
  iconColor = 'text-slate-400',
  className = ''
}) => {
  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{value}</h3>
        </div>
        
        {Icon && (
          <div className={`p-3 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center`}>
            <Icon size={20} />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {trend && (
          <span className={`
            inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold
            ${trendType === 'up' && 'text-emerald-400 bg-emerald-500/10'}
            ${trendType === 'down' && 'text-rose-400 bg-rose-500/10'}
            ${trendType === 'neutral' && 'text-slate-400 bg-slate-500/10'}
          `}>
            {trendType === 'up' && <TrendingUp size={12} />}
            {trendType === 'down' && <TrendingDown size={12} />}
            {trend}
          </span>
        )}
        
        {subtext && (
          <span className="text-xs text-slate-500">{subtext}</span>
        )}
      </div>
    </Card>
  );
};

export default StatCard;
