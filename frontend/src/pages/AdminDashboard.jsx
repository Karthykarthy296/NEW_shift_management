import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout, { AlertPanel, ShiftDisplay } from '../components/DashboardLayout';
import DashboardCharts from '../components/DashboardCharts';
import { 
  UserPlus, 
  Shield, 
  Trash2, 
  Mail, 
  Lock, 
  UserCheck, 
  ArrowRight,
  MoreVertical,
  Activity,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [summary, setSummary] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('manager');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

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

  const fetchSchedule = async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return navigate('/login');
    try {
      const res = await axios.get(`${API_URL}/get-schedule?date=${today}`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      console.log("Schedule Data Received:", res.data);
      setSchedule(res.data);
    } catch (e) {
      console.error(e);
      if (e.response?.status === 401) navigate('/login');
    }
  };

  const fetchSummary = async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;
    try {
      const res = await axios.get(`${API_URL}/summary`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      console.log("Summary Data Received:", res.data);
      setSummary(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSchedule();
    fetchSummary();
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
      fetchSummary();
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
      fetchSummary();
    } catch (error) {
      setMsg('Error deleting user');
    }
  };

  return (
    <DashboardLayout title="System Intelligence Dashboard" role="Admin">
      {msg && <AlertPanel title="System Orchestration" message={msg} type={msg.startsWith('Error') ? 'danger' : 'success'} />}

      {/* Analytics & Charts Section */}
      <section className="mb-14">
        <DashboardCharts summary={summary} role="Admin" />
      </section>

      {/* Admin Operations Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start mb-14">
        {/* User Onboarding Card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="xl:col-span-4"
        >
          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-black/[0.02] h-full">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                  <UserPlus size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Onboard Operator</h3>
              </div>
              <button className="text-slate-400 hover:text-slate-900 transition-colors"><MoreVertical size={20} /></button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Identifier (Username)</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="e.g. ops_manager_1" 
                    className="w-full bg-slate-50 border border-transparent rounded-2xl py-3.5 pl-12 pr-6 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" 
                    value={username} 
                    onChange={e=>setUsername(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Security Key (Password)</label>
                <div className="relative group">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full bg-slate-50 border border-transparent rounded-2xl py-3.5 pl-12 pr-6 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" 
                    value={password} 
                    onChange={e=>setPassword(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Authorization Tier</label>
                <div className="relative">
                  <Shield size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select 
                    className="w-full bg-slate-50 border border-transparent rounded-2xl py-3.5 pl-12 pr-6 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer" 
                    value={role} 
                    onChange={e=>setRole(e.target.value)}
                  >
                    <option value="manager">Manager (Unrestricted)</option>
                    <option value="supervisor">Supervisor (Limited)</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 group">
                Provision Account <UserCheck size={18} className="group-hover:scale-110 transition-transform" />
              </button>
            </form>
          </div>
        </motion.section>

        {/* Access Control Table */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="xl:col-span-8"
        >
          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-black/[0.02] overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                    <Shield size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Access Control Registry</h3>
               </div>
               <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl">
                  <button className="px-5 py-2 text-[10px] font-black uppercase tracking-widest bg-white text-slate-900 shadow-sm rounded-xl border border-slate-100">Active Operators</button>
                  <button className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Access Logs</button>
               </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-4">
                <thead>
                  <tr className="text-left">
                    <th className="px-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operator</th>
                    <th className="px-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tier</th>
                    <th className="px-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                    <th className="px-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => (
                    <motion.tr 
                      key={u.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + idx * 0.05 }}
                      className="group"
                    >
                      <td className="px-6 py-5 bg-slate-50 group-hover:bg-indigo-50 group-hover:shadow-lg group-hover:shadow-indigo-900/5 transition-all rounded-l-[2rem] border-y border-l border-transparent group-hover:border-indigo-100">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-white text-indigo-500 flex items-center justify-center font-black text-sm shadow-sm group-hover:scale-110 transition-transform">
                             {u.username.charAt(0).toUpperCase()}
                           </div>
                           <span className="font-black text-slate-900 tracking-tight">{u.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 bg-slate-50 group-hover:bg-indigo-50 transition-all border-y border-transparent group-hover:border-indigo-100">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          u.role === 'admin' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-5 bg-slate-50 group-hover:bg-indigo-50 transition-all border-y border-transparent group-hover:border-indigo-100">
                         <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connected</span>
                         </div>
                      </td>
                      <td className="px-6 py-5 bg-slate-50 group-hover:bg-indigo-50 transition-all rounded-r-[2rem] border-y border-r border-transparent group-hover:border-indigo-100 text-right">
                        {u.role !== 'admin' ? (
                          <button 
                            onClick={() => handleDeleteUser(u.id)} 
                            className="p-3 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm"
                          >
                            <Trash2 size={18} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full uppercase tracking-widest">System</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Deployment & Grid Section */}
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full"
      >
        <ShiftDisplay schedule={schedule} onUpdate={fetchSchedule} />
      </motion.section>
    </DashboardLayout>
  );
}
