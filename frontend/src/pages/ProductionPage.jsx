import { useState, useEffect } from 'react';
import api from '../api/client';

const f2      = n => Number(n || 0).toFixed(2);
const fmt     = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const DEFAULT_CAT_LABEL = { shawl_nighty: 'Shawl Nighty', shawl_nighty_lace: 'Shawl Nighty + Lace', ordinary_nighty: 'Ordinary Nighty' };
const getProductLabel = cat => DEFAULT_CAT_LABEL[cat] || cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const getProductColor = cat => {
  const colors = { shawl_nighty: 'var(--accent)', shawl_nighty_lace: 'var(--cyan)', ordinary_nighty: 'var(--green)' };
  return colors[cat] || 'var(--orange)';
};

// Yield: how many nighties one purchased unit covers
const ACC_YIELD = { zip: 1, thread: 20, canvas: 40, plastic: 1, lace: 1 };
const CANVAS_DEFAULT = 15 / 40; // ₹15/canvas ÷ 40 nighties = ₹0.375/nighty
// cost_per_nighty = (amount / qty_purchased) / yield
const accPerNighty = (row) => row ? (row.amount / row.qty_purchased) / (ACC_YIELD[row.accessory_type] || 1) : null;

const STATUS_STEPS = ['allocated', 'cutting', 'stitching', 'finished'];
const STATUS_LABEL = { allocated: 'Allocated', cutting: 'Cutting', stitching: 'Stitching', finished: 'Finished' };

