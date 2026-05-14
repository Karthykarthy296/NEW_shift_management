import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { AlertPanel } from '../components/DashboardLayout';
import { UserPlus, Shield, Trash2, Mail, Lock } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('manager');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();
  const currentRole = localStorage.getItem('role');

  const fetchUsers = async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      const res = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setUsers(res.data);
    } catch (error) {
       console.error(error);
       if (error.response?.status === 401) navigate('/login');
    }
  };

  useEffect(() => {
    if (currentRole !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMsg('');
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      await axios.post(`${API_URL}/create-user`, 
        { username, password, role },
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      setMsg('User account created successfully.');
      setUsername(''); setPassword('');
      fetchUsers();
    } catch (error) {
      setMsg('Error: Check if username already exists.');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      await axios.delete(`${API_URL}/users/${id}`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      fetchUsers();
    } catch (error) {
      setMsg('Error deleting user');
    }
  };

  return (
    <DashboardLayout title="User Management" role="Admin">
      {msg && <AlertPanel title="Admin Action" message={msg} type={msg.startsWith('Error') ? 'danger' : 'success'} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Create User Section */}
        <section>
          <div className="card">
            <div className="card-title">
              <span>Create Account</span>
              <UserPlus size={18} color="var(--primary)" />
            </div>
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-sub)' }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-sub)' }} />
                  <input type="text" placeholder="e.g. johndoe" className="input-field" style={{ paddingLeft: '36px' }} value={username} onChange={e=>setUsername(e.target.value)} required />
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-sub)' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-sub)' }} />
                  <input type="password" placeholder="••••••••" className="input-field" style={{ paddingLeft: '36px' }} value={password} onChange={e=>setPassword(e.target.value)} required />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-sub)' }}>System Role</label>
                <select className="input-field" value={role} onChange={e=>setRole(e.target.value)}>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Create User</button>
            </form>
          </div>
        </section>

        {/* User Management Table */}
        <section>
          <div className="card">
            <div className="card-title">
              <span>System Users</span>
              <Shield size={18} color="var(--primary)" />
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.username}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-busy' : 'badge-offline'}`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {u.role !== 'admin' ? (
                          <button 
                            onClick={() => handleDeleteUser(u.id)} 
                            className="btn" 
                            style={{ padding: '6px', background: '#fee2e2', color: '#dc2626' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Restricted</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
