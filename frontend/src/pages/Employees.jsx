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
  ChevronRight,
  Loader2,
  AlertCircle
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Bulk Operations State Definitions
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [rolesList, setRolesList] = useState([]);
  const [selectedRoleToDelete, setSelectedRoleToDelete] = useState('all');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
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

  const fetchRoles = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/employees/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRolesList(res.data || []);
    } catch (err) {
      console.error('Error fetching employee roles:', err);
    }
  };

  const handleExecuteBulkDelete = async () => {
    const token = getToken();
    if (!token) return;
    setIsDeletingBulk(true);
    try {
      const url = `${API_URL}/employees/bulk-delete` + (selectedRoleToDelete !== 'all' ? `?role=${encodeURIComponent(selectedRoleToDelete)}` : '');
      const res = await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Success orchestration
      setMsg(res.data.msg);
      setIsConfirmModalOpen(false);
      setIsBulkDeleteOpen(false);
      
      // Refresh list & roles
      await fetchEmployees();
      await fetchRoles();
    } catch (error) {
      console.error('Error during bulk deletion:', error);
      let errorMsg = 'Error purging employees and records.';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') {
          errorMsg = detail;
        } else if (Array.isArray(detail)) {
          errorMsg = detail.map(err => err.msg || JSON.stringify(err)).join(', ');
        } else if (typeof detail === 'object') {
          errorMsg = detail.message || JSON.stringify(detail);
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      setMsg(`Error: ${errorMsg}`);
      setIsConfirmModalOpen(false);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
    // Fetch once on mount — no polling loop
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

  const defaultRoles = ['Manager', 'Supervisor', 'Operator', 'Security'];
  const combinedRoles = Array.from(new Set([...defaultRoles, ...(rolesList || [])]));

  const filteredEmployees = employees.filter(emp => {
    const q = searchQuery?.toLowerCase() || '';
    return (
      emp.name?.toLowerCase().includes(q) ||
      emp.emp_id?.toLowerCase().includes(q) ||
      (Array.isArray(emp.skills) ? emp.skills.join(' ').toLowerCase().includes(q) : emp.skills?.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
              <div className="flex flex-wrap items-center gap-3">
                 {role === 'admin' && (
                   <button 
                     onClick={() => setIsBulkDeleteOpen(!isBulkDeleteOpen)}
                     className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl group border ${
                       isBulkDeleteOpen 
                       ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-rose-100' 
                       : 'bg-white border-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100'
                     }`}
                     title="Bulk Personnel Purge"
                   >
                     <Trash2 size={18} />
                     <span>Bulk Delete</span>
                   </button>
                 )}
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
          {isBulkDeleteOpen && role === 'admin' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-rose-50/20 border-b border-rose-100 p-8 lg:p-10"
            >
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner">
                       <Trash2 size={20} />
                    </div>
                    <div>
                       <h4 className="text-xl font-black text-rose-950 tracking-tight leading-none">Bulk Personnel Purge Center</h4>
                       <p className="text-xs font-bold text-rose-400 mt-1 uppercase tracking-widest">Admin-Only System Orchestration</p>
                    </div>
                 </div>
                 <button onClick={() => setIsBulkDeleteOpen(false)} className="text-rose-400 hover:text-rose-600 transition-colors"><X size={24} /></button>
              </div>
              
              <div className="bg-white border border-rose-100 rounded-[2rem] p-6 lg:p-8 flex flex-col md:flex-row md:items-end gap-6 shadow-sm">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-rose-950 uppercase tracking-widest ml-1">Filter by Role</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[position:right_16px_center] bg-no-repeat pr-12"
                    value={selectedRoleToDelete} 
                    onChange={e => setSelectedRoleToDelete(e.target.value)}
                  >
                    <option value="all">Delete All Employees (Entire Database)</option>
                    {combinedRoles.map(r => (
                      <option key={r} value={r}>Delete only "{r}" role</option>
                    ))}
                  </select>
                </div>
                <div>
                  <button 
                    onClick={() => setIsConfirmModalOpen(true)}
                    className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-3.5 bg-rose-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                  >
                    <Trash2 size={18} />
                    <span>Execute Purge</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

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
                  {paginatedEmployees.map((emp, idx) => (
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
                               <div className={`w-2 h-2 rounded-full ${
                                 emp.assigned_shift === 'Morning' ? 'bg-amber-400' : 
                                 emp.assigned_shift === 'Afternoon' ? 'bg-yellow-400' : 
                                 emp.assigned_shift === 'Evening' ? 'bg-indigo-400' : 
                                 emp.assigned_shift === 'Night' ? 'bg-purple-400' : 
                                 emp.assigned_shift === 'Week Off' ? 'bg-emerald-400' : 'bg-slate-400'
                               }`}></div>
                               <span className="text-sm font-bold text-slate-600">{emp.assigned_shift || emp.preferred_shift || 'Not Assigned'}</span>
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

              {/* Premium Pagination System */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-6 bg-slate-50/30 border-t border-slate-100 gap-4">
                  <span className="text-xs font-bold text-slate-500">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length} personnel
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all shadow-sm"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-black text-slate-750 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all shadow-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeletingBulk && setIsConfirmModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 m-auto w-full max-w-lg h-fit bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-100 z-[151] flex flex-col gap-6"
            >
              <div className="flex items-center gap-4 text-rose-600">
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center shadow-inner">
                  <AlertCircle size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Confirm Purge Action</h3>
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-2">Critical Database Deletion</p>
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-sm font-bold text-slate-600 leading-relaxed">
                {selectedRoleToDelete === 'all' ? (
                  <p>Are you sure you want to delete <span className="text-rose-600 font-black">ALL employees</span>? This will permanently remove all related schedules, weekly offs, leaves, and replacements from the database.</p>
                ) : (
                  <p>Delete all employees with selected role <span className="text-rose-600 font-black">"{selectedRoleToDelete}"</span>? This will permanently remove their related schedules, weekly offs, leaves, and replacements.</p>
                )}
                <p className="mt-3 text-xs text-slate-400 font-bold uppercase tracking-wider">⚠️ This operation is irreversible.</p>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  disabled={isDeletingBulk}
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  disabled={isDeletingBulk}
                  onClick={handleExecuteBulkDelete}
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-100"
                >
                  {isDeletingBulk ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Purging...</span>
                    </>
                  ) : (
                    <span>Yes, Purge Data</span>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