function BatchFlow({ status, quantity }) {
  const steps = [
    { key: 'allocated',  icon: '📦', label: 'Allocated'  },
    { key: 'cutting',    icon: '✂️', label: 'Cutting'    },
    { key: 'stitching',  icon: '🧵', label: 'Stitching'  },
    { key: 'finished',   icon: '✅', label: 'Finished'   },
  ];
  const idx = STATUS_STEPS.indexOf(status);
  return (
    <div className="prod-flow">
      {steps.map((s) => {
        const stepIdx = STATUS_STEPS.indexOf(s.key);
        const done    = idx > stepIdx;
        const active  = idx === stepIdx;
        return (
          <div key={s.key} className={`pf-step ${done ? 'done' : active ? 'active' : ''}`}>
            <span className="pf-icon">{s.icon}</span>
            <div className="pf-val">{(done || active) ? quantity : '—'}</div>
            <div className="pf-lbl">{done ? '✓ ' : ''}{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function CostCard({ cfg, cardQty, totalPcs, rent, electricity, onQtyChange, accLatest, fabricRate, onFabricRateChange, onSaveFabric, isSavingFabric, sellingRate, onSellingRateChange, onSaveSelling, isSavingSelling }) {
  const ohPerPc  = totalPcs > 0 ? (rent + electricity) / totalPcs : 0;
  const fabric   = Number(fabricRate !== undefined ? fabricRate : cfg.fabric_cost || 0);
  const cut      = Number(cfg.cut_rate       || 0);
  const stitch   = Number(cfg.stitch_rate    || 0);
  const lace     = Number(cfg.lace_cost      || 0);
  const logistics= Number(cfg.logistics_cost || 0);
  const sell     = Number(sellingRate !== undefined ? sellingRate : cfg.selling_rate || 0);
  const isLace    = cfg.category === 'shawl_nighty_lace';
  const isPlastic = cfg.category !== 'ordinary_nighty';

  // Live accessory prices from purchase log (amount / qty / yield = cost per nighty)
  const accPrice = key => {
    const a = accLatest?.find(x => x.accessory_type === key);
    return a ? accPerNighty(a) : null;
  };
  const accDate = key => {
    const a = accLatest?.find(x => x.accessory_type === key);
    return a ? new Date(a.expense_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' }) : null;
  };
  const zip     = accPrice('zip')     ?? Number(cfg.zip_cost     || 0);
  const thread  = accPrice('thread')  ?? Number(cfg.thread_cost  || 0);
  const canvas  = accPrice('canvas')  ?? CANVAS_DEFAULT;
  const plastic = accPrice('plastic') ?? Number(cfg.plastic_cost || 0);

  const total    = fabric + cut + stitch + zip + thread + canvas + (isPlastic ? plastic : 0) + (isLace ? lace : 0) + logistics + ohPerPc;
  const profit   = sell - total;
  const profitColor = profit >= 10 ? 'var(--green)' : profit >= 0 ? 'var(--yellow)' : 'var(--red)';
  const profitBg    = profit >= 10 ? 'var(--green-l)' : profit >= 0 ? 'var(--yellow-l)' : 'var(--red-l)';

  const hasFabricChanged = Math.abs(fabric - Number(cfg.fabric_cost || 0)) > 0.009;
  const hasSellingChanged = Math.abs(sell - Number(cfg.selling_rate || 0)) > 0.009;

  return (
    <div className="card" style={{ borderTop: `3px solid ${getProductColor(cfg.category)}` }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: getProductColor(cfg.category), marginBottom: 12 }}>
        {getProductLabel(cfg.category)}
      </div>

      <div className="cost-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Fabric Rate
          {hasFabricChanged && (
            <button
              onClick={() => onSaveFabric(cfg.category, fabric)}
              disabled={isSavingFabric}
              title="Save as category default"
              style={{
                background: 'var(--orange-l)',
                border: '1px solid #fdba74',
                color: 'var(--orange)',
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                marginLeft: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              {isSavingFabric ? 'Saving…' : '💾 Save'}
            </button>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>₹</span>
          <input
            type="number"
            step="0.01"
            value={fabric}
            onChange={e => onFabricRateChange(parseFloat(e.target.value) || 0)}
            style={{
              width: 66,
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '3px 7px',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center',
              background: '#fff',
              outline: 'none',
            }}
          />
        </div>
      </div>
      <div className="cost-row"><span>Cutting</span><span>₹{f2(cut)}</span></div>
      <div className="cost-row"><span>Stitching</span><span>₹{f2(stitch)}</span></div>

      <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>🧰 Accessories</div>
      <div className="cost-row">
        <span>Zip {accDate('zip') ? <span style={{fontSize:10,color:'var(--green)'}}>📌 {accDate('zip')}</span> : <span style={{fontSize:10,color:'var(--muted)'}}>est.</span>}</span>
        <span>₹{f2(zip)}</span>
      </div>
      <div className="cost-row">
        <span>Thread {accDate('thread') ? <span style={{fontSize:10,color:'var(--green)'}}>📌 {accDate('thread')}</span> : <span style={{fontSize:10,color:'var(--muted)'}}>est.</span>}</span>
        <span>₹{f2(thread)}</span>
      </div>
      <div className="cost-row">
        <span>Canvas {accDate('canvas') ? <span style={{fontSize:10,color:'var(--green)'}}>📌 {accDate('canvas')}</span> : <span style={{fontSize:10,color:'var(--muted)'}}>est.</span>}</span>
        <span>₹{f2(canvas)}</span>
      </div>
      {isPlastic
        ? <div className="cost-row">
            <span>Plastic Bag {accDate('plastic') ? <span style={{fontSize:10,color:'var(--green)'}}>📌 {accDate('plastic')}</span> : <span style={{fontSize:10,color:'var(--muted)'}}>est.</span>}</span>
            <span>₹{f2(plastic)}</span>
          </div>
        : <div className="cost-row" style={{ color: 'var(--muted)', fontSize: 12 }}><span>No plastic bag</span><span>—</span></div>
      }
      {isLace
        ? <div className="cost-row" style={{ color: 'var(--cyan)', fontWeight: 600 }}><span>Lace</span><span>₹{f2(lace)}</span></div>
        : <div className="cost-row" style={{ color: 'var(--muted)', fontSize: 12 }}><span>No lace</span><span>—</span></div>
      }

      <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
      <div className="cost-row" style={{ color: 'var(--muted)', fontSize: 12 }}><span>Logistics</span><span>₹{f2(logistics)}</span></div>

      <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />

      {/* Overhead box with per-card qty input */}
      <div style={{ background: 'var(--accent-l)', borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.5px' }}>📐 Overhead</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input
              type="number"
              value={cardQty}
              onChange={e => onQtyChange(parseInt(e.target.value) || 0)}
              style={{ width: 66, border: '1px solid #c4b5fd', borderRadius: 6, padding: '3px 7px', fontSize: 13, fontWeight: 700, textAlign: 'center', background: '#fff', outline: 'none', color: 'var(--accent)' }}
            />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>pcs</span>
          </div>
        </div>
        <div className="cost-row" style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>Rent + Elec ÷ {totalPcs} total pcs</span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{f2(ohPerPc)}</span>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
      <div className="cost-row bold"><span>Total Cost / pc</span><span style={{ color: 'var(--red)' }}>₹{f2(total)}</span></div>
      <div className="cost-row bold" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Selling Price
          {hasSellingChanged && (
            <button
              onClick={() => onSaveSelling(cfg.category, sell)}
              disabled={isSavingSelling}
              title="Save as category default"
              style={{
                background: 'var(--green-l)',
                border: '1px solid #86efac',
                color: 'var(--green)',
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                marginLeft: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              {isSavingSelling ? 'Saving…' : '💾 Save'}
            </button>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>₹</span>
          <input
            type="number"
            step="0.01"
            value={sell}
            onChange={e => onSellingRateChange(parseFloat(e.target.value) || 0)}
            style={{
              width: 66,
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '3px 7px',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center',
              background: '#fff',
              outline: 'none',
              color: 'var(--green)',
            }}
          />
        </div>
      </div>

      <div style={{ background: profitBg, borderRadius: 6, padding: '8px 10px', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: profitColor }}>Profit / pc</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: profitColor }}>₹{f2(profit)}</span>
      </div>

      {profit < 5 && (
        <div style={{ background: 'var(--red-l)', borderRadius: 5, padding: '4px 8px', fontSize: 11, color: 'var(--red)', fontWeight: 700, marginTop: 6 }}>
          ⚠ Very low margin — increase total volume.
        </div>
      )}
    </div>
  );
}

export default function ProductionPage() {
  const [batches, setBatches]         = useState([]);
  const [configs, setConfigs]         = useState([]);
  const [accLatest, setAccLatest]     = useState([]);   // latest accessory prices
  const [staff, setStaff]             = useState([]);
  const [detail, setDetail]           = useState(null);
  const [showNew, setShowNew]         = useState(false);
  const [editBatch, setEditBatch]     = useState(null); // batch object being edited
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('all');
  const [electricity, setElectricity] = useState(0);
  const [rent, setRent]               = useState(0);
  const [activeTab, setActiveTab]     = useState('batches');
  const [cardQty, setCardQty]         = useState({});
  const [histPage, setHistPage]       = useState(1);
  const [fabricRates, setFabricRates] = useState({});
  const [savingFabric, setSavingFabric] = useState({});
  const [sellingRates, setSellingRates] = useState({});
  const [savingSelling, setSavingSelling] = useState({});
  const HIST_PAGE_SIZE = 8;

  const emptyForm = () => ({
    category: configs[0]?.category || 'shawl_nighty', quantity: '',
    batch_date: new Date().toISOString().slice(0, 10),
    cut_rate: 5.00,
    stitch_rate: 15.00,
  });
  const [form, setForm] = useState(emptyForm());

  const load = () => Promise.all([
    api.get('/production').then(r => {
      setBatches(r.data);
      const qty = {};
      r.data.forEach(b => {
        qty[b.category] = (qty[b.category] || 0) + Number(b.quantity || 0);
      });
      setCardQty(qty);
    }),
    api.get('/production/configs').then(r => {
      setConfigs(r.data);
      const rates = {};
      const sells = {};
      r.data.forEach(c => {
        rates[c.category] = Number(c.fabric_cost || 0);
        sells[c.category] = Number(c.selling_rate || 0);
      });
      setFabricRates(rates);
      setSellingRates(sells);
    }),
    api.get('/expenses/accessory-prices').then(r => setAccLatest(r.data)).catch(() => {}),
    api.get(`/expenses/overhead?month=${new Date().getMonth()+1}&year=${new Date().getFullYear()}`).then(r => { setRent(Number(r.data.rent ?? 0)); setElectricity(Number(r.data.electricity ?? 0)); }).catch(() => {}),
    api.get('/staff').then(r => setStaff(r.data)),
  ]).finally(() => setLoading(false));

  const handleSaveFabric = async (cat, rate) => {
    setSavingFabric(prev => ({ ...prev, [cat]: true }));
    try {
      await api.put(`/production/configs/${cat}`, { fabric_cost: rate });
      const r = await api.get('/production/configs');
      setConfigs(r.data);
    } catch (err) {
      alert('Failed to save fabric rate');
    } finally {
      setSavingFabric(prev => ({ ...prev, [cat]: false }));
    }
  };

  const handleSaveSelling = async (cat, rate) => {
    setSavingSelling(prev => ({ ...prev, [cat]: true }));
    try {
      await api.put(`/production/configs/${cat}`, { selling_rate: rate });
      const r = await api.get('/production/configs');
      setConfigs(r.data);
    } catch (err) {
      alert('Failed to save selling price');
    } finally {
      setSavingSelling(prev => ({ ...prev, [cat]: false }));
    }
  };

  useEffect(() => { load(); }, []);

  const createBatch = async () => {
    if (!form.quantity) return;
    await api.post('/production', { ...form, quantity: +form.quantity });
    setShowNew(false);
    setForm(emptyForm());
    load();
  };

  const finishBatch = async id => {
    await api.put(`/production/${id}/finish`);
    load();
    if (detail?.batch?.id === id) {
      const r = await api.get(`/production/${id}`);
      setDetail(r.data);
    }
  };

  const deleteBatch = async id => {
    if (!confirm('Delete this batch? Work logs will also be removed.')) return;
    await api.delete(`/production/${id}`);
    load();
    if (detail?.batch?.id === id) setDetail(null);
  };

  const openDetail = async id => {
    const r = await api.get(`/production/${id}`);
    setDetail(r.data);
  };

  const saveBatchEdit = async () => {
    await api.put(`/production/${editBatch.id}`, {
      status:      editBatch.status,
      cut_rate:    Number(editBatch.cut_rate || 0),
      stitch_rate: Number(editBatch.stitch_rate || 0),
    });
    setEditBatch(null);
    load();
  };

  const cutters = staff.filter(s => s.role === 'cutting_master');
  const tailors  = staff.filter(s => s.role === 'tailor');

  const activeBatches   = batches.filter(b => b.status !== 'finished');
  const finishedBatches = batches.filter(b => b.status === 'finished');
  const totalPcs        = batches.reduce((s, b) => s + Number(b.quantity || 0), 0);
  const finishedPcs     = finishedBatches.reduce((s, b) => s + Number(b.quantity || 0), 0);
  const cardTotalPcs    = Object.values(cardQty).reduce((s, v) => s + v, 0);

  // pagination for history table
  const histTotal = batches.length;
  const histPages = Math.max(1, Math.ceil(histTotal / HIST_PAGE_SIZE));
  const histSlice = batches.slice((histPage - 1) * HIST_PAGE_SIZE, histPage * HIST_PAGE_SIZE);

  if (loading) return <div className="spinner">Loading…</div>;

  /* New batch modal cost preview */
  const previewCfg  = configs.find(c => c.category === form.category);
  const previewQty  = +form.quantity || 0;
  const cutAmt      = previewQty * Number(form.cut_rate || 0);
  const tailAmt     = previewQty * Number(form.stitch_rate || 0);
  const isLaceForm = form.category === 'shawl_nighty_lace';
  const _pvZ       = accLatest.find(x => x.accessory_type === 'zip');
  const _pvT       = accLatest.find(x => x.accessory_type === 'thread');
  const _pvC       = accLatest.find(x => x.accessory_type === 'canvas');
  const _pvP       = accLatest.find(x => x.accessory_type === 'plastic');
  const _pvZipPc   = _pvZ ? accPerNighty(_pvZ) : Number(previewCfg?.zip_cost     || 0);
  const _pvThrPc   = _pvT ? accPerNighty(_pvT) : Number(previewCfg?.thread_cost  || 0);
  const _pvCanPc   = _pvC ? accPerNighty(_pvC) : CANVAS_DEFAULT;
  const _pvPlaPc   = _pvP ? accPerNighty(_pvP) : Number(previewCfg?.plastic_cost || 0);
  const zipAmt     = previewQty * _pvZipPc;
  const threadAmt  = previewQty * _pvThrPc;
  const canvasAmt  = previewQty * _pvCanPc;
  const plasticAmt = previewQty * _pvPlaPc;
  const laceAmt    = isLaceForm ? previewQty * Number(previewCfg?.lace_cost || 8) : 0;
  const labourTotal = cutAmt + tailAmt;
  const accTotal    = zipAmt + threadAmt + canvasAmt + plasticAmt + laceAmt;

  return (
    <>
      {/* Header */}
      <div className="sec-hd mb16">
        <div>
          <div className="sec-title">Production Log</div>
          <div className="sec-sub">
            {batches.length} batch{batches.length !== 1 ? 'es' : ''} · {totalPcs} pcs total · {finishedPcs} finished
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => {
          const defCfg = configs.find(c => c.category === 'shawl_nighty_lace') || {};
          setForm({
            category: 'shawl_nighty_lace',
            quantity: '',
            batch_date: new Date().toISOString().slice(0, 10),
            cut_rate: defCfg.cut_rate ?? 5.00,
            stitch_rate: defCfg.stitch_rate ?? 15.00,
          });
          setShowNew(true);
        }}>+ New Batch</button>
      </div>

      {/* Summary stats */}
      <div className="g4 mb16">
        <div className="stat s-accent">
          <div className="s-label">Total Batches</div>
          <div className="s-val">{batches.length}</div>
          <div className="s-sub">{totalPcs} pcs across all</div>
        </div>
        <div className="stat s-yellow">
          <div className="s-label">Active</div>
          <div className="s-val">{activeBatches.length}</div>
          <div className="s-sub">{activeBatches.reduce((s,b)=>s+Number(b.quantity||0),0)} pcs in progress</div>
        </div>
        <div className="stat s-green">
          <div className="s-label">Finished</div>
          <div className="s-val">{finishedBatches.length}</div>
          <div className="s-sub">{finishedPcs} pcs done</div>
        </div>
        <div className="stat s-cyan">
          <div className="s-label">Staff Assigned</div>
          <div className="s-val">{staff.length}</div>
          <div className="s-sub">{cutters.length} cutters · {tailors.length} tailors</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <div className={`tab${activeTab === 'batches' ? ' active' : ''}`} onClick={() => setActiveTab('batches')}>Batches</div>
        <div className={`tab${activeTab === 'costs' ? ' active' : ''}`} onClick={() => setActiveTab('costs')}>Cost Calculator</div>
      </div>

      {/* ── Cost Calculator tab ── */}
      {activeTab === 'costs' && <>

      {/* ── Monthly Overhead Banner ── */}
      <div style={{
        background: 'var(--accent-l)', border: '1px solid #c4b5fd', borderRadius: 10,
        padding: '11px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>📐 Monthly Overhead</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Rent + Electricity ÷ total pcs from all batches</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Rent ₹</span>
          <input
            type="number"
            value={rent}
            onChange={e => setRent(parseFloat(e.target.value) || 0)}
            style={{
              width: 72, border: '1px solid #c4b5fd', borderRadius: 7, padding: '5px 9px',
              fontSize: 14, fontWeight: 800, textAlign: 'center', background: '#fff',
              outline: 'none', color: 'var(--accent)',
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Electricity ₹</span>
          <input
            type="number"
            value={electricity}
            onChange={e => setElectricity(parseFloat(e.target.value) || 0)}
            style={{
              width: 72, border: '1px solid #c4b5fd', borderRadius: 7, padding: '5px 9px',
              fontSize: 14, fontWeight: 800, textAlign: 'center', background: '#fff',
              outline: 'none', color: 'var(--yellow)',
            }}
          />
          <div style={{ width: 1, height: 24, background: '#c4b5fd' }} />
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Total: <strong style={{ color: 'var(--accent)' }}>{cardTotalPcs.toLocaleString('en-IN')}</strong> pcs
            &nbsp;→&nbsp;
            <strong style={{ color: 'var(--accent)' }}>
              ₹{cardTotalPcs > 0 ? f2((rent + electricity) / cardTotalPcs) : '0.00'}/pc
            </strong>
          </div>
        </div>
      </div>

      {/* ── Cost Per Piece Cards ── */}
      {configs.length > 0 && (
        <>
          <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px' }}>
            Cost Per Piece
          </div>
          <div className="g3 mb16">
            {configs.map(cfg => {
              const cat = cfg.category;
              return (
                <CostCard
                  key={cat}
                  cfg={cfg}
                  cardQty={cardQty[cat] || 0}
                  totalPcs={cardTotalPcs}
                  rent={rent}
                  electricity={electricity}
                  onQtyChange={v => setCardQty(q => ({ ...q, [cat]: v }))}
                  accLatest={accLatest}
                  fabricRate={fabricRates[cat]}
                  onFabricRateChange={v => setFabricRates(r => ({ ...r, [cat]: v }))}
                  onSaveFabric={handleSaveFabric}
                  isSavingFabric={savingFabric[cat]}
                  sellingRate={sellingRates[cat]}
                  onSellingRateChange={v => setSellingRates(r => ({ ...r, [cat]: v }))}
                  onSaveSelling={handleSaveSelling}
                  isSavingSelling={savingSelling[cat]}
                />
              );
            })}
          </div>
        </>
      )}
      {configs.length === 0 && (
        <div className="card mb16" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚙️</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No product configs set up yet</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Go to Settings → Product Cost Configuration to set fabric cost, labour rates and accessories per category.
          </div>
          <a href="/settings" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>Go to Settings →</a>
        </div>
      )}

      </>}

      {/* ── Batches tab ── */}
      {activeTab === 'batches' && <>

      {/* ── Active Batches ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>
        Active Batches <span style={{ color: 'var(--accent)' }}>({activeBatches.length})</span>
      </div>

      {activeBatches.length === 0 && (
        <div className="empty-state mb16">No active batches. Click + New Batch to start.</div>
      )}

      {activeBatches.map(b => {
        const bCfg  = configs.find(c => c.category === b.category) || {};
        const qty   = Number(b.quantity || 0);
        const isL   = b.category === 'shawl_nighty_lace';
        const isPla = b.category !== 'ordinary_nighty';
        const cutRate   = Number((b.cut_rate ?? bCfg.cut_rate) || 0);
        const stitchRate= Number((b.stitch_rate ?? bCfg.stitch_rate) || 0);
        const cutAmt    = qty * cutRate;
        const stitchAmt = qty * stitchRate;
        const labTotal  = cutAmt + stitchAmt;
        const accZ   = accLatest.find(x => x.accessory_type === 'zip');
        const accT   = accLatest.find(x => x.accessory_type === 'thread');
        const accC   = accLatest.find(x => x.accessory_type === 'canvas');
        const accP   = accLatest.find(x => x.accessory_type === 'plastic');
        const zipPc  = accZ ? accPerNighty(accZ) : Number(bCfg.zip_cost     || 0);
        const thrPc  = accT ? accPerNighty(accT) : Number(bCfg.thread_cost  || 0);
        const canPc  = accC ? accPerNighty(accC) : CANVAS_DEFAULT;
        const plaPc  = accP ? accPerNighty(accP) : Number(bCfg.plastic_cost || 0);
        const _zip  = qty * zipPc;
        const _thr  = qty * thrPc;
        const _can  = qty * canPc;
        const _pla  = isPla ? qty * plaPc : 0;
        const _lac  = isL ? qty * Number(bCfg.lace_cost || 8) : 0;
        const accTotal = _zip + _thr + _can + _pla + _lac;
        return (
          <div key={b.id} className="card mb16" style={{ borderTop: `3px solid ${getProductColor(b.category)}` }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{b.batch_number}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {getProductLabel(b.category)} · {fmtDate(b.batch_date)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: getProductColor(b.category) }}>{b.quantity} pcs</div>
                <span className={`badge ${b.status === 'cutting' ? 'b-accent' : 'b-yellow'}`}>{STATUS_LABEL[b.status] || b.status}</span>
              </div>
            </div>

            <BatchFlow status={b.status} quantity={b.quantity} />

            {/* Labour + Accessories breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div className="calc-box" style={{ margin: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>👷 Labour</div>
                <div className="calc-row"><span className="cl">Cutting (₹{cutRate} × {qty})</span><span className="cv">{fmt(cutAmt)}</span></div>
                <div className="calc-row"><span className="cl">Stitching (₹{stitchRate} × {qty})</span><span className="cv">{fmt(stitchAmt)}</span></div>
                <hr className="calc-divider" />
                <div className="calc-row"><span className="cl">Labour Total</span><span className="cv" style={{ color: 'var(--accent)' }}>{fmt(labTotal)}</span></div>
              </div>
              <div className="calc-box" style={{ margin: 0, background: '#f0fdf4', borderColor: '#86efac' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>🧰 Accessories</div>
                <div className="calc-row"><span className="cl">Zip (₹{zipPc.toFixed(2)}/pc × {qty}{accZ ? ' 📌' : ' est.'})</span><span className="cv">{fmt(_zip)}</span></div>
                <div className="calc-row"><span className="cl">Thread (₹{thrPc.toFixed(2)}/pc × {qty}{accT ? ' 📌' : ' est.'})</span><span className="cv">{fmt(_thr)}</span></div>
                <div className="calc-row"><span className="cl">Canvas (₹{canPc.toFixed(2)}/pc × {qty}{accC ? ' 📌' : ' est.'})</span><span className="cv">{fmt(_can)}</span></div>
                {isPla && <div className="calc-row"><span className="cl">Plastic Bag (₹{plaPc.toFixed(2)}/pc × {qty}{accP ? ' 📌' : ' est.'})</span><span className="cv">{fmt(_pla)}</span></div>}
                {isL && <div className="calc-row" style={{ color: 'var(--cyan)', fontWeight: 600 }}><span className="cl">Lace (₹{bCfg.lace_cost||8} × {qty})</span><span className="cv">{fmt(_lac)}</span></div>}
                <hr className="calc-divider" />
                <div className="calc-row"><span className="cl">Accessories Total</span><span className="cv" style={{ color: 'var(--green)' }}>{fmt(accTotal)}</span></div>
              </div>
            </div>
            <div className="calc-box" style={{ marginTop: 8 }}>
              <div className="calc-row bold"><span className="cl">Labour + Accessories</span><span className="cv">{fmt(labTotal + accTotal)}</span></div>
              {Number(bCfg.selling_rate) > 0 && <>
                <div className="calc-row"><span className="cl">Selling Rate (₹{bCfg.selling_rate} × {qty})</span><span className="cv" style={{ color: 'var(--green)' }}>{fmt(Number(bCfg.selling_rate) * qty)}</span></div>
                <div className="calc-row"><span className="cl">Fabric Cost ({qty} pcs)</span><span className="cv" style={{ color: 'var(--red)' }}>−{fmt(Number(bCfg.fabric_cost||0) * qty)} est.</span></div>
                <hr className="calc-divider" />
                <div className="calc-row bold">
                  <span className="cl">Expected Profit (Batch)</span>
                  <span className="cv" style={{ color: 'var(--green)' }}>{fmt((Number(bCfg.selling_rate) - Number(bCfg.fabric_cost||0)) * qty - (labTotal + accTotal))} est.</span>
                </div>
              </>}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openDetail(b.id)}>View Details →</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditBatch({ id: b.id, batch_number: b.batch_number, category: b.category, quantity: b.quantity, status: b.status, cut_rate: b.cut_rate || 0, stitch_rate: b.stitch_rate || 0 })}>Edit</button>
              <button className="btn btn-red btn-sm" style={{ marginLeft: 'auto' }} onClick={() => deleteBatch(b.id)}>Delete</button>
            </div>
          </div>
        );
      })}

      {/* ── Batch History ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px', margin: '8px 0 10px' }}>
        Batch History <span style={{ color: 'var(--accent)' }}>({histTotal})</span>
      </div>
      {batches.length === 0 ? (
        <div className="empty-state">No batches yet.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Cut Rate</th>
                <th style={{ textAlign: 'right' }}>Stitch Rate</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {histSlice.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 700 }}>{b.batch_number}</td>
                  <td>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: getProductColor(b.category), marginRight: 5 }} />
                    {getProductLabel(b.category)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{b.quantity}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDate(b.batch_date)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>₹{b.cut_rate}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--cyan)' }}>₹{b.stitch_rate}</td>
                  <td>
                    <span className={`badge ${b.status === 'finished' ? 'b-green' : b.status === 'cutting' ? 'b-accent' : 'b-yellow'}`}>
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => openDetail(b.id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {histPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm" disabled={histPage === 1} onClick={() => setHistPage(p => p - 1)}>‹ Prev</button>
              {Array.from({ length: histPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setHistPage(p)} style={{
                  width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: histPage === p ? 'var(--accent)' : 'var(--light)',
                  color: histPage === p ? '#fff' : 'var(--muted)',
                }}>{p}</button>
              ))}
              <button className="btn btn-ghost btn-sm" disabled={histPage === histPages} onClick={() => setHistPage(p => p + 1)}>Next ›</button>
            </div>
          )}
        </div>
      )}

      </>}

      {/* ── Batch detail modal ── */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ width: 580 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>✂️ {detail.batch?.batch_number}</h2>
              <span className={`badge ${detail.batch?.status === 'finished' ? 'b-green' : 'b-yellow'}`}>
                {STATUS_LABEL[detail.batch?.status] || detail.batch?.status}
              </span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              {getProductLabel(detail.batch?.category)}
              {' · '}{detail.batch?.quantity} pcs{' · '}{fmtDate(detail.batch?.batch_date)}
            </div>

            <BatchFlow status={detail.batch?.status} />

            <div style={{ display: 'flex', gap: 12, margin: '12px 0', fontSize: 13 }}>
              <div style={{ flex: 1, background: 'var(--accent-l)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Cutting Rate</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>₹{detail.batch?.cut_rate}/pc</div>
              </div>
              <div style={{ flex: 1, background: 'var(--cyan-l)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Stitching Rate</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--cyan)' }}>₹{detail.batch?.stitch_rate}/pc</div>
              </div>
            </div>

            {/* Cost breakdown — always shown from product config */}
            {(() => {
              const b      = detail.batch;
              const qty    = Number(b?.quantity || 0);
              const bCfg   = configs.find(c => c.category === b?.category) || {};
              const isL    = b?.category === 'shawl_nighty_lace';
              const isPla  = b?.category !== 'ordinary_nighty';
              const cutRate    = Number(b?.cut_rate ?? bCfg.cut_rate ?? 0);
              const stitchRate = Number(b?.stitch_rate ?? bCfg.stitch_rate ?? 0);
              const cutAmt     = qty * cutRate;
              const stitchAmt  = qty * stitchRate;
              const labTotal   = cutAmt + stitchAmt;
              const _accZ  = accLatest.find(x => x.accessory_type === 'zip');
              const _accT  = accLatest.find(x => x.accessory_type === 'thread');
              const _accC  = accLatest.find(x => x.accessory_type === 'canvas');
              const _accP  = accLatest.find(x => x.accessory_type === 'plastic');
              const _zipPc = _accZ ? accPerNighty(_accZ) : Number(bCfg.zip_cost     || 0);
              const _thrPc = _accT ? accPerNighty(_accT) : Number(bCfg.thread_cost  || 0);
              const _canPc = _accC ? accPerNighty(_accC) : CANVAS_DEFAULT;
              const _plaPc = _accP ? accPerNighty(_accP) : Number(bCfg.plastic_cost || 0);
              const _zip  = qty * _zipPc;
              const _thr  = qty * _thrPc;
              const _can  = qty * _canPc;
              const _pla  = isPla ? qty * _plaPc : 0;
              const _lac  = isL ? qty * Number(bCfg.lace_cost || 8) : 0;
              const _acc  = _zip + _thr + _can + _pla + _lac;
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                    <div className="calc-box" style={{ margin: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>👷 Labour</div>
                      <div className="calc-row"><span className="cl">Cutting (₹{cutRate} × {qty})</span><span className="cv">{fmt(cutAmt)}</span></div>
                      <div className="calc-row"><span className="cl">Stitching (₹{stitchRate} × {qty})</span><span className="cv">{fmt(stitchAmt)}</span></div>
                      <hr className="calc-divider" />
                      <div className="calc-row"><span className="cl">Labour Total</span><span className="cv" style={{ color: 'var(--accent)' }}>{fmt(labTotal)}</span></div>
                    </div>
                    <div className="calc-box" style={{ margin: 0, background: '#f0fdf4', borderColor: '#86efac' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>🧰 Accessories</div>
                      <div className="calc-row"><span className="cl">Zip (₹{_zipPc.toFixed(2)}/pc × {qty}{_accZ ? ' 📌' : ' est.'})</span><span className="cv">{fmt(_zip)}</span></div>
                      <div className="calc-row"><span className="cl">Thread (₹{_thrPc.toFixed(2)}/pc × {qty}{_accT ? ' 📌' : ' est.'})</span><span className="cv">{fmt(_thr)}</span></div>
                      <div className="calc-row"><span className="cl">Canvas (₹{_canPc.toFixed(2)}/pc × {qty}{_accC ? ' 📌' : ' est.'})</span><span className="cv">{fmt(_can)}</span></div>
                      {isPla && <div className="calc-row"><span className="cl">Plastic Bag (₹{_plaPc.toFixed(2)}/pc × {qty}{_accP ? ' 📌' : ' est.'})</span><span className="cv">{fmt(_pla)}</span></div>}
                      {isL && <div className="calc-row" style={{ color: 'var(--cyan)', fontWeight: 600 }}><span className="cl">Lace (₹{bCfg.lace_cost||8} × {qty})</span><span className="cv">{fmt(_lac)}</span></div>}
                      <hr className="calc-divider" />
                      <div className="calc-row"><span className="cl">Accessories Total</span><span className="cv" style={{ color: 'var(--green)' }}>{fmt(_acc)}</span></div>
                    </div>
                  </div>
                  <div className="calc-box" style={{ marginTop: 10 }}>
                    <div className="calc-row bold"><span className="cl">Labour + Accessories</span><span className="cv">{fmt(labTotal + _acc)}</span></div>
                    {Number(bCfg.selling_rate) > 0 && <>
                      <div className="calc-row"><span className="cl">Selling Rate (₹{bCfg.selling_rate} × {qty})</span><span className="cv" style={{ color: 'var(--green)' }}>{fmt(Number(bCfg.selling_rate) * qty)}</span></div>
                      <div className="calc-row"><span className="cl">Fabric Cost ({qty} pcs)</span><span className="cv" style={{ color: 'var(--red)' }}>−{fmt(Number(bCfg.fabric_cost||0) * qty)} est.</span></div>
                      <hr className="calc-divider" />
                      <div className="calc-row bold">
                        <span className="cl">Expected Profit (Batch)</span>
                        <span className="cv" style={{ color: 'var(--green)' }}>{fmt((Number(bCfg.selling_rate) - Number(bCfg.fabric_cost||0)) * qty - (labTotal + _acc))} est.</span>
                      </div>
                    </>}
                  </div>
                </>
              );
            })()}

            {/* Work log table — only if staff logs exist */}
            {detail.workLogs?.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '16px 0 8px' }}>Work Logs</div>
                <table>
                  <thead>
                    <tr><th>Staff</th><th>Role</th><th style={{ textAlign:'right' }}>Pcs</th><th style={{ textAlign:'right' }}>Rate</th><th style={{ textAlign:'right' }}>Amount</th><th>Settled</th></tr>
                  </thead>
                  <tbody>
                    {detail.workLogs.map(w => (
                      <tr key={w.id}>
                        <td style={{ fontWeight: 600 }}>{w.staff_name}</td>
                        <td style={{ textTransform: 'capitalize', color: 'var(--muted)', fontSize: 12 }}>{w.role?.replace(/_/g, ' ')}</td>
                        <td style={{ textAlign: 'right' }}>{w.pieces}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(w.rate_per_pc)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(w.amount)}</td>
                        <td><span className={`badge ${w.is_settled ? 'b-green' : 'b-yellow'}`}>{w.is_settled ? 'Paid' : 'Pending'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className="modal-actions">
              {detail.batch?.status !== 'finished' && (
                <button className="btn btn-primary" onClick={() => { finishBatch(detail.batch.id); setDetail(null); }}>
                  ✓ Mark Finished
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Batch modal ── */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" style={{ width: 580 }} onClick={e => e.stopPropagation()}>
            <h2>New Production Batch</h2>
            <div className="form-grid">
              <div className="field">
                <label>Category</label>
                <select value={form.category} onChange={e => {
                  const cat = e.target.value;
                  const cfg = configs.find(c => c.category === cat) || {};
                  setForm(f => ({
                    ...f,
                    category: cat,
                    cut_rate: cfg.cut_rate ?? 5.00,
                    stitch_rate: cfg.stitch_rate ?? 15.00,
                  }));
                }}>
                  {configs.map(c => <option key={c.category} value={c.category}>{getProductLabel(c.category)}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Quantity (pcs)</label>
                <input type="number" placeholder="e.g. 300" autoFocus
                  value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.batch_date} onChange={e => setForm(f => ({ ...f, batch_date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Cutting Rate (₹/pc)</label>
                <input type="number" step="0.01" value={form.cut_rate}
                  onChange={e => setForm(f => ({ ...f, cut_rate: e.target.value }))} />
              </div>
              <div className="field">
                <label>Stitching Rate (₹/pc)</label>
                <input type="number" step="0.01" value={form.stitch_rate}
                  onChange={e => setForm(f => ({ ...f, stitch_rate: e.target.value }))} />
              </div>
            </div>

            {/* Labour + Accessories cost preview */}
            {previewQty > 0 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                  <div className="calc-box" style={{ margin: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>👷 Labour</div>
                    <div className="calc-row"><span className="cl">Cutting (₹{form.cut_rate||0}×{previewQty})</span><span className="cv">{fmt(cutAmt)}</span></div>
                    <div className="calc-row"><span className="cl">Stitching (₹{form.stitch_rate||0}×{previewQty})</span><span className="cv">{fmt(tailAmt)}</span></div>
                    <hr className="calc-divider" />
                    <div className="calc-row"><span className="cl">Labour Total</span><span className="cv" style={{ color: 'var(--accent)' }}>{fmt(labourTotal)}</span></div>
                  </div>
                  <div className="calc-box" style={{ margin: 0, background: '#f0fdf4', borderColor: '#86efac' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>🧰 Accessories</div>
                    <div className="calc-row"><span className="cl">Zip (₹{_pvZipPc.toFixed(2)}/pc×{previewQty}{_pvZ ? ' 📌' : ' est.'})</span><span className="cv">{fmt(zipAmt)}</span></div>
                    <div className="calc-row"><span className="cl">Thread (₹{_pvThrPc.toFixed(2)}/pc×{previewQty}{_pvT ? ' 📌' : ' est.'})</span><span className="cv">{fmt(threadAmt)}</span></div>
                    <div className="calc-row"><span className="cl">Canvas (₹{_pvCanPc.toFixed(2)}/pc×{previewQty}{_pvC ? ' 📌' : ' est.'})</span><span className="cv">{fmt(canvasAmt)}</span></div>
                    <div className="calc-row"><span className="cl">Plastic (₹{_pvPlaPc.toFixed(2)}/pc×{previewQty}{_pvP ? ' 📌' : ' est.'})</span><span className="cv">{fmt(plasticAmt)}</span></div>
                    {isLaceForm && <div className="calc-row" style={{ color: 'var(--cyan)', fontWeight: 600 }}><span className="cl">Lace (₹{previewCfg?.lace_cost||8}×{previewQty})</span><span className="cv">{fmt(laceAmt)}</span></div>}
                    {!isLaceForm && <div className="calc-row" style={{ color: 'var(--muted)', fontSize: 12 }}><span className="cl">Lace</span><span className="cv">—</span></div>}
                    <hr className="calc-divider" />
                    <div className="calc-row"><span className="cl">Accessories Total</span><span className="cv" style={{ color: 'var(--green)' }}>{fmt(accTotal)}</span></div>
                  </div>
                </div>
                <div className="calc-box" style={{ marginTop: 8 }}>
                  <div className="calc-row bold"><span className="cl">Total Batch Cost (Labour + Accessories)</span><span className="cv" style={{ color: 'var(--accent)' }}>{fmt(labourTotal + accTotal)}</span></div>
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowNew(false); setForm(emptyForm()); }}>Cancel</button>
              <button className="btn btn-primary" onClick={createBatch} disabled={!form.quantity}>Create Batch</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Batch modal ── */}
      {editBatch && (
        <div className="modal-overlay" onClick={() => setEditBatch(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Edit Batch — {editBatch.batch_number}</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
               {getProductLabel(editBatch.category)} · {editBatch.quantity} pcs
            </div>

            <div className="form-grid">
              <div className="field form-full">
                <label>Status</label>
                <select value={editBatch.status} onChange={e => setEditBatch(b => ({ ...b, status: e.target.value }))}>
                  {STATUS_STEPS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Cutting Rate (₹/pc)</label>
                <input type="number" step="0.01" value={editBatch.cut_rate}
                  onChange={e => setEditBatch(b => ({ ...b, cut_rate: e.target.value }))} />
              </div>
              <div className="field">
                <label>Stitching Rate (₹/pc)</label>
                <input type="number" step="0.01" value={editBatch.stitch_rate}
                  onChange={e => setEditBatch(b => ({ ...b, stitch_rate: e.target.value }))} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditBatch(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveBatchEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
