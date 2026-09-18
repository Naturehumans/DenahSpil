import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getCategories } from '../../api/categories';
import { getInventoryLogs, getAssets } from '../../api/inventory';
import { getAllEquipments } from '../../api/equipments';
import { useToast } from '../../contexts/ToastContext';
import { FileSpreadsheet, RefreshCw, Filter, Search } from 'lucide-react';
import Skeleton from '../UI/Skeleton';

const CategoryUsageTracker = ({ onRegisterExport }) => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [logs, setLogs] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [assets, setAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubItemNames, setSelectedSubItemNames] = useState([]);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedSubItemNames([]);
  }, [selectedCategoryId]);

  useEffect(() => {
    if (onRegisterExport) {
      onRegisterExport((format) => {
        if (format === 'pdf') handleExportPDF();
        else handleExportXLSX();
      });
    }
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [catsRes, logsRes, eqRes, assetsRes] = await Promise.all([
        getCategories().catch(() => []),
        getInventoryLogs().catch(() => []),
        getAllEquipments().catch(() => []),
        getAssets().catch(() => [])
      ]);

      const catList = Array.isArray(catsRes) ? catsRes : [];
      
      const mergedLogs = Array.isArray(logsRes) ? logsRes : [];

      setCategories(catList);
      setLogs(mergedLogs);
      setEquipments(Array.isArray(eqRes) ? eqRes : []);
      setAssets(Array.isArray(assetsRes) ? assetsRes : []);

      // Default to "Lampu" category if present, or first category
      const lampCat = catList.find(c => c.name.toLowerCase().includes('lampu'));
      if (lampCat) {
        setSelectedCategoryId(lampCat.id);
      } else if (catList.length > 0) {
        setSelectedCategoryId(catList[0].id);
      }
    } catch (err) {
      showToast('Gagal memuat data daftar pemakaian', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find(c => c.id === selectedCategoryId) || 
    (categories.length > 0 ? categories[0] : { name: 'Lampu', id: 'lampu' });

  // Helper to check if string is a Slot / Equipment ID like gua11, sea12, etc.
  const isSlotId = (str) => {
    if (!str) return true;
    const lower = str.trim().toLowerCase();
    // Patterns like gua11, sea12, room slots, or slot codes
    if (/^(gua|sea|dep|fl|lt|rm)\d+$/i.test(lower)) return true;
    if (equipments.some(eq => (eq.name && eq.name.toLowerCase() === lower) || (eq.slot_code && eq.slot_code.toLowerCase() === lower))) {
      return true;
    }
    return false;
  };

  // Extract sub-items / models dynamically for the selected category based strictly on user's real inventory!
  const getSubItemsForCategory = (cat) => {
    if (!cat) return [];

    const catNameLower = (cat.name || '').toLowerCase();
    const modelStockMap = new Map(); // key: display name -> { name, brand, model_number, stock }

    // Helper to check if string is an invalid/dummy display name
    const isValidItemName = (name, brand, model) => {
      if (!name) return false;
      const lower = name.trim().toLowerCase();
      if (lower === 'standard' || lower === '-' || lower === '--' || lower === 'none' || lower.startsWith('--')) return false;
      if (isSlotId(lower)) return false;
      return true;
    };

    // Count stock from backend assets (excluding slot IDs and dummy codes)
    assets.forEach(ast => {
      const isMatch = String(ast.category_id) === String(cat.id);
      if (isMatch) {
        let displayName = ast.brand;
        if (ast.model_number && ast.model_number !== 'Standard') {
          displayName = ast.brand ? `${ast.brand} (${ast.model_number})` : ast.model_number;
        }

        if (isValidItemName(displayName, ast.brand, ast.model_number)) {
          const isAvail = ast.status === 'available';
          if (!modelStockMap.has(displayName)) {
            modelStockMap.set(displayName, {
              name: displayName,
              brand: ast.brand || '',
              model_number: ast.model_number || 'Standard',
              stock: isAvail ? 1 : 0
            });
          } else if (isAvail) {
            modelStockMap.get(displayName).stock += 1;
          }
        }
      }
    });

    if (modelStockMap.size > 0) {
      return Array.from(modelStockMap.values());
    }

    return [];
  };

  const allCategorySubItems = getSubItemsForCategory(selectedCategory);
  const categorySubItems = allCategorySubItems.filter(item => 
    selectedSubItemNames.length === 0 || selectedSubItemNames.includes(item.name)
  );

  // Filter logs strictly for selected category and deduplicate identical API + Local entries
  const filteredCategoryLogs = (() => {
    const rawCatLogs = logs.filter(log => {
      const isCatMatch = selectedCategoryId === 'all' || 
        log.category_id === selectedCategory.id || 
        log.category?.id === selectedCategory.id ||
        (selectedCategory.name && log.category?.name?.toLowerCase() === selectedCategory.name.toLowerCase());

      if (!isCatMatch) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const loc = (log.location_info || `${log.building_name || ''} ${log.floor_name || ''}`).toLowerCase();
        const item = (log.asset_id || log.model_number || log.brand || '').toLowerCase();
        return loc.includes(q) || item.includes(q);
      }
      return true;
    });

    // Detect if batch transaction logs (quantity > 1) exist for brand/models
    const hasBatchLogMap = new Map();
    rawCatLogs.forEach(l => {
      const isMasuk = (l.action_type || '').toLowerCase().includes('add_stock') || (l.status || '').toLowerCase().includes('siap');
      const qtyVal = parseInt(l.quantity || l.qty || l.stock || 1);
      if (isMasuk && qtyVal > 1) {
        const key = `${(l.brand || '').toLowerCase().trim()}_${(l.model_number || '').toLowerCase().trim()}`;
        hasBatchLogMap.set(key, true);
      }
    });

    const uniqueLogs = [];
    const seenSet = new Set();
    
    rawCatLogs.forEach(log => {
      const isMasuk = (log.action_type || '').toLowerCase().includes('add_stock') || (log.status || '').toLowerCase().includes('siap');
      const key = `${(log.brand || '').toLowerCase().trim()}_${(log.model_number || '').toLowerCase().trim()}`;
      const qtyVal = parseInt(log.quantity || log.qty || log.stock || 1);

      // If a batch transaction log exists for this brand/model, skip individual single-unit logs (e.g. Lampu - 1, Lampu - 2) to avoid 15 + 15 = 30 double counting
      if (isMasuk && hasBatchLogMap.get(key) && qtyVal <= 1 && log.asset_id && log.asset_id.includes(' - ')) {
        return;
      }

      const logId = log.id || `${log.created_at}_${log.brand}_${log.model_number}_${log.quantity}`;
      if (!seenSet.has(logId)) {
        seenSet.add(logId);
        uniqueLogs.push(log);
      }
    });

    return uniqueLogs;
  })();

  // Precise IN (Masuk = Stok Ditambahkan) and OUT (Keluar = Stok Dipakai / Dipasang ke Lokasi) classification
  const rawUsageRows = filteredCategoryLogs.map((log, idx) => {
    const dateStr = log.created_at ? new Date(log.created_at).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    }) : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });

    let modelName = log.brand;
    if (log.model_number && log.model_number !== 'Standard') {
      modelName = log.brand ? `${log.brand} (${log.model_number})` : log.model_number;
    }
    if (!modelName) modelName = log.asset_id || (categorySubItems[0]?.name);

    // MASUK: Saat stok ditambahkan ke inventori / gudang / restock
    const actionType = (log.action_type || '').toLowerCase();
    const statusText = (log.status || '').toLowerCase();
    const locationLower = (log.location_info || '').toLowerCase();

    // "Dilepas dari Gedung X" = unit dikembalikan dari ruangan ke gudang → harus Masuk
    const isDilepasKembali = locationLower.includes('dilepas dari') ||
                              locationLower.includes('dilepas/diganti dari');

    // KELUAR = Dibuang (permanen) ATAU Dipasang ke gedung.
    // Dibuang:
    const isDiscard = !isDilepasKembali && (
                      actionType.includes('remove') || 
                      actionType.includes('discard') || 
                      actionType.includes('delete') || 
                      statusText.includes('dibuang') || 
                      statusText.includes('dihapus')
                     );

    const isMove = actionType.includes('move') || locationLower.includes('dipindahkan dari');

    // Dipasang:
    const isDipasang = !isDilepasKembali && !isMove && (
                       actionType.includes('deploy') ||
                       locationLower.includes('ditempatkan') ||
                       locationLower.includes('penempatan')
                      );

    const isKeluar = isDiscard || isDipasang;

    // MASUK = Selain keluar dan bukan perpindahan (misal: tambah stok, diretur, dilepas, rusak/masuk perbaikan, dsb)
    const isMasuk = !isKeluar && !isMove;
    const logQty = parseInt(log.quantity || log.qty || log.stock) || 1;

    let finalLocationText = '';
    if (isDiscard) {
      finalLocationText = log.location_info || log.notes || 'Stok dibuang/dihapus';
    } else if (isDilepasKembali) {
      // Tampilkan lokasi asli (dari ruangan mana unit dikembalikan) agar lebih informatif
      finalLocationText = log.location_info || `Dikembalikan ke gudang`;
    } else if (isMasuk) {
      finalLocationText = log.location_info || `Stok Masuk Gudang`;
    } else {
      finalLocationText = log.location_info || `${log.building_name || 'Gedung Utama'} - ${log.floor_name || 'Lt.1'} ${log.room_name ? '(' + log.room_name + ')' : ''}`;
      // Retroaktif menambahkan Asset ID untuk log "Penempatan/Penggantian" lama yang tidak punya Asset ID di teksnya
      if (finalLocationText.startsWith('Penempatan/Penggantian di') && log.asset_id) {
        finalLocationText = `"${log.asset_id}" ${finalLocationText}`;
      }
    }

    return {
      date: dateStr,
      modelName: modelName || categorySubItems[0]?.name || 'Tipe A',
      isMasuk: isMasuk,
      isKeluar: isKeluar,
      qty: logQty,
      location: finalLocationText
    };
  });

  // Group identical log activities (same date, model, isMasuk/isKeluar, and location)
  // Automatically combines repetitive individual 1, 1, 1, 1 entries into 1 single total row per item type!
  const groupedMap = new Map();
  rawUsageRows.forEach(item => {
    const groupKey = `${item.date}__${item.modelName}__${item.isMasuk}__${item.location}`;
    if (groupedMap.has(groupKey)) {
      const existing = groupedMap.get(groupKey);
      existing.qty += item.qty;
    } else {
      groupedMap.set(groupKey, { ...item });
    }
  });

  const usageRows = Array.from(groupedMap.values()).map((row, idx) => ({
    no: idx + 1,
    ...row
  }));

  // Real initial stock entry rows for user items if API logs are not yet recorded
  const getUserStockRows = () => {
    if (categorySubItems.length === 0) return [];
    
    return categorySubItems.map((item, idx) => ({
      no: idx + 1,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      modelName: item.name,
      isMasuk: true,
      isKeluar: false,
      qty: item.stock > 0 ? item.stock : 1,
      location: `Masuk Stok Gudang (${selectedCategory.name || 'Siap Pakai'})`
    }));
  };

  const checkIfRowMatchesItem = (rowModelNameStr, item, forceMatchIfSingle) => {
    const itemBrand = (item.brand || '').toLowerCase().trim();
    const itemModel = (item.model_number || '').toLowerCase().trim();
    const itemName = (item.name || '').toLowerCase().trim();
    const rowModelName = (rowModelNameStr || '').toLowerCase().trim();

    let isMatch = false;
    if (rowModelName && itemName) {
      if (rowModelName === itemName) {
        isMatch = true;
      } else if (itemModel && itemModel !== 'standard' && itemModel.length > 2 && rowModelName.includes(itemModel)) {
        if (!itemBrand || itemBrand === '-' || rowModelName.includes(itemBrand)) isMatch = true;
      } else if (itemBrand && itemBrand !== '-' && rowModelName.includes(itemBrand)) {
        if (!itemModel || itemModel === 'standard') {
          if (!rowModelName.includes('(')) isMatch = true;
        } else if (rowModelName.includes(itemModel)) {
          isMatch = true;
        }
      }
    }
    if (!isMatch && forceMatchIfSingle) isMatch = true;
    return isMatch;
  };

  const baseRows = usageRows.length > 0 ? usageRows : getUserStockRows();
  const displayRows = baseRows.filter(r => 
    categorySubItems.some(item => checkIfRowMatchesItem(r.modelName, item, allCategorySubItems.length === 1))
  );

  const handleExportXLSX = () => {
    try {
      const sheetData = [];

      // Row 1: Merged Title Banner
      sheetData.push([`DAFTAR PEMAKAIAN ${selectedCategory.name.toUpperCase()}`]);
      
      // Row 2: Subheader Info Date
      const todayDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
      sheetData.push([`Update: ${todayDate}`]);

      // Row 3: Sub-item Header Names
      const subItemHeader = ['No', 'Tanggal'];
      categorySubItems.forEach(item => {
        subItemHeader.push(item.name, ''); // Spans 2 subcolumns (Masuk & Keluar)
      });
      subItemHeader.push('Lokasi Pemakaian');
      sheetData.push(subItemHeader);

      // Row 4: Sisa Stock Row
      const stockHeader = ['', ''];
      categorySubItems.forEach(item => {
        stockHeader.push(`Sisa Stock: ${item.stock}`, '');
      });
      stockHeader.push('');
      sheetData.push(stockHeader);

      // Row 5: Masuk / Keluar Subheaders
      const moveHeader = ['', ''];
      categorySubItems.forEach(() => {
        moveHeader.push('Masuk', 'Keluar');
      });
      moveHeader.push('');
      sheetData.push(moveHeader);

      // Rows 6+: Data Rows
      displayRows.forEach((r, idx) => {
        const row = [idx + 1, r.date];
        categorySubItems.forEach(item => {
          const isTarget = checkIfRowMatchesItem(r.modelName, item, allCategorySubItems.length === 1);
          if (isTarget) {
            row.push(r.isMasuk ? r.qty : '', r.isKeluar ? r.qty : '');
          } else {
            row.push('', '');
          }
        });
        row.push(r.location);
        sheetData.push(row);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      // Set Merges for Title
      const totalCols = 2 + categorySubItems.length * 2 + 1;
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }
      ];

      // Merge model headers across Masuk & Keluar columns
      categorySubItems.forEach((_, i) => {
        const colIdx = 2 + i * 2;
        worksheet['!merges'].push({ s: { r: 2, c: colIdx }, e: { r: 2, c: colIdx + 1 } });
        worksheet['!merges'].push({ s: { r: 3, c: colIdx }, e: { r: 3, c: colIdx + 1 } });
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Pemakaian ${selectedCategory.name}`);
      XLSX.writeFile(workbook, `Daftar_Pemakaian_${selectedCategory.name}_${todayDate.replace(/\//g, '')}.xlsx`);

      showToast(`Daftar Pemakaian ${selectedCategory.name} berhasil di-export!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat export Excel', 'error');
    }
  };

  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;

      const doc = new jsPDF('landscape');
      
      doc.setFontSize(14);
      doc.text(`DAFTAR PEMAKAIAN ${selectedCategory.name.toUpperCase()}`, 14, 15);
      
      const todayDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
      doc.setFontSize(10);
      doc.text(`Update: ${todayDate}`, 14, 22);

      // We need multiple header rows for jspdf-autotable to mimic the nested layout.
      // Row 1: subItems names
      // Row 2: Sisa stock
      // Row 3: Masuk / Keluar

      const headRow1 = [{ content: 'No', rowSpan: 3 }, { content: 'Tanggal', rowSpan: 3 }];
      categorySubItems.forEach(item => {
        headRow1.push({ content: item.name, colSpan: 2, styles: { halign: 'center' } });
      });
      headRow1.push({ content: 'Lokasi Pemakaian', rowSpan: 3, styles: { halign: 'left' } });

      const headRow2 = [];
      categorySubItems.forEach(item => {
        headRow2.push({ content: `SISA STOCK ${item.stock}`, colSpan: 2, styles: { halign: 'center', textColor: [58, 149, 66] } });
      });

      const headRow3 = [];
      categorySubItems.forEach(() => {
        headRow3.push({ content: 'Masuk', styles: { halign: 'center', textColor: [22, 163, 74] } });
        headRow3.push({ content: 'Keluar', styles: { halign: 'center', textColor: [220, 38, 38] } });
      });

      const bodyRows = displayRows.map(r => {
        const row = [r.no, r.date];
        categorySubItems.forEach((item) => {
          const isMatch = checkIfRowMatchesItem(r.modelName, item, allCategorySubItems.length === 1);

          const masukVal = isMatch && r.isMasuk ? r.qty : '';
          const keluarVal = isMatch && r.isKeluar ? r.qty : '';
          row.push(masukVal, keluarVal);
        });
        row.push(r.location);
        return row;
      });

      autoTable(doc, {
        startY: 28,
        head: [headRow1, headRow2, headRow3],
        body: bodyRows,
        theme: 'grid',
        headStyles: { fillColor: [58, 149, 66], textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 20 },
          // the last column is variable index, we can just use styles to override halign 'left' for specific cells.
        },
        didParseCell: function(data) {
          // Last column alignment
          if (data.section === 'body' && data.column.index === data.row.cells.length - 1) {
            data.cell.styles.halign = 'left';
          }
        }
      });

      doc.save(`daftar_pemakaian_${selectedCategory.name}_${new Date().toISOString().slice(0,10)}.pdf`);
      showToast(`Daftar Pemakaian ${selectedCategory.name} berhasil di-export ke PDF!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat export PDF', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <Skeleton height="60px" borderRadius="12px" style={{ marginBottom: '16px' }} />
        <Skeleton height="350px" borderRadius="12px" />
      </div>
    );
  }

  const currentDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Category Selection & Search Action Bar */}
      <div className="neu-raised" style={{ 
        padding: '16px 22px', 
        borderRadius: '14px', 
        background: 'var(--color-bg)',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.9rem', color: 'var(--color-text)' }}>
            <Filter size={18} color="var(--color-primary)" />
            <span>Pilih Kategori:</span>
          </div>

          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="neu-inset"
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: '0.9rem',
              fontWeight: '700',
              outline: 'none',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="neu-inset" style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: '10px', width: '280px' }}>
            <Search size={16} color="var(--color-text-secondary)" style={{ marginRight: '8px' }} />
            <input
              type="text"
              placeholder="Cari lokasi pemakaian..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.85rem', color: 'var(--color-text)' }}
            />
          </div>
        </div>

        {allCategorySubItems.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px', width: '100%' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-text-secondary)', marginRight: '4px', alignSelf: 'center' }}>Filter Item:</span>
            <button
              onClick={() => setSelectedSubItemNames([])}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                background: selectedSubItemNames.length === 0 ? 'var(--color-primary)' : 'var(--color-bg)',
                color: selectedSubItemNames.length === 0 ? '#fff' : 'var(--color-text-secondary)',
                boxShadow: selectedSubItemNames.length === 0 ? '0 4px 10px rgba(58, 149, 66, 0.2)' : 'none',
                border: selectedSubItemNames.length === 0 ? 'none' : '1px solid rgba(0,0,0,0.1)'
              }}
            >
              Semua
            </button>
            {allCategorySubItems.map(item => (
              <button
                key={item.name}
                onClick={() => {
                  if (selectedSubItemNames.includes(item.name)) {
                    setSelectedSubItemNames(selectedSubItemNames.filter(n => n !== item.name));
                  } else {
                    setSelectedSubItemNames([...selectedSubItemNames, item.name]);
                  }
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: selectedSubItemNames.includes(item.name) ? '#2563eb' : 'var(--color-bg)',
                  color: selectedSubItemNames.includes(item.name) ? '#fff' : 'var(--color-text)',
                  boxShadow: selectedSubItemNames.includes(item.name) ? '0 4px 10px rgba(37, 99, 235, 0.2)' : 'none',
                  border: selectedSubItemNames.includes(item.name) ? 'none' : '1px solid rgba(0,0,0,0.1)'
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Excel-Style Usage Matrix Table Container */}
      <div className="neu-raised" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', background: '#FFFFFF' }}>
        
        {/* SPIL Green Banner Header */}
        <div style={{
          background: 'linear-gradient(135deg, #3a9542 0%, #297232 100%)',
          color: 'white',
          padding: '14px 24px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          fontWeight: '900',
          fontSize: '1.15rem',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          boxShadow: '0 3px 10px rgba(0,0,0,0.12)'
        }}>
          <span>DAFTAR PEMAKAIAN {selectedCategory.name.toUpperCase()}</span>
          <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontWeight: '700' }}>
            SPIL DENAH TRACKER
          </span>
        </div>

        {/* Update Date Bar */}
        <div style={{
          background: '#F8FAFC',
          padding: '8px 20px',
          borderBottom: '1px solid #E2E8F0',
          fontSize: '0.8rem',
          fontWeight: '700',
          color: '#475569',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          <span>Update Terakhir: <strong style={{ color: '#0F172A' }}>{currentDate}</strong></span>
          <span style={{ color: '#64748B', fontStyle: 'italic' }}>* Hijau: Barang Masuk (Stok Ditambahkan) | Merah: Barang Keluar (Stok Dipakai / Dipasang di Lokasi)</span>
        </div>

        {/* Table Container */}
        <div style={{ overflowX: 'auto', maxHeight: '620px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }}>
            <thead>
              {/* Row 1: Sub-Item Names */}
              <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
                <th rowSpan={3} style={{ width: '45px', padding: '10px', textAlign: 'center', borderRight: '1px solid #CBD5E1', fontWeight: '800', background: '#E2E8F0', color: '#0F172A' }}>
                  No
                </th>
                <th rowSpan={3} style={{ width: '85px', padding: '10px', textAlign: 'center', borderRight: '1px solid #CBD5E1', fontWeight: '800', background: '#E2E8F0', color: '#0F172A' }}>
                  Tanggal
                </th>

                {categorySubItems.map((item, idx) => (
                  <th key={idx} colSpan={2} style={{
                    padding: '10px', textAlign: 'center', fontWeight: '800',
                    borderRight: '1px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A',
                    fontSize: '0.85rem', minWidth: '130px'
                  }}>
                    {item.name}
                  </th>
                ))}

                <th rowSpan={3} style={{
                  padding: '10px 18px', textAlign: 'left', fontWeight: '800',
                  background: '#E2E8F0', color: '#0F172A', borderLeft: '1px solid #CBD5E1', minWidth: '240px'
                }}>
                  Lokasi Pemakaian
                </th>
              </tr>

              {/* Row 2: Sisa Stock Header */}
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>
                {categorySubItems.map((item, idx) => (
                  <th key={idx} colSpan={2} style={{
                    padding: '6px 8px', textAlign: 'center', fontWeight: '700',
                    borderRight: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569',
                    fontSize: '0.78rem'
                  }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748B' }}>Sisa Stock</span>
                    <div style={{
                      display: 'inline-block',
                      marginLeft: '6px',
                      padding: '1px 8px',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      fontWeight: '900',
                      background: item.stock > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: item.stock > 0 ? '#15803d' : '#b91c1c',
                      border: item.stock > 0 ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                      {item.stock}
                    </div>
                  </th>
                ))}
              </tr>

              {/* Row 3: Masuk / Keluar Subheaders */}
              <tr style={{ borderBottom: '2px solid #94A3B8' }}>
                {categorySubItems.map((_, idx) => (
                  <React.Fragment key={idx}>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: '800', background: '#dcfce7', color: '#15803d', borderRight: '1px solid #CBD5E1', width: '60px', fontSize: '0.75rem' }}>
                      Masuk
                    </th>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: '800', background: '#fee2e2', color: '#b91c1c', borderRight: '1px solid #CBD5E1', width: '60px', fontSize: '0.75rem' }}>
                      Keluar
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayRows.map((r, rowIdx) => {
                const isEven = rowIdx % 2 === 0;
                return (
                  <tr key={rowIdx} style={{
                    background: isEven ? '#FFFFFF' : '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    transition: 'background 0.15s ease'
                  }}>
                    {/* No */}
                    <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #E2E8F0', fontWeight: '700', color: '#64748B', background: isEven ? '#FFFFFF' : '#F8FAFC' }}>
                      {r.no}
                    </td>

                    {/* Tanggal */}
                    <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #E2E8F0', fontWeight: '600', color: '#334155', background: isEven ? '#FFFFFF' : '#F8FAFC' }}>
                      {r.date}
                    </td>

                    {/* Sub-item values */}
                    {categorySubItems.map((item, itemIdx) => {
                      const isMatch = checkIfRowMatchesItem(r.modelName, item, allCategorySubItems.length === 1);

                      const masukVal = isMatch && r.isMasuk ? r.qty : '';
                      const keluarVal = isMatch && r.isKeluar ? r.qty : '';

                      return (
                        <React.Fragment key={itemIdx}>
                          <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #F1F5F9', fontWeight: '700', color: '#16a34a', background: masukVal ? 'rgba(34, 197, 94, 0.1)' : 'transparent' }}>
                            {masukVal && (
                              <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '800' }}>
                                {masukVal}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #CBD5E1', fontWeight: '700', color: '#dc2626', background: keluarVal ? 'rgba(239, 68, 68, 0.1)' : 'transparent' }}>
                            {keluarVal && (
                              <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '800' }}>
                                {keluarVal}
                              </span>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* Lokasi Pemakaian */}
                    <td style={{ padding: '8px 14px', borderLeft: '1px solid #CBD5E1', color: '#1E293B', fontWeight: '600' }}>
                      {r.location}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CategoryUsageTracker;
