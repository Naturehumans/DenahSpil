import React, { useState } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';

const EquipmentForm = ({ onSubmit, onCancel, initialData = null, categories = [] }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    category_id: initialData?.category_id || '',
    brand: initialData?.brand || '',
    model_number: initialData?.model_number || '',
    installation_date: initialData?.installation_date ? new Date(initialData.installation_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    lifespan_months: initialData?.lifespan_months || 12,
    notes: initialData?.notes || ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      lifespan_months: parseInt(formData.lifespan_months, 10)
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input
        label="Nama Barang"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>
          Kategori <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <select 
          className="neu-inset"
          name="category_id"
          value={formData.category_id}
          onChange={handleChange}
          required
          style={{
            padding: '12px 16px',
            border: 'none',
            borderRadius: '12px',
            background: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
            outline: 'none',
            fontSize: '1rem',
            fontFamily: 'inherit'
          }}
        >
          <option value="" disabled>Pilih Kategori</option>
          {categories.map(cat => (
            <option key={cat.id || cat.name} value={cat.id || cat.name}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        <Input label="Merek" name="brand" value={formData.brand} onChange={handleChange} style={{ flex: 1 }} />
        <Input label="Model/Seri" name="model_number" value={formData.model_number} onChange={handleChange} style={{ flex: 1 }} />
      </div>

      <Input 
        type="textarea" 
        label="Catatan" 
        name="notes" 
        value={formData.notes} 
        onChange={handleChange} 
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
        <Button variant="ghost" onClick={onCancel}>Batal</Button>
        <Button variant="primary" type="submit">Simpan</Button>
      </div>
    </form>
  );
};

export default EquipmentForm;
