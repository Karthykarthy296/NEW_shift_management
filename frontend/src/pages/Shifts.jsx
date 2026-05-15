import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { AlertPanel, ShiftDisplay } from '../components/DashboardLayout';
import { Clock, Save, X, Edit2, Lock, RefreshCw, Layers } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

const SHIFT_META = {
  Morning:   { icon: '🌅', color: '#fef3c7', border: '#f59e0b', text: '#92400e', label: '06:00 AM – 12:00 PM' },
  Afternoon: { icon: '☀️',  color: '#fef9c3', border: '#eab308', text: '#713f12', label: '12:00 PM – 06:00 PM' },
  Evening:   { icon: '🌆', color: '#dbeafe', border: '#3b82f6', text: '#1e3a8a', label: '06:00 PM – 12:00 AM' },
  Night:     { icon: '🌙', color: '#ede9fe', border: '#7c3aed', text: '#4c1d95', label: '12:00 AM – 06:00 AM' },
};

export default function Shifts() {
  const [shifts, setShifts]       = useState([]);
  const [schedule, setSchedule]   = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData]   = useState({});
  const [msg, setMsg]             = useState('');
  const [msgType, setMsgType]     = useState('info');
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  const navigate  = useNavigate();
  const role      = localStorage.getItem('role') || '';
  const canEdit   = role === 'admin' || role === 'manager' || role === 'supervisor';
  const today     = new Date().toISOString().split('T')[0];

  const getToken = () => {
    const t = localStorage.getItem('token');
    if (!t) { navigate('/login'); return null; }
    return t;
  };

  const fetchShifts = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/shifts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShifts(res.data);
    } catch (err) {
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedule = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/get-schedule?date=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSchedule(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { 
    fetchShifts(); 
    fetchSchedule();
    const interval = setInterval(() => {
      fetchShifts();
      fetchSchedule();
    }, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const startEdit = (shift) => {
    setEditingId(shift.id);
    setEditData({
      start_time: shift.start_time,
      end_time: shift.end_time,
      required_employees: shift.required_employees,
    });
    setMsg('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSave = async (id) => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await axios.put(`${API_URL}/shifts/${id}`, editData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg(res.data.msg || 'Shift updated and schedule regenerated.');
      setMsgType('success');
      setEditingId(null);
      fetchShifts();
      fetchSchedule(); // Refresh live view too
    } catch (err) {
      setMsg(err.response?.data?.detail || 'Failed to update shift.');
      setMsgType('danger');
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Shift Timings"
      role={role.charAt(0).toUpperCase() + role.slice(1)}
    >
      {msg && (
        <AlertPanel
          title={msgType === 'success' ? 'AI Schedule Updated' : 'Error'}
          message={msg}
          type={msgType}
        />
      )}

      <div className="card">
        <div className="card-title">
          <div>
            <div style={{ fontWeight: 700 }}>Fixed Shift Configurations</div>
            <div style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: '2px' }}>
              {canEdit
                ? 'Click ✏️ to edit timings — AI will regenerate the schedule automatically.'
                : 'Shift timings are managed by Admin/Manager.'}
            </div>
          </div>
          {!canEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-sub)' }}>
              <Lock size={14} /> View only
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <p>Loading shifts...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {shifts.map(shift => {
              const meta = SHIFT_META[shift.name] || { icon: '⏰', color: '#f1f5f9', border: '#94a3b8', text: '#334155', label: '' };
              const isEditing = editingId === shift.id;

              return (
                <div
                  key={shift.id}
                  style={{
                    borderRadius: '12px',
                    border: `2px solid ${isEditing ? 'var(--primary)' : meta.border}`,
                    background: isEditing ? '#f0f7ff' : meta.color,
                    padding: '20px',
                    transition: 'all 0.2s',
                    boxShadow: isEditing ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
                  }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '28px' }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: isEditing ? 'var(--primary)' : meta.text }}>
                          {shift.name} Shift
                        </div>
                        <div style={{ fontSize: '11px', color: isEditing ? '#64748b' : meta.text, opacity: 0.7 }}>
                          4 fixed shifts · AI auto-assigned
                        </div>
                      </div>
                    </div>
                    {canEdit && !isEditing && (
                      <button
                        onClick={() => startEdit(shift)}
                        className="btn"
                        style={{ padding: '6px 10px', background: '#e0f2fe', color: '#0369a1', fontSize: '12px' }}
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                    )}
                  </div>

                  {/* Fields */}
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        Start Time
                        <input
                          type="time"
                          className="input-field"
                          style={{ marginTop: '4px' }}
                          value={editData.start_time}
                          onChange={e => setEditData(d => ({ ...d, start_time: e.target.value }))}
                        />
                      </label>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        End Time
                        <input
                          type="time"
                          className="input-field"
                          style={{ marginTop: '4px' }}
                          value={editData.end_time}
                          onChange={e => setEditData(d => ({ ...d, end_time: e.target.value }))}
                        />
                      </label>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                        Staff Required
                        <input
                          type="number"
                          min="1"
                          max="20"
                          className="input-field"
                          style={{ marginTop: '4px' }}
                          value={editData.required_employees}
                          onChange={e => setEditData(d => ({ ...d, required_employees: parseInt(e.target.value) || 1 }))}
                        />
                      </label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => handleSave(shift.id)}
                          disabled={saving}
                          className="btn btn-primary"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          {saving ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Save size={14} />}
                          {saving ? 'Saving & Running AI...' : 'Save & Trigger AI'}
                        </button>
                        <button onClick={cancelEdit} className="btn" style={{ padding: '8px 12px' }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: meta.text }}>
                        <Clock size={14} />
                        <span><strong>Start:</strong> {shift.start_time}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: meta.text }}>
                        <Clock size={14} />
                        <span><strong>End:</strong> {shift.end_time}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: meta.text }}>
                        <span style={{ marginLeft: 2 }}>👥</span>
                        <span><strong>Staff Required:</strong> {shift.required_employees}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: '6px', borderRadius: '8px' }}>
                <Layers size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Live Shift Assignments</h3>
        </div>
        <ShiftDisplay schedule={schedule} onUpdate={fetchSchedule} />
      </div>

      {/* Keyframe injection */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </DashboardLayout>
  );
}
