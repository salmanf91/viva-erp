import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function JobWorkPage() {
  const { user } = useAuth();
  const currency = user?.currency || '₹';

  // Tabs: 'orders' | 'payouts'
  const [activeTab, setActiveTab] = useState('orders');

  // Dynamic Branches
  const [branches, setBranches] = useState(['Bajpe', 'Kannur']);
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState('');
  const [branchContextSetter, setBranchContextSetter] = useState(null);

  // Filters
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Data states
  const [orders, setOrders] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalPcsCollected: 0,
    activePcs: 0,
    readyPcs: 0,
    deliveredPcs: 0,
    bajpePcs: 0,
    kannurPcs: 0,
    totalRevenue: 0,
    totalCollected: 0,
    totalReceivable: 0,
    totalStaffWages: 0,
    totalExpenses: 0,
    netProfit: 0,
  });
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);

  // Option A Staff Payouts states
  const [staffLedger, setStaffLedger] = useState([]);
  const [payoutsHistory, setPayoutsHistory] = useState([]);
  const [payoutLoading, setPayoutLoading] = useState(false);

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [orderToDeliver, setOrderToDeliver] = useState(null);
  const [deliverDate, setDeliverDate] = useState(new Date().toISOString().slice(0, 10));
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState(null);

  // Payout Modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    staff_id: '',
    staff_name: '',
    branch: 'Bajpe',
    amount: '',
    payment_mode: 'cash',
    payment_date: new Date().toISOString().slice(0, 10),
    reference_order_id: '',
    notes: '',
  });

  // New Intake Form
  const [newForm, setNewForm] = useState({
    client_name: '',
    client_phone: '',
    received_date: new Date().toISOString().slice(0, 10),
    target_delivery_date: '',
    branch: 'Bajpe',
    total_pcs: '',
    client_rate_per_pc: '',
    amount_paid: '',
    notes: '',
    staff_name: '',
    staff_id: '',
    staff_rate: '',
    initial_expense_title: '',
    initial_expense_amount: '',
  });

  // Assign staff subform in detail drawer
  const [assignForm, setAssignForm] = useState({
    staff_name: '',
    staff_id: '',
    branch: 'Bajpe',
    pcs_assigned: '',
    rate_per_pc: '',
    assigned_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Add expense subform in detail drawer
  const [expenseForm, setExpenseForm] = useState({
    expense_title: '',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const fmt = (v) => `${currency} ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const loadOrders = async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum,
        limit: 20,
      });
      if (branchFilter && branchFilter !== 'all') params.append('branch', branchFilter);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (search) params.append('search', search);

      const r = await api.get(`/job-work?${params.toString()}`);
      setOrders(r.data.data || []);
      setTotalOrders(r.data.total || 0);
      setTotalPages(r.data.pages || 1);
      setPage(r.data.page || 1);
      if (r.data.stats) setStats(r.data.stats);
    } catch (err) {
      console.error('loadOrders error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      const r = await api.get('/staff');
      setStaffList(r.data || []);
    } catch {}
  };

  const loadBranches = async () => {
    try {
      const r = await api.get('/job-work/branches');
      if (Array.isArray(r.data) && r.data.length > 0) {
        setBranches(r.data);
      }
    } catch {}
  };

  const handleCreateBranch = async (e) => {
    e?.preventDefault?.();
    const name = newBranchInput.trim();
    if (!name) return;
    try {
      await api.post('/job-work/branches', { name });
      if (!branches.includes(name)) {
        setBranches(prev => [...prev, name].sort((a, b) => a.localeCompare(b)));
      }
      if (branchContextSetter) {
        branchContextSetter(name);
      }
      setShowAddBranchModal(false);
      setNewBranchInput('');
      setBranchContextSetter(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add branch');
    }
  };

  const promptNewBranch = (setterFn) => {
    setBranchContextSetter(() => setterFn);
    setNewBranchInput('');
    setShowAddBranchModal(true);
  };

  const loadStaffPayouts = async () => {
    setPayoutLoading(true);
    try {
      const r = await api.get('/job-work/staff/payouts');
      setStaffLedger(r.data.ledger || []);
      setPayoutsHistory(r.data.payouts || []);
    } catch (err) {
      console.error('loadStaffPayouts error:', err);
    } finally {
      setPayoutLoading(false);
    }
  };

  useEffect(() => {
    loadOrders(page);
    loadStaff();
    loadBranches();
  }, [branchFilter, statusFilter, search, page]);

  useEffect(() => {
    if (activeTab === 'payouts') {
      loadStaffPayouts();
    }
  }, [activeTab]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const openOrderDetail = async (orderId) => {
    try {
      const r = await api.get(`/job-work/${orderId}`);
      setSelectedOrder(r.data.order);
      setDetailData(r.data);
      setAssignForm({
        staff_name: '',
        staff_id: '',
        branch: r.data.order.branch || 'Bajpe',
        pcs_assigned: '',
        rate_per_pc: '',
        assigned_date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      setShowDetailDrawer(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load order details');
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newForm.client_name || !newForm.total_pcs || !newForm.client_rate_per_pc) {
      alert('Please fill client name, total pieces, and agreed stitching rate per pc');
      return;
    }

    try {
      const payload = {
        client_name: newForm.client_name,
        client_phone: newForm.client_phone,
        received_date: newForm.received_date,
        target_delivery_date: newForm.target_delivery_date || null,
        branch: newForm.branch,
        total_pcs: Number(newForm.total_pcs),
        client_rate_per_pc: Number(newForm.client_rate_per_pc),
        amount_paid: Number(newForm.amount_paid || 0),
        notes: newForm.notes,
        staff_assignments: [],
        expenses: [],
      };

      if (newForm.staff_name && Number(newForm.total_pcs) > 0 && newForm.staff_rate) {
        payload.staff_assignments.push({
          staff_id: newForm.staff_id || null,
          staff_name: newForm.staff_name,
          branch: newForm.branch,
          pcs_assigned: Number(newForm.total_pcs),
          rate_per_pc: Number(newForm.staff_rate),
        });
      }

      if (newForm.initial_expense_title && Number(newForm.initial_expense_amount) > 0) {
        payload.expenses.push({
          expense_title: newForm.initial_expense_title,
          amount: Number(newForm.initial_expense_amount),
          expense_date: newForm.received_date,
        });
      }

      await api.post('/job-work', payload);
      setShowNewModal(false);
      setNewForm({
        client_name: '',
        client_phone: '',
        received_date: new Date().toISOString().slice(0, 10),
        target_delivery_date: '',
        branch: 'Bajpe',
        total_pcs: '',
        client_rate_per_pc: '',
        amount_paid: '',
        notes: '',
        staff_name: '',
        staff_id: '',
        staff_rate: '',
        initial_expense_title: '',
        initial_expense_amount: '',
      });
      loadOrders(1);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create job work order');
    }
  };

  const handleMarkDelivered = async () => {
    if (!orderToDeliver) return;
    try {
      await api.post(`/job-work/${orderToDeliver.id}/deliver`, {
        delivered_date: deliverDate,
      });
      setShowDeliverModal(false);
      setOrderToDeliver(null);
      loadOrders(page);
      if (showDetailDrawer && selectedOrder?.id === orderToDeliver.id) {
        openOrderDetail(orderToDeliver.id);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark as delivered');
    }
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    if (!assignForm.staff_name || !assignForm.pcs_assigned) {
      alert('Please provide tailor name and pieces assigned');
      return;
    }
    try {
      await api.post(`/job-work/${selectedOrder.id}/assignments`, assignForm);
      openOrderDetail(selectedOrder.id);
      loadOrders(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add staff assignment');
    }
  };

  const handleUpdateAssignmentPcs = async (assignmentId, currentAssigned, completedPcs) => {
    const pcs = prompt(`Enter completed stitched pieces (Max: ${currentAssigned}):`, completedPcs || '0');
    if (pcs === null) return;
    const num = parseInt(pcs, 10);
    if (isNaN(num) || num < 0) {
      alert('Invalid quantity');
      return;
    }
    try {
      await api.put(`/job-work/assignments/${assignmentId}`, {
        pcs_completed: num,
      });
      openOrderDetail(selectedOrder.id);
      loadOrders(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update completed pcs');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!confirm('Remove this staff assignment?')) return;
    try {
      await api.delete(`/job-work/assignments/${assignmentId}`);
      openOrderDetail(selectedOrder.id);
      loadOrders(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete assignment');
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.expense_title || !expenseForm.amount) {
      alert('Please provide title and amount');
      return;
    }
    try {
      await api.post(`/job-work/${selectedOrder.id}/expenses`, expenseForm);
      setExpenseForm({
        expense_title: '',
        amount: '',
        expense_date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      openOrderDetail(selectedOrder.id);
      loadOrders(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add expense');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Delete this expense entry?')) return;
    try {
      await api.delete(`/job-work/expenses/${expenseId}`);
      openOrderDetail(selectedOrder.id);
      loadOrders(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  const handleUpdatePayment = async () => {
    const amt = prompt('Update amount paid by client:', selectedOrder.amount_paid || '0');
    if (amt === null) return;
    const num = parseFloat(amt);
    if (isNaN(num) || num < 0) {
      alert('Invalid amount');
      return;
    }
    try {
      await api.put(`/job-work/${selectedOrder.id}`, {
        amount_paid: num,
      });
      openOrderDetail(selectedOrder.id);
      loadOrders(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update payment');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm('Are you sure you want to permanently delete this job work order? This cannot be undone.')) return;
    try {
      await api.delete(`/job-work/${orderId}`);
      setShowDetailDrawer(false);
      loadOrders(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete order');
    }
  };

  const handleRecordPayout = async (e) => {
    e.preventDefault();
    if (!payoutForm.staff_name || !payoutForm.amount) {
      alert('Please fill staff name and amount');
      return;
    }
    try {
      await api.post('/job-work/staff/payouts', payoutForm);
      setShowPayoutModal(false);
      setPayoutForm({
        staff_id: '',
        staff_name: '',
        branch: 'Bajpe',
        amount: '',
        payment_mode: 'cash',
        payment_date: new Date().toISOString().slice(0, 10),
        reference_order_id: '',
        notes: '',
      });
      loadStaffPayouts();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record payout');
    }
  };

  const handleDeletePayout = async (payoutId) => {
    if (!confirm('Delete this staff payout voucher?')) return;
    try {
      await api.delete(`/job-work/staff/payouts/${payoutId}`);
      loadStaffPayouts();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete payout voucher');
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 60 }}>
      {/* ── TOP HEADER WITH BUSINESS SEGMENT TITLE ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>🧵</span>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                Client Salwar Stitching Unit
              </h1>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Job work intake, Bajpe &amp; Kannur branch tracking, tailor piece rates, direct expenses &amp; delivery
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowNewModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <span>+</span> New Client Intake
          </button>
        </div>
      </div>

      {/* ── KPI STATS CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 12,
        marginBottom: 20
      }}>
        <div style={{ background: 'var(--white)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Pcs Collected</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
            {Number(stats.totalPcsCollected).toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>pcs</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, fontSize: 11 }}>
            {(stats.branchBreakdown || []).slice(0, 4).map(bb => (
              <span key={bb.branch} className="badge b-blue">
                {bb.branch}: {bb.pcs}
              </span>
            ))}
            {(!stats.branchBreakdown || stats.branchBreakdown.length === 0) && (
              <>
                <span className="badge b-blue">Bajpe: {stats.bajpePcs || 0}</span>
                <span className="badge b-purple">Kannur: {stats.kannurPcs || 0}</span>
              </>
            )}
          </div>
        </div>

        <div style={{ background: 'var(--white)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Active in Stitching</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
            {Number(stats.activePcs).toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>pcs</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
            Ready for Delivery: <strong style={{ color: '#8b5cf6' }}>{stats.readyPcs} pcs</strong>
          </div>
        </div>

        <div style={{ background: 'var(--white)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Delivered Back</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
            {Number(stats.deliveredPcs).toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>pcs</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
            Handed over to clients
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.02) 100%)',
          padding: 14,
          borderRadius: 10,
          border: '1.5px solid rgba(16, 185, 129, 0.3)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>Job Work Net Profit</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#065f46', marginTop: 4 }}>
            {fmt(stats.netProfit)}
          </div>
          <div style={{ fontSize: 10, color: '#047857', marginTop: 6 }}>
            Revenue {fmt(stats.totalRevenue)} - Wages {fmt(stats.totalStaffWages)} - Exp {fmt(stats.totalExpenses)}
          </div>
        </div>
      </div>

      {/* ── MODULE MAIN TABS (Option A Standalone) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--border)',
        marginBottom: 16
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'orders' ? '2.5px solid var(--accent)' : '2.5px solid transparent',
            background: 'none',
            color: activeTab === 'orders' ? 'var(--accent)' : 'var(--muted)',
            cursor: 'pointer'
          }}
        >
          📋 Client Intake &amp; Orders ({totalOrders})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payouts')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'payouts' ? '2.5px solid #10b981' : '2.5px solid transparent',
            background: 'none',
            color: activeTab === 'payouts' ? '#059669' : 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>👷 Staff Wages &amp; Payouts Ledger</span>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#d1fae5', color: '#065f46', fontWeight: 800 }}>Option A</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 1: CLIENT INTAKE & ORDERS
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'orders' && (
        <>
          {/* Filters Bar */}
          <div style={{
            background: 'var(--white)',
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border)',
            marginBottom: 14,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              {/* Branch Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Branch:</span>
                <select
                  value={branchFilter}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '__add_new__') {
                      promptNewBranch(name => {
                        setBranchFilter(name);
                        setPage(1);
                      });
                    } else {
                      setBranchFilter(val);
                      setPage(1);
                    }
                  }}
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}
                >
                  <option value="all">All Branches</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b} Branch</option>
                  ))}
                  <option value="__add_new__" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    ➕ + Add New Branch...
                  </option>
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                  style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="received">Received</option>
                  <option value="in_progress">In Stitching</option>
                  <option value="ready">Ready for Delivery</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
            </div>

            {/* Search form */}
            <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                placeholder="Search Client, Phone, Order #..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, minWidth: 200 }}
              />
              <button type="submit" className="btn btn-sm" style={{ padding: '6px 12px', fontSize: 12 }}>
                Search
              </button>
              {search && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => { setSearchInput(''); setSearch(''); }}
                  style={{ padding: '6px 8px', fontSize: 12, background: 'none', border: '1px solid var(--border)' }}
                >
                  ✕
                </button>
              )}
            </form>
          </div>

          {/* Orders Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 12px' }}>Order #</th>
                    <th style={{ padding: '10px 12px' }}>Client</th>
                    <th style={{ padding: '10px 12px' }}>Branch</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Pcs</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Client Rate</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Bill</th>
                    <th style={{ padding: '10px 12px' }}>Stitching Progress</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Net Profit</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                        Loading orders...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                        No client salwar orders found. Click <strong>+ New Client Intake</strong> to get started.
                      </td>
                    </tr>
                  ) : (
                    orders.map(o => {
                      const isDelivered = o.status === 'delivered';
                      const isReady = o.status === 'ready';
                      const assignedPcs = Number(o.total_pcs_assigned || 0);
                      const completedPcs = Number(o.total_pcs_completed || 0);
                      const progressPct = o.total_pcs > 0 ? Math.min(100, Math.round((completedPcs / o.total_pcs) * 100)) : 0;

                      return (
                        <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent)' }}>
                            {o.order_no}
                            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400, fontFamily: 'sans-serif' }}>
                              Rec: {o.received_date ? new Date(o.received_date).toLocaleDateString('en-IN') : '—'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{o.client_name}</div>
                            {o.client_phone && (
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>📞 {o.client_phone}</div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className={o.branch?.toLowerCase() === 'bajpe' ? 'badge b-blue' : 'badge b-purple'}>
                              📍 {o.branch || 'Bajpe'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
                            {o.total_pcs}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            {fmt(o.client_rate_per_pc)}/pc
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 800 }}>{fmt(o.client_total_amount)}</div>
                            <div style={{ fontSize: 10, color: o.balance_due > 0 ? '#ef4444' : '#10b981' }}>
                              {o.balance_due > 0 ? `Due: ${fmt(o.balance_due)}` : 'Fully Paid'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', minWidth: 140 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>
                              <span>{completedPcs} / {o.total_pcs} pcs</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct >= 100 ? '#10b981' : 'var(--accent)' }} />
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: Number(o.net_profit) >= 0 ? '#059669' : '#dc2626' }}>
                            {fmt(o.net_profit)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {isDelivered ? (
                              <div>
                                <span className="badge b-green">Delivered</span>
                                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                                  {o.delivered_date ? new Date(o.delivered_date).toLocaleDateString('en-IN') : ''}
                                </div>
                              </div>
                            ) : isReady ? (
                              <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>Ready</span>
                            ) : o.status === 'in_progress' ? (
                              <span className="badge b-yellow">In Stitching</span>
                            ) : (
                              <span className="badge b-blue">Received</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {!isDelivered && (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => {
                                    setOrderToDeliver(o);
                                    setDeliverDate(new Date().toISOString().slice(0, 10));
                                    setShowDeliverModal(true);
                                  }}
                                  style={{ padding: '4px 8px', fontSize: 11, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', fontWeight: 700 }}
                                  title="Mark Delivered to Client"
                                >
                                  ✓ Deliver
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => openOrderDetail(o.id)}
                                style={{ padding: '4px 8px', fontSize: 11 }}
                              >
                                Manage
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => {
                                  setOrderToPrint(o);
                                  setShowPrintModal(true);
                                }}
                                style={{ padding: '4px 8px', fontSize: 11, background: 'none', border: '1px solid var(--border)' }}
                                title="Print Job Slip"
                              >
                                🖨️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Page {page} of {totalPages} ({totalOrders} orders)
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="btn btn-sm"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="btn btn-sm"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 2: STAFF WAGES & PAYOUTS (OPTION A - STANDALONE)
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'payouts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Header Action Card */}
          <div style={{
            background: 'var(--white)',
            padding: 16,
            borderRadius: 10,
            border: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                Tailor Piece Wages &amp; Payment Ledger
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Option A: Independent wage tracking for client salwar stitching, pieces stitched, payouts &amp; pending balances.
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowPayoutModal(true)}
              style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}
            >
              💵 + Record Staff Payout
            </button>
          </div>

          {/* Tailor Balances Summary Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
              Worker Earnings &amp; Outstanding Balances
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 12px' }}>Tailor / Staff</th>
                    <th style={{ padding: '10px 12px' }}>Branch</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Orders Assigned</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Pcs Stitched</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Wages Earned</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Paid to Date</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Balance Due</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutLoading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20 }}>Loading tailor balances...</td></tr>
                  ) : staffLedger.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>No tailor assignments found yet.</td></tr>
                  ) : (
                    staffLedger.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{s.staff_name}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={s.branch?.toLowerCase() === 'bajpe' ? 'badge b-blue' : 'badge b-purple'}>
                            {s.branch || 'Bajpe'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{s.total_orders}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>
                          {s.total_pcs_completed} / {s.total_pcs_assigned}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                          {fmt(s.total_wage_earned)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                          {fmt(s.total_paid)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: s.pending_balance > 0 ? '#ef4444' : '#10b981' }}>
                          {fmt(s.pending_balance)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              setPayoutForm({
                                staff_id: s.staff_id || '',
                                staff_name: s.staff_name,
                                branch: s.branch || 'Bajpe',
                                amount: s.pending_balance > 0 ? String(s.pending_balance) : '',
                                payment_mode: 'cash',
                                payment_date: new Date().toISOString().slice(0, 10),
                                reference_order_id: '',
                                notes: '',
                              });
                              setShowPayoutModal(true);
                            }}
                            style={{ padding: '4px 8px', fontSize: 11, background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 700 }}
                          >
                            Pay Worker
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Payout Vouchers Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
              Recent Payout Vouchers &amp; Receipts
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ margin: 0, width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Staff Name</th>
                    <th style={{ padding: '10px 12px' }}>Branch</th>
                    <th style={{ padding: '10px 12px' }}>Payment Mode</th>
                    <th style={{ padding: '10px 12px' }}>Ref Order</th>
                    <th style={{ padding: '10px 12px' }}>Notes</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount Paid</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutsHistory.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No payout vouchers recorded yet.</td></tr>
                  ) : (
                    payoutsHistory.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px' }}>{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{p.staff_name}</td>
                        <td style={{ padding: '10px 12px' }}>{p.branch}</td>
                        <td style={{ padding: '10px 12px', textTransform: 'uppercase', fontSize: 11 }}>{p.payment_mode}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{p.order_no || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{p.notes || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                          {fmt(p.amount)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleDeletePayout(p.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                            title="Delete payout voucher"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL: NEW CLIENT INTAKE
      ══════════════════════════════════════════════════════════════════════════ */}
      {showNewModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--white)',
            borderRadius: 12,
            width: '100%',
            maxWidth: 620,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                🧵 New Client Salwar Job Work Intake
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Client & Branch Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ayesha Boutique"
                    value={newForm.client_name}
                    onChange={e => setNewForm({ ...newForm, client_name: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Client Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={newForm.client_phone}
                    onChange={e => setNewForm({ ...newForm, client_phone: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Dates & Branch Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Date Collected *
                  </label>
                  <input
                    type="date"
                    required
                    value={newForm.received_date}
                    onChange={e => setNewForm({ ...newForm, received_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Target Delivery
                  </label>
                  <input
                    type="date"
                    value={newForm.target_delivery_date}
                    onChange={e => setNewForm({ ...newForm, target_delivery_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Branch Assigned *
                  </label>
                  <select
                    value={newForm.branch}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '__add_new__') {
                        promptNewBranch(name => setNewForm(prev => ({ ...prev, branch: name })));
                      } else {
                        setNewForm({ ...newForm, branch: val });
                      }
                    }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13, fontWeight: 700 }}
                  >
                    {branches.map(b => (
                      <option key={b} value={b}>{b} Branch</option>
                    ))}
                    <option value="__add_new__" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                      ➕ + Add New Branch...
                    </option>
                  </select>
                </div>
              </div>

              {/* Quantity, Rate & Total */}
              <div style={{
                background: 'var(--bg)',
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12
              }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Total Raw Pcs Collected *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 50"
                    value={newForm.total_pcs}
                    onChange={e => setNewForm({ ...newForm, total_pcs: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 14, fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Stitching Charge / Pc ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 150"
                    value={newForm.client_rate_per_pc}
                    onChange={e => setNewForm({ ...newForm, client_rate_per_pc: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 14, fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    Total Client Bill
                  </label>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent)', paddingTop: 8 }}>
                    {fmt(Number(newForm.total_pcs || 0) * Number(newForm.client_rate_per_pc || 0))}
                  </div>
                </div>
              </div>

              {/* Advance Paid */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                  Advance Paid by Client ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1000 (Optional)"
                  value={newForm.amount_paid}
                  onChange={e => setNewForm({ ...newForm, amount_paid: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
                />
              </div>

              {/* Initial Tailor Assignment Section */}
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                  Assign to Tailor (Optional - can also assign later)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Tailor Name</label>
                    <input
                      type="text"
                      list="staffListOptions"
                      placeholder="Select or enter tailor name"
                      value={newForm.staff_name}
                      onChange={e => {
                        const val = e.target.value;
                        const match = staffList.find(s => s.name?.toLowerCase() === val.toLowerCase());
                        setNewForm({
                          ...newForm,
                          staff_name: val,
                          staff_id: match ? match.id : '',
                          staff_rate: match?.rate_per_pc ? String(match.rate_per_pc) : newForm.staff_rate,
                        });
                      }}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: 6, fontSize: 12 }}
                    />
                    <datalist id="staffListOptions">
                      {staffList.map(s => <option key={s.id} value={s.name}>{s.name} ({s.role || 'Staff'})</option>)}
                    </datalist>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Tailor Wage per Pc ({currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 70"
                      value={newForm.staff_rate}
                      onChange={e => setNewForm({ ...newForm, staff_rate: e.target.value })}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: 6, fontSize: 12 }}
                    />
                  </div>
                </div>
              </div>

              {/* Initial Job Expense Section */}
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                  Initial Job Expenses (Optional)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <input
                    type="text"
                    placeholder="Expense title (e.g. Threads & Zippers, Lining)"
                    value={newForm.initial_expense_title}
                    onChange={e => setNewForm({ ...newForm, initial_expense_title: e.target.value })}
                    style={{ width: '100%', padding: '7px 9px', borderRadius: 6, fontSize: 12 }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Amount (${currency})`}
                    value={newForm.initial_expense_amount}
                    onChange={e => setNewForm({ ...newForm, initial_expense_amount: e.target.value })}
                    style={{ width: '100%', padding: '7px 9px', borderRadius: 6, fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                  Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Design details, client delivery notes, etc."
                  value={newForm.notes}
                  onChange={e => setNewForm({ ...newForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 12 }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowNewModal(false)}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontWeight: 800 }}
                >
                  Save &amp; Create Job Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL: QUICK MARK DELIVERED
      ══════════════════════════════════════════════════════════════════════════ */}
      {showDeliverModal && orderToDeliver && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--white)',
            borderRadius: 12,
            width: '100%',
            maxWidth: 420,
            padding: 20,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
              🚀 Mark Order as Delivered
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
              Confirm delivery of <strong>{orderToDeliver.total_pcs} pcs</strong> for client <strong>{orderToDeliver.client_name}</strong> ({orderToDeliver.order_no}).
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                Delivery Date
              </label>
              <input
                type="date"
                required
                value={deliverDate}
                onChange={e => setDeliverDate(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => { setShowDeliverModal(false); setOrderToDeliver(null); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleMarkDelivered}
                style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 800 }}
              >
                Confirm Delivery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL: RECORD STAFF PAYOUT (OPTION A)
      ══════════════════════════════════════════════════════════════════════════ */}
      {showPayoutModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--white)',
            borderRadius: 12,
            width: '100%',
            maxWidth: 480,
            padding: 22,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                💵 Record Tailor Payout / Wage Payment
              </div>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayout} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                  Tailor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tailor Ahmed"
                  value={payoutForm.staff_name}
                  onChange={e => setPayoutForm({ ...payoutForm, staff_name: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Branch *
                  </label>
                  <select
                    value={payoutForm.branch}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '__add_new__') {
                        promptNewBranch(name => setPayoutForm(prev => ({ ...prev, branch: name })));
                      } else {
                        setPayoutForm({ ...payoutForm, branch: val });
                      }
                    }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 12 }}
                  >
                    {branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="__add_new__" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                      ➕ + Add New Branch...
                    </option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Amount Paid ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 2500"
                    value={payoutForm.amount}
                    onChange={e => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13, fontWeight: 800 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Payment Mode
                  </label>
                  <select
                    value={payoutForm.payment_mode}
                    onChange={e => setPayoutForm({ ...payoutForm, payment_mode: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 12 }}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / GPay</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payoutForm.payment_date}
                    onChange={e => setPayoutForm({ ...payoutForm, payment_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                  Notes / Receipt Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advance paid for Job Work #12"
                  value={payoutForm.notes}
                  onChange={e => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowPayoutModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#059669', borderColor: '#059669', fontWeight: 800 }}
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          DRAWER: ORDER DETAIL, TAILOR ASSIGNMENTS & EXPENSES
      ══════════════════════════════════════════════════════════════════════════ */}
      {showDetailDrawer && selectedOrder && detailData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--white)',
            width: '100%',
            maxWidth: 640,
            height: '100%',
            overflowY: 'auto',
            padding: 24,
            boxShadow: '-4px 0 25px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18
          }}>
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)', fontFamily: 'monospace' }}>
                    {selectedOrder.order_no}
                  </span>
                  <span className={selectedOrder.branch?.toLowerCase() === 'bajpe' ? 'badge b-blue' : 'badge b-purple'}>
                    📍 {selectedOrder.branch}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
                  {selectedOrder.client_name} {selectedOrder.client_phone ? `· ${selectedOrder.client_phone}` : ''}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setOrderToPrint(selectedOrder);
                    setShowPrintModal(true);
                  }}
                  style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  🖨️ Slip
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetailDrawer(false)}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', padding: '0 4px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Financial Overview Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              background: 'var(--bg)',
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--border)'
            }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>CLIENT BILL</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                  {fmt(detailData.summary.clientTotal)}
                </div>
                <div style={{ fontSize: 10, color: detailData.summary.balanceDue > 0 ? '#ef4444' : '#10b981' }}>
                  {detailData.summary.balanceDue > 0 ? `Due: ${fmt(detailData.summary.balanceDue)}` : 'Paid'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>STAFF WAGES</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                  {fmt(detailData.summary.totalStaffWage)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Labor Cost</div>
              </div>

              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>JOB EXPENSES</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#6366f1', marginTop: 2 }}>
                  {fmt(detailData.summary.totalExpenses)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Trims / Direct</div>
              </div>

              <div>
                <div style={{ fontSize: 10, color: '#047857', fontWeight: 800 }}>NET PROFIT</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#065f46', marginTop: 2 }}>
                  {fmt(detailData.summary.netProfit)}
                </div>
                <div style={{ fontSize: 10, color: '#059669', fontWeight: 700 }}>
                  Margin: {detailData.summary.profitMarginPct}%
                </div>
              </div>
            </div>

            {/* Client Payment Quick Updater */}
            <div style={{
              background: 'var(--white)',
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Client Payment Status</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Paid: <strong>{fmt(selectedOrder.amount_paid)}</strong> · Outstanding: <strong style={{ color: selectedOrder.balance_due > 0 ? '#ef4444' : '#10b981' }}>{fmt(selectedOrder.balance_due)}</strong>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleUpdatePayment}
                style={{ fontSize: 11, fontWeight: 700 }}
              >
                ✏️ Update Payment
              </button>
            </div>

            {/* Delivery Status & Action */}
            <div style={{
              background: selectedOrder.status === 'delivered' ? '#ecfdf5' : '#fffbeb',
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${selectedOrder.status === 'delivered' ? '#a7f3d0' : '#fde68a'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: selectedOrder.status === 'delivered' ? '#065f46' : '#92400e' }}>
                  Delivery Status: {selectedOrder.status === 'delivered' ? 'DELIVERED BACK TO CLIENT' : 'IN WORKSHOP'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {selectedOrder.status === 'delivered'
                    ? `Delivered on ${new Date(selectedOrder.delivered_date).toLocaleDateString('en-IN')}`
                    : `Target Date: ${selectedOrder.target_delivery_date ? new Date(selectedOrder.target_delivery_date).toLocaleDateString('en-IN') : 'Not specified'}`}
                </div>
              </div>
              {selectedOrder.status !== 'delivered' && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setOrderToDeliver(selectedOrder);
                    setDeliverDate(new Date().toISOString().slice(0, 10));
                    setShowDeliverModal(true);
                  }}
                  style={{ background: '#10b981', color: '#fff', border: 'none', fontWeight: 700 }}
                >
                  🚀 Mark Delivered
                </button>
              )}
            </div>

            {/* Section 1: Staff Stitching Assignments */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                background: 'var(--bg)',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                  👷 Tailor Piece Assignments ({detailData.assignments.length})
                </div>
              </div>

              {/* Assignment List */}
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detailData.assignments.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 12 }}>
                    No tailors assigned yet. Use the form below to assign pieces.
                  </div>
                ) : (
                  detailData.assignments.map(a => (
                    <div key={a.id} style={{
                      background: 'var(--white)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>
                          {a.staff_name} <span className="badge b-blue" style={{ fontSize: 9 }}>{a.branch}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          Assigned: <strong>{a.pcs_assigned} pcs</strong> @ {fmt(a.rate_per_pc)}/pc = {fmt(a.total_wage)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: a.pcs_completed >= a.pcs_assigned ? '#10b981' : '#f59e0b' }}>
                            {a.pcs_completed} / {a.pcs_assigned} Stitched
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateAssignmentPcs(a.id, a.pcs_assigned, a.pcs_completed)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, padding: 0, fontWeight: 700 }}
                          >
                            ✏️ Update Pcs
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAssignment(a.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                          title="Remove assignment"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {/* Add Assignment Subform */}
                <form onSubmit={handleAddAssignment} style={{
                  background: 'var(--bg)',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px dashed var(--border)',
                  marginTop: 6
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>+ Assign Tailor for this Order</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 6 }}>
                    <input
                      type="text"
                      list="staffListOptionsDrawer"
                      required
                      placeholder="Tailor name"
                      value={assignForm.staff_name}
                      onChange={e => {
                        const val = e.target.value;
                        const match = staffList.find(s => s.name?.toLowerCase() === val.toLowerCase());
                        setAssignForm({
                          ...assignForm,
                          staff_name: val,
                          staff_id: match ? match.id : '',
                          rate_per_pc: match?.rate_per_pc ? String(match.rate_per_pc) : assignForm.rate_per_pc,
                        });
                      }}
                      style={{ padding: '6px 8px', borderRadius: 4, fontSize: 11 }}
                    />
                    <datalist id="staffListOptionsDrawer">
                      {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </datalist>

                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="Pcs"
                      value={assignForm.pcs_assigned}
                      onChange={e => setAssignForm({ ...assignForm, pcs_assigned: e.target.value })}
                      style={{ padding: '6px 8px', borderRadius: 4, fontSize: 11 }}
                    />

                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder={`Rate (${currency})`}
                      value={assignForm.rate_per_pc}
                      onChange={e => setAssignForm({ ...assignForm, rate_per_pc: e.target.value })}
                      style={{ padding: '6px 8px', borderRadius: 4, fontSize: 11 }}
                    />

                    <select
                      value={assignForm.branch}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__add_new__') {
                          promptNewBranch(name => setAssignForm(prev => ({ ...prev, branch: name })));
                        } else {
                          setAssignForm({ ...assignForm, branch: val });
                        }
                      }}
                      style={{ padding: '6px 8px', borderRadius: 4, fontSize: 11 }}
                    >
                      {branches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                      <option value="__add_new__" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        ➕ + Branch...
                      </option>
                    </select>

                    <button type="submit" className="btn btn-sm btn-primary" style={{ padding: '6px 12px', fontSize: 11 }}>
                      Assign
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Section 2: Direct Job Expenses */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                background: 'var(--bg)',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                  🧾 Direct Materials &amp; Job Expenses ({detailData.expenses.length})
                </div>
              </div>

              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detailData.expenses.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 10 }}>
                    No expenses logged for this order.
                  </div>
                ) : (
                  detailData.expenses.map(ex => (
                    <div key={ex.id} style={{
                      background: 'var(--white)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{ex.expense_title}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {new Date(ex.expense_date).toLocaleDateString('en-IN')} {ex.notes ? `· ${ex.notes}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 12, color: '#4f46e5' }}>{fmt(ex.amount)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(ex.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                          title="Delete expense"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {/* Add Expense Subform */}
                <form onSubmit={handleAddExpense} style={{
                  background: 'var(--bg)',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px dashed var(--border)',
                  marginTop: 6
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>+ Add Expense for this Job</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 6 }}>
                    <input
                      type="text"
                      required
                      placeholder="Title (e.g. Zips, Thread, Elastic)"
                      value={expenseForm.expense_title}
                      onChange={e => setExpenseForm({ ...expenseForm, expense_title: e.target.value })}
                      style={{ padding: '6px 8px', borderRadius: 4, fontSize: 11 }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder={`Amount (${currency})`}
                      value={expenseForm.amount}
                      onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      style={{ padding: '6px 8px', borderRadius: 4, fontSize: 11 }}
                    />
                    <button type="submit" className="btn btn-sm btn-primary" style={{ padding: '6px 12px', fontSize: 11 }}>
                      Add
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Danger Zone: Delete Order */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleDeleteOrder(selectedOrder.id)}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >
                🗑️ Delete Entire Job Order
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowDetailDrawer(false)}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          PRINTABLE JOB SLIP MODAL
      ══════════════════════════════════════════════════════════════════════════ */}
      {showPrintModal && orderToPrint && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: '#fff',
            color: '#000',
            borderRadius: 12,
            width: '100%',
            maxWidth: 500,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            fontFamily: 'monospace'
          }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>VIVA STUDIO</div>
              <div style={{ fontSize: 11 }}>CLIENT SALWAR STITCHING JOB SLIP</div>
              <div style={{ fontSize: 10, marginTop: 4 }}>Branch: {orderToPrint.branch}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span>Order No:</span>
              <strong>{orderToPrint.order_no}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span>Date Collected:</span>
              <span>{orderToPrint.received_date ? new Date(orderToPrint.received_date).toLocaleDateString('en-IN') : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span>Client Name:</span>
              <strong>{orderToPrint.client_name}</strong>
            </div>
            {orderToPrint.client_phone && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span>Client Phone:</span>
                <span>{orderToPrint.client_phone}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 12 }}>
              <span>Target Delivery:</span>
              <span>{orderToPrint.target_delivery_date ? new Date(orderToPrint.target_delivery_date).toLocaleDateString('en-IN') : 'Standard'}</span>
            </div>

            <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '8px 0', margin: '10px 0', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Salwar Pieces Received:</span>
                <strong>{orderToPrint.total_pcs} pcs</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Rate per Piece:</span>
                <span>{fmt(orderToPrint.client_rate_per_pc)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14 }}>
                <span>Total Amount:</span>
                <span>{fmt(orderToPrint.client_total_amount)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>Advance Paid:</span>
              <span>{fmt(orderToPrint.amount_paid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, marginBottom: 14 }}>
              <span>Balance Due on Delivery:</span>
              <span>{fmt(orderToPrint.client_total_amount - orderToPrint.amount_paid)}</span>
            </div>

            {orderToPrint.notes && (
              <div style={{ fontSize: 10, border: '1px solid #ccc', padding: 6, borderRadius: 4, marginBottom: 14 }}>
                Notes: {orderToPrint.notes}
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: 9, color: '#555', borderTop: '1px dashed #000', paddingTop: 8, marginBottom: 16 }}>
              Please present this slip at the time of delivery collection. Thank you!
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowPrintModal(false)}
                style={{ fontFamily: 'sans-serif' }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => window.print()}
                style={{ fontFamily: 'sans-serif', fontWeight: 700 }}
              >
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL: ADD NEW BRANCH DYNAMICALLY
      ══════════════════════════════════════════════════════════════════════════ */}
      {showAddBranchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: 16
        }}>
          <div style={{
            background: 'var(--white)',
            borderRadius: 12,
            width: '100%',
            maxWidth: 380,
            padding: 20,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
              🏢 Add New Branch
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>
              Create a new workshop location or stitching branch.
            </p>

            <form onSubmit={handleCreateBranch} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                  Branch Name *
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Mangalore, Udupi, Kavoor..."
                  value={newBranchInput}
                  onChange={e => setNewBranchInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowAddBranchModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 800 }}
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

