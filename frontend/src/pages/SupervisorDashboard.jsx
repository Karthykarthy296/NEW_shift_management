import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { ShiftDisplay, AlertPanel } from '../components/DashboardLayout';
import { UserPlus } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

export default function SupervisorDashboard() {
  const [schedule, setSchedule] = useState(null);
  const [leaveName, setLeaveName] = useState('');
  const [msg, setMsg] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const navigate = useNavigate();

  const fetchSchedule = async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      const res = await axios.get(`${API_URL}/get-schedule?date=${today}`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setSchedule(res.data);
    } catch (e) {
      console.error(e);
      if (e.response?.status === 401) navigate('/login');
    }
  };

  useEffect(() => {
    fetchSchedule();
    // Fetch once on mount — no polling loop
  }, []);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setMsg('');
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      await axios.post(`${API_URL}/apply-leave`, 
        { employee_name: leaveName, date: today },
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      setMsg('Leave processed and shifts automatically reassigned by AI.');
      setLeaveName('');
      fetchSchedule();
    } catch (error) {
      setMsg('Error applying leave');
      if (error.response?.status === 401) navigate('/login');
    }
  };

  return (
    <DashboardLayout title="Supervisor Dashboard" role="Supervisor">
      {msg && <AlertPanel title="AI Action" message={msg} />}
      
      <div className="card">
        <div className="card-title">
          <span>Manage Leave</span>
          <UserPlus size={18} color="var(--primary)" />
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-sub)', marginBottom: '20px' }}>
          Enter employee name to process leave. AI will automatically reassign shifts to maintain balance.
        </p>
        <form onSubmit={handleApplyLeave} style={{ display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search Employee..." 
            value={leaveName}
            onChange={e => setLeaveName(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">Process Leave</button>
        </form>
      </div>

      <ShiftDisplay schedule={schedule} onUpdate={fetchSchedule} />
    </DashboardLayout>
  );
}
