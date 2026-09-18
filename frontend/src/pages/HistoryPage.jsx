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
  FileSpreadsheet,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Calendar
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { id } from 'date-fns/locale/id';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [viewTab, setViewTab] = useState('history'); // 'history' (Default), 'matrix', 'usage', or 'expired'
  const [logs, setLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const getDaysToExpiration = (expiredDateStr) => {
    if (!expiredDateStr) return null;
    const exp = new Date(expiredDateStr);
    const now = new Date();
    exp.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    const diffTime = exp.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState('all');
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedCondition, setSelectedCondition] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;

  const [selectedLogTimeline, setSelectedLogTimeline] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBuilding, selectedFloor, selectedCategoryId, selectedCondition, sortField, sortAsc]);

  const matrixExportRef = useRef(null);
  const usageExportRef = useRef(null);
  const [showExportMenu, setShowExportMenu] = useState(false);



  useEffect(() => {
    fetchHistoryData();
  }, []);

  const fetchHistoryData = async () => {
    setLoading(true);
    try {
      const { getAssets } = await import('../api/inventory');

      const [logsRes, catsRes, assetsRes] = await Promise.all([
        getInventoryLogs().catch(err => {
          console.error("Error fetching logs:", err);
          return [];
        }),
        getCategories().catch(err => {
          console.error("Error fetching categories:", err);
          return [];
        }),
        getAssets('available').catch(err => {
          console.error("Error fetching available assets:", err);
          return [];
        })
      ]);

      const backendLogs = Array.isArray(logsRes) ? logsRes : [];
      setLogs(backendLogs);
      setCategories(Array.isArray(catsRes) ? catsRes : []);

      // Load expired items from API
      try {
        const assets = assetsRes;
        
        let exItems = [];
        if (assets && Array.isArray(assets)) {
          assets.forEach(asset => {
            if (asset.expired_date && !exItems.some(ex => ex.id === asset.id)) {
              exItems.push({
                ...asset,
                category_name: asset.category?.name || 'Umum',
                stock: 1 // Since it's from /assets, each represents 1 unit
              });
            }
          });
          // Sort expired items by date closest to expiration
          exItems.sort((a, b) => new Date(a.expired_date) - new Date(b.expired_date));
        }
        setExpiredItems(exItems);
      } catch (e) {
        console.error("Error loading expired items:", e);
      }
      
    } catch (e) {
      console.error(e);
      showToast('Gagal memuat data riwayat', 'error');
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

      // If both have asset_ids, they must match exactly.
      if (targetId && lId) {
        return targetId === lId;
      }

      // If one is missing asset_id, fallback to brand & model matching
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
    const catId = String(log.category?.id || log.category_id || '');
    if (selectedCategoryId !== 'all' && catId !== String(selectedCategoryId)) return false;
    if (selectedCondition !== 'all') {
      const cond = selectedCondition.toLowerCase();
      if (!statusText.toLowerCase().includes(cond)) return false;
    }

    if (startDate) {
      const logDate = new Date(log.created_at);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (logDate < start) return false;
    }

    if (endDate) {
      const logDate = new Date(log.created_at);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (logDate > end) return false;
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

  // Group logs by asset ID to only show the latest status
  const groupedLogsMap = new Map();
  // Sort descending by date to easily pick the latest log
  const descLogs = [...filteredLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  descLogs.forEach(log => {
    const assetKey = log.asset_id || `${log.category?.name || 'unknown'}_${log.brand || '-'}_${log.model_number || 'std'}`;
    if (!groupedLogsMap.has(assetKey)) {
      groupedLogsMap.set(assetKey, log);
    }
  });
  
  const groupedLogs = Array.from(groupedLogsMap.values());

  // Sort grouped logs for display
  const sortedGroupedLogs = [...groupedLogs].sort((a, b) => {
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

  // Keep flat sorted logs for Export functionality
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

  const totalPages = Math.ceil(sortedGroupedLogs.length / itemsPerPage) || 1;
  const paginatedLogs = sortedGroupedLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExportHistoryXLSX = async () => {
    if (sortedLogs.length === 0) {
      showToast('Tidak ada data riwayat untuk diekspor', 'warning');
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const sheetData = [];
      sheetData.push(['RIWAYAT & DATA PENGGANTIAN BARANG']);
      sheetData.push([]);
      
      const headers = ['Lokasi', 'Lantai', 'Ruang', 'ID Tempat (Slot)', 'ID Barang (Aset)', 'Kategori', 'Merk', 'Tipe/Model', 'Kondisi', 'Tanggal Update'];
      sheetData.push(headers);

      sortedLogs.forEach(log => {
        sheetData.push([
          getBuildingName(log),
          getFloorName(log),
          log.room_name || '-',
          log.slot_code || '-',
          log.asset_id || log.category?.name || '-',
          log.category?.name || '-',
          log.brand || '-',
          log.model_number || '-',
          getStatusText(log),
          new Date(log.created_at).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})
        ]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat");
      XLSX.writeFile(workbook, `history_spil_denah_${new Date().toISOString().slice(0,10)}.xlsx`);
      
      showToast('Riwayat berhasil di-export ke Excel (.xlsx)', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat export Excel', 'error');
    }
  };

  const handleExportHistoryPDF = async () => {
    if (sortedLogs.length === 0) {
      showToast('Tidak ada data riwayat untuk diekspor', 'warning');
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;
      const doc = new jsPDF('landscape');

      doc.setFontSize(14);
      doc.text('Riwayat & Data Penggantian Barang', 14, 15);
      doc.setFontSize(10);
      doc.text(`Tanggal Export: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);

      const tableBody = sortedLogs.map(log => [
        getBuildingName(log),
        getFloorName(log),
        log.room_name || '-',
        log.slot_code || '-',
        log.asset_id || log.category?.name || '-',
        log.category?.name || '-',
        log.brand || '-',
        log.model_number || '-',
        getStatusText(log),
        new Date(log.created_at).toLocaleDateString('id-ID')
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['Lokasi', 'Lantai', 'Ruang', 'ID Slot', 'ID Aset', 'Kategori', 'Merk', 'Tipe/Model', 'Kondisi', 'Tanggal']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [58, 149, 66] },
        styles: { fontSize: 8, cellPadding: 2 }
      });

      doc.save(`history_spil_denah_${new Date().toISOString().slice(0,10)}.pdf`);
      showToast('Riwayat berhasil di-export ke PDF', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat export PDF', 'error');
    }
  };

  const handleExportExpiredXLSX = async () => {
    if (expiredItems.length === 0) {
      showToast('Tidak ada data barang expired untuk diekspor', 'warning');
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const sheetData = [];
      sheetData.push(['DATA BARANG KEDALUWARSA (EXPIRED)']);
      sheetData.push([]);
      
      const headers = ['Kategori Barang', 'Merk & Tipe', 'Jumlah Stok Expired', 'Tanggal Pembelian', 'Tanggal Kedaluwarsa', 'Status / Sisa Hari'];
      sheetData.push(headers);

      expiredItems.forEach(item => {
        const days = getDaysToExpiration(item.expired_date);
        const status = days < 0 ? 'Sudah Kedaluwarsa' : `${days} Hari Lagi`;
        sheetData.push([
          item.category_name || '-',
          `${item.brand || '-'} (${item.model_number || '-'})`,
          `${item.stock} Unit`,
          item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('id-ID') : '-',
          new Date(item.expired_date).toLocaleDateString('id-ID'),
          status
        ]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Barang Expired");
      XLSX.writeFile(workbook, `barang_expired_spil_denah_${new Date().toISOString().slice(0,10)}.xlsx`);
      
      showToast('Data Barang Expired berhasil di-export ke Excel (.xlsx)', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat export Excel', 'error');
    }
  };

  const handleExportExpiredPDF = async () => {
    if (expiredItems.length === 0) {
      showToast('Tidak ada data barang expired untuk diekspor', 'warning');
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;
      const doc = new jsPDF('landscape');

      doc.setFontSize(14);
      doc.text('Data Barang Kedaluwarsa (Expired)', 14, 15);
      doc.setFontSize(10);
      doc.text(`Tanggal Export: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);

      const tableBody = expiredItems.map(item => {
        const days = getDaysToExpiration(item.expired_date);
        const status = days < 0 ? 'Sudah Kedaluwarsa' : `${days} Hari Lagi`;
        return [
          item.category_name || '-',
          `${item.brand || '-'} (${item.model_number || '-'})`,
          `${item.stock} Unit`,
          item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('id-ID') : '-',
          new Date(item.expired_date).toLocaleDateString('id-ID'),
          status
        ];
      });

      autoTable(doc, {
        startY: 28,
        head: [['Kategori Barang', 'Merk & Tipe', 'Jumlah Stok', 'Tanggal Pembelian', 'Tanggal Kedaluwarsa', 'Status / Sisa Hari']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] }, // Red header for expired
        styles: { fontSize: 9, cellPadding: 3 }
      });

      doc.save(`barang_expired_spil_denah_${new Date().toISOString().slice(0,10)}.pdf`);
      showToast('Data Barang Expired berhasil di-export ke PDF', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat export PDF', 'error');
    }
  };

  const handleTopExport = (format) => {
    setShowExportMenu(false);
    if (viewTab === 'matrix') {
      if (matrixExportRef.current) matrixExportRef.current(format);
      else showToast('Data List Aset belum siap untuk diekspor', 'warning');
    } else if (viewTab === 'usage') {
      if (usageExportRef.current) usageExportRef.current(format);
      else showToast('Data Daftar Pemakaian belum siap untuk diekspor', 'warning');
    } else if (viewTab === 'history') {
      if (format === 'pdf') {
        handleExportHistoryPDF();
      } else {
        handleExportHistoryXLSX();
      }
    } else if (viewTab === 'expired') {
      if (format === 'pdf') {
        handleExportExpiredPDF();
      } else {
        handleExportExpiredXLSX();
      }
    }
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

            {/* Top Right Action Button */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
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
              <Download size={16} strokeWidth={2.5} />
              <span>Export Data</span>
            </button>
            
            {showExportMenu && (
              <>
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} 
                  onClick={() => setShowExportMenu(false)}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                  overflow: 'hidden',
                  zIndex: 100,
                  minWidth: '180px',
                  border: '1px solid #e2e8f0'
                }}>
                  <button
                    onClick={() => handleTopExport('xlsx')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '12px 16px',
                      background: 'transparent', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                      textAlign: 'left', color: '#334155', fontWeight: '600', fontSize: '0.9rem', transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Export Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleTopExport('pdf')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '12px 16px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      textAlign: 'left', color: '#334155', fontWeight: '600', fontSize: '0.9rem', transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Export PDF (.pdf)
                  </button>
                </div>
              </>
            )}
          </div>
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
            <option value="expired">🚨 Barang Expired</option>
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

            <button
              onClick={() => setViewTab('expired')}
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
                background: viewTab === 'expired' ? 'var(--color-primary)' : 'transparent',
                color: viewTab === 'expired' ? 'white' : 'var(--color-text-secondary)',
                boxShadow: viewTab === 'expired' ? '0 4px 14px rgba(58, 149, 66, 0.35)' : 'none',
                transition: 'all 0.25s ease',
                whiteSpace: 'nowrap',
                flex: '1 1 auto',
                justifyContent: 'center'
              }}
            >
              <AlertTriangle size={16} />
              <span>Barang Expired</span>
            </button>
          </div>
        </div>

        {viewTab === 'matrix' ? (
          <AssetDashboardMatrix onRegisterExport={(fn) => { matrixExportRef.current = fn; }} />
        ) : viewTab === 'usage' ? (
          <CategoryUsageTracker onRegisterExport={(fn) => { usageExportRef.current = fn; }} />
        ) : viewTab === 'expired' ? (
          <div className="neu-raised" style={{ borderRadius: '12px', overflow: 'hidden', background: 'var(--color-bg)', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
            {expiredItems.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <AlertTriangle size={48} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text)' }}>Tidak ada data barang expired</h3>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Tidak ada barang yang tercatat memiliki tanggal kedaluwarsa.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-primary)', color: 'white' }}>
                      <th style={{ padding: '14px 16px', fontWeight: '700' }}>Kategori Barang</th>
                      <th style={{ padding: '14px 16px', fontWeight: '700' }}>Merk & Tipe</th>
                      <th style={{ padding: '14px 16px', fontWeight: '700' }}>Jumlah Stok Expired</th>
                      <th style={{ padding: '14px 16px', fontWeight: '700' }}>Tanggal Pembelian</th>
                      <th style={{ padding: '14px 16px', fontWeight: '700' }}>Tanggal Kedaluwarsa</th>
                      <th style={{ padding: '14px 16px', fontWeight: '700' }}>Status / Sisa Hari</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiredItems.map((item, index) => {
                      const days = getDaysToExpiration(item.expired_date);
                      const isExpired = days < 0;
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isExpired && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} title="Sudah Kedaluwarsa!" />}
                              {item.category_name}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#334155' }}>{item.brand} ({item.model_number})</td>
                          <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--color-primary)' }}>{item.stock} Unit</td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '-'}</td>
                          <td style={{ padding: '12px 16px', fontWeight: '600', color: isExpired ? '#dc2626' : 'inherit' }}>
                            {new Date(item.expired_date).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: 'numeric'})}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {isExpired ? (
                              <span style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', fontWeight: '700', fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                Sudah Kedaluwarsa
                              </span>
                            ) : (
                              <span style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', fontWeight: '700', fontSize: '0.8rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                {days} Hari Lagi
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
              onChange={(e) => setSelectedCategoryId(e.target.value)}
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

            {/* Filter Tanggal Range */}
            <div className="neu-inset filter-select-mobile" style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: '10px', background: 'var(--color-bg)' }}>
              <Calendar size={15} color="var(--color-primary)" style={{ marginRight: '8px' }} />
              <DatePicker
                selectsRange={true}
                startDate={startDate}
                endDate={endDate}
                onChange={(update) => {
                  setDateRange(update);
                }}
                isClearable={true}
                placeholderText="Pilih Rentang Tanggal"
                locale={id}
                dateFormat="dd MMM yyyy"
                className="custom-date-picker-input"
                shouldCloseOnSelect={true}
              />
            </div>

            {/* Reset Filters Button */}
            {(selectedBuilding !== 'all' || selectedFloor !== 'all' || selectedCategoryId !== 'all' || selectedCondition !== 'all' || searchQuery !== '' || startDate !== '' || endDate !== '') && (
              <button
                onClick={() => {
                  setSelectedBuilding('all');
                  setSelectedFloor('all');
                  setSelectedCategoryId('all');
                  setSelectedCondition('all');
                  setSearchQuery('');
                  setDateRange([null, null]);
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
            <>
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
                  {paginatedLogs.map((log, index) => {
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

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '20px', gap: '15px' }}>
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="neu-action-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', background: currentPage === 1 ? '#e2e8f0' : 'var(--color-primary)', color: currentPage === 1 ? '#94a3b8' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  >
                    <ChevronLeft size={18} /> Prev
                  </button>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)', background: 'white', padding: '8px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="neu-action-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', background: currentPage === totalPages ? '#e2e8f0' : 'var(--color-primary)', color: currentPage === totalPages ? '#94a3b8' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                  >
                    Next <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </>
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

      {/* Back to Top Button */}
      <button 
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="neu-action-btn"
        style={{ 
          position: 'fixed', 
          bottom: '30px', 
          right: '30px', 
          width: '50px', 
          height: '50px', 
          borderRadius: '50%', 
          background: 'var(--color-primary)', 
          color: 'white', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          border: 'none', 
          cursor: 'pointer', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
          zIndex: 100 
        }}
        title="Kembali ke atas"
      >
        <ArrowUp size={24} /> 
      </button>

    </div>
  );
};

export default HistoryPage;
