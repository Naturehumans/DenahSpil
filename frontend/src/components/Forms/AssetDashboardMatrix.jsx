import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getBuildings } from '../../api/buildings';
import { getCategories } from '../../api/categories';
import { getAllEquipments } from '../../api/equipments';
import { getAllSlots } from '../../api/slots';
import { getInventoryLogs, getAssets } from '../../api/inventory';
import { useToast } from '../../contexts/ToastContext';
import { RefreshCw, Search, FileSpreadsheet } from 'lucide-react';
import Skeleton from '../UI/Skeleton';

const AssetDashboardMatrix = ({ onRegisterExport }) => {
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [logs, setLogs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBuildings, setExpandedBuildings] = useState({});
  const { showToast } = useToast();

  useEffect(() => {
    loadMatrixData();
  }, []);

  useEffect(() => {
    if (onRegisterExport) {
      onRegisterExport(handleExportXLSX);
    }
  }, []);

  const loadMatrixData = async () => {
    setLoading(true);
    try {
      const [bRes, cRes, eRes, sRes, lRes, aRes] = await Promise.all([
        getBuildings().catch(() => []),
        getCategories().catch(() => []),
        getAllEquipments().catch(() => []),
        getAllSlots().catch(() => []),
        getInventoryLogs().catch(() => []),
        getAssets('available').catch(() => [])
      ]);
      setBuildings(Array.isArray(bRes) ? bRes : []);
      setCategories(Array.isArray(cRes) ? cRes : []);
      setEquipments(Array.isArray(eRes) ? eRes : []);
      setSlots(Array.isArray(sRes) ? sRes : []);
      setLogs(Array.isArray(lRes) ? lRes : []);
      setAssets(Array.isArray(aRes) ? aRes : []);
    } catch (err) {
      showToast('Gagal memuat data Dashboard Aset', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Category Extraction: merge registered categories with any category attached to equipments & slots
  const categoryMap = new Map();
  categories.forEach(c => {
    if (c && c.id) categoryMap.set(c.id, c);
  });
  equipments.forEach(eq => {
    if (eq.category && eq.category.id && !categoryMap.has(eq.category.id)) {
      categoryMap.set(eq.category.id, eq.category);
    }
  });
  slots.forEach(s => {
    const cat = s.category || s.equipment?.category;
    if (cat && cat.id && !categoryMap.has(cat.id)) {
      categoryMap.set(cat.id, cat);
    }
  });
  const displayCategories = Array.from(categoryMap.values());

  // Build rows (Locations / Buildings & Floors)
  const locationMap = new Map();

  const registerLocation = (bName, fName) => {
    if (!bName) return null;
    const cleanB = bName.trim();
    const cleanF = (fName && fName !== '-' && fName !== 'null') ? fName.trim() : '';
    const key = cleanF ? `${cleanB} (${cleanF})` : cleanB;
    if (!locationMap.has(key)) {
      locationMap.set(key, { id: key, name: key, buildingName: cleanB, floorName: cleanF });
    }
    return key;
  };

  buildings.forEach(b => {
    if (b.floors && b.floors.length > 0) {
      b.floors.forEach(f => {
        registerLocation(b.name, f.name);
      });
    } else {
      registerLocation(b.name, '');
    }
  });

  equipments.forEach(eq => {
    const bName = eq.floor?.building?.name || eq.building_name || 'Gedung Utama';
    const fName = eq.floor?.name || eq.floor_name || '';
    registerLocation(bName, fName);
  });

  slots.forEach(s => {
    const bName = s.floor?.building?.name || s.building_name || 'Spil Mengajar';
    const fName = s.floor?.name || s.floor_name || '';
    registerLocation(bName, fName);
  });

  const locations = Array.from(locationMap.values());

  const filteredLocations = locations.filter(loc => {
    if (searchQuery && !(loc.name || '').toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Clean up empty base building names if specific floor entries exist for that building
    if (!loc.floorName && locations.some(other => other.buildingName === loc.buildingName && other.floorName)) {
      return false;
    }
    return true;
  });

  const matrix = {};
  filteredLocations.forEach(loc => {
    matrix[loc.name] = {};
    displayCategories.forEach(cat => {
      matrix[loc.name][cat.id] = 0;
    });
  });

  const countedEquipmentIds = new Set();

  equipments.forEach(eq => {
    if (eq.id) countedEquipmentIds.add(String(eq.id));
    const bName = eq.floor?.building?.name || eq.building_name || 'Gedung Utama';
    const fName = eq.floor?.name || eq.floor_name || '';
    const cleanB = bName.trim();
    const cleanF = (fName && fName !== '-' && fName !== 'null') ? fName.trim() : '';
    const key = cleanF ? `${cleanB} (${cleanF})` : cleanB;
    const catId = eq.category_id || eq.category?.id;

    if (matrix[key] && catId && matrix[key][catId] !== undefined) {
      matrix[key][catId] += 1;
    }
  });

  slots.forEach(s => {
    // Avoid double counting if slot equipment is already in equipments array
    if (s.equipment_id && countedEquipmentIds.has(String(s.equipment_id))) {
      return;
    }
    const bName = s.floor?.building?.name || s.building_name || 'Spil Mengajar';
    const fName = s.floor?.name || s.floor_name || '';
    const cleanB = bName.trim();
    const cleanF = (fName && fName !== '-' && fName !== 'null') ? fName.trim() : '';
    const key = cleanF ? `${cleanB} (${cleanF})` : cleanB;
    const catId = s.category_id || s.category?.id || s.equipment?.category_id || s.equipment?.category?.id;

    if (matrix[key] && catId && matrix[key][catId] !== undefined) {
      matrix[key][catId] += 1;
    }
  });

  const categoryTotals = {};
  displayCategories.forEach(cat => {
    categoryTotals[cat.id] = filteredLocations.reduce((sum, loc) => sum + (matrix[loc.name]?.[cat.id] || 0), 0);
  });

  const locationTotals = {};
  filteredLocations.forEach(loc => {
    locationTotals[loc.name] = displayCategories.reduce((sum, cat) => sum + (matrix[loc.name]?.[cat.id] || 0), 0);
  });

  const grandTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  // --- Pivot Table Data Preparation ---
  const buildingsMap = new Map();
  filteredLocations.forEach(loc => {
    if (!buildingsMap.has(loc.buildingName)) {
      buildingsMap.set(loc.buildingName, {
        name: loc.buildingName,
        floors: [],
        isOnlyBuilding: false
      });
    }
    if (loc.floorName) {
      buildingsMap.get(loc.buildingName).floors.push(loc);
    } else {
      buildingsMap.get(loc.buildingName).isOnlyBuilding = true;
      buildingsMap.get(loc.buildingName).floors.push(loc);
    }
  });
  const groupedBuildings = Array.from(buildingsMap.values());

  const buildingMatrix = {};
  groupedBuildings.forEach(bldg => {
    buildingMatrix[bldg.name] = {};
    displayCategories.forEach(cat => {
      buildingMatrix[bldg.name][cat.id] = 0;
      bldg.floors.forEach(floorLoc => {
        buildingMatrix[bldg.name][cat.id] += (matrix[floorLoc.name]?.[cat.id] || 0);
      });
    });
  });

  const buildingTotals = {};
  groupedBuildings.forEach(bldg => {
    buildingTotals[bldg.name] = 0;
    bldg.floors.forEach(floorLoc => {
      buildingTotals[bldg.name] += (locationTotals[floorLoc.name] || 0);
    });
  });
  // ------------------------------------

  // Top Location with most assets
  let topLocationName = '-';
  let maxCount = 0;
  Object.entries(locationTotals).forEach(([locName, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topLocationName = locName;
    }
  });

  // Lowest Stock Category in Warehouse (Peringatan Stok Tipis)
  let lowestStockCategoryName = '-';
  let minStockCount = Infinity;

  displayCategories.forEach(cat => {
    let catStock = cat.initial_stock || 0;
    
    // Add available assets for this category
    const catAssets = assets.filter(a => String(a.category_id) === String(cat.id));
    catStock += catAssets.length;

    if (catStock < minStockCount) {
      minStockCount = catStock;
      lowestStockCategoryName = cat.name;
    }
  });

  if (minStockCount === Infinity) minStockCount = 0;


  // Export Matrix Table to XLSX (Excel format matching user layout)
  const handleExportXLSX = () => {
    try {
      const sheetData = [];

      // Banner Row (Row 1)
      sheetData.push(['DASHBOARD ASET']);
      
      // Empty Spacing Row (Row 2)
      sheetData.push([]);

      // Table Header (Row 3)
      const headerRow = ['Jenis Aset', ...displayCategories.map(c => c.name), 'Total'];
      sheetData.push(headerRow);

      // Data Rows (Rows 4+)
      filteredLocations.forEach(loc => {
        const row = [
          loc.name,
          ...displayCategories.map(cat => matrix[loc.name]?.[cat.id] || 0),
          locationTotals[loc.name] || 0
        ];
        sheetData.push(row);
      });

      // Bottom Total Row
      const totalRow = [
        'Total',
        ...displayCategories.map(cat => categoryTotals[cat.id] || 0),
        grandTotal
      ];
      sheetData.push(totalRow);

      // Create Worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      // Merge Title Header Row across all columns
      const totalCols = headerRow.length;
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }
      ];

      // Set column widths dynamically
      const colWidths = headerRow.map((colName, index) => {
        if (index === 0) return { wch: 28 };
        return { wch: Math.max(colName.length + 5, 12) };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Dashboard Aset');

      XLSX.writeFile(workbook, `Dashboard_Aset_SpilDenah_${new Date().toISOString().slice(0,10)}.xlsx`);
      showToast('Dashboard Aset berhasil di-export ke format Excel (.xlsx)', 'success');
    } catch (err) {
      console.error('XLSX Export Error:', err);
      showToast('Gagal memuat export Excel', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <Skeleton height="80px" borderRadius="12px" style={{ marginBottom: '16px' }} />
        <Skeleton height="350px" borderRadius="12px" />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls Bar (Search Bar & Actions) ABOVE Summary Cards */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="neu-inset" style={{ display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: '12px', background: 'var(--color-bg)', width: '320px', height: '42px', boxSizing: 'border-box' }}>
            <Search size={18} color="var(--color-text-muted)" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Cari nama lokasi / area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem', color: 'var(--color-text)' }}
            />
          </div>
        </div>


      </div>

      {/* Summary Cards Section (5 Cards Grid) - BELOW Searchbar & Dynamic to Filter */}
      <div className="hide-on-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div className="neu-raised" style={{ padding: '14px 18px', borderRadius: '14px', background: 'var(--color-bg)' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Area / Lokasi
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-text-primary)' }}>
            {filteredLocations.length} <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Lokasi</span>
          </p>
        </div>

        <div className="neu-raised" style={{ padding: '14px 18px', borderRadius: '14px', background: 'var(--color-bg)' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Aset Terpasang
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-primary)' }}>
            {grandTotal} <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Item</span>
          </p>
        </div>

        <div className="neu-raised" style={{ padding: '14px 18px', borderRadius: '14px', background: 'var(--color-bg)' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Kategori Aset
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#2563eb' }}>
            {displayCategories.length} <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Kategori</span>
          </p>
        </div>

        <div className="neu-raised" style={{ padding: '14px 18px', borderRadius: '14px', background: 'var(--color-bg)' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Area Terbanyak
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '1.05rem', fontWeight: '800', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {topLocationName} <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-primary)' }}>({maxCount} item)</span>
          </p>
        </div>

        <div className="neu-raised" style={{ padding: '14px 18px', borderRadius: '14px', background: 'var(--color-bg)' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Peringatan Stok Tipis
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '1.05rem', fontWeight: '800', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lowestStockCategoryName} <span style={{ fontSize: '0.8rem', fontWeight: '600', color: minStockCount === 0 ? '#dc2626' : '#d97706' }}>({minStockCount} item)</span>
          </p>
        </div>
      </div>

      {/* Main Asset Dashboard Matrix Table */}
      <div className="neu-raised" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}>
        {/* SPIL Green Banner Header matching app color palette */}
        <div style={{
          background: 'linear-gradient(135deg, #3a9542 0%, #2d7a34 100%)',
          color: 'white',
          padding: '14px 20px',
          display: 'flex',
          justify: 'center',
          alignItems: 'center',
          fontWeight: '800',
          fontSize: '1.05rem',
          letterSpacing: '0.5px'
        }}>
          DASHBOARD ASET (REKAP KESELURUHAN LOKASI)
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '550px', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', fontFamily: 'Inter, sans-serif', minWidth: '600px' }}>
            <thead>
              <tr style={{ background: '#2d7a34', color: 'white' }}>
                <th style={{
                  padding: '12px 16px', textAlign: 'left', fontWeight: '700',
                  borderRight: '1px solid rgba(255,255,255,0.2)'
                }}>
                  Jenis Aset
                </th>

                {displayCategories.map(cat => (
                  <th key={cat.id} style={{
                    padding: '12px 14px', textAlign: 'center', fontWeight: '700',
                    borderRight: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap'
                  }}>
                    {cat.name}
                  </th>
                ))}

                <th style={{
                  padding: '12px 16px', textAlign: 'center', fontWeight: '800',
                  borderLeft: '1px solid rgba(255,255,255,0.2)'
                }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedBuildings.length === 0 ? (
                <tr>
                  <td colSpan={displayCategories.length + 2} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    Tidak ada lokasi / area yang ditemukan.
                  </td>
                </tr>
              ) : (
                groupedBuildings.map((bldg, idx) => {
                  const bldgTotal = buildingTotals[bldg.name] || 0;
                  const isExpanded = expandedBuildings[bldg.name];
                  const hasRealFloors = bldg.floors.length > 0 && !bldg.isOnlyBuilding;
                  const isEven = idx % 2 === 0;
                  
                  return (
                    <React.Fragment key={bldg.name}>
                      <tr 
                        onClick={() => {
                          if (hasRealFloors) {
                            setExpandedBuildings(prev => ({
                              ...prev,
                              [bldg.name]: !prev[bldg.name]
                            }));
                          }
                        }} 
                        style={{ 
                          background: isEven ? '#FAFAFA' : '#FFFFFF', 
                          borderBottom: '1px solid #E2E8F0', 
                          cursor: hasRealFloors ? 'pointer' : 'default' 
                        }}
                      >
                        <td style={{
                          padding: '11px 16px', fontWeight: '800', color: '#1E293B',
                          borderRight: '2px solid #E2E8F0', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                          {hasRealFloors ? (
                            <span style={{ 
                              display: 'inline-block',
                              fontSize: '10px', 
                              transition: 'transform 0.2s', 
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' 
                            }}>
                              ▶
                            </span>
                          ) : <span style={{ width: '10px' }}></span>}
                          {bldg.name}
                        </td>
                        
                        {displayCategories.map(cat => {
                          const count = buildingMatrix[bldg.name]?.[cat.id] || 0;
                          return (
                            <td key={cat.id} style={{
                              padding: '10px 12px', textAlign: 'center',
                              fontWeight: count > 0 ? '800' : '500',
                              color: count > 0 ? '#0F172A' : '#94A3B8',
                              background: count > 0 ? 'rgba(58, 149, 66, 0.08)' : 'transparent',
                              borderRight: '1px solid #F1F5F9'
                            }}>
                              {count}
                            </td>
                          );
                        })}
                        
                        <td style={{
                          padding: '10px 14px', textAlign: 'center', fontWeight: '800',
                          color: 'var(--color-primary)', background: isEven ? '#F1F5F9' : '#F8FAFC',
                          borderLeft: '2px solid #E2E8F0'
                        }}>
                          {bldgTotal}
                        </td>
                      </tr>
                      
                      {isExpanded && hasRealFloors && bldg.floors.map((floorLoc, fIdx) => {
                        const locTotal = locationTotals[floorLoc.name] || 0;
                        return (
                          <tr key={floorLoc.name} style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                            <td style={{
                              padding: '10px 16px 10px 36px', fontWeight: '600', color: '#475569',
                              borderRight: '2px solid #E2E8F0', whiteSpace: 'nowrap', fontSize: '0.8rem',
                              display: 'flex', alignItems: 'center'
                            }}>
                              <span style={{ width: '12px', height: '12px', borderLeft: '2px solid #CBD5E1', borderBottom: '2px solid #CBD5E1', marginRight: '8px', marginTop: '-12px' }}></span>
                              {floorLoc.floorName || 'Tanpa Lantai'}
                            </td>
                            {displayCategories.map(cat => {
                              const count = matrix[floorLoc.name]?.[cat.id] || 0;
                              return (
                                <td key={cat.id} style={{
                                  padding: '8px 12px', textAlign: 'center',
                                  fontWeight: count > 0 ? '600' : '400', fontSize: '0.8rem',
                                  color: count > 0 ? '#334155' : '#94A3B8',
                                  borderRight: '1px solid #F1F5F9'
                                }}>
                                  {count}
                                </td>
                              );
                            })}
                            <td style={{
                              padding: '8px 14px', textAlign: 'center', fontWeight: '700', fontSize: '0.8rem',
                              color: '#334155', borderLeft: '2px solid #E2E8F0'
                            }}>
                              {locTotal}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(58, 149, 66, 0.12)', borderTop: '2px solid #3a9542' }}>
                <td style={{
                  padding: '13px 16px', fontWeight: '800', color: '#1b5e20',
                  borderRight: '2px solid rgba(58, 149, 66, 0.25)', fontSize: '0.9rem'
                }}>
                  Total
                </td>

                {displayCategories.map(cat => (
                  <td key={cat.id} style={{
                    padding: '13px 12px', textAlign: 'center', fontWeight: '800',
                    color: '#1b5e20',
                    borderRight: '1px solid rgba(58, 149, 66, 0.2)', fontSize: '0.9rem'
                  }}>
                    {categoryTotals[cat.id] || 0}
                  </td>
                ))}

                <td style={{
                  padding: '13px 16px', textAlign: 'center', fontWeight: '900',
                  color: '#1b5e20',
                  borderLeft: '2px solid #3a9542', fontSize: '1rem'
                }}>
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AssetDashboardMatrix;
