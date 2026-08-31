import React from 'react';
import Button from './Button';
import Modal from './Modal';

const ConfirmDialog = ({ isOpen, title, message, variant = 'danger', onConfirm, onCancel, confirmText = 'Konfirmasi', cancelText = 'Batal' }) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>{message}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button variant="ghost" onClick={onCancel}>{cancelText}</Button>
        <Button variant={variant} onClick={onConfirm}>{confirmText}</Button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
