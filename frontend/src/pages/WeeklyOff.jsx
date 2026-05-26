import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import {
  Calendar, RefreshCw, RotateCcw, CheckCircle2, AlertTriangle,
  Users, Search, ChevronLeft, ChevronRight, Edit2, X, Check,
  BarChart3, Zap, Shield
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAY_COLORS = {
  Monday:    { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', dot: '#3b82f6' },
  Tuesday:   { bg: '#f0fdf4', border: '#22c55e', text: '#15803d', dot: '#22c55e' },
  Wednesday: { bg: '#faf5ff', border: '#a855f7', text: '#7e22ce', dot: '#a855f7' },
  Thursday:  { bg: '#fff7ed', border: '#f97316', text: '#c2410c', dot: '#f97316' },
  Friday:    { bg: '#fdf4ff', border: '#e879f9', text: '#86198f', dot: '#e879f9' },
  Saturday:  { bg: '#f0fdfa', border: '#14b8a6', text: '#0f766e', dot: '#14b8a6' },
  Sunday:    { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c', dot: '#ef4444' },
};

export default function WeeklyOff() {
  const navigate = useNavigate();
  const [distribution, setDistribution] = useState(null);
  const [roster, setRoster]             = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalPages, setTotalPages]     = useState(1);
  const [page, setPage]                 = useState(1);
  const [filterDay, setFilterDay]       = useState('');
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]                   = useState(null);
  const [editingId, setEditingId]       = useState(null);
  const [editDay, setEditDay]           = useState('');

  // Stable helper — reads token at call time, never causes re-renders
  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  });

  const fetchDistribution = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/weekly-off-distribution`, { headers: getHeaders() });
      setDistribution(res.data);
    } catch (e) {
      console.error('Distribution fetch error:', e);
      if (e.response?.status === 401) navigate('/login');
    }
  }, []);

  const fetchRoster = useCallback(async (p = page, day = filterDay) => {
    setLoading(true);
    try {
      const params = { page: p, page_size: 50 };
      if (day) params.day = day;
      const res = await axios.get(`${API_URL}/weekly-off-roster`, { headers: getHeaders(), params });
      setRoster(res.data.employees || []);
      setTotalEmployees(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } catch (e) {
      console.error('Roster fetch error:', e);
      if (e.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [page, filterDay]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    fetchDistribution();
    fetchRoster(1, '');
  }, []);

  const handleDayFilter = (day) => {
    const newDay = filterDay === day ? '' : day;
    setFilterDay(newDay);
    setPage(1);
    fetchRoster(1, newDay);
  };

  const handleAssign = async (force = false) => {
    setActionLoading('assign');
    setMsg(null);
    try {
      const res = await axios.post(`${API_URL}/assign-weekly-offs`, { force_reassign: force }, { headers: getHeaders() });
      setMsg({
        type: 'success',
        text: `✅ Fair assignment complete! ${res.data.assignments_made} employees assigned across 7 days.`,
        data: res.data,
      });
      await fetchDistribution();
      await fetchRoster(1, filterDay);
    } catch (e) {
      setMsg({ type: 'error', text: `❌ ${e.response?.data?.detail || 'Assignment failed'}` });
      if (e.response?.status === 401) navigate('/login');
    } finally {
      setActionLoading('');
    }
  };

  const handleRotate = async () => {
    setActionLoading('rotate');
    setMsg(null);
    try {
      const res = await axios.post(`${API_URL}/rotate-weekly-offs`, { week_offset: 1 }, { headers: getHeaders() });
      setMsg({
        type: 'success',
        text: `🔄 Rotated ${res.data.rotated} employees' weekly off by 1 day for fairness.`,
      });
      await fetchDistribution();
      await fetchRoster(1, filterDay);
    } catch (e) {
      setMsg({ type: 'error', text: `❌ ${e.response?.data?.detail || 'Rotation failed'}` });
      if (e.response?.status === 401) navigate('/login');
    } finally {
      setActionLoading('');
    }
  };

  const handleUpdateDay = async (empId, newDay) => {
    try {
      await axios.patch(`${API_URL}/employees/${empId}/weekly-off`, { weekly_off: newDay }, { headers: getHeaders() });
      setEditingId(null);
      setMsg({ type: 'success', text: `✅ Weekly off updated to ${newDay}` });
      await fetchDistribution();
      await fetchRoster(page, filterDay);
    } catch (e) {
      setMsg({ type: 'error', text: `❌ ${e.response?.data?.detail || 'Update failed'}` });
      if (e.response?.status === 401) navigate('/login');
    }
  };

  const filteredRoster = search
    ? roster.filter(e =>
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.emp_id?.toLowerCase().includes(search.toLowerCase()) ||
        e.role?.toLowerCase().includes(search.toLowerCase())
      )
    : roster;

  const idealPerDay = distribution?.ideal_per_day ?? 0;
  const balanceScore = distribution?.balance_score ?? 0;

  return (
    <DashboardLayout title="Weekly Off Management">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>
              Fair Weekly Off Distribution
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              AI-powered balanced weekly off assignment across all 7 days
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleAssign(false)}
              disabled={!!actionLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '13px',
                opacity: actionLoading ? 0.7 : 1,
              }}
            >
              <Zap size={15} />
              {actionLoading === 'assign' ? 'Assigning...' : 'Auto Assign'}
            </button>
            <button
              onClick={() => handleAssign(true)}
              disabled={!!actionLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: '10px',
                background: '#111827', color: '#fff', border: 'none',
                cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                opacity: actionLoading ? 0.7 : 1,
              }}
            >
              <Shield size={15} />
              {actionLoading === 'assign' ? '...' : 'Force Reassign All'}
            </button>
            <button
              onClick={handleRotate}
              disabled={!!actionLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: '10px',
                background: '#fff', color: '#374151', border: '1px solid #d1d5db',
                cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                opacity: actionLoading ? 0.7 : 1,
              }}
            >
              <RotateCcw size={15} />
              {actionLoading === 'rotate' ? 'Rotating...' : 'Rotate +1 Day'}
            </button>
          </div>
        </div>

        {/* ── Message Banner ────────────────────────────────────────────────── */}
        {msg && (
          <div style={{
            padding: '14px 18px', borderRadius: '12px',
            background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${msg.type === 'success' ? '#86efac' : '#fca5a5'}`,
            color: msg.type === 'success' ? '#166534' : '#b91c1c',
            fontSize: '13px', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            {msg.type === 'success'
              ? <CheckCircle2 size={16} />
              : <AlertTriangle size={16} />}
            {msg.text}
            <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Stats Row ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          {[
            { label: 'Total Employees', value: distribution?.total_employees ?? '—', icon: Users, color: '#3b82f6' },
            { label: 'Balance Score', value: `${balanceScore}%`, icon: BarChart3, color: balanceScore >= 95 ? '#22c55e' : balanceScore >= 80 ? '#f59e0b' : '#ef4444' },
            { label: 'Ideal / Day', value: idealPerDay ? `~${Math.round(idealPerDay)}` : '—', icon: Calendar, color: '#8b5cf6' },
            { label: 'Unassigned', value: distribution?.unassigned ?? '—', icon: AlertTriangle, color: (distribution?.unassigned ?? 0) > 0 ? '#f59e0b' : '#22c55e' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{
              background: '#fff', borderRadius: '14px', padding: '20px',
              border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '14px',
            }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={color} />
              </div>
              <div>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>{value}</p>
                <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0 0' }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Distribution Chart ────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '20px' }}>
            Weekly Off Distribution by Day
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
            {DAYS.map(day => {
              const count = distribution?.distribution?.[day] ?? 0;
              const pct = idealPerDay > 0 ? Math.min(100, (count / idealPerDay) * 100) : 0;
              const c = DAY_COLORS[day];
              const isSelected = filterDay === day;
              return (
                <div
                  key={day}
                  onClick={() => handleDayFilter(day)}
                  style={{
                    cursor: 'pointer', borderRadius: '12px', padding: '14px 10px',
                    background: isSelected ? c.bg : '#f9fafb',
                    border: `2px solid ${isSelected ? c.border : '#e5e7eb'}`,
                    textAlign: 'center', transition: 'all 0.2s',
                  }}
                >
                  <p style={{ fontSize: '11px', fontWeight: 700, color: isSelected ? c.text : '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {day.slice(0, 3)}
                  </p>
                  {/* Bar */}
                  <div style={{ height: '60px', background: '#e5e7eb', borderRadius: '6px', position: 'relative', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: `${pct}%`, background: c.dot,
                      borderRadius: '6px', transition: 'height 0.4s ease',
                    }} />
                  </div>
                  <p style={{ fontSize: '18px', fontWeight: 800, color: isSelected ? c.text : '#111827', margin: 0 }}>{count}</p>
                  <p style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0 0 0' }}>employees</p>
                </div>
              );
            })}
          </div>
          {filterDay && (
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Filtered by:</span>
              <span style={{
                padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                background: DAY_COLORS[filterDay].bg, color: DAY_COLORS[filterDay].text,
                border: `1px solid ${DAY_COLORS[filterDay].border}`,
              }}>
                {filterDay}
              </span>
              <button onClick={() => { setFilterDay(''); fetchRoster(1, ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '12px' }}>
                Clear filter ×
              </button>
            </div>
          )}
        </div>

        {/* ── Roster Table ─────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>
              Employee Roster {filterDay && `— ${filterDay}`}
              <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>({totalEmployees} employees)</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 12px', minWidth: '220px' }}>
              <Search size={14} color="#9ca3af" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, ID, role..."
                style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', color: '#374151', width: '100%' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Emp ID', 'Name', 'Role', 'Department', 'Weekly Off', 'Action'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading...</td></tr>
                ) : filteredRoster.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No employees found.</td></tr>
                ) : filteredRoster.map(emp => {
                  const c = DAY_COLORS[emp.weekly_off] || { bg: '#f3f4f6', border: '#d1d5db', text: '#374151', dot: '#9ca3af' };
                  const isEditing = editingId === emp.id;
                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>{emp.emp_id}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{emp.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>{emp.role}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>{emp.department}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {isEditing ? (
                          <select
                            value={editDay}
                            onChange={e => setEditDay(e.target.value)}
                            autoFocus
                            style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px', fontWeight: 600 }}
                          >
                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                            background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.dot }} />
                            {emp.weekly_off}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleUpdateDay(emp.id, editDay)} style={{ background: '#22c55e', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#fff' }}>
                              <Check size={13} />
                            </button>
                            <button onClick={() => setEditingId(null)} style={{ background: '#ef4444', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#fff' }}>
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(emp.id); setEditDay(emp.weekly_off); }}
                            style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#374151' }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                Page {page} of {totalPages} · {totalEmployees} total
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchRoster(p, filterDay); }}
                  disabled={page === 1}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchRoster(p, filterDay); }}
                  disabled={page === totalPages}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
