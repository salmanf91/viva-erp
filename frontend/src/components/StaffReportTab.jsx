import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAT_LABEL   = { shawl_nighty: 'Shawl Nighty', ordinary_nighty: 'Ordinary Nighty', shawl_nighty_lace: 'Shawl + Lace', mixed: 'Mixed' };
const getProductLabel = cat => CAT_LABEL[cat] || (cat ? cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—');
const fmtDate     = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtFullDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function StaffReportTab() {
  const now = new Date();
  const [month, setMonth]             = useState(now.getMonth() + 1);
  const [year, setYear]               = useState(now.getFullYear());
  const [staffFilter, setStaffFilter] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [staffList, setStaffList]     = useState([]);
  const [rows, setRows]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [copied, setCopied]           = useState(false);

  useEffect(() => {
    api.get('/staff').then(r => setStaffList(r.data)).catch(() => {});
  }, []);

  const loadReport = useCallback(() => {
    setLoading(true);
    const params = { month, year };
    if (staffFilter) params.staff_id = staffFilter;
    api.get('/staff/work-entries/history', { params })
      .then(r => setRows(r.data))
      .finally(() => setLoading(false));
  }, [month, year, staffFilter]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const changeMonth = delta => {
    let m = month + delta;
    let y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  };

  const selectedStaffObj = staffList.find(s => String(s.id) === String(staffFilter));

  const filteredRows = rows.filter(r => {
    if (workTypeFilter && r.work_type !== workTypeFilter) return false;
    if (statusFilter === 'completed' && !(r.remaining_pcs === 0 && r.completed_pcs > 0)) return false;
    if (statusFilter === 'pending' && !(r.remaining_pcs > 0)) return false;
    if (statusFilter === 'settled' && !r.is_settled) return false;
    if (statusFilter === 'unsettled' && r.is_settled) return false;
    return true;
  });

  const totalAlloc = filteredRows.reduce((a, r) => a + (r.allocated_pcs || 0), 0);
  const totalDone  = filteredRows.reduce((a, r) => a + (r.completed_pcs || 0), 0);
  const totalPend  = filteredRows.reduce((a, r) => a + (r.remaining_pcs > 0 ? r.remaining_pcs : 0), 0);
  const completionPct = totalAlloc > 0 ? Math.round((totalDone / totalAlloc) * 100) : 0;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    const cycleLabel = `21 ${MONTH_NAMES[prevM - 1]} ${prevY !== year ? prevY : ''} – 20 ${MONTH_NAMES[month - 1]} ${year}`;
    const statusLabel = statusFilter ? ` | Status: ${statusFilter.toUpperCase()}` : '';
    const workLabel = workTypeFilter ? ` | Type: ${workTypeFilter.toUpperCase()}` : '';
    const title = `STAFF WORK REPORT - ${selectedStaffObj ? selectedStaffObj.name.toUpperCase() : 'ALL STAFF'}\nSalary Period: ${cycleLabel} (Payout: 20th ${MONTH_NAMES[month - 1]} ${year})${statusLabel}${workLabel}\n`;
    const summary = `Allocated: ${totalAlloc} pcs | Completed: ${totalDone} pcs | Pending: ${totalPend} pcs (${completionPct}% Done)\n\nBreakdown:\n`;
    const items = filteredRows.map(r => {
      const pName = getProductLabel(r.category);
      const allocD = fmtDate(r.entry_date);
      const compD = r.completion_date ? fmtDate(r.completion_date) : 'Pending';
      const statusText = r.is_settled ? 'Settled' : r.remaining_pcs > 0 ? `${r.remaining_pcs} pcs pending` : 'Done';
      return `• ${allocD} - ${pName} (${r.work_type}): ${r.completed_pcs}/${r.allocated_pcs} pcs [${statusText}]`;
    }).join('\n');

    navigator.clipboard.writeText(title + summary + items);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const prevM = month === 1 ? 12 : month - 1;
  const prevY = month === 1 ? year - 1 : year;
  const cycleLabel = `21 ${MONTH_NAMES[prevM - 1]} ${prevY !== year ? prevY : ''} – 20 ${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div>
      {/* Print Specific Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #staff-report-print, #staff-report-print * {
            visibility: visible;
          }
          #staff-report-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            margin: 0;
            background: #fff !important;
            color: #000 !important;
          }
          .no-print, button, select, input {
            display: none !important;
          }
        }
      `}</style>

      {/* Filter & Action Controls Bar */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => changeMonth(-1)}>← Prev</button>
          <div style={{
            fontWeight: 700, fontSize: 13, background: 'var(--white)',
            border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 14px',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span>💰 {MONTH_NAMES[month - 1]} {year}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>({cycleLabel})</span>
          </div>
          <button className="btn btn-ghost btn-sm"
            disabled={month === now.getMonth() + 1 && year === now.getFullYear()}
            onClick={() => changeMonth(1)}>Next →</button>

          <select 
            value={staffFilter} 
            onChange={e => setStaffFilter(e.target.value)}
            style={{ minWidth: 180, padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, fontWeight: 600, background: 'var(--white)' }}
          >
            <option value="">All Staff Members</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.role === 'cutting_master' ? 'Cutter' : 'Tailor'})</option>
            ))}
          </select>

          <select 
            value={workTypeFilter} 
            onChange={e => setWorkTypeFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--white)' }}
          >
            <option value="">All Work Types</option>
            <option value="cutting">✂️ Cutting</option>
            <option value="stitching">🧵 Stitching</option>
          </select>

          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, fontWeight: 600, background: 'var(--white)' }}
          >
            <option value="">All Statuses</option>
            <option value="completed">✓ Completed</option>
            <option value="pending">⏳ Pending</option>
            <option value="settled">✓ Settled</option>
            <option value="unsettled">⏳ Unsettled</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            className="btn btn-ghost btn-sm"
            onClick={handleCopyText}
            disabled={filteredRows.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {copied ? '✓ Copied to Clipboard!' : '📋 Copy Text (WhatsApp)'}
          </button>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handlePrint}
            disabled={filteredRows.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div id="staff-report-print">
        {/* Report Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--accent)', paddingBottom: 14, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', margin: 0 }}>Viva Studio</h1>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>Staff Work &amp; Output Report</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Piece Production Statement (Non-Financial)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
              {selectedStaffObj ? selectedStaffObj.name : 'All Staff Members'}
            </div>
            {selectedStaffObj && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Role: <b>{selectedStaffObj.role === 'cutting_master' ? 'Cutting Master' : 'Tailor'}</b>
                {selectedStaffObj.phone ? ` · 📞 ${selectedStaffObj.phone}` : ''}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>
              Salary Period: {cycleLabel} (Payout: 20th {MONTH_NAMES[month - 1]} {year})
            </div>
          </div>
        </div>

        {/* Piece Output Summary KPI Cards (NO AMOUNT PAYABLE) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
          <div className="card" style={{ padding: '12px 16px', borderLeft: '3.5px solid var(--accent)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total Allocated</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{totalAlloc} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>pcs</span></div>
          </div>

          <div className="card" style={{ padding: '12px 16px', borderLeft: '3.5px solid var(--green)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Total Completed</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{totalDone} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>pcs</span></div>
          </div>

          <div className="card" style={{ padding: '12px 16px', borderLeft: '3.5px solid var(--yellow)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Pending / Remaining</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: totalPend > 0 ? 'var(--yellow)' : 'var(--text)' }}>{totalPend} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>pcs</span></div>
          </div>

          <div className="card" style={{ padding: '12px 16px', borderLeft: '3.5px solid var(--cyan, #0891b2)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Completion Rate</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--cyan, #0891b2)' }}>{completionPct}%</div>
          </div>
        </div>

        {/* Detailed Work Log Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }} className="spinner">Loading report data…</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic' }}>
              No work records found for {selectedStaffObj ? selectedStaffObj.name : 'staff'} in {MONTH_NAMES[month - 1]} {year}.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1.5px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Alloc Date</th>
                  <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Comp Date</th>
                  {!staffFilter && (
                    <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Staff</th>
                  )}
                  <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Product / Category</th>
                  <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Work Type</th>
                  <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Allocated</th>
                  <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Completed</th>
                  <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>Remaining</th>
                  <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'rgba(249,250,251,0.6)' : '#fff' }}>
                    <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtDate(r.entry_date)}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {r.completion_date ? fmtDate(r.completion_date) : '—'}
                    </td>
                    {!staffFilter && (
                      <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600 }}>{r.staff_name}</td>
                    )}
                    <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{getProductLabel(r.category)}</span>
                        {r.size && (
                          <span className="badge" style={{ fontSize: 10, background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
                            📏 {r.size}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12 }}>
                      <span className={`badge ${r.work_type === 'cutting' ? 'b-accent' : 'b-cyan'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                        {r.work_type === 'cutting' ? '✂️ Cutting' : '🧵 Stitching'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12, textAlign: 'right', fontWeight: 600 }}>
                      {r.allocated_pcs} pcs
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12, textAlign: 'right', fontWeight: 700, color: r.completed_pcs >= r.allocated_pcs ? 'var(--green)' : 'var(--text)' }}>
                      {r.completed_pcs} pcs
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12, textAlign: 'right', color: r.remaining_pcs > 0 ? 'var(--yellow)' : 'var(--muted)' }}>
                      {r.remaining_pcs > 0 ? `${r.remaining_pcs} left` : '0'}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12 }}>
                      {r.remaining_pcs === 0 && r.completed_pcs > 0 ? (
                        <span className="badge b-green" style={{ fontSize: 10 }}>✓ Done</span>
                      ) : r.remaining_pcs > 0 ? (
                        <span className="badge b-yellow" style={{ fontSize: 10 }}>⏳ Pending</span>
                      ) : (
                        <span className="badge" style={{ fontSize: 10 }}>Allocated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                  <td colSpan={staffFilter ? 3 : 4} style={{ padding: '10px 14px', fontWeight: 800 }}>
                    Total Work Output ({filteredRows.length} entries)
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--text)' }}>
                    {totalAlloc} pcs
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>
                    {totalDone} pcs
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: totalPend > 0 ? 'var(--yellow)' : 'var(--muted)' }}>
                    {totalPend} pcs
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--green)', fontWeight: 800 }}>
                    {completionPct}%
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Verification Signatures (Visible only when printed) */}
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', padding: '0 20px', borderTop: '1px dashed #cbd5e1', paddingTop: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Staff Member Signature</div>
            <div style={{ height: 40 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', width: 180, fontSize: 11, color: '#64748b' }}>Date &amp; Sign</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Supervisor / Admin Signature</div>
            <div style={{ height: 40 }}></div>
            <div style={{ borderTop: '1px solid #94a3b8', width: 180, fontSize: 11, color: '#64748b' }}>Date &amp; Sign</div>
          </div>
        </div>
      </div>
    </div>
  );
}
