import { useState, useEffect } from 'react';
import api from '../api/client';

// Raw material categories — what vendors supply
const RAW_CATS = ['shawl_nighty', 'ordinary_nighty'];
const RAW_LABEL = { shawl_nighty: 'Shawl Nighty', ordinary_nighty: 'Ordinary Nighty' };
const RAW_COLOR = { shawl_nighty: '#6c63ff', ordinary_nighty: '#10b981' };

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ background: 'var(--light)', borderRadius: 6, height: 8, overflow: 'hidden', margin: '4px 0' }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 6, transition: 'width .4s' }} />
    </div>
  );
}

export default function StockPage() {
  const [summary, setSummary]   = useState(null);
  const [byVendor, setByVendor] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/stock/summary').then(r => setSummary(r.data)),
      api.get('/stock/by-vendor').then(r => setByVendor(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner">Loading…</div>;

  const get = (arr, cat) => Number(arr?.find(r => r.category === cat)?.qty || 0);

  // Build rows keyed by raw material only
  const rows = RAW_CATS.map(cat => {
    const rec      = get(summary?.received,  cat);
    const alloc    = get(summary?.allocated, cat);
    const totalFin = get(summary?.finished,  cat);
    const sold     = get(summary?.sold,      cat);
    const fin      = Math.max(0, totalFin - sold); // Net finished goods on hand
    const avail    = rec - alloc;
    return { cat, rec, alloc, totalFin, sold, fin, avail };
  }).filter(r => r.rec > 0 || r.alloc > 0); // hide empty

  const totals = rows.reduce(
    (a, r) => ({
      rec: a.rec + r.rec,
      alloc: a.alloc + r.alloc,
      totalFin: a.totalFin + r.totalFin,
      sold: a.sold + r.sold,
      fin: a.fin + r.fin,
      avail: a.avail + r.avail
    }),
    { rec: 0, alloc: 0, totalFin: 0, sold: 0, fin: 0, avail: 0 }
  );

  // Shawl nighty active batch sub-breakdown (lace vs plain)
  const shawlPlain = get(summary?.shawlBreakdown, 'shawl_nighty');
  const shawlLace  = get(summary?.shawlBreakdown, 'shawl_nighty_lace');

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
          <div className="s-label">Total Received</div>
          <div className="s-val">{totals.rec}</div>
          <div className="s-sub">pcs across all purchases</div>
        </div>
        <div className="stat s-yellow">
          <div className="s-label">In Production</div>
          <div className="s-val">{totals.alloc}</div>
          <div className="s-sub">actively allocated</div>
        </div>
        <div className="stat s-green">
          <div className="s-label">Finished Goods</div>
          <div className="s-val">{totals.fin}</div>
          <div className="s-sub">{totals.totalFin} produced · {totals.sold} sold</div>
        </div>
        <div className="stat s-cyan">
          <div className="s-label">Available</div>
          <div className="s-val">{totals.avail}</div>
          <div className="s-sub">unallocated fabric</div>
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
              {rows.map(({ cat, rec, alloc, totalFin, sold, fin, avail }) => (
                <div key={cat} style={{ borderLeft: `3px solid ${RAW_COLOR[cat]}`, paddingLeft: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{RAW_LABEL[cat]}</span>
                    <span className={`badge ${avail > 0 ? 'b-green' : avail === 0 ? 'b-gray' : 'b-red'}`}>
                      {avail} available
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.5fr', gap: 8, marginBottom: 6 }}>
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

                  <ProgressBar value={alloc} max={rec} color={RAW_COLOR[cat]} />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {rec > 0 ? Math.round((alloc / rec) * 100) : 0}% allocated
                  </div>

                  {/* Shawl sub-breakdown: lace vs plain */}
                  {cat === 'shawl_nighty' && alloc > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {shawlPlain > 0 && (
                        <span style={{ background: 'var(--accent-l)', color: 'var(--accent)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          ✂️ {shawlPlain} pcs → Plain
                        </span>
                      )}
                      {shawlLace > 0 && (
                        <span style={{ background: 'var(--cyan-l)', color: 'var(--cyan)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          ✨ {shawlLace} pcs → With Lace
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
                          <span style={{ color: 'var(--muted)' }}>{RAW_LABEL[row.category] || row.category}</span>
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

      {/* Utilisation table */}
      {rows.length > 0 && (
        <div className="card mt16">
          <div className="card-hd">Overall Stock Utilisation</div>

          {/* Fabric flow note */}
          <div style={{ background: 'var(--accent-l)', border: '1px solid #c4b5fd', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--accent)' }}>
            <strong>How it works:</strong> Vendors supply <strong>Shawl Nighty</strong> or <strong>Ordinary Nighty</strong> fabric.
            When creating a batch, you choose whether Shawl Nighty becomes <em>Plain</em> or <em>With Lace</em> — both consume from Shawl Nighty stock.
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
              {rows.map(({ cat, rec, alloc, totalFin, sold, fin, avail }) => (
                <tr key={cat}>
                  <td>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: RAW_COLOR[cat], marginRight: 6 }} />
                    <strong>{RAW_LABEL[cat]}</strong>
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
                    {rec > 0 ? Math.round((alloc / rec) * 100) : 0}%
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
                  {totals.rec > 0 ? Math.round((totals.alloc / totals.rec) * 100) : 0}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
