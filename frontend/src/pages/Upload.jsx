import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { AlertPanel } from '../components/DashboardLayout';
import { Upload as UploadIcon, FileSpreadsheet } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

export default function Upload() {
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'User';

  const getToken = () => {
    const t = localStorage.getItem('token');
    if (!t) { navigate('/login'); return null; }
    return t;
  };

  React.useEffect(() => {
    const checkToken = async () => {
      const token = getToken();
      if (!token) return;
      try {
        // Simple ping to verify token visibility/validity
        await axios.get(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      } catch (e) {
        if (e.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      }
    };
    checkToken();
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
      console.log('Uploading file:', file.name);
      const res = await axios.post(`${API_URL}/upload-excel?type=employees`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      console.log('Upload response:', res.data);
      
      const responseMsg = res.data.msg || res.data.message || 'Upload successful';
      const employeesImported = res.data.employees_imported || 0;
      
      setMsg(`✓ Successfully imported ${employeesImported} employees. ${responseMsg}`);
      setMsgType('success');
      setTimeout(() => navigate(`/${role}/dashboard`), 2000); // Redirect after 2s so they see the success msg
    } catch (err) {
      console.error('Upload error:', err);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      const detail = err.response?.data?.detail || 'Upload failed. Please check the file format.';
      console.error('Error detail:', detail);
      setMsg(`✗ ${detail}`);
      setMsgType('danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Upload Data" role={role.charAt(0).toUpperCase() + role.slice(1)}>
      {msg && <AlertPanel title={msgType === 'success' ? 'Upload Successful' : 'System Message'} message={msg} type={msgType} />}

      <div className="card">
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
              { col: 'Employee ID', req: false, note: 'Flexible — auto-generated if missing' },
              { col: 'Name',        req: false, note: 'Flexible — fallbacks to ID if omitted' },
              { col: 'Skills',      req: false, note: 'Optional — comma separated list' },
              { col: 'Preferred Shift', req: false, note: 'Optional — e.g. Morning, Evening' },
              { col: 'Max Hours',   req: false, note: 'Optional — defaults to 40' },
              { col: 'Shift Name',  req: false, note: 'Optional — creates/updates shift definitions' },
              { col: 'Start Time',  req: false, note: 'Optional — e.g. 06:00' },
              { col: 'End Time',    req: false, note: 'Optional — e.g. 14:00' },
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
              <UploadIcon size={16} />
              Upload Excel File
            </>
          )}
          <input type="file" hidden accept=".xlsx,.xls" onChange={e => handleUpload(e.target.files[0])} disabled={loading} />
        </label>
        
        <p style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-sub)' }}>
          ○ = Flexible Column &nbsp;|&nbsp; The AI is highly permissive: if an ID or Name is missing, it will auto-generate one to ensure no data is lost.
        </p>
      </div>
    </DashboardLayout>
  );
}
