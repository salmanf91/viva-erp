import { useState, useEffect } from 'react';
import api from '../api/client';

const DEFAULT_LABELS = {
  shawl_nighty: 'Shawl Nighty',
  shawl_nighty_lace: 'Shawl Nighty (With Lace)',
  ordinary_nighty: 'Ordinary Nighty',
  mixed: 'Mixed Fabric'
};

const DEFAULT_COLORS = {
  shawl_nighty: '#6c63ff',
  ordinary_nighty: '#10b981',
  mixed: '#f59e0b',
  shawl_nighty_lace: '#06b6d4'
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
  const [summary, setSummary]   = useState(null);
  const [byVendor, setByVendor] = useState([]);
  const [configs, setConfigs]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/stock/summary').then(r => setSummary(r.data)),
      api.get('/stock/by-vendor').then(r => setByVendor(r.data)),
      api.get('/production/configs').then(r => setConfigs(r.data)).catch(() => []),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner">Loading stock overview…</div>;

  const getLabel = (cat) => {
    if (!cat) return 'Mixed';
    const cfg = configs.find(c => (c.category || '').toLowerCase() === cat.toLowerCase());
    if (cfg?.display_name || cfg?.name) return cfg.display_name || cfg.name;
    return DEFAULT_LABELS[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getColor = (cat, idx = 0) => {
    if (DEFAULT_COLORS[cat]) return DEFAULT_COLORS[cat];
    return COLOR_PALETTE[idx % COLOR_PALETTE.length];
  };

  const normalize = s => (s || '').toLowerCase().replace(/[\s_-]+/g, '');

  const get = (arr, cat) => {
    if (!arr || !cat) return 0;
    const target = normalize(cat);
    const found = arr.find(r => normalize(r.category) === target);
    return Number(found?.qty || 0);
  };

  // Discover all active categories from data and configs
  const rawSet = new Set([
    'shawl_nighty',
    'ordinary_nighty',
    ...(configs || []).map(c => c.category),
    ...(summary?.received || []).map(r => r.category),
    ...(summary?.allocated || []).map(r => r.category),
    ...(summary?.finished || []).map(r => r.category),
  ].filter(Boolean));

  const allRawCats = Array.from(rawSet);

  // Build rows keyed by raw material
  const rows = allRawCats.map((cat, idx) => {
    const rec      = get(summary?.received,  cat);
    const alloc    = get(summary?.allocated, cat); // In active production
    const totalFin = get(summary?.finished,  cat); // Total finished produced
    const sold     = get(summary?.sold,      cat);
    const fin      = Math.max(0, totalFin - sold); // Net finished goods on hand
    const used     = alloc + totalFin;
    const avail    = Math.max(0, rec - used);      // Unallocated raw fabric remaining
    const color    = getColor(cat, idx);
    const label    = getLabel(cat);
    return { cat, label, color, rec, alloc, totalFin, sold, fin, used, avail };
  }).filter(r => r.rec > 0 || r.alloc > 0 || r.totalFin > 0);

  const totals = rows.reduce(
    (a, r) => ({
      rec: a.rec + r.rec,
      alloc: a.alloc + r.alloc,
      totalFin: a.totalFin + r.totalFin,
      sold: a.sold + r.sold,
      fin: a.fin + r.fin,
      used: a.used + r.used,
      avail: a.avail + r.avail
    }),
    { rec: 0, alloc: 0, totalFin: 0, sold: 0, fin: 0, used: 0, avail: 0 }
  );

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

  return (
    <>
      {/* Stat cards */}
      <div className="g4 mb16">
        <div className="stat s-accent">
          <div className="s-label">Total Fabric Received</div>
          <div className="s-val">{totals.rec}</div>
          <div className="s-sub">pcs from fabric purchases</div>
        </div>
        <div className="stat s-yellow">
          <div className="s-label">In Production (Active)</div>
          <div className="s-val">{totals.alloc}</div>
          <div className="s-sub">currently being cut / stitched</div>
        </div>
        <div className="stat s-green">
          <div className="s-label">Finished Goods (On Hand)</div>
          <div className="s-val">{totals.fin}</div>
          <div className="s-sub">{totals.totalFin} produced · {totals.sold} sold</div>
        </div>
        <div className="stat s-cyan">
          <div className="s-label">Available Raw Fabric</div>
          <div className="s-val">{totals.avail}</div>
          <div className="s-sub">unallocated & ready to cut</div>
        </div>
      </div>

      <div className="g2">
        {/* Stock by raw material */}
        <div className="card">
          <div className="card-hd">Stock by Category</div>
          {rows.length === 0 ? (
            <div className="empty-state">No stock data yet. Add purchases to begin.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {rows.map(({ cat, label, color, rec, alloc, totalFin, sold, fin, used, avail }) => (
                <div key={cat} style={{ borderLeft: `3px solid ${color}`, paddingLeft: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{label}</span>
                    <span className={`badge ${avail > 0 ? 'b-green' : avail === 0 ? 'b-gray' : 'b-red'}`}>
                      {avail} raw fabric left
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1.5fr', gap: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Received</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{rec}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>In Prod.</div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: '#f59e0b' }}>{alloc}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Finished (On Hand)</div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: '#10b981' }}>{fin}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>({totalFin} prod. · {sold} sold)</div>
                    </div>
                  </div>

                  <ProgressBar value={used} max={rec} color={color} />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{rec > 0 ? Math.round((used / rec) * 100) : 0}% fabric utilised ({used}/{rec} pcs)</span>
                    <span>{avail} pcs unallocated</span>
                  </div>

                  {/* Shawl sub-breakdown: lace vs plain */}
                  {cat === 'shawl_nighty' && alloc > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {shawlPlain > 0 && (
                        <span style={{ background: 'var(--accent-l)', color: 'var(--accent)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          ✂️ {shawlPlain} pcs → Plain in prod.
                        </span>
                      )}
                      {shawlLace > 0 && (
                        <span style={{ background: 'var(--cyan-l)', color: 'var(--cyan)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          ✨ {shawlLace} pcs → With Lace in prod.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By vendor */}
        <div className="card">
          <div className="card-hd">Stock by Vendor</div>
          {byVendor.length === 0 ? (
            <div className="empty-state">No vendor data yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(vendorGroups).map(([vendor, items]) => {
                const vendorTotal = items.reduce((s, r) => s + Number(r.received), 0);
                return (
                  <div key={vendor} style={{ borderRadius: 10, background: 'var(--bg-card2)', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700 }}>{vendor}</span>
                      <span className="badge b-accent">{vendorTotal} pcs total</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {items.map((row, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--muted)' }}>{getLabel(row.category)}</span>
                          <span style={{ fontWeight: 600 }}>{row.received} pcs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Finished Goods Inventory Breakdown */}
      {finishedBreakdown.length > 0 && (
        <div className="card mt16">
          <div className="card-hd">
            <span>🏁 Finished Goods Inventory (By Product &amp; Size)</span>
            <span className="badge b-green">{totals.totalFin} pcs total produced</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {finishedBreakdown.map((item, idx) => (
              <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{getLabel(item.category)}</span>
                {item.size && (
                  <span className="badge" style={{ fontSize: 10, background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', fontWeight: 700 }}>
                    📏 {item.size}
                  </span>
                )}
                <span style={{ fontWeight: 800, fontSize: 14, color: '#10b981' }}>{item.qty} pcs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Utilisation table */}
      {rows.length > 0 && (
        <div className="card mt16">
          <div className="card-hd">Overall Stock Utilisation</div>

          {/* Fabric flow note */}
          <div style={{ background: 'var(--accent-l)', border: '1px solid #c4b5fd', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--accent)' }}>
            <strong>How stock tracking works:</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              <li><strong>Received:</strong> Raw fabric received from vendor purchases.</li>
              <li><strong>In Prod. (Active):</strong> Raw fabric currently being cut and stitched in ongoing batches (e.g. Batch 3).</li>
              <li><strong>Finished:</strong> Batches completed and ready in finished inventory (e.g. Batch 1 &amp; 2).</li>
              <li><strong>Available:</strong> Unallocated raw fabric remaining for new batches.</li>
            </ul>
          </div>

          <table>
            <thead>
              <tr>
                <th>Raw Material</th>
                <th style={{ textAlign: 'right' }}>Received</th>
                <th style={{ textAlign: 'right' }}>In Prod.</th>
                <th style={{ textAlign: 'right' }}>Finished</th>
                <th style={{ textAlign: 'right' }}>Available</th>
                <th style={{ textAlign: 'right' }}>Utilised %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cat, label, color, rec, alloc, totalFin, sold, fin, used, avail }) => (
                <tr key={cat}>
                  <td>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 6 }} />
                    <strong>{label}</strong>
                    {cat === 'shawl_nighty' && alloc > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
                        ({shawlPlain} plain · {shawlLace} lace in prod.)
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>{rec}</td>
                  <td style={{ textAlign: 'right', color: '#f59e0b' }}>{alloc}</td>
                  <td style={{ textAlign: 'right', color: '#10b981' }}>
                    <div>{fin}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 'normal' }}>({totalFin} prod. · {sold} sold)</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`badge ${avail > 0 ? 'b-green' : avail === 0 ? 'b-gray' : 'b-red'}`}>{avail}</span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                    {rec > 0 ? Math.round((used / rec) * 100) : 0}%
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '1px solid var(--border)' }}>
                <td>Total</td>
                <td style={{ textAlign: 'right' }}>{totals.rec}</td>
                <td style={{ textAlign: 'right', color: '#f59e0b' }}>{totals.alloc}</td>
                <td style={{ textAlign: 'right', color: '#10b981' }}>
                  <div>{totals.fin}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 'normal' }}>({totals.totalFin} prod. · {totals.sold} sold)</div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className={`badge ${totals.avail > 0 ? 'b-green' : 'b-gray'}`}>{totals.avail}</span>
                </td>
                <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                  {totals.rec > 0 ? Math.round((totals.used / totals.rec) * 100) : 0}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
