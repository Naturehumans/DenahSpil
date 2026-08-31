import React from 'react';

const Skeleton = ({ variant = 'text', width, height, style }) => {
  const baseStyle = {
    background: 'linear-gradient(90deg, var(--color-bg) 25%, #f0f3f7 50%, var(--color-bg) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    boxShadow: 'var(--neu-shadow-inset)',
    ...style
  };

  if (variant === 'text') {
    return <div style={{ ...baseStyle, width: width || '100%', height: height || '16px', borderRadius: '4px', marginBottom: '8px' }} />;
  }

  if (variant === 'circle') {
    return <div style={{ ...baseStyle, width: width || '40px', height: height || '40px', borderRadius: '50%' }} />;
  }

  if (variant === 'card') {
    return <div style={{ ...baseStyle, width: width || '100%', height: height || '150px', borderRadius: '12px' }} />;
  }

  return <div style={{ ...baseStyle, width, height }} />;
};

// Add shimmer keyframes globally or in css
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

export default Skeleton;
