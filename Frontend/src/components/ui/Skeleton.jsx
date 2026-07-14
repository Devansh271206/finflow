import React from 'react';

export const Skeleton = ({
  className = '',
  variant = 'text', // text, circle, rect
  count = 1
}) => {
  const baseStyle = 'animate-pulse bg-white/5';
  
  const variants = {
    text: 'h-4 w-full rounded',
    circle: 'rounded-full',
    rect: 'rounded-2xl'
  };

  const skeletons = Array.from({ length: count });

  return (
    <>
      {skeletons.map((_, i) => (
        <div
          key={i}
          className={`${baseStyle} ${variants[variant]} ${className}`}
        />
      ))}
    </>
  );
};

export default Skeleton;
