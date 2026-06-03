import React, { useState, useEffect } from 'react';
import api from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { 
  Clock, 
  Users, 
  Building2, 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Edit3, 
  X, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const SafeResponsiveContainer = ({ children, ...props }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div style={{ width: props.width || '100%', height: props.height || '100%' }} />;

  return (
    <ResponsiveContainer {...props}>
      {children}
    </ResponsiveContainer>
  );
};

export default function Overtime() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    total_hours: 0,
    employees_today: 0,
    department_wise: {},
    monthly_summary: []
  });
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters state
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedShift, setSelectedShift] = useState('');

  // Add/Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [modalData, setModalData] = useState({
    employee_id: '',
    department_id: '', // for filtering employees
    shift: '',
    overtime_hours: '',
    overtime_date: '',
    reason: '',
    status: 'approved' // auto-approve for admin/manager additions
  });

  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'User';
  const token = localStorage.getItem('token');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch OT records
      const otRes = await api.get('/overtime');
      console.log("OT API response:", otRes.data);
      console.log("Token:", localStorage.getItem("token"));
      setRecords(otRes.data.data || []);

      // 2. Fetch OT stats
      const statsRes = await api.get('/overtime/stats');
      setStats(statsRes.data.data || {
        total_hours: 0,
        employees_today: 0,
        department_wise: {},
        monthly_summary: []
      });

      // 3. Fetch employees list (for search & drop downs)
      const empRes = await api.get('/employees');
      setEmployees(empRes.data || []);

      // Get unique departments from employees list
      const uniqueDepts = [...new Set(empRes.data.map(e => e.department).filter(Boolean))];
      setDepartments(uniqueDepts);

      // Get unique shifts from schedule or default shifts list
      try {
        const shiftRes = await api.get('/shifts');
        setShifts(shiftRes.data || []);
      } catch {
        setShifts([{ name: 'Morning' }, { name: 'Afternoon' }, { name: 'Evening' }, { name: 'Night' }]);
      }

    } catch (error) {
      console.error('Error fetching overtime data:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        showToast(error.response?.data?.detail || 'Failed to load data', 'danger');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingRecord(null);
    setModalData({
      employee_id: '',
      department_id: '',
      shift: '',
      overtime_hours: '',
      overtime_date: new Date().toISOString().split('T')[0],
      reason: '',
      status: 'approved'
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (record) => {
    setEditingRecord(record);
    // Find matching employee's department
    const emp = employees.find(e => e.id === record.employee_id);
    setModalData({
      employee_id: record.employee_id,
      department_id: emp ? emp.department : '',
      shift: record.shift,
      overtime_hours: record.overtime_hours,
      overtime_date: record.overtime_date,
      reason: record.reason || '',
      status: record.status
    });
    setModalOpen(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!modalData.employee_id || !modalData.overtime_hours || !modalData.overtime_date) {
      showToast('Please fill all required fields', 'danger');
      return;
    }

    try {
      const payload = {
        employee_id: parseInt(modalData.employee_id),
        overtime_hours: parseFloat(modalData.overtime_hours),
        overtime_date: modalData.overtime_date,
        reason: modalData.reason,
        shift: modalData.shift || null,
        status: modalData.status
      };

      if (editingRecord) {
        // Update
        await api.put(`/overtime/${editingRecord.id}`, payload);
        showToast('Overtime record updated successfully!');
      } else {
        // Add
        await api.post('/overtime/add', payload);
        showToast('Overtime record added successfully!');
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving overtime:', error);
      showToast(error.response?.data?.detail || 'Validation failed. Please check rules.', 'danger');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this overtime entry?')) return;
    try {
      await api.delete(`/overtime/${id}`);
      showToast('Overtime record deleted successfully');
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.detail || 'Failed to delete record', 'danger');
    }
  };

  // Filter records locally
  const filteredRecords = records.filter(rec => {
    if (employeeSearch && !rec.employee_name.toLowerCase().includes(employeeSearch.toLowerCase())) return false;
    if (selectedDept && rec.department !== selectedDept) return false;
    if (selectedDate && rec.overtime_date !== selectedDate) return false;
    if (selectedShift && rec.shift !== selectedShift) return false;
    return true;
  });

  // Calculate total hours of filtered subset
  const filteredTotalHours = filteredRecords.reduce((sum, r) => sum + r.overtime_hours, 0).toFixed(1);

  // Filtered employees for dropdown based on department selection in modal
  const modalFilteredEmployees = modalData.department_id 
    ? employees.filter(e => e.department === modalData.department_id)
    : employees;

  // Export CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      showToast('No records to export', 'danger');
      return;
    }
    const headers = ['ID', 'Employee Name', 'Department', 'Shift', 'OT Hours', 'Date', 'Reason', 'Status'];
    const csvRows = [
      headers.join(','),
      ...filteredRecords.map(r => [
        r.id,
        `"${r.employee_name}"`,
        `"${r.department}"`,
        `"${r.shift}"`,
        r.overtime_hours,
        r.overtime_date,
        `"${r.reason || ''}"`,
        r.status
      ].join(','))
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `overtime_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV downloaded successfully');
  };

  // Format department data for chart
  const deptChartData = Object.entries(stats.department_wise || {}).map(([name, hours]) => ({
    name,
    hours
  }));

  const colors = ['#3B82F6', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#8B5CF6'];

  return (
    <DashboardLayout title="Overtime (OT) Management">
      <div className="space-y-8">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Clock className="text-indigo-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-0.5">Total OT Hours</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_hours.toFixed(1)} hrs</p>
                <p className="text-xs text-green-600 font-semibold mt-1">Approved logs total</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Users className="text-emerald-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-0.5">OT Employees Today</p>
                <p className="text-3xl font-bold text-gray-900">{stats.employees_today}</p>
                <p className="text-xs text-gray-500 mt-1">Working extra hours today</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
                <Building2 className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-0.5">Filter Result Hours</p>
                <p className="text-3xl font-bold text-gray-900">{filteredTotalHours} hrs</p>
                <p className="text-xs text-indigo-600 font-semibold mt-1">Sum of filtered subset</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <TrendingUp className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-0.5">Monthly Average</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.monthly_summary.length > 0 
                    ? (stats.monthly_summary.reduce((s, m) => s + m.hours, 0) / stats.monthly_summary.length).toFixed(1)
                    : 0} hrs
                </p>
                <p className="text-xs text-gray-500 mt-1">Average per calendar month</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        {deptChartData.length > 0 || stats.monthly_summary.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Wise OT */}
            {deptChartData.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Department-wise Overtime (Approved)</h3>
                <div className="h-64">
                  <SafeResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} suffix="h" />
                      <Tooltip formatter={(value) => [`${value} hours`, 'Overtime']} />
                      <Bar dataKey="hours" fill="#4F46E5" radius={[6, 6, 0, 0]}>
                        {deptChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </SafeResponsiveContainer>
                </div>
              </div>
            )}

            {/* Monthly Summary */}
            {stats.monthly_summary.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Monthly Overtime Trends</h3>
                <div className="h-64">
                  <SafeResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthly_summary}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} suffix="h" />
                      <Tooltip formatter={(value) => [`${value} hours`, 'Total OT']} />
                      <Bar dataKey="hours" fill="#10B981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </SafeResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Filters and Actions Bar */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Overtime Log Sheet</h3>
              <p className="text-sm text-gray-500">View, search, and manage employee overtime credits.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-sm text-gray-700 transition-all"
              >
                <Download size={16} />
                Export CSV
              </button>
              
              {(role === 'admin' || role === 'manager') && (
                <button 
                  onClick={handleOpenAddModal}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-all"
                >
                  <Plus size={16} />
                  Add Overtime
                </button>
              )}
            </div>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            {/* Employee Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search Employee..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Department Filter */}
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all appearance-none"
              >
                <option value="">All Departments</option>
                {departments.map((dept, i) => (
                  <option key={i} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Shift Filter */}
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all appearance-none"
              >
                <option value="">All Shifts</option>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm font-semibold text-gray-500">Loading overtime records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center text-gray-500">
              <Clock size={48} className="text-gray-300 mb-4" />
              <p className="text-lg font-bold text-gray-800">No overtime entries found</p>
              <p className="text-sm max-w-sm mt-1">Try clearing filters or add a new record to start tracking.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Shift</th>
                    <th className="px-6 py-4 text-center">OT Hours</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">Status</th>
                    {(role === 'admin' || role === 'manager') && <th className="px-6 py-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {record.employee_name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-semibold text-gray-900">{record.employee_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{record.department}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          record.shift === 'Morning' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                          record.shift === 'Afternoon' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          record.shift === 'Evening' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                          'bg-slate-50 text-slate-700 border border-slate-100'
                        }`}>
                          {record.shift}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-indigo-600">{record.overtime_hours.toFixed(1)} hrs</td>
                      <td className="px-6 py-4 text-gray-600">{record.overtime_date}</td>
                      <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={record.reason}>
                        {record.reason || <span className="italic text-gray-400">No reason provided</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          record.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                          record.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                          'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            record.status === 'approved' ? 'bg-green-600' :
                            record.status === 'rejected' ? 'bg-red-600' :
                            'bg-yellow-500'
                          }`} />
                          {record.status.toUpperCase()}
                        </span>
                      </td>
                      
                      {(role === 'admin' || role === 'manager') && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleOpenEditModal(record)}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                              title="Edit Record"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(record.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                              title="Delete Record"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{editingRecord ? 'Edit Overtime Log' : 'Add Overtime (OT)'}</h3>
                  <p className="text-xs text-gray-500 mt-1">Fill in the employee overtime logs with AI validation checks.</p>
                </div>
                <button 
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleModalSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                
                {/* Department Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Department</label>
                  <select
                    value={modalData.department_id}
                    onChange={(e) => setModalData({ ...modalData, department_id: e.target.value, employee_id: '' })}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">Select Department (Filters employees)</option>
                    {departments.map((dept, i) => (
                      <option key={i} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Employee Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Employee *</label>
                  <select
                    value={modalData.employee_id}
                    onChange={(e) => setModalData({ ...modalData, employee_id: e.target.value })}
                    required
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">Select Employee</option>
                    {modalFilteredEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.emp_id}) - {emp.department}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Date Selection */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Date *</label>
                    <input
                      type="date"
                      value={modalData.overtime_date}
                      onChange={(e) => setModalData({ ...modalData, overtime_date: e.target.value })}
                      required
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  {/* OT Hours */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">OT Hours *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={modalData.overtime_hours}
                      onChange={(e) => setModalData({ ...modalData, overtime_hours: e.target.value })}
                      required
                      placeholder="e.g. 2.5"
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Shift (Optional, defaults to schedule) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Shift (Optional)</label>
                    <select
                      value={modalData.shift}
                      onChange={(e) => setModalData({ ...modalData, shift: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="">Auto-detect (scheduled shift)</option>
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Evening">Evening</option>
                      <option value="Night">Night</option>
                    </select>
                  </div>

                  {/* Status Selection */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
                    <select
                      value={modalData.status}
                      onChange={(e) => setModalData({ ...modalData, status: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Reason / Remarks</label>
                  <textarea
                    value={modalData.reason}
                    onChange={(e) => setModalData({ ...modalData, reason: e.target.value })}
                    rows="3"
                    placeholder="e.g. Worked extra hours to cover leave replacement for shift hand-off."
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>

                {/* Business Rules Info Banner */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                  <AlertCircle className="flex-shrink-0 text-amber-600" size={16} />
                  <div>
                    <p className="font-bold">Overtime Policy Rules Apply:</p>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      <li>Must be an active employee (non-leaves, non-weekly-off).</li>
                      <li>Must have a scheduled shift (attendance record) on this date.</li>
                      <li>Weekly hours are checked against department OT limits.</li>
                    </ul>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-all"
                  >
                    {editingRecord ? 'Save Changes' : 'Add Record'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* Global Toast */}
        {toast && (
          <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-8 py-4 rounded-xl shadow-2xl z-[200] flex items-center gap-3 font-semibold text-sm text-white ${
            toast.type === 'success' ? 'bg-gray-900' : 'bg-red-600'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} className="text-green-400" /> : <AlertCircle size={18} />}
            {toast.message}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
