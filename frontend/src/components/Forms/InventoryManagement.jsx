import React, { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { getAssets, getInventoryLogs, deleteAsset } from '../../api/inventory';
import { Package, Trash2, Clock, CheckCircle, AlertTriangle, X, LayoutGrid, Tag } from 'lucide-react';
import Button from '../UI/Button';
import AssetDashboardMatrix from './AssetDashboardMatrix';
import CategoryForm from './CategoryForm';

const InventoryManagement = ({ 
  onClose, 
  initialTab = 'category',
  categories = [],
  onCategorySubmit,
  onUpdateCategory,
  onDeleteCategory
}) => {
  const [activeTab, setActiveTab] = useState(initialTab); // 'matrix', 'category', 'good', 'damaged', 'history'
  const [assets, setAssets] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (activeTab !== 'matrix' && activeTab !== 'category') {
      fetchData();
    }
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'history') {
        const data = await getInventoryLogs();
        setLogs(data);
      } else if (activeTab === 'good' || activeTab === 'damaged') {
        const data = await getAssets(activeTab === 'good' ? 'available' : 'damaged');
        setAssets(data);
      }
    } catch (err) {
      showToast('Gagal memuat data inventori', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAsset = async (id) => {
    if (!window.confirm('Hapus aset ini secara permanen dari gudang?')) return;
    try {
      await deleteAsset(id);
      setAssets(assets.filter(a => a.id !== id));
      showToast('Aset berhasil dihapus', 'success');
    } catch (err) {
      showToast('Gagal menghapus aset', 'error');
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'repair': return 'var(--color-success)';
      case 'damage': return 'var(--color-warning)';
      case 'remove': return 'var(--color-danger)';
      case 'deploy': return 'var(--color-primary)';
      case 'restock': return 'var(--color-info)';
      default: return 'var(--color-text-secondary)';
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case 'repair': return 'Masuk Gudang Baru';
      case 'damage': return 'Masuk Gudang Rusak';
      case 'remove': return 'Dihapus / Dibuang';
      case 'deploy': return 'Ditempatkan di Denah';
      case 'restock': return 'Restock Baru';
      default: return action;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px', 
        borderBottom: '1px solid var(--color-border)', 
        paddingBottom: '14px', 
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('category')}
            style={{
              background: activeTab === 'category' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              border: activeTab === 'category' ? '1px solid #f59e0b' : '1px solid transparent',
              cursor: 'pointer',
              fontWeight: '700', padding: '8px 14px', borderRadius: '10px',
              color: activeTab === 'category' ? '#d97706' : 'var(--color-text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={17} color="#f59e0b" />
              <span>Kategori ({categories.length})</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            style={{
              background: activeTab === 'matrix' ? 'rgba(58, 149, 66, 0.12)' : 'transparent',
              border: activeTab === 'matrix' ? '1px solid var(--color-primary)' : '1px solid transparent',
              cursor: 'pointer',
              fontWeight: '700', padding: '8px 14px', borderRadius: '10px',
              color: activeTab === 'matrix' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutGrid size={17} />
              <span>Dashboard Aset (Rekap)</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('good')}
            style={{
              background: activeTab === 'good' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
              border: activeTab === 'good' ? '1px solid #6366f1' : '1px solid transparent',
              cursor: 'pointer',
              fontWeight: '600', padding: '8px 14px', borderRadius: '10px',
              color: activeTab === 'good' ? '#4f46e5' : 'var(--color-text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={17} />
              <span>Gudang Siap Pakai</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('damaged')}
            style={{
              background: activeTab === 'damaged' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
              border: activeTab === 'damaged' ? '1px solid #f59e0b' : '1px solid transparent',
              cursor: 'pointer',
              fontWeight: '600', padding: '8px 14px', borderRadius: '10px',
              color: activeTab === 'damaged' ? '#b45309' : 'var(--color-text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={17} />
              <span>Gudang Rusak</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              background: activeTab === 'history' ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
              border: activeTab === 'history' ? '1px solid var(--color-border)' : '1px solid transparent',
              cursor: 'pointer',
              fontWeight: '600', padding: '8px 14px', borderRadius: '10px',
              color: activeTab === 'history' ? 'var(--color-text)' : 'var(--color-text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={17} />
              <span>Riwayat Log</span>
            </div>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'matrix' ? (
          <AssetDashboardMatrix />
        ) : activeTab === 'category' ? (
          <CategoryForm 
            categories={categories}
            onSubmit={onCategorySubmit}
            onUpdate={onUpdateCategory}
            onDelete={onDeleteCategory}
            onCancel={onClose}
          />
        ) : loading ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat data...</p>
        ) : (
          <>
            {(activeTab === 'good' || activeTab === 'damaged') && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {assets.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', gridColumn: '1 / -1' }}>Gudang ini kosong.</p>
                ) : (
                  assets.map(asset => (
                    <div key={asset.id} className="neu-inset" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: asset.category?.color || '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={20} color="white" />
                        </div>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--color-text)' }}>{asset.asset_id}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg)', padding: '2px 8px', borderRadius: '12px' }}>
                            {asset.category?.name || 'Tanpa Kategori'}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteAsset(asset.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '8px' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {logs.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Belum ada riwayat aktivitas.</p>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="neu-flat" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>{log.asset_id || log.category?.name}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: getActionColor(log.action_type), background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px' }}>
                            {getActionText(log.action_type)}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{log.location_info || '-'}</p>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {new Date(log.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
        <Button variant="secondary" onClick={onClose}>Tutup</Button>
      </div>
    </div>
  );
};

export default InventoryManagement;
