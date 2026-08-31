import React from 'react';

const Input = ({ 
  label, 
  error, 
  type = 'text', 
  id, 
  value, 
  onChange, 
  placeholder,
  required = false,
  className = '',
  style = {},
  labelStyle = {},
  ...props
}) => {

  const handleOnChange = (e) => {
    // Simple sanitization for text inputs to prevent XSS
    if (type === 'text' || type === 'textarea') {
      let val = e.target.value;
      val = val.replace(/<[^>]*>?/gm, ''); // Remove HTML tags
      e.target.value = val;
    }
    if (onChange) onChange(e);
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--color-bg)',
    border: 'none',
    boxShadow: 'var(--neu-shadow-inset)',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '1rem',
    color: 'var(--color-text-primary)',
    outline: 'none',
    transition: 'all 0.2s ease',
    ...style
  };

  return (
    <div className={className} style={{ marginBottom: '16px', width: '100%' }}>
      {label && (
        <label htmlFor={id} style={{ 
          display: 'block', 
          marginBottom: '8px', 
          fontSize: '0.875rem', 
          color: 'var(--color-text-secondary)',
          fontWeight: '500',
          ...labelStyle
        }}>
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}
      
      {type === 'textarea' ? (
        <textarea
          id={id}
          value={value}
          onChange={handleOnChange}
          placeholder={placeholder}
          required={required}
          style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
          {...props}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={handleOnChange}
          placeholder={placeholder}
          required={required}
          style={inputStyle}
          {...props}
        />
      )}

      {error && (
        <span style={{ 
          display: 'block', 
          marginTop: '6px', 
          fontSize: '0.75rem', 
          color: 'var(--color-danger)' 
        }}>
          {error}
        </span>
      )}
    </div>
  );
};

export default Input;
