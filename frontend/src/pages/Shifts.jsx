import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { AlertPanel, ShiftDisplay } from '../components/DashboardLayout';
import { Clock, Save, X, Edit2, Lock, RefreshCw, Layers } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';



export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const role = localStorage.getItem('role') || '';
  const canEdit = role === 'admin' || role === 'manager' || role === 'supervisor';
  const today = new Date().toISOString().split('T')[0];

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


      <ShiftDisplay schedule={schedule} onUpdate={fetchSchedule} />

      {/* Keyframe injection */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </DashboardLayout>
  );
}
