import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout, { AlertPanel, SearchContext } from '../components/DashboardLayout';

const SafeSearchContext = () => {
  try {
    return useContext(SearchContext);
  } catch (e) {
    return { searchQuery: '', setSearchQuery: () => {} };
  }
};
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Sparkles, 
  Search, 
  Filter, 
  Download,
  Briefcase,
  Clock,
  Calendar,
  MoreVertical,
  Zap,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

export default function Employees() {
  const { searchQuery: contextSearch, setSearchQuery: setContextSearch } = SafeSearchContext();
  const [searchQuery, setSearchQuery] = useState(contextSearch || '');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ emp_id: '', name: '', skills: '', preferred_shift: 'Morning', max_hours: 40, weekly_off: 'Monday' });
  const [isAdding, setIsAdding] = useState(false);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (setContextSearch) setContextSearch(value);
  };

  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'User';
  const canEdit = role === 'admin' || role === 'manager';

  const getToken = () => {
    const t = localStorage.getItem('token');
    if (!t) { navigate('/login'); return null; }
    return t;
  };

  const fetchEmployees = async () => {
    const token = getToken();
    if (!token) return;
    try {
      console.log('Fetching employees...');
      const res = await axios.get(`${API_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Employees response:', res.data);
      
      // Handle both response formats: direct array or {employees: [...]}
      const employeeData = Array.isArray(res.data) ? res.data : (res.data.employees || []);
      setEmployees(employeeData);
      console.log(`Loaded ${employeeData.length} employees`);
      setError(null);
    } catch (error) {
      console.error('Error fetching employees:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        setError(error.response?.data?.detail || 'Failed to load employees');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    try {
      const dataToSend = { ...formData, skills: formData.skills.split(',').map(s => s.trim()) };
      const res = await axios.post(`${API_URL}/employees`, dataToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg(res.data.msg);
      setIsAdding(false);
      setFormData({ emp_id: '', name: '', skills: '', preferred_shift: 'Morning', max_hours: 40, weekly_off: 'Monday' });
      fetchEmployees();
    } catch (error) {
      setMsg('Error adding employee');
    }
  };

  const handleUpdate = async (id) => {
    const token = getToken();
    if (!token) return;
    try {
      const emp = employees.find(e => e.id === id);
      const dataToSend = {
        emp_id: emp.emp_id,
        name: emp.name,
        skills: Array.isArray(emp.skills) ? emp.skills : emp.skills.split(',').map(s => s.trim()),
        preferred_shift: emp.preferred_shift,
        max_hours: emp.max_hours,
        weekly_off: emp.weekly_off
      };
      const res = await axios.put(`${API_URL}/employees/${id}`, dataToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg(res.data.msg);
      setEditingId(null);
      fetchEmployees();
    } catch (error) {
      setMsg('Error updating employee');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("CRITICAL: This will remove the employee and invalidate existing AI schedules. Proceed?")) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.delete(`${API_URL}/employees/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg(res.data.msg);
      fetchEmployees();
    } catch (error) {
      setMsg('Error deleting employee');
    }
  };

  const handleAIAutoAssign = async () => {
    if (!window.confirm("AI Optimization: Redistribute weekly offs to ensure maximum coverage across all shifts?\n\nNote: This may take 10-15 seconds for large datasets.")) return;
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setMsg('⏳ AI is analyzing and redistributing weekly offs... This may take a moment.');
    try {
      console.log('Starting AI auto-assign...');
      const startTime = Date.now();
      
      const res = await axios.post(`${API_URL}/auto-assign-weekly-offs`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000 // 30 second timeout
      });
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`AI auto-assign completed in ${duration}s`);
      
      setMsg(`✓ ${res.data.msg} (Completed in ${duration}s)`);
      fetchEmployees();
    } catch (error) {
      console.error('AI auto-assign error:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Error in AI auto-assignment';
      setMsg(`✗ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (id, field, value) => {
    setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, [field]: value } : emp));
  };

  const filteredEmployees = employees.filter(emp => {
    const q = searchQuery?.toLowerCase() || '';
    return (
      emp.name?.toLowerCase().includes(q) ||
      emp.emp_id?.toLowerCase().includes(q) ||
      (Array.isArray(emp.skills) ? emp.skills.join(' ').toLowerCase().includes(q) : emp.skills?.toLowerCase().includes(q))
    );
  });

  return (
    <DashboardLayout title={canEdit ? "Force Management" : "Force Directory"} role={role.charAt(0).toUpperCase() + role.slice(1)}>
      {msg && <AlertPanel title="Personnel System Registry" message={msg} type={msg.includes('Error') ? 'danger' : 'success'} />}

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-black/[0.02] overflow-hidden">
        {/* Header Section */}
        <div className="p-8 lg:p-10 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-slate-50/30">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-200 ring-8 ring-indigo-50">
              <Users size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Active Force</h2>
              <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest">{employees.length} Personnel Enrolled</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative group flex-1 min-w-[240px]">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
<input 
                  type="text" 
                  placeholder="Search force by name, ID or skill..." 
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-6 text-sm font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
            </div>
            
            {canEdit && (
              <div className="flex items-center gap-3">
                 <button 
                   onClick={() => setIsAdding(true)}
                   className="flex items-center gap-3 px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-100 group"
                 >
                   <UserPlus size={18} />
                   <span>Add Personnel</span>
                 </button>
                 <button 
                   onClick={handleAIAutoAssign}
                   className="flex items-center justify-center w-12 h-12 bg-white border-2 border-slate-100 rounded-2xl text-indigo-500 hover:bg-indigo-50 hover:border-indigo-100 transition-all shadow-sm"
                   title="AI Balance Weekly Offs"
                 >
                   <Sparkles size={20} />
                 </button>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-indigo-50/30 border-b border-indigo-100 p-8 lg:p-10"
            >
              <div className="flex items-center justify-between mb-8">
                 <h4 className="text-xl font-black text-indigo-900 tracking-tight">Onboard New Personnel</h4>
                 <button onClick={() => setIsAdding(false)} className="text-indigo-400 hover:text-indigo-600 transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Force ID</label>
                  <input className="w-full bg-white border border-indigo-100 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="EMP001" value={formData.emp_id} onChange={e => setFormData({ ...formData, emp_id: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Full Name</label>
                  <input className="w-full bg-white border border-indigo-100 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="John Doe" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Skill Matrix</label>
                  <input className="w-full bg-white border border-indigo-100 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="Python, React..." value={formData.skills} onChange={e => setFormData({ ...formData, skills: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Preferred Slot</label>
                  <select className="w-full bg-white border border-indigo-100 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none" value={formData.preferred_shift} onChange={e => setFormData({ ...formData, preferred_shift: e.target.value })}>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Max Hours/Wk</label>
                  <input type="number" className="w-full bg-white border border-indigo-100 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none" value={formData.max_hours} onChange={e => setFormData({ ...formData, max_hours: e.target.value })} required />
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                   <button type="submit" className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">Submit</button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
               <Zap size={40} className="text-indigo-500 animate-bounce" />
               <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Syncing Personnel Data...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-200">
                 <Users size={40} />
              </div>
              <div className="text-center">
                 <h3 className="text-xl font-black text-slate-900 tracking-tight">No Personnel Found</h3>
                 <p className="text-slate-400 font-bold text-sm mt-1">Upload force registry or add manually.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Personnel ID</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Force Member</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Department</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Role</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Shift</th>
                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Leave Status</th>
                    {canEdit && <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Operations</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredEmployees.map((emp, idx) => (
                    <motion.tr 
                      key={emp.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="group hover:bg-slate-50/50 transition-all"
                    >
                      <td className="px-8 py-6">
                        <span className="text-xs font-black text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">{emp.emp_id || 'FORCE-00'}</span>
                      </td>
                      <td className="px-8 py-6">
                        {editingId === emp.id
                          ? <input className="bg-white border-2 border-indigo-100 rounded-xl py-2 px-3 text-sm font-bold focus:border-indigo-500 outline-none w-full" value={emp.name} onChange={e => handleChange(emp.id, 'name', e.target.value)} />
                          : <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{emp.name}</span>
                        }
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                          {emp.department || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        {editingId === emp.id
                          ? <input className="bg-white border-2 border-indigo-100 rounded-xl py-2 px-3 text-sm font-bold focus:border-indigo-500 outline-none w-full" value={emp.role || 'Staff'} onChange={e => handleChange(emp.id, 'role', e.target.value)} />
                          : <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">{emp.role || 'Staff'}</span>
                        }
                      </td>
                      <td className="px-8 py-6">
                        {editingId === emp.id
                          ? (
                            <select className="bg-white border-2 border-indigo-100 rounded-xl py-2 px-3 text-sm font-bold focus:border-indigo-500 outline-none w-full appearance-none" value={emp.preferred_shift} onChange={e => handleChange(emp.id, 'preferred_shift', e.target.value)}>
                              <option value="Morning">Morning</option>
                              <option value="Afternoon">Afternoon</option>
                              <option value="Evening">Evening</option>
                              <option value="Night">Night</option>
                            </select>
                          )
                          : (
                            <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${emp.preferred_shift === 'Morning' ? 'bg-amber-400' : emp.preferred_shift === 'Afternoon' ? 'bg-yellow-400' : emp.preferred_shift === 'Evening' ? 'bg-indigo-400' : 'bg-purple-400'}`}></div>
                               <span className="text-sm font-bold text-slate-600">{emp.preferred_shift}</span>
                            </div>
                          )
                        }
                      </td>
                      <td className="px-8 py-6">
                        {editingId === emp.id
                          ? (
                            <select className="bg-white border-2 border-indigo-100 rounded-xl py-2 px-3 text-sm font-bold focus:border-indigo-500 outline-none w-full appearance-none" value={emp.leave_status || 'Present'} onChange={e => handleChange(emp.id, 'leave_status', e.target.value)}>
                              <option value="Present">Present</option>
                              <option value="On Leave">On Leave</option>
                              <option value="Active">Active</option>
                            </select>
                          )
                          : (
                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                              emp.leave_status === 'Present' || emp.leave_status === 'Active' || !emp.leave_status ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              emp.leave_status === 'On Leave' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                              'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                              {emp.leave_status || 'Present'}
                            </span>
                          )
                        }
                      </td>
                      {canEdit && (
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {editingId === emp.id ? (
                              <>
                                <button onClick={() => handleUpdate(emp.id)} className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-100 hover:scale-110 transition-transform"><Save size={16} /></button>
                                <button onClick={() => setEditingId(null)} className="p-2.5 bg-white border border-slate-100 text-slate-400 rounded-xl hover:text-slate-900 transition-colors"><X size={16} /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditingId(emp.id)} className="p-2.5 bg-white border border-slate-100 text-indigo-500 rounded-xl hover:bg-indigo-50 transition-all shadow-sm"><Edit2 size={16} /></button>
                                <button onClick={() => handleDelete(emp.id)} className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={16} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
