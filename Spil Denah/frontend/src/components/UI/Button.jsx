import React, { useState } from 'react';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  type = 'button', 
  disabled = false,
  className = '',
  style = {}
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const baseStyle = {
    fontFamily: 'Inter, sans-serif',
    fontWeight: '600',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    opacity: disabled ? 0.6 : 1,
    outline: 'none',
    ...style
  };

  const sizes = {
    sm: { padding: '8px 16px', fontSize: '0.875rem', borderRadius: '50px' },
    md: { padding: '12px 24px', fontSize: '1rem', borderRadius: '50px' },
    lg: { padding: '16px 32px', fontSize: '1.125rem', borderRadius: '50px' }
  };

  const getVariantStyles = () => {
    if (variant === 'ghost') {
      return {
        background: 'transparent',
        color: 'var(--color-text-secondary)',
        boxShadow: isPressed ? 'var(--neu-shadow-inset)' : 'none',
      };
    }
    
    let color = 'var(--color-text-primary)';
    if (variant === 'primary') color = 'var(--color-primary)';
    if (variant === 'danger') color = 'var(--color-danger)';
    if (variant === 'success') color = 'var(--color-success)';

    return {
      background: 'var(--color-bg)',
      color: color,
      boxShadow: isPressed ? 'var(--neu-shadow-inset)' : 'var(--neu-shadow-raised)',
      transform: isPressed ? 'scale(0.98)' : 'scale(1)',
    };
  };

  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => !disabled && setIsPressed(false)}
      onMouseLeave={() => !disabled && setIsPressed(false)}
      onTouchStart={() => !disabled && setIsPressed(true)}
      onTouchEnd={() => !disabled && setIsPressed(false)}
      style={{
        ...baseStyle,
        ...sizes[size],
        ...getVariantStyles(),
        ...style
      }}
    >
      {children}
    </button>
  );
};

export default Button;
