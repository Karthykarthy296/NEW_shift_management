import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { AlertPanel } from '../components/DashboardLayout';
import { UserPlus, Calendar, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

export default function WeeklyOffSwap() {
  const [employee1Name, setEmployee1Name] = useState('');
  const [employee2Name, setEmployee2Name] = useState('');
  const [targetOffDay, setTargetOffDay] = useState('');
  const [employees, setEmployees] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'User';

  const fetchEmployees = async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      const res = await axios.get(`${API_URL}/employees`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setEmployees(res.data);
    } catch (e) {
      console.error(e);
      if (e.response?.status === 401) navigate('/login');
    }
  };

  const fetchSwaps = async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      const res = await axios.get(`${API_URL}/weekly-off-swaps`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setSwaps(res.data);
    } catch (e) {
      console.error(e);
      if (e.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchSwaps();
  }, []);

  const handleRequestSwap = async (e) => {
    e.preventDefault();
    setMsg('');
    setMsgType('');
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      const res = await axios.post(`${API_URL}/request-weekly-off-swap`, 
        { 
          employee_1_name: employee1Name,
          employee_2_name: employee2Name,
          target_off_day: targetOffDay
        },
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      setMsg(res.data.msg);
      setMsgType('success');
      setEmployee1Name('');
      setEmployee2Name('');
      setTargetOffDay('');
      fetchSwaps();
    } catch (error) {
      setMsg(error.response?.data?.detail || 'Error requesting swap');
      setMsgType('danger');
      if (error.response?.status === 401) navigate('/login');
    }
  };

  const handleApproveSwap = async (swapId, approve) => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      await axios.post(`${API_URL}/approve-weekly-off-swap`, 
        { 
          swap_id: swapId,
          approve: approve
        },
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      setMsg(approve ? 'Swap approved successfully' : 'Swap rejected');
      setMsgType('success');
      fetchSwaps();
    } catch (error) {
      setMsg(error.response?.data?.detail || 'Error processing swap');
      setMsgType('danger');
      if (error.response?.status === 401) navigate('/login');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="badge" style={{ background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Pending</span>;
      case 'approved':
        return <span className="badge" style={{ background: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Approved</span>;
      case 'rejected':
        return <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Rejected</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <DashboardLayout title="Weekly Off Swap" role={role.charAt(0).toUpperCase() + role.slice(1)}>
      {msg && <AlertPanel title="Status" message={msg} type={msgType} />}
      
      <div className="card">
        <div className="card-title">
          <span>Request Weekly Off Swap</span>
          <UserPlus size={18} color="var(--primary)" />
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-sub)', marginBottom: '20px' }}>
          Exchange weekly off days with another employee. AI will validate the request automatically.
        </p>
        <form onSubmit={handleRequestSwap} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-sub)', marginBottom: '4px', display: 'block' }}>
                Your Name
              </label>
              <select 
                className="input-field" 
                value={employee1Name}
                onChange={e => setEmployee1Name(e.target.value)}
                required
                style={{ width: '100%' }}
              >
                <option value="">Select employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name} ({emp.emp_id})</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-sub)', marginBottom: '4px', display: 'block' }}>
                Swap With
              </label>
              <select 
                className="input-field" 
                value={employee2Name}
                onChange={e => setEmployee2Name(e.target.value)}
                required
                style={{ width: '100%' }}
              >
                <option value="">Select employee</option>
                {employees.filter(emp => emp.name !== employee1Name).map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name} ({emp.emp_id}) - {emp.weekly_off || 'No off'}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-sub)', marginBottom: '4px', display: 'block' }}>
              Target Off Day
            </label>
            <select 
              className="input-field" 
              value={targetOffDay}
              onChange={e => setTargetOffDay(e.target.value)}
              required
              style={{ width: '100%' }}
            >
              <option value="">Select target off day</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Request Swap</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-title">
          <span>Swap Requests</span>
          <RefreshCw size={18} color="var(--primary)" />
        </div>
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : swaps.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)', fontStyle: 'italic' }}>
            No swap requests yet.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Employee 1</th>
                  <th>Employee 2</th>
                  <th>Old Off Day</th>
                  <th>New Off Day</th>
                  <th>Status</th>
                  <th>AI Validation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {swaps.map(swap => (
                  <tr key={swap.id}>
                    <td>{swap.id}</td>
                    <td style={{ fontWeight: 600 }}>{swap.employee_1_name}</td>
                    <td style={{ fontWeight: 600 }}>{swap.employee_2_name}</td>
                    <td>{swap.old_off_day}</td>
                    <td>{swap.new_off_day}</td>
                    <td>{getStatusBadge(swap.status)}</td>
                    <td>
                      {swap.ai_validation_status && (
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: swap.ai_validation_status.valid ? 'green' : 'red' }}>
                            {swap.ai_validation_status.valid ? 'Valid' : 'Invalid'}
                          </span>
                          <div style={{ color: 'var(--text-sub)', fontSize: '10px', marginTop: '2px' }}>
                            {swap.ai_validation_status.details?.slice(0, 2).join(', ')}
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      {swap.status === 'pending' && (role === 'manager' || role === 'admin') && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleApproveSwap(swap.id, true)}
                            style={{ 
                              padding: '4px 8px', 
                              background: '#10b981', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '4px', 
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button 
                            onClick={() => handleApproveSwap(swap.id, false)}
                            style={{ 
                              padding: '4px 8px', 
                              background: '#ef4444', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '4px', 
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </DashboardLayout>
  );
}
