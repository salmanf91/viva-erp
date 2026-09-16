import { useState, useEffect } from 'react';
import api from '../api/client';

const DEFAULT_LABELS = {
  shawl_nighty: 'Shawl Nighty',
  shawl_nighty_lace: 'Shawl Nighty (With Lace)',
  ordinary_nighty: 'Ordinary Nighty',
  salwar_suit: 'Salwar Suit',
  mixed: 'Mixed Fabric'
};

const DEFAULT_COLORS = {
  shawl_nighty: '#6c63ff',
  ordinary_nighty: '#10b981',
  mixed: '#f59e0b',
  shawl_nighty_lace: '#06b6d4',
  salwar_suit: '#8b5cf6'
};

const COLOR_PALETTE = ['#6c63ff', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6'];

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ background: 'var(--light)', borderRadius: 6, height: 8, overflow: 'hidden', margin: '4px 0' }}>
      <div style={{ width: `${pct}%`, background: color || 'var(--accent)', height: '100%', borderRadius: 6, transition: 'width .4s' }} />
    </div>
  );
}

export default function StockPage() {
  const [tab, setTab]           = useState('overview');
  const [summary, setSummary]   = useState(null);
  const [byVendor, setByVendor] = useState([]);
  const [configs, setConfigs]   = useState([]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [hideLegacy, setHideLegacy]   = useState(true);
  const [searchFinished, setSearchFinished] = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/stock/summary').then(r => setSummary(r.data)),
      api.get('/stock/by-vendor').then(r => setByVendor(r.data)),
      api.get('/production/configs').then(r => setConfigs(r.data)).catch(() => []),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner">Loading stock overview…</div>;

  const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const isLegacyCat = cat => {
    const n = normalize(cat);
    return n.includes('nighty') || n === 'mixed' || n === 'mixedfabric';
  };

  const mapToRawMaterial = (cat) => {
    if (!cat) return 'Mixed Fabric';
    const norm = normalize(cat);
    const rm = (summary?.rawMaterials || []).find(r => normalize(r.name) === norm);
    if (rm) return rm.name;
    if (norm.includes('salwar')) return 'Mixed Fabric (Salwar)';
    if (norm.includes('nighty') || norm === 'shawlnighty' || norm === 'ordinarynighty') return 'Mixed Fabric (Nighty)';
    if (norm === 'mixed' || norm === 'mixedfabric') return 'Mixed Fabric';
    return cat;
  };

  const getLabel = (cat) => {
    if (!cat) return 'Mixed Fabric';
    const norm = normalize(cat);
    const rm = (summary?.rawMaterials || []).find(r => normalize(r.name) === norm);
    if (rm) return rm.name;
    const cfg = configs.find(c => normalize(c.category) === norm || normalize(c.name) === norm);
    if (cfg?.display_name || cfg?.name) return cfg.display_name || cfg.name;
    if (norm === 'mixedfabricsalwar') return 'Mixed Fabric (Salwar)';
    if (norm === 'mixedfabricnighty') return 'Mixed Fabric (Nighty)';
    if (norm === 'mixed' || norm === 'mixedfabric') return 'Mixed Fabric';
    return DEFAULT_LABELS[cat] || (cat.includes('(') ? cat : cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  };

  const getColor = (cat, idx = 0) => {
    if (DEFAULT_COLORS[cat]) return DEFAULT_COLORS[cat];
    return COLOR_PALETTE[idx % COLOR_PALETTE.length];
  };

  const get = (arr, cat) => {
    if (!arr || !cat) return 0;
    const targetNorm = normalize(cat);
    return (arr || [])
      .filter(r => {
        if (!r.category) return targetNorm === 'mixed' || targetNorm === 'mixedfabric';
        const rNorm = normalize(r.category);
        if (rNorm === targetNorm) return true;
        const mapped = mapToRawMaterial(r.category);
        if (mapped === cat || normalize(mapped) === targetNorm) return true;
        return false;
      })
      .reduce((sum, r) => sum + Number(r.qty || 0), 0);
  };

  // Discover all active categories from raw materials catalog, data and configs
  const rawSet = new Set();
  (summary?.rawMaterials || []).forEach(r => r.name && rawSet.add(mapToRawMaterial(r.name)));
  ['received', 'allocated', 'finished', 'sold'].forEach(key => {
    (summary?.[key] || []).forEach(r => r.category && rawSet.add(mapToRawMaterial(r.category)));
  });
  if (rawSet.size === 0) {
    rawSet.add('Mixed Fabric (Salwar)');
    rawSet.add('Mixed Fabric (Nighty)');
  }

  // Deduplicate by normalized key
  const uniqueCatsMap = new Map();
  for (const cat of Array.from(rawSet)) {
    const key = normalize(cat);
    if (!uniqueCatsMap.has(key)) {
      uniqueCatsMap.set(key, cat);
    }
  }
  const allRawCats = Array.from(uniqueCatsMap.values());

  // Build rows keyed by raw material
  const allRows = allRawCats.map((cat, idx) => {
    const rec      = get(summary?.received,  cat);
    const alloc    = get(summary?.allocated, cat); // In active production
    const totalFin = get(summary?.finished,  cat); // Total finished produced
    const sold     = get(summary?.sold,      cat);
    const fin      = Math.max(0, totalFin - sold); // Net finished goods on hand
    const used     = alloc + totalFin;
    const avail    = Math.max(0, rec - used); // Unallocated raw fabric remaining
    const color    = getColor(cat, idx);
    const label    = getLabel(cat);
    return { cat, label, color, rec, alloc, totalFin, sold, fin, used, avail };
  }).filter(r => r.rec > 0 || r.alloc > 0 || r.totalFin > 0 || r.sold > 0);

  // Global aggregate totals (aggregating accurately by category so unrelated sales don't cancel produced stock)
  const totalRec = (summary?.received || []).reduce((s, r) => s + Number(r.qty || 0), 0);
  const totalAlloc = (summary?.allocated || []).reduce((s, r) => s + Number(r.qty || 0), 0);
  const totalFinProduced = (summary?.finished || []).reduce((s, r) => s + Number(r.qty || 0), 0);
  const totalFinOnHand = allRows.reduce((s, r) => s + r.fin, 0);
  const totalCategorySold = allRows.reduce((s, r) => s + r.sold, 0);
  const totalAvail = allRows.reduce((s, r) => s + r.avail, 0);

  const totals = {
    rec: totalRec,
    alloc: totalAlloc,
    totalFin: totalFinProduced,
    sold: totalCategorySold,
    fin: totalFinOnHand,
    avail: totalAvail,
    used: totalAlloc + totalFinProduced
  };

  // Active rows based on hideLegacy (defaults to active salwar fabric)
  const activeRows = hideLegacy ? allRows.filter(r => !isLegacyCat(r.cat)) : allRows;

  // Filtered rows for Overview
  const filteredRows = selectedCat === 'all'
    ? activeRows
    : allRows.filter(r => normalize(r.cat) === normalize(selectedCat));

  const filteredTotals = {
    rec: filteredRows.reduce((s, r) => s + r.rec, 0),
    alloc: filteredRows.reduce((s, r) => s + r.alloc, 0),
    totalFin: filteredRows.reduce((s, r) => s + r.totalFin, 0),
    sold: filteredRows.reduce((s, r) => s + r.sold, 0),
    fin: filteredRows.reduce((s, r) => s + r.fin, 0),
    avail: filteredRows.reduce((s, r) => s + r.avail, 0),
    used: filteredRows.reduce((s, r) => s + r.used, 0),
  };

  // Shawl nighty active batch sub-breakdown (lace vs plain)
  const shawlPlain = get(summary?.shawlBreakdown, 'shawl_nighty');
  const shawlLace  = get(summary?.shawlBreakdown, 'shawl_nighty_lace');
  const finishedBreakdown = summary?.finishedBreakdown || [];

  const vendorGroups = byVendor.reduce((acc, row) => {
    const k = row.vendor_name || 'Unknown';
    if (!acc[k]) acc[k] = [];
    acc[k].push(row);
    return acc;
  }, {});

  // Filtered finished goods for tab 4
  const filteredFinished = finishedBreakdown.filter(item => {
    if (hideLegacy && isLegacyCat(item.category)) return false;
    const q = searchFinished.toLowerCase();
    const label = getLabel(item.category).toLowerCase();
    const size = (item.size || '').toLowerCase();
    return label.includes(q) || size.includes(q);
  });

  const finishedTotals = {
    fin: filteredFinished.reduce((s, it) => s + Number(it.on_hand_qty ?? Math.max(0, (it.produced_qty ?? it.qty ?? 0) - (it.sold_qty ?? 0))), 0),
    totalFin: filteredFinished.reduce((s, it) => s + Number(it.produced_qty ?? it.qty ?? 0), 0),
    sold: filteredFinished.reduce((s, it) => s + Number(it.sold_qty ?? 0), 0),
  };

  // Filtered sold dispatches log for tab 4
  const filteredSoldDetails = (summary?.soldDetails || []).filter(item => {
    if (hideLegacy && isLegacyCat(item.raw_material_name || item.category)) return false;
    return true;
  });

  return (
    <>
      {/* Tab Navigation & Legacy Filter Toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1.5px solid var(--border)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            ['overview', '📊 Overview & Utilisation'],
            ['category', '🗂️ Stock by Category'],
            ['vendor', '🏢 Stock by Vendor'],
            ['finished', '🏁 Finished Goods Inventory']
          ].map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 18px',
                fontWeight: 700,
                fontSize: 13,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                borderBottom: tab === t ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                color: tab === t ? 'var(--accent)' : 'var(--muted)',
                borderRadius: 0,
                transition: 'all 0.15s'
              }}
            >
              {label}
              {t === 'finished' && (
                <span className="badge b-green" style={{ marginLeft: 6, fontSize: 10 }}>{finishedTotals.fin} pcs</span>
              )}
            </button>
          ))}
        </div>

        {/* Closed / Legacy Filter Toggle */}
        <label style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 12,
          fontWeight: 600,
          color: hideLegacy ? 'var(--accent)' : 'var(--muted)',
          cursor: 'pointer',
          background: hideLegacy ? 'var(--accent-l)' : 'var(--surface)',
          padding: '6px 12px',
          borderRadius: 20,
          border: `1px solid ${hideLegacy ? 'var(--accent)' : 'var(--border)'}`,
          userSelect: 'none',
          marginBottom: 6
        }}>
          <input
            type="checkbox"
            checked={hideLegacy}
            onChange={e => setHideLegacy(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>🔒 Hide Closed Legacy Fabrics (Nighty &amp; Mixed)</span>
        </label>
      </div>

      {/* ── TAB 1: OVERVIEW & UTILISATION ── */}
      {tab === 'overview' && (
        <>
          {/* Top Stat Cards (responsive to selected raw material) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div className="stat s-accent">
              <div className="s-label">Total Fabric Received</div>
              <div className="s-val">{filteredTotals.rec}</div>
              <div className="s-sub">pcs from vendor purchases</div>
            </div>
            <div className="stat s-yellow">
              <div className="s-label">In Production (Active)</div>
              <div className="s-val">{filteredTotals.alloc}</div>
              <div className="s-sub">cutting / stitching in progress</div>
            </div>
            <div className="stat s-cyan">
              <div className="s-label">Finished (Produced)</div>
              <div className="s-val">{filteredTotals.totalFin}</div>
              <div className="s-sub">from completed batches</div>
            </div>
            <div className="stat s-yellow" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="s-label">Sold / Dispatched</div>
              <div className="s-val" style={{ color: '#d97706' }}>{filteredTotals.sold}</div>
              <div className="s-sub">invoiced via sales orders</div>
            </div>
            <div className="stat s-green">
              <div className="s-label">Finished Goods (On Hand)</div>
              <div className="s-val">{filteredTotals.fin}</div>
              <div className="s-sub">{filteredTotals.totalFin} prod. − {filteredTotals.sold} sold</div>
            </div>
            <div className="stat s-cyan" style={{ borderLeft: '4px solid #06b6d4' }}>
              <div className="s-label">Available Raw Fabric</div>
              <div className="s-val">{filteredTotals.avail}</div>
              <div className="s-sub">{filteredTotals.avail > 0 ? 'unallocated & ready to cut' : '0 pcs left (100% Allocated)'}</div>
            </div>
          </div>

          {/* Overall Stock Utilisation with Raw Material selector */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="card-hd" style={{ margin: 0 }}>Overall Stock Utilisation</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Tracking live fabric flow, production batches, and sales dispatches
                </div>
              </div>

              {/* Raw Material Selector Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Filter Raw Material:</span>
                <select
                  value={selectedCat}
                  onChange={e => setSelectedCat(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1.5px solid var(--border)',
                    fontSize: 13,
                    fontWeight: 600,
                    outline: 'none',
                    background: 'var(--white)',
                    color: 'var(--text)',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">🌐 {hideLegacy ? 'All Active Materials' : 'All Raw Materials'} ({activeRows.length})</option>
                  {activeRows.map(r => (
                    <option key={r.cat} value={r.cat}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fabric flow guide notice */}
            <div style={{ background: 'var(--accent-l)', border: '1px solid #c4b5fd', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--accent)' }}>
              <strong>📋 Stock Lifecycle Flow:</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 6 }}>
                <div><strong>1. Received:</strong> Raw fabric purchased from bills ({filteredTotals.rec} pcs).</div>
                <div><strong>2. In Production:</strong> Fabric active in cutting/stitching ({filteredTotals.alloc} pcs).</div>
                <div><strong>3. Produced:</strong> Completed batches ({filteredTotals.totalFin} pcs).</div>
                <div><strong>4. Sold / Dispatched:</strong> Invoiced sales ({filteredTotals.sold} pcs).</div>
                <div><strong>5. On Hand:</strong> Unsold finished goods ({filteredTotals.fin} pcs).</div>
                <div><strong>6. Available:</strong> Remaining unallocated raw fabric ({filteredTotals.avail} pcs).</div>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="empty-state">No stock data available for the selected raw material.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Raw Material</th>
                    <th style={{ textAlign: 'right' }}>Received</th>
                    <th style={{ textAlign: 'right' }}>In Prod. (Active)</th>
                    <th style={{ textAlign: 'right' }}>Finished Produced</th>
                    <th style={{ textAlign: 'right' }}>Sold / Dispatched</th>
                    <th style={{ textAlign: 'right' }}>Finished (On Hand)</th>
                    <th style={{ textAlign: 'right' }}>Available Fabric</th>
                    <th style={{ textAlign: 'right' }}>Utilisation %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(({ cat, label, color, rec, alloc, totalFin, sold, fin, used, avail }) => (
                    <tr key={cat}>
                      <td>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 8 }} />
                        <strong>{label}</strong>
                        {cat === 'shawl_nighty' && alloc > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
                            ({shawlPlain} plain · {shawlLace} lace in prod.)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{rec} pcs</td>
                      <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 700 }}>{alloc} pcs</td>
                      <td style={{ textAlign: 'right', color: '#0891b2', fontWeight: 700 }}>{totalFin} pcs</td>
                      <td style={{ textAlign: 'right', color: '#d97706', fontWeight: 700 }}>{sold} pcs</td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 800 }}>{fin} pcs</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`badge ${avail > 0 ? 'b-green' : 'b-gray'}`}>{avail} pcs left</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <div style={{ width: 80 }}>
                            <ProgressBar value={used} max={rec} color={color} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', minWidth: 36 }}>
                            {rec > 0 ? Math.min(100, Math.round((used / rec) * 100)) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {selectedCat === 'all' && (
                    <tr style={{ fontWeight: 800, borderTop: '2px solid var(--border)', background: 'var(--bg-card2)' }}>
                      <td>Total</td>
                      <td style={{ textAlign: 'right' }}>{filteredTotals.rec} pcs</td>
                      <td style={{ textAlign: 'right', color: '#f59e0b' }}>{filteredTotals.alloc} pcs</td>
                      <td style={{ textAlign: 'right', color: '#0891b2' }}>{filteredTotals.totalFin} pcs</td>
                      <td style={{ textAlign: 'right', color: '#d97706' }}>{filteredTotals.sold} pcs</td>
                      <td style={{ textAlign: 'right', color: '#10b981' }}>{filteredTotals.fin} pcs</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`badge ${filteredTotals.avail > 0 ? 'b-green' : 'b-gray'}`}>{filteredTotals.avail} pcs</span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                        {filteredTotals.rec > 0 ? Math.min(100, Math.round((filteredTotals.used / filteredTotals.rec) * 100)) : 0}%
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── TAB 2: STOCK BY CATEGORY ── */}
      {tab === 'category' && (
        <div className="card">
          <div className="card-hd">Stock by Category Breakdown</div>
          {activeRows.length === 0 ? (
            <div className="empty-state">No category stock data yet. Add purchases to begin.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
              {activeRows.map(({ cat, label, color, rec, alloc, totalFin, sold, fin, used, avail }) => (
                <div key={cat} style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${color}`, borderRadius: 10, padding: 16, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontWeight: 800, fontSize: 16 }}>{label}</span>
                    <span className={`badge ${avail > 0 ? 'b-green' : avail === 0 ? 'b-gray' : 'b-red'}`}>
                      {avail} unallocated fabric left
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1.5fr', gap: 10, marginBottom: 12, background: 'var(--bg-card2)', padding: 10, borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Received</div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>{rec}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>In Prod. (Active)</div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#f59e0b' }}>{alloc}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Finished (On Hand)</div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#10b981' }}>{fin}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>({totalFin} prod. · {sold} sold)</div>
                    </div>
                  </div>

                  <ProgressBar value={used} max={rec} color={color} />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{rec > 0 ? Math.round((used / rec) * 100) : 0}% fabric utilised ({used}/{rec} pcs)</span>
                    <span>{avail} pcs ready to allocate</span>
                  </div>

                  {/* Shawl sub-breakdown: lace vs plain */}
                  {cat === 'shawl_nighty' && alloc > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {shawlPlain > 0 && (
                        <span style={{ background: 'var(--accent-l)', color: 'var(--accent)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
                          ✂️ {shawlPlain} pcs → Plain in active prod.
                        </span>
                      )}
                      {shawlLace > 0 && (
                        <span style={{ background: 'var(--cyan-l)', color: 'var(--cyan)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
                          ✨ {shawlLace} pcs → With Lace in active prod.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: STOCK BY VENDOR ── */}
      {tab === 'vendor' && (
        <div className="card">
          <div className="card-hd">Stock Received by Vendor</div>
          {byVendor.length === 0 ? (
            <div className="empty-state">No vendor purchase data found.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {Object.entries(vendorGroups).map(([vendor, items]) => {
                const vendorTotal = items.reduce((s, r) => s + Number(r.received), 0);
                return (
                  <div key={vendor} style={{ borderRadius: 10, border: '1px solid var(--border)', background: '#fff', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 15 }}>🏢 {vendor}</span>
                      <span className="badge b-accent">{vendorTotal} pcs total</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {items.map((row, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: i < items.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                          <span style={{ color: 'var(--muted)' }}>{getLabel(row.category)}</span>
                          <span style={{ fontWeight: 700 }}>{row.received} pcs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: FINISHED GOODS INVENTORY ── */}
      {tab === 'finished' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="card-hd" style={{ margin: 0 }}>🏁 Finished Goods Ready Inventory</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Manufactured garments ready for sale, organized by Product Category &amp; Size.
              </div>
            </div>

            {/* Search Input for fast scalability */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                placeholder="🔍 Search product or size..."
                value={searchFinished}
                onChange={e => setSearchFinished(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border)',
                  fontSize: 13,
                  outline: 'none',
                  minWidth: 220
                }}
              />
            </div>
          </div>

          {/* Metrics summary */}
          <div className="g3 mb16">
            <div className="stat s-green" style={{ padding: '12px 16px' }}>
              <div className="s-label">Ready On Hand</div>
              <div className="s-val" style={{ fontSize: 22 }}>{finishedTotals.fin} pcs</div>
              <div className="s-sub">available to dispatch</div>
            </div>
            <div className="stat s-accent" style={{ padding: '12px 16px' }}>
              <div className="s-label">Total Produced</div>
              <div className="s-val" style={{ fontSize: 22 }}>{finishedTotals.totalFin} pcs</div>
              <div className="s-sub">from completed batches</div>
            </div>
            <div className="stat s-yellow" style={{ padding: '12px 16px' }}>
              <div className="s-label">Total Sold</div>
              <div className="s-val" style={{ fontSize: 22 }}>{finishedTotals.sold} pcs</div>
              <div className="s-sub">delivered to customers</div>
            </div>
          </div>

          {filteredFinished.length === 0 ? (
            <div className="empty-state">
              {searchFinished ? 'No finished goods match your search.' : 'No finished goods inventory recorded yet. Finish a production batch to add goods.'}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product Category</th>
                  <th>Size / Variation</th>
                  <th style={{ textAlign: 'right' }}>Total Produced</th>
                  <th style={{ textAlign: 'right' }}>Total Sold</th>
                  <th style={{ textAlign: 'right' }}>On-Hand Available</th>
                  <th style={{ textAlign: 'center' }}>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredFinished.map((item, idx) => {
                  const produced = Number(item.produced_qty ?? item.qty ?? 0);
                  const sold = Number(item.sold_qty ?? 0);
                  const available = Number(item.on_hand_qty ?? Math.max(0, produced - sold));
                  const isLow = available > 0 && available <= 10;
                  const isOut = available <= 0;

                  return (
                    <tr key={idx}>
                      <td>
                        <strong style={{ fontSize: 13 }}>{getLabel(item.category)}</strong>
                      </td>
                      <td>
                        {item.size ? (
                          <span className="badge" style={{ fontSize: 11, background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', fontWeight: 700 }}>
                            📏 {item.size}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Standard / Free Size</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0891b2' }}>
                        {produced} pcs
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#d97706' }}>
                        {sold} pcs
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: isOut ? 'var(--red)' : isLow ? 'var(--yellow)' : 'var(--green)' }}>
                        {available} pcs
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${isOut ? 'b-red' : isLow ? 'b-yellow' : 'b-green'}`}>
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Itemized Sales Dispatches Log */}
          <div style={{ marginTop: 24, borderTop: '1.5px solid var(--border)', paddingTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>📦 Sales Orders &amp; Sold Fabrics Log</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Direct breakdown of all invoiced sales and dispatches across product lines
                </div>
              </div>
              <span className="badge b-yellow" style={{ fontSize: 12, padding: '4px 10px' }}>
                Total Invoiced Sold: {filteredSoldDetails.reduce((s, it) => s + Number(it.quantity || 0), 0)} pcs
              </span>
            </div>

            {filteredSoldDetails.length === 0 ? (
              <div className="empty-state">No sales orders or dispatched goods recorded for active product lines yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Customer / Client</th>
                    <th>Product / Item Name</th>
                    <th style={{ textAlign: 'right' }}>Sold Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate / Pc</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSoldDetails.map((s, idx) => (
                    <tr key={s.order_id ? `${s.order_id}_${idx}` : idx}>
                      <td><strong>{s.invoice_number || `INV-${s.order_id}`}</strong></td>
                      <td style={{ color: 'var(--muted)' }}>
                        {s.order_date ? new Date(s.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td>{s.client_name || 'Direct Client'}</td>
                      <td>
                        <span className="badge" style={{ background: '#f3e8ff', color: '#7e22ce', fontWeight: 600 }}>
                          {s.item_name || getLabel(s.category)}
                        </span>
                        {s.item_name && s.category && s.item_name !== s.category && (
                          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>({getLabel(s.category)})</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#d97706' }}>
                        {s.quantity} pcs
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                        ₹{Number(s.rate_per_pc || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                        ₹{(Number(s.quantity || 0) * Number(s.rate_per_pc || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${s.status === 'paid' ? 'b-green' : s.status === 'partial' ? 'b-yellow' : 'b-gray'}`}>
                          {s.status ? s.status.toUpperCase() : 'COMPLETED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
