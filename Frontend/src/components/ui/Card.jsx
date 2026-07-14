import React from 'react';
import { motion } from 'framer-motion';

export const Card = ({ children, className = '', hover = true, glass = false, onClick }) => {
  const Component = onClick ? motion.div : 'div';
  const interactivityProps = onClick ? {
    whileHover: { y: -3, scale: 1.01 },
    whileTap: { scale: 0.99 },
    onClick,
    style: { cursor: 'pointer' }
  } : {};

  return (
    <Component
      {...interactivityProps}
      className={`
        relative rounded-[18px] p-6 overflow-hidden transition-all duration-300
        ${glass ? 'glass-panel' : 'bg-[#111827] border border-white/5'}
        ${hover && !onClick ? 'glow-card' : ''}
        ${className}
      `}
    >
      {children}
    </Component>
  );
};

export default Card;
