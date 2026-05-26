import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { AlertPanel } from '../components/DashboardLayout';
import { Search, Calendar, Shield, Download, FileText, ChevronLeft, ChevronRight, RefreshCw, Activity } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  
  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');

  const fetchLogs = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    
    setLoading(true);
    setErrorMsg('');
    try {
      const params = {
        page,
        limit,
        search: search || undefined,
        role: roleFilter || undefined,
        module_name: moduleFilter || undefined,
        status: statusFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };

      const res = await axios.get(`${API_URL}/activity-logs`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to fetch activity logs. Make sure you have appropriate admin or manager permissions.');
      if (err.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'manager') {
      navigate('/dashboard');
      return;
    }
    fetchLogs();
  }, [page, roleFilter, moduleFilter, statusFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const resetFilters = () => {
    setSearch('');
    setRoleFilter('');
    setModuleFilter('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const exportToCSV = () => {
    const headers = ['User', 'Role', 'Activity', 'Module', 'Status', 'IP Address', 'Description', 'Time'];
    const rows = logs.map(log => [
      log.username || 'System',
      log.role || 'System',
      log.activity,
      log.module_name,
      log.status,
      log.ip_address || 'N/A',
      log.description || '',
      new Date(log.created_at).toLocaleString()
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Activity_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    window.print();
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <DashboardLayout title="Activity Logs & Audit Trail" role={userRole === 'admin' ? 'Admin' : 'Manager'}>
      {errorMsg && <AlertPanel title="Security & API Status" message={errorMsg} type="danger" />}

      {/* Filter and Control Bar */}
      <div className="card mb-6">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-400" />
              </span>
              <input
                type="text"
                className="input-field pl-9 w-full"
                placeholder="Search username, activity..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Role Filter */}
            <select
              className="input-field w-full"
              value={roleFilter}
              onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="system">System</option>
            </select>

            {/* Module Filter */}
            <select
              className="input-field w-full"
              value={moduleFilter}
              onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Modules</option>
              <option value="Authentication">Authentication</option>
              <option value="Employee Management">Employee Management</option>
              <option value="Shift Management">Shift Management</option>
              <option value="Weekly Off">Weekly Off</option>
              <option value="Leave Management">Leave Management</option>
              <option value="AI Scheduler">AI Scheduler</option>
              <option value="Attendance">Attendance</option>
              <option value="Admin">Admin</option>
              <option value="System">System</option>
            </select>

            {/* Status Filter */}
            <select
              className="input-field w-full"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>

            {/* Start Date */}
            <div className="relative">
              <input
                type="date"
                className="input-field w-full"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(1); }}
              />
            </div>

            {/* End Date */}
            <div className="relative">
              <input
                type="date"
                className="input-field w-full"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(1); }}
              />
            </div>

          </div>

          <div className="flex justify-between items-center flex-wrap gap-4 border-t border-slate-100 pt-4">
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary px-5 py-2">
                Apply Search
              </button>
              <button type="button" onClick={resetFilters} className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 px-4 py-2">
                Reset Filters
              </button>
              <button type="button" onClick={fetchLogs} className="btn bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 p-2">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={exportToCSV} className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 flex items-center gap-2">
                <Download size={16} />
                <span>Export CSV</span>
              </button>
              <button type="button" onClick={exportToPDF} className="btn bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-4 py-2 flex items-center gap-2">
                <FileText size={16} />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Main Table Container */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-indigo-600" />
            <h3 className="text-lg font-black text-slate-800">Audit Trail Logs</h3>
            <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-bold">
              {total} total records
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-slate-500 font-medium">Fetching enterprise logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-slate-50 p-6 rounded-full text-slate-400 mb-4">
              <Shield size={48} />
            </div>
            <h4 className="text-lg font-bold text-slate-800 mb-1">No Activity Logs Found</h4>
            <p className="text-slate-500 max-w-md">No system or audit logs matched your current filters. Try expanding your search queries or resetting filters.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left font-bold text-slate-500 uppercase tracking-wider py-3 px-4">User</th>
                    <th className="text-left font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Role</th>
                    <th className="text-left font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Activity</th>
                    <th className="text-left font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Module</th>
                    <th className="text-left font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Status</th>
                    <th className="text-left font-bold text-slate-500 uppercase tracking-wider py-3 px-4">IP Address</th>
                    <th className="text-left font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Time</th>
                    <th className="text-left font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {log.username || <span className="text-slate-400 font-normal">System</span>}
                      </td>
                      <td className="py-3 px-4">
                        {log.role ? (
                          <span className={`badge ${
                            log.role === 'admin' ? 'badge-busy' : 
                            log.role === 'manager' ? 'badge-available' : 'badge-offline'
                          }`}>
                            {log.role.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{log.activity}</td>
                      <td className="py-3 px-4 text-slate-600">{log.module_name}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          log.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-sm">{log.ip_address || 'N/A'}</td>
                      <td className="py-3 px-4 text-slate-500 text-sm whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-sm max-w-xs truncate" title={log.description}>
                        {log.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex justify-between items-center mt-6">
              <span className="text-sm text-slate-500">
                Showing Page <b>{page}</b> of <b>{totalPages}</b>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="btn bg-white hover:bg-slate-50 border border-slate-200 p-2 disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="btn bg-white hover:bg-slate-50 border border-slate-200 p-2 disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
