import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { ShiftDisplay, AlertPanel } from '../components/DashboardLayout';
import { Upload, FileSpreadsheet } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

export default function ManagerDashboard() {
  const [schedule, setSchedule] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const getToken = () => {
    const t = localStorage.getItem('token');
    if (!t) { navigate('/login'); return null; }
    return t;
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
      if (e.response?.status === 401) navigate('/login');
    }
  };

  useEffect(() => {
    fetchSchedule();
    const interval = setInterval(fetchSchedule, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    const token = getToken();
    if (!token) return;

    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    setMsg('');

    try {
      const res = await axios.post(`${API_URL}/upload-excel?type=employees`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setMsg(res.data.msg);
      setMsgType('success');
      fetchSchedule();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Upload failed. Please check the file format.';
      setMsg(detail);
      setMsgType('danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Manager Dashboard" role="Manager">
      {msg && <AlertPanel title={msgType === 'success' ? 'Upload Successful' : 'System Message'} message={msg} type={msgType} />}

      {/* Upload Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-title">
          <span>Employee Data Upload</span>
          <FileSpreadsheet size={18} color="var(--primary)" />
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-sub)', marginBottom: '20px' }}>
          Upload your Excel file. The AI will read all employee data, optionally update shift timings
          if provided, then <strong>automatically assign every employee</strong> to a shift —
          balancing workload and respecting preferences.
        </p>

        {/* Column reference */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Accepted Excel Columns
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              { col: 'Employee ID', req: false, note: 'Flexible — will be auto-generated if missing' },
              { col: 'Name',        req: false, note: 'Flexible — can use ID as name' },
              { col: 'Skills',      req: false, note: 'Optional — comma separated list' },
              { col: 'Preferred Shift', req: false, note: 'Optional — Morning/Afternoon/Evening/Night' },
              { col: 'Max Hours',   req: false, note: 'Optional — defaults to 40 hours' },
              { col: 'Shift Name',  req: false, note: 'Optional — creates/updates shift definitions' },
              { col: 'Start Time',  req: false, note: 'Optional — defaults if omitted' },
              { col: 'End Time',    req: false, note: 'Optional — defaults if omitted' },
            ].map(({ col, req, note }) => (
              <div key={col} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px' }}>
                <span style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  borderRadius: '4px', padding: '1px 6px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0
                }}>○ {col}</span>
                <span style={{ color: 'var(--text-sub)' }}>{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Predefined shifts info */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { name: 'Morning',   time: '06:00–12:00', color: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '🌅' },
            { name: 'Afternoon', time: '12:00–18:00', color: '#fef9c3', border: '#eab308', text: '#713f12', icon: '☀️' },
            { name: 'Evening',   time: '18:00–00:00', color: '#dbeafe', border: '#3b82f6', text: '#1e3a8a', icon: '🌆' },
            { name: 'Night',     time: '00:00–06:00', color: '#ede9fe', border: '#7c3aed', text: '#4c1d95', icon: '🌙' },
          ].map(s => (
            <div key={s.name} style={{
              padding: '8px 14px', borderRadius: '8px', background: s.color,
              border: `1px solid ${s.border}`, fontSize: '12px', color: s.text, fontWeight: 600
            }}>
              {s.icon} {s.name} · {s.time}
            </div>
          ))}
        </div>

        {/* Upload button */}
        <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
          {loading ? (
            <>
              <span style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              Processing...
            </>
          ) : (
            <>
              <Upload size={16} />
              Upload Excel File
            </>
          )}
          <input type="file" hidden accept=".xlsx,.xls" onChange={e => handleUpload(e.target.files[0])} disabled={loading} />
        </label>

        <p style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-sub)' }}>
          ○ = Flexible Column &nbsp;|&nbsp; The AI is highly permissive: if an ID or Name is missing, it will auto-generate one to ensure no data is lost.
        </p>
      </div>

      <ShiftDisplay schedule={schedule} onUpdate={fetchSchedule} />
    </DashboardLayout>
  );
}
