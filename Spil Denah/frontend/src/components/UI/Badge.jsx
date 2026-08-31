import React from 'react';

const Badge = ({ children, variant = 'primary', style = {} }) => {
  let color = 'var(--color-primary)';
  let bg = 'rgba(99, 102, 241, 0.1)';
  
  if (variant === 'success' || variant === 'active') {
    color = 'var(--color-success)';
    bg = 'rgba(34, 197, 94, 0.1)';
  } else if (variant === 'warning') {
    color = 'var(--color-warning)';
    bg = 'rgba(245, 158, 11, 0.1)';
  } else if (variant === 'danger' || variant === 'expired') {
    color = 'var(--color-danger)';
    bg = 'rgba(239, 68, 68, 0.1)';
  } else if (variant === 'replaced') {
    color = 'var(--color-text-secondary)';
    bg = 'rgba(99, 110, 114, 0.1)';
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: '50px',
      fontSize: '0.75rem',
      fontWeight: '600',
      color: color,
      backgroundColor: bg,
      boxShadow: 'var(--neu-shadow-sm)',
      ...style
    }}>
      {children}
    </span>
  );
};

export default Badge;
