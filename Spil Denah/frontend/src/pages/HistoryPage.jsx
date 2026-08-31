import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Skeleton from '../components/UI/Skeleton';
import { getInventoryLogs } from '../api/inventory';
import { getCategories } from '../api/categories';
import { useToast } from '../contexts/ToastContext';
import AssetDashboardMatrix from '../components/Forms/AssetDashboardMatrix';
import CategoryUsageTracker from '../components/Forms/CategoryUsageTracker';
import { 
  ArrowLeft, 
  Clock, 
  Search, 
  Filter, 
  Download,
  Activity,
  ArrowUpDown,
  CheckCircle,
  AlertTriangle,
  Trash2,
  PackageCheck,
  PlusCircle,
  LayoutGrid,
  FileSpreadsheet
} from 'lucide-react';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [viewTab, setViewTab] = useState('history'); // 'history' (Default), 'matrix', or 'usage'
  const [logs, setLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState('all');
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedCondition, setSelectedCondition] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const [selectedLogTimeline, setSelectedLogTimeline] = useState(null);

  const matrixExportRef = useRef(null);
  const usageExportRef = useRef(null);

  const handleTopExport = () => {
    if (viewTab === 'history') {
      handleExportHistory();
    } else if (viewTab === 'matrix') {
      if (matrixExportRef.current) matrixExportRef.current();
      else showToast('Data List Aset belum siap untuk diekspor', 'warning');
    } else if (viewTab === 'usage') {
      if (usageExportRef.current) usageExportRef.current();
      else showToast('Data Daftar Pemakaian belum siap untuk diekspor', 'warning');
    }
  };

  useEffect(() => {
    fetchHistoryData();
  }, []);

  const fetchHistoryData = async () => {
    setLoading(true);
    try {
      const logsRes = await getInventoryLogs().catch(err => {
        console.error("Error fetching logs:", err);
        return [];
      });
      const catsRes = await getCategories().catch(err => {
        console.error("Error fetching categories:", err);
        return [];
      });

      let localLogs = [];
      try {
        const saved = localStorage.getItem('spil_local_history_logs');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Filter out move logs from localStorage so local storage doesn't duplicate official DB move logs
          localLogs = parsed.filter(l => l.action_type !== 'move');
          localStorage.setItem('spil_local_history_logs', JSON.stringify(localLogs));
        }
      } catch (e) {}

      const backendLogs = Array.isArray(logsRes) ? logsRes : [];

      // Combine and deduplicate strictly by (asset_id + slot_code + status) or log ID
      const combined = [...localLogs, ...backendLogs];
      const seenKeys = new Set();
      
      const mergedLogs = combined.filter(log => {
        if (!log) return false;
        const idKey = log.id ? `id_${log.id}` : null;
        const attrKey = `${log.asset_id || ''}_${log.slot_code || ''}_${log.status || ''}`;
        
        if (idKey && seenKeys.has(idKey)) return false;
        if (seenKeys.has(attrKey)) return false;
        
        if (idKey) seenKeys.add(idKey);
        seenKeys.add(attrKey);
        return true;
      });

      setLogs(mergedLogs);
      setCategories(Array.isArray(catsRes) ? catsRes : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getItemTimelineLogs = (selectedLog) => {
    if (!selectedLog) return [];
    const targetId = (selectedLog.asset_id || '').toLowerCase();
    const targetBrand = (selectedLog.brand || '').toLowerCase();
    const targetModel = (selectedLog.model_number || '').toLowerCase();

    return logs.filter(l => {
      const lId = (l.asset_id || '').toLowerCase();
      const lBrand = (l.brand || '').toLowerCase();
      const lModel = (l.model_number || '').toLowerCase();

      if (targetId && lId && targetId === lId) return true;
      if (targetBrand && lBrand && targetBrand === lBrand && (!targetModel || targetModel === lModel)) return true;
      return false;
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  };

  // Helper to extract Lokasi (Building) from location_info if building_name isn't stored
  const getBuildingName = (log) => {
    if (log.building_name && log.building_name !== 'Gedung Utama') return log.building_name;
    if (log.location_info && log.location_info.includes('Penempatan di ')) {
      const parts = log.location_info.replace('Penempatan di ', '').split(' - ');
      return parts[0] || '-';
    }
    if (log.location_info && (log.location_info.includes('Tanpa Lokasi') || log.location_info.includes('dibuang') || log.location_info.includes('dihapus'))) {
      return 'Gudang (Tanpa Lokasi)';
    }
    if (log.building_name === '-') return '-';
    return log.building_name || 'Gedung Utama';
  };

  // Helper to extract Lantai from location_info if floor_name isn't stored
  const getFloorName = (log) => {
    let name = '-';
    if (log.floor_name) name = log.floor_name;
    else if (log.location_info && log.location_info.includes('Penempatan di ')) {
      const parts = log.location_info.replace('Penempatan di ', '').split(' - ');
      name = parts[1] || '-';
    }
    if (!name || name === '-' || name.toLowerCase() === 'null') return '-';
    // Normalize case to prevent "Lt.1" and "lt.1" showing up as different options
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  // Helper for Status/Kondisi
  const getStatusText = (log) => {
    if (log.status) return log.status;
    switch (log.action_type) {
      case 'deploy': return 'Dipasang';
      case 'restock': return 'Stok Baru';
      case 'repair': return 'Siap Pakai';
      case 'damage': return 'Perlu Cek / Rusak';
      case 'remove': return 'Dihapus / Dibuang';
      default: return log.action_type || 'Aktif';
    }
  };

  const getStatusStyle = (log) => {
    const text = getStatusText(log).toLowerCase();
    if (text.includes('pasang') || text.includes('aktif') || text.includes('siap')) {
      return { bg: 'rgba(34, 197, 94, 0.12)', color: '#15803d', border: '1px solid rgba(34, 197, 94, 0.3)' };
    }
    if (text.includes('rusak') || text.includes('cek')) {
      return { bg: 'rgba(245, 158, 11, 0.12)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.3)' };
    }
    if (text.includes('buang') || text.includes('hapus')) {
      return { bg: 'rgba(239, 68, 68, 0.12)', color: '#b91c1c', border: '1px solid rgba(239, 68, 68, 0.3)' };
    }
    return { bg: 'rgba(99, 102, 241, 0.12)', color: '#4338ca', border: '1px solid rgba(99, 102, 241, 0.3)' };
  };

  // Dynamic filter options derived from actual logs
  const availableBuildings = Array.from(new Set(logs.map(log => getBuildingName(log)))).filter(Boolean);
  
  const floorsForSelectedBuilding = selectedBuilding === 'all' 
    ? logs 
    : logs.filter(log => getBuildingName(log) === selectedBuilding);
    
  const availableFloors = Array.from(new Set(floorsForSelectedBuilding.map(log => getFloorName(log)))).filter(f => Boolean(f) && f !== '-');

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const bName = getBuildingName(log);
    const fName = getFloorName(log);
    const statusText = getStatusText(log);

    if (selectedBuilding !== 'all' && bName !== selectedBuilding) return false;
    if (selectedFloor !== 'all' && fName !== selectedFloor) return false;
    if (selectedCategoryId !== 'all' && log.category_id !== selectedCategoryId) return false;
    if (selectedCondition !== 'all') {
      const cond = selectedCondition.toLowerCase();
      if (!statusText.toLowerCase().includes(cond)) return false;
    }
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const rName = (log.room_name || '').toLowerCase();
      const catName = (log.category?.name || '').toLowerCase();
      const slotCode = (log.slot_code || '').toLowerCase();
      const item = (log.asset_id || log.category?.name || '').toLowerCase();
      const brand = (log.brand || '').toLowerCase();
      const model = (log.model_number || '').toLowerCase();
      const status = statusText.toLowerCase();

      return bName.toLowerCase().includes(q) || 
             fName.toLowerCase().includes(q) || 
             rName.includes(q) ||
             slotCode.includes(q) ||
             catName.includes(q) || 
             item.includes(q) || 
             brand.includes(q) || 
             model.includes(q) || 
             status.includes(q);
    }
    return true;
  });

  // Sort logs
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';

    if (sortField === 'building_name') {
      valA = getBuildingName(a);
      valB = getBuildingName(b);
    } else if (sortField === 'floor_name') {
      valA = getFloorName(a);
      valB = getFloorName(b);
    } else if (sortField === 'status') {
      valA = getStatusText(a);
      valB = getStatusText(b);
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExportHistory = () => {
    if (sortedLogs.length === 0) {
      showToast('Tidak ada data riwayat untuk diekspor', 'warning');
      return;
    }

    const headers = ['Lokasi', 'Lantai', 'Ruang', 'ID Tempat (Slot)', 'ID Barang (Aset)', 'Kategori', 'Merk', 'Tipe/Model', 'Kondisi', 'Tanggal Update'];
    const rows = sortedLogs.map(log => [
      `"${getBuildingName(log)}"`,
      `"${getFloorName(log)}"`,
      `"${log.room_name || '-'}"`,
      `"${log.slot_code || '-'}"`,
      `"${log.asset_id || log.category?.name || '-'}"`,
      `"${log.category?.name || '-'}"`,
      `"${log.brand || '-'}"`,
      `"${log.model_number || '-'}"`,
      `"${getStatusText(log)}"`,
      `"${new Date(log.created_at).toLocaleDateString('id-ID')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `history_spil_denah_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('File CSV berhasil diunduh!', 'success');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', overflowX: 'hidden', width: '100%' }}>
      <Header />

      <main style={{ flex: 1, padding: '20px 16px', maxWidth: '1600px', width: '100%', margin: '0 auto', boxSizing: 'border-box', overflowX: 'hidden' }}>
        
        {/* Header & Back Button (Spacious & Centered) */}
        <div style={{ marginBottom: '28px', position: 'relative' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              className="neu-raised-sm"
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-bg)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--color-primary)',
                fontWeight: '600',
                fontSize: '0.875rem',
                width: 'auto'
              }}
              title="Kembali ke Dashboard Denah"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Denah</span>
            </button>

            <button
              onClick={handleTopExport}
              className="neu-raised neu-raised-btn"
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-primary)',
                color: 'white',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(58, 149, 66, 0.25)',
                width: 'auto'
              }}
            >
              {viewTab === 'history' ? <Download size={16} /> : <FileSpreadsheet size={16} />}
              <span>
                {viewTab === 'history' ? 'Export CSV Log' : 'Export Excel (.xlsx)'}
              </span>
            </button>
          </div>

          <div style={{ textAlign: 'center', margin: '0 auto', maxWidth: '750px' }}>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-primary)', letterSpacing: '-0.4px', lineHeight: '1.25' }}>
              {viewTab === 'matrix' 
                ? 'Dashboard Aset & Matriks Lokasi' 
                : viewTab === 'usage' 
                ? 'Daftar Pemakaian Aset Per Kategori' 
                : 'Riwayat & Data Penggantian Barang'}
            </h1>
            <p style={{ margin: 0, fontSize: '1.05rem', color: 'var(--color-text-secondary)', lineHeight: '1.5', fontWeight: '500' }}>
              {viewTab === 'matrix' 
                ? 'Rekapitulasi total aset aktif yang terpasang di seluruh area, gedung, dan lantai'
                : viewTab === 'usage'
                ? 'Tabel pemakaian detail per tipe item barang (Masuk/Keluar, Sisa Stok, & Lokasi Pemakaian)'
                : 'Tabel log terlengkap mencatat Lokasi, Lantai, Ruang, Kategori, Item, Merk, Model, Kondisi & Tanggal Update'
              }
            </p>
          </div>
        </div>

        {/* Mobile Dropdown Tab Switcher (Visible on Mobile <= 768px) */}
        <div className="show-on-mobile" style={{ 
          justifyContent: 'center', 
          alignItems: 'center', 
          marginBottom: '24px',
          marginTop: '6px'
        }}>
          <select
            value={viewTab}
            onChange={(e) => setViewTab(e.target.value)}
            className="neu-inset"
            style={{
              padding: '12px 18px',
              borderRadius: '14px',
              border: 'none',
              background: 'var(--color-bg)',
              color: 'var(--color-primary)',
              fontWeight: '800',
              fontSize: '0.95rem',
              width: '100%',
              maxWidth: '340px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="history">⏱️ Riwayat Data</option>
            <option value="matrix">🔲 List Aset & Matriks</option>
            <option value="usage">📄 Daftar Pemakaian</option>
          </select>
        </div>

        {/* Desktop Centered Segmented Control Tab Switcher (Hidden on Mobile) */}
        <div className="hide-on-mobile" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          marginBottom: '28px',
          marginTop: '6px'
        }}>
          <div className="neu-inset" style={{ 
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            padding: '6px', 
            borderRadius: '16px', 
            gap: '6px',
            width: '100%',
            maxWidth: 'fit-content'
          }}>
            <button
              onClick={() => setViewTab('history')}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: viewTab === 'history' ? 'var(--color-primary)' : 'transparent',
                color: viewTab === 'history' ? 'white' : 'var(--color-text-secondary)',
                boxShadow: viewTab === 'history' ? '0 4px 14px rgba(58, 149, 66, 0.35)' : 'none',
                transition: 'all 0.25s ease',
                whiteSpace: 'nowrap',
                flex: '1 1 auto',
                justifyContent: 'center'
              }}
            >
              <Clock size={16} />
              <span>Riwayat</span>
            </button>

            <button
              onClick={() => setViewTab('matrix')}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: viewTab === 'matrix' ? 'var(--color-primary)' : 'transparent',
                color: viewTab === 'matrix' ? 'white' : 'var(--color-text-secondary)',
                boxShadow: viewTab === 'matrix' ? '0 4px 14px rgba(58, 149, 66, 0.35)' : 'none',
                transition: 'all 0.25s ease',
                whiteSpace: 'nowrap',
                flex: '1 1 auto',
                justifyContent: 'center'
              }}
            >
              <LayoutGrid size={16} />
              <span>List Aset</span>
            </button>

            <button
              onClick={() => setViewTab('usage')}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: viewTab === 'usage' ? 'var(--color-primary)' : 'transparent',
                color: viewTab === 'usage' ? 'white' : 'var(--color-text-secondary)',
                boxShadow: viewTab === 'usage' ? '0 4px 14px rgba(58, 149, 66, 0.35)' : 'none',
                transition: 'all 0.25s ease',
                whiteSpace: 'nowrap',
                flex: '1 1 auto',
                justifyContent: 'center'
              }}
            >
              <FileSpreadsheet size={16} />
              <span>Daftar Pemakaian</span>
            </button>
          </div>
        </div>

        {viewTab === 'matrix' ? (
          <AssetDashboardMatrix onRegisterExport={(fn) => { matrixExportRef.current = fn; }} />
        ) : viewTab === 'usage' ? (
          <CategoryUsageTracker onRegisterExport={(fn) => { usageExportRef.current = fn; }} />
        ) : (
          <>
        {/* Filters Bar (ABOVE Summary Cards) */}
        <div className="neu-raised" style={{ 
          padding: '14px 20px', 
          borderRadius: '16px', 
          marginBottom: '20px', 
          background: 'var(--color-bg)', 
          display: 'flex', 
          gap: '12px', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          {/* Compact Search Box */}
          <div className="neu-inset search-box-mobile" style={{ 
            width: '280px', 
            maxWidth: '100%',
            display: 'flex', 
            alignItems: 'center', 
            padding: '0 14px', 
            borderRadius: '12px', 
            height: '42px',
            background: 'var(--color-bg)',
            boxSizing: 'border-box'
          }}>
            <Search size={18} color="var(--color-text-muted)" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Cari item, brand, dll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', color: 'var(--color-text)', fontSize: '0.9rem' }}
            />
          </div>

          {/* Dropdown Filters Group */}
          <div className="filter-group-mobile" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="filter-label-mobile" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: '600' }}>
              <Filter size={15} color="var(--color-primary)" />
              <span>Filter:</span>
            </div>

            {/* Filter Lokasi */}
            <select
              value={selectedBuilding}
              onChange={(e) => {
                setSelectedBuilding(e.target.value);
                setSelectedFloor('all');
              }}
              className="neu-inset filter-select-mobile"
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-bg)',
                fontSize: '0.8125rem',
                color: 'var(--color-text)',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              <option value="all">Semua Lokasi</option>
              {availableBuildings.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Filter Lantai */}
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="neu-inset filter-select-mobile"
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-bg)',
                fontSize: '0.8125rem',
                color: 'var(--color-text)',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              <option value="all">Semua Lantai</option>
              {availableFloors.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            {/* Filter Kategori */}
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="neu-inset filter-select-mobile"
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-bg)',
                fontSize: '0.8125rem',
                color: 'var(--color-text)',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              <option value="all">Semua Kategori</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Filter Kondisi / Status */}
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="neu-inset filter-select-mobile"
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-bg)',
                fontSize: '0.8125rem',
                color: 'var(--color-text)',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              <option value="all">Semua Kondisi</option>
              <option value="pasang">Dipasang</option>
              <option value="siap">Siap Pakai / Stok</option>
              <option value="rusak">Rusak / Perlu Cek</option>
              <option value="buang">Dibuang / Off</option>
            </select>
            {/* Reset Filters Button */}
            {(selectedBuilding !== 'all' || selectedFloor !== 'all' || selectedCategoryId !== 'all' || selectedCondition !== 'all' || searchQuery !== '') && (
              <button
                onClick={() => {
                  setSelectedBuilding('all');
                  setSelectedFloor('all');
                  setSelectedCategoryId('all');
                  setSelectedCondition('all');
                  setSearchQuery('');
                }}
                className="filter-reset-mobile"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#dc2626',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* History Table Matching Requested Reference Design */}
        <div className="neu-raised" style={{ borderRadius: '12px', overflow: 'hidden', background: 'var(--color-bg)', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Skeleton variant="card" width="100%" height="200px" />
            </div>
          ) : sortedLogs.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <Clock size={48} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text)' }}>Tidak ada data riwayat</h3>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Belum ada log yang sesuai dengan pencarian Anda.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                textAlign: 'left',
                fontSize: '0.875rem',
                fontFamily: 'Inter, sans-serif'
              }}>
                <thead>
                  <tr style={{ background: 'var(--color-primary)', color: 'white' }}>
                    {[
                      { field: 'building_name', label: 'Lokasi' },
                      { field: 'floor_name', label: 'Lantai' },
                      { field: 'room_name', label: 'Ruang' },
                      { field: 'slot_code', label: 'ID Tempat (Slot)' },
                      { field: 'asset_id', label: 'ID Barang (Aset)' },
                      { field: 'category_id', label: 'Kategori' },
                      { field: 'brand', label: 'Merk' },
                      { field: 'model_number', label: 'Tipe/Model' },
                      { field: 'status', label: 'Kondisi' },
                      { field: 'created_at', label: 'Tanggal Update' },
                    ].map(col => (
                      <th 
                        key={col.field}
                        onClick={() => handleSort(col.field)}
                        style={{ 
                          padding: '14px 16px', 
                          fontWeight: '700', 
                          fontSize: '0.8125rem',
                          borderRight: '1px solid rgba(255,255,255,0.2)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span>{col.label}</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>▼</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedLogs.map((log, index) => {
                    const statusStyle = getStatusStyle(log);
                    const isEven = index % 2 === 0;

                    return (
                      <tr 
                        key={log.id || index}
                        onClick={() => setSelectedLogTimeline(log)}
                        title="Klik untuk melihat kronologi & riwayat lengkap barang ini"
                        style={{
                          background: isEven ? '#ffffff' : '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          transition: 'background 0.15s ease',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(58, 149, 66, 0.06)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = isEven ? '#ffffff' : '#f8fafc'}
                      >
                        {/* Lokasi */}
                        <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', color: '#1e293b', fontWeight: '500' }}>
                          {getBuildingName(log)}
                        </td>

                        {/* Lantai */}
                        <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', color: '#334155' }}>
                          {getFloorName(log)}
                        </td>

                        {/* Ruang */}
                        <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', color: '#475569' }}>
                          {log.room_name || ''}
                        </td>

                        {/* ID Tempat / Slot Code */}
                        <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', fontWeight: '700', color: 'var(--color-primary)' }}>
                          {log.slot_code ? (
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(58, 149, 66, 0.1)', fontSize: '0.75rem' }}>
                              {log.slot_code}
                            </span>
                          ) : '-'}
                        </td>

                        {/* ID Barang / Asset ID */}
                        <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', fontWeight: '700', color: '#2563eb' }}>
                          {log.asset_id ? (
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(37, 99, 235, 0.1)', fontSize: '0.75rem' }}>
                              {log.asset_id}
                            </span>
                          ) : (log.category?.name || 'Item')}
                        </td>

                        {/* Kategori */}
                        <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', fontWeight: '600' }}>
                          {log.category?.name ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              background: `${log.category.color || '#3a9542'}18`,
                              color: log.category.color || '#3a9542',
                              border: `1px solid ${log.category.color || '#3a9542'}40`
                            }}>
                              {log.category.name}
                            </span>
                          ) : '-'}
                        </td>

                        {/* Merk */}
                        <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', color: '#334155' }}>
                          {log.brand || log.equipment?.brand || '-'}
                        </td>

                        {/* Tipe/Model */}
                        <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', color: '#475569' }}>
                          {log.model_number || log.equipment?.model_number || '-'}
                        </td>

                        {/* Kondisi */}
                        <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            border: statusStyle.border
                          }}>
                            {getStatusText(log)}
                          </span>
                        </td>

                        {/* Tanggal Update */}
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.8125rem' }}>
                          {new Date(log.created_at).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit'
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        )}

      </main>

      {/* MODAL POPUP KRONOLOGI / TIMELINE KONDISI BARANG */}
      {selectedLogTimeline && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="neu-raised" style={{ background: 'var(--color-bg)', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Kronologi & Perjalanan Barang
                </span>
                <h3 style={{ margin: '4px 0 0', color: 'var(--color-text-primary)', fontSize: '1.25rem' }}>
                  {selectedLogTimeline.asset_id || selectedLogTimeline.brand} {selectedLogTimeline.model_number ? `(${selectedLogTimeline.model_number})` : ''}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  Kategori: {selectedLogTimeline.category?.name || 'Aset'} | Merk: {selectedLogTimeline.brand || '-'}
                </p>
              </div>
              <button onClick={() => setSelectedLogTimeline(null)} className="neu-action-btn" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '8px' }}>
              {getItemTimelineLogs(selectedLogTimeline).map((itemLog, i) => {
                const stStyle = getStatusStyle(itemLog);
                return (
                  <div key={itemLog.id || i} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: stStyle.color, flexShrink: 0, marginTop: '4px' }} />
                      {i < getItemTimelineLogs(selectedLogTimeline).length - 1 && (
                        <div style={{ width: '2px', flex: 1, background: 'rgba(0,0,0,0.1)', marginTop: '4px' }} />
                      )}
                    </div>

                    <div className="neu-raised-sm" style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', background: 'var(--color-bg)', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', background: stStyle.bg, color: stStyle.color, border: stStyle.border }}>
                          {getStatusText(itemLog)}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {new Date(itemLog.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-text-primary)', fontWeight: '500' }}>
                        {itemLog.location_info || `${getStatusText(itemLog)} di ${getBuildingName(itemLog)} - ${getFloorName(itemLog)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
