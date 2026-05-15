import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { AlertPanel, SearchContext } from '../components/DashboardLayout';

import { UserPlus, Calendar, RefreshCw } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

export default function Leaves() {
  const { searchQuery } = useContext(SearchContext);
  const [leaveName, setLeaveName] = useState('');
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [replacements, setReplacements] = useState([]);

  const today = new Date().toISOString().split('T')[0];
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'User';

  const fetchLeaves = async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;
    try {
      const res = await axios.get(`${API_URL}/leaves`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setLeaves(res.data);
    } catch (e) {
      console.error(e);
      if (e.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
    const interval = setInterval(fetchLeaves, 15000); // Auto-refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setMsg('');
    setReplacements([]);
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      const res = await axios.post(`${API_URL}/apply-leave`, 
        { employee_name: leaveName, date: today },
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      setMsg(res.data.msg);
      setReplacements(res.data.replacements || []);
      setLeaveName('');
      fetchLeaves();
    } catch (error) {
      setMsg(error.response?.data?.detail || 'Error applying leave');
      if (error.response?.status === 401) navigate('/login');
    }
  };

  return (
    <DashboardLayout title="Leave Management" role={role.charAt(0).toUpperCase() + role.slice(1)}>
      {msg && <AlertPanel title="AI Action" message={msg} type={msg.includes('Error') ? 'danger' : 'success'} />}
      
      {replacements.length > 0 && (
        <div className="card" style={{ marginBottom: '24px', background: '#ecfdf5', border: '1px solid #10b981' }}>
          <div className="card-title" style={{ color: '#065f46' }}>
            <span>Replacement Information</span>
          </div>
          <p style={{ fontSize: '13px', color: '#065f46', marginBottom: '12px' }}>AI assigned the following employees to replace the leave request:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {replacements.map((r, idx) => (
              <div key={idx} style={{ 
                padding: '10px 12px', 
                background: '#fff', 
                borderRadius: '6px',
                border: '1px solid #10b981',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#065f46' }}>{r.employee_name}</span>
                  <span style={{ color: '#6b7280', marginLeft: '8px' }}>({r.employee_id})</span>
                </div>
                <div>
                  <span style={{ 
                    padding: '4px 8px', 
                    background: '#10b981', 
                    color: 'white', 
                    borderRadius: '4px', 
                    fontSize: '12px',
                    fontWeight: 500
                  }}>
                    {r.shift}
                  </span>
                  <span style={{ color: '#6b7280', marginLeft: '8px', fontSize: '12px' }}>{r.shift_time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
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

      <div className="card" style={{ marginTop: '24px' }}>
         <div className="card-title">
            <span>Active Leaves (Today)</span>
            <Calendar size={18} color="var(--primary)" />
         </div>
         <p style={{ color: 'var(--text-sub)', fontSize: '13px', marginBottom: '16px' }}>Showing employees currently on leave for {today}.</p>
         
         {loading ? (
             <div style={{ padding: '40px', textAlign: 'center' }}>
                 <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
             </div>
         ) : leaves.length === 0 ? (
             <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-sub)', fontStyle: 'italic' }}>
                No employees are on leave today.
             </div>
         ) : (
             <div className="table-container">
                 <table>
                     <thead>
                         <tr>
                             <th>Employee</th>
                             <th>ID</th>
                             <th>Date</th>
                             <th>Status</th>
                         </tr>
                     </thead>
                     <tbody>
                          {leaves
                            .filter(l => {
                              if (!searchQuery) return true;
                              const q = searchQuery.toLowerCase();
                              return (l.employee_name?.toLowerCase().includes(q) || l.employee_id?.toString().toLowerCase().includes(q));
                            })
                            .map(l => (
                              <tr key={l.id}>
                                  <td style={{ fontWeight: 600 }}>{l.employee_name}</td>
                                  <td>{l.employee_id}</td>
                                  <td>{l.date}</td>
                                  <td><span className="badge badge-busy">ON LEAVE</span></td>
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
