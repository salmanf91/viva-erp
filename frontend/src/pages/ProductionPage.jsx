import { useState, useEffect } from 'react';
import api from '../api/client';

const f2      = n => Number(n || 0).toFixed(2);
const fmt     = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const DEFAULT_CAT_LABEL = { shawl_nighty: 'Shawl Nighty', shawl_nighty_lace: 'Shawl Nighty + Lace', ordinary_nighty: 'Ordinary Nighty' };
const getProductLabel = (cat, cfgs = []) => {
  const match = (cfgs || []).find(c => (c.category || '').toLowerCase() === (cat || '').toLowerCase() || (c.name || '').toLowerCase() === (cat || '').toLowerCase());
  if (match?.display_name || match?.name) return match.display_name || match.name;
  return DEFAULT_CAT_LABEL[cat] || (cat ? cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—');
};

const getProductColor = cat => {
  const colors = { shawl_nighty: 'var(--accent)', shawl_nighty_lace: 'var(--cyan)', ordinary_nighty: 'var(--green)' };
  return colors[cat] || 'var(--orange)';
};

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

function CostCard({ cfg, cardQty, totalPcs, rent, electricity, onQtyChange, fabricRate, onFabricRateChange, onSaveFabric, isSavingFabric, sellingRate, onSellingRateChange, onSaveSelling, isSavingSelling, configs }) {
  const ohPerPc  = totalPcs > 0 ? (rent + electricity) / totalPcs : 0;
  const fabric   = Number(fabricRate !== undefined ? fabricRate : cfg.fabric_cost || 0);
  const cut      = Number(cfg.cut_rate       || 0);
  const stitch   = Number(cfg.stitch_rate    || 0);
  const zip      = Number(cfg.zip_cost       || 0);
  const thread   = Number(cfg.thread_cost    || 0);
  const canvas   = Number(cfg.canvas_cost    || 0);
  const plastic  = Number(cfg.plastic_cost   || 0);
  const lace     = Number(cfg.lace_cost      || 0);
  const logistics= Number(cfg.logistics_cost || 0);
  const sell     = Number(sellingRate !== undefined ? sellingRate : cfg.selling_rate || 0);

  const accTotal = zip + thread + canvas + plastic + lace + logistics;
  const total    = fabric + cut + stitch + accTotal + ohPerPc;
  const profit   = sell - total;
  const profitColor = profit >= 10 ? 'var(--green)' : profit >= 0 ? 'var(--yellow)' : 'var(--red)';
  const profitBg    = profit >= 10 ? 'var(--green-l)' : profit >= 0 ? 'var(--yellow-l)' : 'var(--red-l)';

  const hasFabricChanged = Math.abs(fabric - Number(cfg.fabric_cost || 0)) > 0.009;
  const hasSellingChanged = Math.abs(sell - Number(cfg.selling_rate || 0)) > 0.009;

  return (
    <div className="card" style={{ borderTop: `3px solid ${getProductColor(cfg.category)}` }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: getProductColor(cfg.category), marginBottom: 12 }}>
        {cfg.display_name || cfg.name || getProductLabel(cfg.category, configs)}
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
      {zip > 0 && <div className="cost-row"><span>Zip</span><span>₹{f2(zip)}</span></div>}
      {thread > 0 && <div className="cost-row"><span>Thread</span><span>₹{f2(thread)}</span></div>}
      {canvas > 0 && <div className="cost-row"><span>Canvas</span><span>₹{f2(canvas)}</span></div>}
      {plastic > 0 && <div className="cost-row"><span>Packaging / Plastic</span><span>₹{f2(plastic)}</span></div>}
      {lace > 0 && <div className="cost-row" style={{ color: 'var(--cyan)', fontWeight: 600 }}><span>Lace</span><span>₹{f2(lace)}</span></div>}
      {logistics > 0 && <div className="cost-row" style={{ color: 'var(--muted)' }}><span>Logistics / Other</span><span>₹{f2(logistics)}</span></div>}
      {accTotal === 0 && <div className="cost-row" style={{ color: 'var(--muted)', fontSize: 12 }}><span>No accessories set</span><span>₹0.00</span></div>}

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
  const [activeBatches, setActiveBatches] = useState([]);
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
  const [histTotal, setHistTotal]     = useState(0);
  const [histPages, setHistPages]     = useState(1);
  const [statsPcs, setStatsPcs]       = useState(0);
  const [statsFinishedPcs, setStatsFinishedPcs] = useState(0);
  const [statsActiveCount, setStatsActiveCount] = useState(0);
  const [statsActivePcs, setStatsActivePcs] = useState(0);

  const defaultItemRow = (category, cfgs = []) => {
    const cat = category || cfgs[0]?.category || 'shawl_nighty_lace';
    const cfg = cfgs.find(c => (c.category || '').toLowerCase() === (cat || '').toLowerCase()) || {};
    return {
      category: cat,
      size: '',
      quantity: '',
      cut_rate: cfg.cut_rate ?? 5.00,
      stitch_rate: cfg.stitch_rate ?? 15.00,
    };
  };

  const emptyForm = (cfgs = []) => ({
    batch_date: new Date().toISOString().slice(0, 10),
    notes: '',
    items: [defaultItemRow(cfgs[0]?.category, cfgs)],
  });

  const [form, setForm] = useState(emptyForm());

  const calculateItemsBreakdown = (itemsList, cfgs = configs) => {
    let totalQty = 0;
    let cutTotal = 0;
    let stitchTotal = 0;
    let zipTotal = 0;
    let threadTotal = 0;
    let canvasTotal = 0;
    let plasticTotal = 0;
    let laceTotal = 0;
    let logisticsTotal = 0;

    (itemsList || []).forEach(it => {
      const q = parseFloat(it.quantity) || 0;
      if (q <= 0) return;
      const c = cfgs.find(cfg => (cfg.category || '').toLowerCase() === (it.category || '').toLowerCase()) || {};
      const cCut = it.cut_rate !== undefined && it.cut_rate !== '' ? parseFloat(it.cut_rate) : Number(c.cut_rate || 5.00);
      const cStitch = it.stitch_rate !== undefined && it.stitch_rate !== '' ? parseFloat(it.stitch_rate) : Number(c.stitch_rate || 15.00);

      totalQty += q;
      cutTotal += q * cCut;
      stitchTotal += q * cStitch;
      zipTotal += q * Number(c.zip_cost || 0);
      threadTotal += q * Number(c.thread_cost || 0);
      canvasTotal += q * Number(c.canvas_cost || 0);
      plasticTotal += q * Number(c.plastic_cost || 0);
      laceTotal += q * Number(c.lace_cost || 0);
      logisticsTotal += q * Number(c.logistics_cost || 0);
    });

    const labourTotal = cutTotal + stitchTotal;
    const accTotal = zipTotal + threadTotal + canvasTotal + plasticTotal + laceTotal + logisticsTotal;

    return {
      totalQty,
      cutTotal,
      stitchTotal,
      labourTotal,
      zipTotal,
      threadTotal,
      canvasTotal,
      plasticTotal,
      laceTotal,
      logisticsTotal,
      accTotal,
      grandTotal: labourTotal + accTotal,
    };
  };

  const load = () => Promise.all([
    api.get(`/production?page=${histPage}&limit=${HIST_PAGE_SIZE}`).then(r => {
      setBatches(r.data.data || []);
      setActiveBatches(r.data.active || []);
      setHistTotal(r.data.total || 0);
      setHistPages(r.data.pages || 1);
      const stats = r.data.stats || {};
      setCardQty(stats.categoryTotals || {});
      setStatsPcs(stats.totalPcs || 0);
      setStatsFinishedPcs(stats.finishedPcs || 0);
      setStatsActiveCount(stats.activeCount || 0);
      setStatsActivePcs(stats.activePcs || 0);
    }),
    api.get('/items?all=1').then(r => {
      const itemsList = r.data || [];
      setConfigs(itemsList);
      const rates = {};
      const sells = {};
      itemsList.forEach(c => {
        rates[c.category] = Number(c.fabric_cost || 0);
        sells[c.category] = Number(c.selling_rate || 0);
      });
      setFabricRates(rates);
      setSellingRates(sells);
    }).catch(() => {
      api.get('/production/configs').then(r => {
        setConfigs(r.data || []);
        const rates = {};
        const sells = {};
        (r.data || []).forEach(c => {
          rates[c.category] = Number(c.fabric_cost || 0);
          sells[c.category] = Number(c.selling_rate || 0);
        });
        setFabricRates(rates);
        setSellingRates(sells);
      });
    }),
    api.get(`/expenses/overhead?month=${new Date().getMonth()+1}&year=${new Date().getFullYear()}`).then(r => { setRent(Number(r.data.rent ?? 0)); setElectricity(Number(r.data.electricity ?? 0)); }).catch(() => {}),
    api.get('/staff').then(r => setStaff(r.data)),
  ]).finally(() => setLoading(false));

  const handleSaveFabric = async (cat, rate) => {
    setSavingFabric(prev => ({ ...prev, [cat]: true }));
    try {
      await api.put(`/production/configs/${cat}`, { fabric_cost: rate });
      const r = await api.get('/items?all=1').catch(() => api.get('/production/configs'));
      setConfigs(r.data || []);
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
      const r = await api.get('/items?all=1').catch(() => api.get('/production/configs'));
      setConfigs(r.data || []);
    } catch (err) {
      alert('Failed to save selling price');
    } finally {
      setSavingSelling(prev => ({ ...prev, [cat]: false }));
    }
  };

  useEffect(() => { load(); }, [histPage]);

  const handleAddItemRow = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, defaultItemRow(configs[0]?.category, configs)]
    }));
  };

  const handleUpdateItemRow = (idx, field, value) => {
    setForm(prev => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'category') {
        const cfg = configs.find(c => (c.category || '').toLowerCase() === (value || '').toLowerCase()) || {};
        updated[idx].cut_rate = cfg.cut_rate ?? 5.00;
        updated[idx].stitch_rate = cfg.stitch_rate ?? 15.00;
      }
      return { ...prev, items: updated };
    });
  };

  const handleRemoveItemRow = (idx) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const createBatch = async () => {
    const validItems = form.items.filter(it => parseFloat(it.quantity) > 0);
    if (validItems.length === 0) {
      alert('Please enter quantity for at least one item line.');
      return;
    }
    await api.post('/production', {
      batch_date: form.batch_date,
      notes: form.notes,
      items: validItems.map(it => ({
        category: it.category,
        size: it.size ? it.size.trim() : null,
        quantity: parseFloat(it.quantity) || 0,
        cut_rate: parseFloat(it.cut_rate) || 0,
        stitch_rate: parseFloat(it.stitch_rate) || 0,
      }))
    });
    setShowNew(false);
    setForm(emptyForm(configs));
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

  const openEditBatchModal = (b) => {
    const batchItems = Array.isArray(b.items) && b.items.length > 0
      ? b.items.map(it => ({
          category: it.category,
          size: it.size || '',
          quantity: it.quantity,
          cut_rate: it.cut_rate ?? b.cut_rate ?? 5.00,
          stitch_rate: it.stitch_rate ?? b.stitch_rate ?? 15.00,
        }))
      : [
          {
            category: b.category,
            size: '',
            quantity: b.quantity,
            cut_rate: b.cut_rate || 5.00,
            stitch_rate: b.stitch_rate || 15.00,
          }
        ];

    setEditBatch({
      id: b.id,
      batch_number: b.batch_number,
      status: b.status,
      batch_date: b.batch_date ? b.batch_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: b.notes || '',
      items: batchItems,
    });
  };

  const handleAddEditBatchItem = () => {
    setEditBatch(prev => ({
      ...prev,
      items: [...prev.items, defaultItemRow(configs[0]?.category, configs)]
    }));
  };

  const handleUpdateEditBatchItem = (idx, field, value) => {
    setEditBatch(prev => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'category') {
        const cfg = configs.find(c => (c.category || '').toLowerCase() === (value || '').toLowerCase()) || {};
        updated[idx].cut_rate = cfg.cut_rate ?? 5.00;
        updated[idx].stitch_rate = cfg.stitch_rate ?? 15.00;
      }
      return { ...prev, items: updated };
    });
  };

  const handleRemoveEditBatchItem = (idx) => {
    if (editBatch.items.length <= 1) return;
    setEditBatch(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const saveBatchEdit = async () => {
    const validItems = editBatch.items.filter(it => parseFloat(it.quantity) > 0 || it.category);
    await api.put(`/production/${editBatch.id}`, {
      status: editBatch.status,
      batch_date: editBatch.batch_date,
      notes: editBatch.notes,
      items: validItems.map(it => ({
        category: it.category,
        size: it.size ? it.size.trim() : null,
        quantity: parseFloat(it.quantity) || 0,
        cut_rate: parseFloat(it.cut_rate) || 0,
        stitch_rate: parseFloat(it.stitch_rate) || 0,
      }))
    });
    setEditBatch(null);
    load();
  };

  const cutters = staff.filter(s => s.role === 'cutting_master');
  const tailors  = staff.filter(s => s.role === 'tailor');

  const totalPcs        = statsPcs;
  const finishedPcs     = statsFinishedPcs;
  const cardTotalPcs    = Object.values(cardQty).reduce((s, v) => s + Number(v), 0);
  const histSlice       = batches;

  if (loading) return <div className="spinner">Loading…</div>;

  const formCostPreview = calculateItemsBreakdown(form.items, configs);
  const editCostPreview = editBatch ? calculateItemsBreakdown(editBatch.items, configs) : null;

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
          <div className="s-val">{histTotal}</div>
          <div className="s-sub">{totalPcs} pcs across all</div>
        </div>
        <div className="stat s-yellow">
          <div className="s-label">Active</div>
          <div className="s-val">{statsActiveCount}</div>
          <div className="s-sub">{statsActivePcs} pcs in progress</div>
        </div>
        <div className="stat s-green">
          <div className="s-label">Finished</div>
          <div className="s-val">{histTotal - statsActiveCount}</div>
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
                  configs={configs}
                  cardQty={cardQty[cat] || 0}
                  totalPcs={cardTotalPcs}
                  rent={rent}
                  electricity={electricity}
                  onQtyChange={v => setCardQty(q => ({ ...q, [cat]: v }))}
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
        const bItems = Array.isArray(b.items) && b.items.length > 0
          ? b.items
          : [{ category: b.category, size: null, quantity: b.quantity, cut_rate: b.cut_rate, stitch_rate: b.stitch_rate }];
        
        const bBreakdown = calculateItemsBreakdown(bItems, configs);
        const qty = bBreakdown.totalQty || Number(b.quantity || 0);
        const bCfg = configs.find(c => (c.category || '').toLowerCase() === (b.category || '').toLowerCase()) || {};

        return (
          <div key={b.id} className="card mb16" style={{ borderTop: `3px solid ${getProductColor(b.category)}` }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {b.batch_number}
                  <span className={`badge ${b.status === 'cutting' ? 'b-accent' : 'b-yellow'}`}>{STATUS_LABEL[b.status] || b.status}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  {fmtDate(b.batch_date)} {b.notes ? ` · ${b.notes}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: getProductColor(b.category) }}>{qty} pcs</div>
              </div>
            </div>

            {/* Items & Sizes breakdown pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 10px' }}>
              {bItems.map((it, idx) => {
                const itCfg = configs.find(c => (c.category || '').toLowerCase() === (it.category || '').toLowerCase()) || {};
                const itName = itCfg.display_name || itCfg.name || getProductLabel(it.category, configs);
                return (
                  <div key={idx} style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: getProductColor(it.category) }} />
                    <span style={{ fontWeight: 600 }}>{itName}</span>
                    {it.size && <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '1px 5px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>{it.size}</span>}
                    <span style={{ color: 'var(--muted)', fontWeight: 700 }}>× {it.quantity} pcs</span>
                  </div>
                );
              })}
            </div>

            <BatchFlow status={b.status} quantity={qty} />

            {/* Labour + Accessories breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 12 }}>
              <div className="calc-box" style={{ margin: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>👷 Labour</div>
                <div className="calc-row"><span className="cl">Cutting Total</span><span className="cv">{fmt(bBreakdown.cutTotal)}</span></div>
                <div className="calc-row"><span className="cl">Stitching Total</span><span className="cv">{fmt(bBreakdown.stitchTotal)}</span></div>
                <hr className="calc-divider" />
                <div className="calc-row"><span className="cl">Labour Total</span><span className="cv" style={{ color: 'var(--accent)' }}>{fmt(bBreakdown.labourTotal)}</span></div>
              </div>
              <div className="calc-box" style={{ margin: 0, background: '#f0fdf4', borderColor: '#86efac' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>🧰 Accessories</div>
                {bBreakdown.zipTotal > 0 && <div className="calc-row"><span className="cl">Zip</span><span className="cv">{fmt(bBreakdown.zipTotal)}</span></div>}
                {bBreakdown.threadTotal > 0 && <div className="calc-row"><span className="cl">Thread</span><span className="cv">{fmt(bBreakdown.threadTotal)}</span></div>}
                {bBreakdown.canvasTotal > 0 && <div className="calc-row"><span className="cl">Canvas</span><span className="cv">{fmt(bBreakdown.canvasTotal)}</span></div>}
                {bBreakdown.plasticTotal > 0 && <div className="calc-row"><span className="cl">Packaging</span><span className="cv">{fmt(bBreakdown.plasticTotal)}</span></div>}
                {bBreakdown.laceTotal > 0 && <div className="calc-row" style={{ color: 'var(--cyan)', fontWeight: 600 }}><span className="cl">Lace</span><span className="cv">{fmt(bBreakdown.laceTotal)}</span></div>}
                {bBreakdown.logisticsTotal > 0 && <div className="calc-row"><span className="cl">Other</span><span className="cv">{fmt(bBreakdown.logisticsTotal)}</span></div>}
                {bBreakdown.accTotal === 0 && <div className="calc-row" style={{ color: 'var(--muted)', fontSize: 12 }}><span className="cl">No accessories</span><span className="cv">₹0.00</span></div>}
                <hr className="calc-divider" />
                <div className="calc-row"><span className="cl">Accessories Total</span><span className="cv" style={{ color: 'var(--green)' }}>{fmt(bBreakdown.accTotal)}</span></div>
              </div>
            </div>
            <div className="calc-box" style={{ marginTop: 8 }}>
              <div className="calc-row bold"><span className="cl">Labour + Accessories Total</span><span className="cv">{fmt(bBreakdown.grandTotal)}</span></div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openDetail(b.id)}>View Details →</button>
              <button className="btn btn-ghost btn-sm" onClick={() => openEditBatchModal(b)}>✏️ Edit Batch</button>
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
                <th>Products & Sizes</th>
                <th style={{ textAlign: 'right' }}>Total Qty</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Avg Cut</th>
                <th style={{ textAlign: 'right' }}>Avg Stitch</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {histSlice.map(b => {
                const bItems = Array.isArray(b.items) && b.items.length > 0
                  ? b.items
                  : [{ category: b.category, size: null, quantity: b.quantity }];
                return (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.batch_number}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {bItems.map((it, idx) => {
                          const itCfg = configs.find(c => (c.category || '').toLowerCase() === (it.category || '').toLowerCase()) || {};
                          return (
                            <span key={idx} style={{
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: getProductColor(it.category) }} />
                              {itCfg.display_name || itCfg.name || getProductLabel(it.category, configs)}
                              {it.size && <strong style={{ color: '#4f46e5' }}>({it.size})</strong>}
                              <span style={{ color: 'var(--muted)' }}>: {it.quantity}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13 }}>{b.quantity} pcs</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDate(b.batch_date)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>₹{Number(b.cut_rate || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--cyan)' }}>₹{Number(b.stitch_rate || 0).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${b.status === 'finished' ? 'b-green' : b.status === 'cutting' ? 'b-accent' : 'b-yellow'}`}>
                        {STATUS_LABEL[b.status] || b.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => openDetail(b.id)}>View</button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => openEditBatchModal(b)}>Edit</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
          <div className="modal" style={{ width: 620 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0 }}>✂️ {detail.batch?.batch_number}</h2>
              <span className={`badge ${detail.batch?.status === 'finished' ? 'b-green' : 'b-yellow'}`}>
                {STATUS_LABEL[detail.batch?.status] || detail.batch?.status}
              </span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              Total: {detail.batch?.quantity} pcs · Date: {fmtDate(detail.batch?.batch_date)} {detail.batch?.notes ? ` · Notes: ${detail.batch.notes}` : ''}
            </div>

            <BatchFlow status={detail.batch?.status} quantity={detail.batch?.quantity} />

            {/* Items Breakdown Table */}
            <div style={{ marginTop: 16, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Items & Sizes in Batch
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Size</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Cut Rate</th>
                    <th style={{ textAlign: 'right' }}>Stitch Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.batch?.items || [{ category: detail.batch?.category, size: null, quantity: detail.batch?.quantity, cut_rate: detail.batch?.cut_rate, stitch_rate: detail.batch?.stitch_rate }]).map((it, idx) => {
                    const itCfg = configs.find(c => (c.category || '').toLowerCase() === (it.category || '').toLowerCase()) || {};
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{itCfg.display_name || itCfg.name || getProductLabel(it.category, configs)}</td>
                        <td>{it.size ? <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>{it.size}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{it.quantity} pcs</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent)' }}>₹{Number(it.cut_rate || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--cyan)' }}>₹{Number(it.stitch_rate || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Combined Cost breakdown */}
            {(() => {
              const bItems = detail.batch?.items || [{ category: detail.batch?.category, size: null, quantity: detail.batch?.quantity, cut_rate: detail.batch?.cut_rate, stitch_rate: detail.batch?.stitch_rate }];
              const breakdown = calculateItemsBreakdown(bItems, configs);

              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
                    <div className="calc-box" style={{ margin: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>👷 Labour</div>
                      <div className="calc-row"><span className="cl">Cutting Total</span><span className="cv">{fmt(breakdown.cutTotal)}</span></div>
                      <div className="calc-row"><span className="cl">Stitching Total</span><span className="cv">{fmt(breakdown.stitchTotal)}</span></div>
                      <hr className="calc-divider" />
                      <div className="calc-row"><span className="cl">Labour Total</span><span className="cv" style={{ color: 'var(--accent)' }}>{fmt(breakdown.labourTotal)}</span></div>
                    </div>
                    <div className="calc-box" style={{ margin: 0, background: '#f0fdf4', borderColor: '#86efac' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>🧰 Accessories</div>
                      {breakdown.zipTotal > 0 && <div className="calc-row"><span className="cl">Zip</span><span className="cv">{fmt(breakdown.zipTotal)}</span></div>}
                      {breakdown.threadTotal > 0 && <div className="calc-row"><span className="cl">Thread</span><span className="cv">{fmt(breakdown.threadTotal)}</span></div>}
                      {breakdown.canvasTotal > 0 && <div className="calc-row"><span className="cl">Canvas</span><span className="cv">{fmt(breakdown.canvasTotal)}</span></div>}
                      {breakdown.plasticTotal > 0 && <div className="calc-row"><span className="cl">Packaging</span><span className="cv">{fmt(breakdown.plasticTotal)}</span></div>}
                      {breakdown.laceTotal > 0 && <div className="calc-row" style={{ color: 'var(--cyan)', fontWeight: 600 }}><span className="cl">Lace</span><span className="cv">{fmt(breakdown.laceTotal)}</span></div>}
                      {breakdown.logisticsTotal > 0 && <div className="calc-row"><span className="cl">Other</span><span className="cv">{fmt(breakdown.logisticsTotal)}</span></div>}
                      {breakdown.accTotal === 0 && <div className="calc-row" style={{ color: 'var(--muted)', fontSize: 12 }}><span className="cl">No accessories</span><span className="cv">₹0.00</span></div>}
                      <hr className="calc-divider" />
                      <div className="calc-row"><span className="cl">Accessories Total</span><span className="cv" style={{ color: 'var(--green)' }}>{fmt(breakdown.accTotal)}</span></div>
                    </div>
                  </div>
                  <div className="calc-box" style={{ marginTop: 10 }}>
                    <div className="calc-row bold"><span className="cl">Total Batch Cost (Labour + Accessories)</span><span className="cv" style={{ color: 'var(--accent)' }}>{fmt(breakdown.grandTotal)}</span></div>
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
          <div className="modal" style={{ width: 680, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>➕ New Production Batch</h2>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                Total: {formCostPreview.totalQty} pcs
              </div>
            </div>

            <div className="form-grid mb16">
              <div className="field">
                <label>Batch Date</label>
                <input type="date" value={form.batch_date} onChange={e => setForm(f => ({ ...f, batch_date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Notes / Batch Remarks (Optional)</label>
                <input type="text" placeholder="e.g. Eid Festive Collection" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* Product & Size Items List */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '.5px' }}>
                  📦 Batch Items (Categories & Optional Sizes)
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddItemRow} style={{ color: 'var(--accent)', fontWeight: 700 }}>
                  + Add Item / Size Line
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.items.map((it, idx) => (
                  <div key={idx} style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 12,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) 36px',
                    gap: 8,
                    alignItems: 'center'
                  }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Product Category</label>
                      <select value={it.category} onChange={e => handleUpdateItemRow(idx, 'category', e.target.value)} style={{ width: '100%' }}>
                        {configs.map(c => <option key={c.category} value={c.category}>{c.display_name || c.name || getProductLabel(c.category, configs)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Size (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. M, L, XL, Free"
                        value={it.size}
                        onChange={e => handleUpdateItemRow(idx, 'size', e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Qty (pcs) *</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={it.quantity}
                        onChange={e => handleUpdateItemRow(idx, 'quantity', e.target.value)}
                        style={{ width: '100%', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Cut Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={it.cut_rate}
                        onChange={e => handleUpdateItemRow(idx, 'cut_rate', e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Stitch Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={it.stitch_rate}
                        onChange={e => handleUpdateItemRow(idx, 'stitch_rate', e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14 }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={form.items.length <= 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: form.items.length > 1 ? '#ef4444' : '#cbd5e1',
                          cursor: form.items.length > 1 ? 'pointer' : 'not-allowed',
                          fontSize: 18
                        }}
                        title="Remove Line"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Cost Preview */}
            {formCostPreview.totalQty > 0 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 12 }}>
                  <div className="calc-box" style={{ margin: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>👷 Labour ({formCostPreview.totalQty} pcs)</div>
                    <div className="calc-row"><span className="cl">Cutting Total</span><span className="cv">{fmt(formCostPreview.cutTotal)}</span></div>
                    <div className="calc-row"><span className="cl">Stitching Total</span><span className="cv">{fmt(formCostPreview.stitchTotal)}</span></div>
                    <hr className="calc-divider" />
                    <div className="calc-row"><span className="cl">Labour Total</span><span className="cv" style={{ color: 'var(--accent)' }}>{fmt(formCostPreview.labourTotal)}</span></div>
                  </div>
                  <div className="calc-box" style={{ margin: 0, background: '#f0fdf4', borderColor: '#86efac' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6 }}>🧰 Accessories</div>
                    {formCostPreview.zipTotal > 0 && <div className="calc-row"><span className="cl">Zip</span><span className="cv">{fmt(formCostPreview.zipTotal)}</span></div>}
                    {formCostPreview.threadTotal > 0 && <div className="calc-row"><span className="cl">Thread</span><span className="cv">{fmt(formCostPreview.threadTotal)}</span></div>}
                    {formCostPreview.canvasTotal > 0 && <div className="calc-row"><span className="cl">Canvas</span><span className="cv">{fmt(formCostPreview.canvasTotal)}</span></div>}
                    {formCostPreview.plasticTotal > 0 && <div className="calc-row"><span className="cl">Packaging</span><span className="cv">{fmt(formCostPreview.plasticTotal)}</span></div>}
                    {formCostPreview.laceTotal > 0 && <div className="calc-row" style={{ color: 'var(--cyan)', fontWeight: 600 }}><span className="cl">Lace</span><span className="cv">{fmt(formCostPreview.laceTotal)}</span></div>}
                    {formCostPreview.logisticsTotal > 0 && <div className="calc-row"><span className="cl">Other</span><span className="cv">{fmt(formCostPreview.logisticsTotal)}</span></div>}
                    {formCostPreview.accTotal === 0 && <div className="calc-row" style={{ color: 'var(--muted)', fontSize: 12 }}><span className="cl">No accessories</span><span className="cv">₹0.00</span></div>}
                    <hr className="calc-divider" />
                    <div className="calc-row"><span className="cl">Accessories Total</span><span className="cv" style={{ color: 'var(--green)' }}>{fmt(formCostPreview.accTotal)}</span></div>
                  </div>
                </div>
                <div className="calc-box" style={{ marginTop: 8 }}>
                  <div className="calc-row bold"><span className="cl">Total Batch Cost (Labour + Accessories)</span><span className="cv" style={{ color: 'var(--accent)' }}>{fmt(formCostPreview.grandTotal)}</span></div>
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowNew(false); setForm(emptyForm(configs)); }}>Cancel</button>
              <button className="btn btn-primary" onClick={createBatch} disabled={formCostPreview.totalQty <= 0}>
                Create Batch ({formCostPreview.totalQty} pcs)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Batch modal ── */}
      {editBatch && (
        <div className="modal-overlay" onClick={() => setEditBatch(null)}>
          <div className="modal" style={{ width: 680, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0 }}>✏️ Edit Batch — {editBatch.batch_number}</h2>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                Total: {editCostPreview?.totalQty || 0} pcs
              </div>
            </div>

            <div className="form-grid mb16">
              <div className="field">
                <label>Status</label>
                <select value={editBatch.status} onChange={e => setEditBatch(b => ({ ...b, status: e.target.value }))}>
                  {STATUS_STEPS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={editBatch.batch_date} onChange={e => setEditBatch(b => ({ ...b, batch_date: e.target.value }))} />
              </div>
              <div className="field form-full">
                <label>Notes / Batch Remarks</label>
                <input type="text" value={editBatch.notes} onChange={e => setEditBatch(b => ({ ...b, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>

            {/* Batch Items List */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '.5px' }}>
                  📦 Batch Items (Categories & Sizes)
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddEditBatchItem} style={{ color: 'var(--accent)', fontWeight: 700 }}>
                  + Add Item / Size Line
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {editBatch.items.map((it, idx) => (
                  <div key={idx} style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 12,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) 36px',
                    gap: 8,
                    alignItems: 'center'
                  }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Product Category</label>
                      <select value={it.category} onChange={e => handleUpdateEditBatchItem(idx, 'category', e.target.value)} style={{ width: '100%' }}>
                        {configs.map(c => <option key={c.category} value={c.category}>{c.display_name || c.name || getProductLabel(c.category, configs)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Size (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. M, L, XL"
                        value={it.size}
                        onChange={e => handleUpdateEditBatchItem(idx, 'size', e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Qty (pcs) *</label>
                      <input
                        type="number"
                        value={it.quantity}
                        onChange={e => handleUpdateEditBatchItem(idx, 'quantity', e.target.value)}
                        style={{ width: '100%', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Cut Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={it.cut_rate}
                        onChange={e => handleUpdateEditBatchItem(idx, 'cut_rate', e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Stitch Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={it.stitch_rate}
                        onChange={e => handleUpdateEditBatchItem(idx, 'stitch_rate', e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14 }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveEditBatchItem(idx)}
                        disabled={editBatch.items.length <= 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: editBatch.items.length > 1 ? '#ef4444' : '#cbd5e1',
                          cursor: editBatch.items.length > 1 ? 'pointer' : 'not-allowed',
                          fontSize: 18
                        }}
                        title="Remove Line"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Cost Preview */}
            {editCostPreview && editCostPreview.totalQty > 0 && (
              <div className="calc-box" style={{ marginTop: 8 }}>
                <div className="calc-row bold"><span className="cl">Updated Batch Cost (Labour + Accessories)</span><span className="cv" style={{ color: 'var(--accent)' }}>{fmt(editCostPreview.grandTotal)}</span></div>
              </div>
            )}

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
