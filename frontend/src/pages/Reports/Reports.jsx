import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/apiService';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  FileText, TrendingUp, BarChart3, PieChart, Clock, ShieldCheck, 
  History, CalendarRange, Filter, Download, Search, Users, 
  AlertTriangle, CheckCircle2, ChevronRight, ArrowUpRight, ArrowDownRight,
  Printer, FileJson, Calendar as CalendarIcon, Briefcase, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart as RePieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';

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

// --- Utilities ---

const exportToCSV = (data, filename) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(obj => Object.values(obj).join(',')).join('\n');
  const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- Shared Components ---

const ReportHeader = ({ title, description, icon: Icon, onExport, filters, setFilters, departments = [] }) => (
  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
    <div className="flex items-center gap-6">
      <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500 text-white flex items-center justify-center shadow-2xl shadow-indigo-200">
        <Icon size={32} />
      </div>
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{title}</h2>
        <p className="text-slate-500 font-bold mt-1 uppercase text-xs tracking-widest">{description}</p>
      </div>
    </div>
    
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
        <div className="relative group">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search..." 
            value={filters.search || ''}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            className="pl-10 pr-4 py-2 bg-transparent outline-none text-sm font-bold w-40"
          />
        </div>
        <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
        <select 
          className="bg-transparent outline-none text-xs font-black uppercase tracking-wider px-3 py-2 cursor-pointer"
          value={filters.department || ''}
          onChange={(e) => setFilters({...filters, department: e.target.value})}
        >
          <option value="">All Dept</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>

      <button 
        onClick={() => {
          if (window.openExportSidebar) {
            window.openExportSidebar();
          } else if (onExport) {
            onExport();
          }
        }}
        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
      >
        <Download size={16} />
        Export
      </button>
    </div>
  </div>
);

const StatCard = ({ label, value, trend, icon: Icon, color }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-black/[0.02] flex items-center justify-between group"
  >
    <div className="flex items-center gap-5">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color} shadow-lg shadow-black/5`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h4 className="text-2xl font-black text-slate-900 leading-none">{value}</h4>
      </div>
    </div>
    {trend !== undefined && (
      <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
        {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(trend)}%
      </div>
    )}
  </motion.div>
);

const LoadingOverlay = () => (
  <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-[2.5rem]">
    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
  </div>
);

// --- Report Modules ---

export const AttendanceReport = () => {
  const [data, setData] = useState({ present: 0, absent: 0, leave: 0, percentage: 0, trends: [] });
  const [filters, setFilters] = useState({ search: '', department: '' });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [summary, trends] = await Promise.all([
        api.get('/dashboard-summary'),
        api.get('/reports/attendance-trends')
      ]);
      
      const total = summary.data.total_employees || 0;
      const present = summary.data.active_shifts || 0;
      const leave = summary.data.today_leaves || 0;
      const weeklyOff = summary.data.today_weekly_off || 0;
      const absent = Math.max(0, total - present - leave - weeklyOff);
      
      setData({
        present, leave, absent,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0,
        trends: trends.data
      });
      setLoading(false);
    } catch (err) { console.error(err); setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    // Fetch once on mount — no polling loop
  }, []);

  return (
    <DashboardLayout title="Attendance Report" role="Admin">
      <div className="relative">
        {loading && <LoadingOverlay />}
        <ReportHeader 
          title="Attendance Analytics" 
          description="Live workforce presence tracking" 
          icon={Clock} 
          onExport={() => exportToCSV(data.trends, 'attendance_report')}
          filters={filters}
          setFilters={setFilters}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard label="Present Today" value={data.present} color="bg-indigo-500" trend={5.2} icon={Users} />
          <StatCard label="On Leave" value={data.leave} color="bg-amber-500" trend={-2.1} icon={CalendarRange} />
          <StatCard label="Absent" value={data.absent} color="bg-rose-500" trend={1.4} icon={AlertTriangle} />
          <StatCard label="Attendance %" value={`${data.percentage}%`} color="bg-emerald-500" trend={0.8} icon={CheckCircle2} />
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-black/[0.02] mb-10">
          <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
            <TrendingUp size={20} className="text-indigo-500" /> Attendance Trends (Last 7 Days)
          </h3>
          <div className="h-[350px] w-full">
            <SafeResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '15px' }}
                  itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="present" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorPresent)" />
                <Area type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={4} fillOpacity={0} />
              </AreaChart>
            </SafeResponsiveContainer>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const ShiftDistributionReport = () => {
  const [data, setData] = useState({ shifts: [], distribution: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await api.get('/dashboard-summary');
      const dist = res.data.shift_assignments || {};
      const chartData = Object.entries(dist).map(([name, count]) => ({ name, count }));
      setData({ shifts: Object.keys(dist), distribution: chartData });
      setLoading(false);
    } catch (err) { console.error(err); setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    // Fetch once on mount — no polling loop
  }, []);

  return (
    <DashboardLayout title="Shift Distribution" role="Admin">
      <div className="relative">
        {loading && <LoadingOverlay />}
        <ReportHeader 
          title="Shift Allocation" 
          description="Personnel distribution across time slots" 
          icon={PieChart} 
          onExport={() => exportToCSV(data.distribution, 'shift_distribution')}
          filters={{}} setFilters={() => {}}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {data.distribution.map((d, i) => (
            <StatCard 
              key={d.name} 
              label={`${d.name} Shift`} 
              value={d.count} 
              color={i === 0 ? 'bg-sky-400' : i === 1 ? 'bg-orange-400' : 'bg-indigo-900'} 
              icon={Clock} 
            />
          ))}
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl shadow-black/[0.03]">
          <h3 className="text-2xl font-black text-slate-900 mb-12">Workforce Concentration</h3>
          <div className="h-[400px] w-full">
            <SafeResponsiveContainer width="100%" height="100%">
              <BarChart data={data.distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 13, fontWeight: 800}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 13, fontWeight: 800}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="count" fill="#6366f1" radius={[15, 15, 0, 0]} barSize={80}>
                  {data.distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#38bdf8' : index === 1 ? '#fb923c' : '#4f46e5'} />
                  ))}
                </Bar>
              </BarChart>
            </SafeResponsiveContainer>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const LeaveReport = () => {
  const [data, setData] = useState({ frequent: [], trends: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await api.get('/reports/leave-stats');
      setData(res.data);
      setLoading(false);
    } catch (err) { console.error(err); setLoading(false); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <DashboardLayout title="Leave Analytics" role="Admin">
      <div className="relative">
        {loading && <LoadingOverlay />}
        <ReportHeader 
          title="Leave & Absence" 
          description="Pattern analysis and impact monitoring" 
          icon={CalendarRange} 
          onExport={() => exportToCSV(data.trends, 'leave_report')}
          filters={{}} setFilters={() => {}}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-black/[0.02]">
              <h3 className="text-xl font-black text-slate-900 mb-8">Monthly Leave Trends</h3>
              <div className="h-[300px]">
                <SafeResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                    <Tooltip />
                    <Legend iconType="circle" />
                    <Bar dataKey="medical" fill="#6366f1" stackId="a" />
                    <Bar dataKey="personal" fill="#fb923c" stackId="a" />
                    <Bar dataKey="casual" fill="#ec4899" stackId="a" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </SafeResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-black/[0.02]">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center justify-between">
              Frequent Takers <History size={18} className="text-slate-400" />
            </h3>
            <div className="space-y-6">
              {data.frequent.map((emp, i) => (
                <div key={i} className="flex items-center justify-between group cursor-default">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      {emp.count}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{emp.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp.dept}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const OvertimeReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/overtime');
        console.log("OT API response:", res.data);
        console.log("Token:", localStorage.getItem("token"));
        setData(res.data.data || []);
        setLoading(false);
      } catch (err) { console.error(err); setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <DashboardLayout title="Overtime Monitoring" role="Admin">
      <div className="relative">
        {loading && <LoadingOverlay />}
        <ReportHeader 
          title="Overtime & Load" 
          description="Extra hours and burnout risk tracking" 
          icon={TrendingUp} 
          onExport={() => exportToCSV(data, 'overtime_report')}
          filters={{}} setFilters={() => {}}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard label="Total OT Entries" value={data.length} color="bg-rose-500" trend={12.4} icon={Clock} />
          <StatCard label="Approved OT" value={data.filter(d => d.status === 'approved').length} color="bg-emerald-500" trend={8.1} icon={CheckCircle2} />
          <StatCard label="Pending OT" value={data.filter(d => d.status === 'pending').length} color="bg-amber-500" trend={2.0} icon={AlertTriangle} />
          <StatCard label="High Load Index" value="84%" color="bg-indigo-500" trend={-1.5} icon={TrendingUp} />
        </div>

        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-black/[0.02] overflow-hidden">
          <div className="p-8 lg:p-10">
            <h3 className="text-xl font-black text-slate-900 mb-8">Recent Overtime Logs</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                    <th className="pb-4 px-4">Employee</th>
                    <th className="pb-4 px-4">Date</th>
                    <th className="pb-4 px-4">Regular</th>
                    <th className="pb-4 px-4">Overtime</th>
                    <th className="pb-4 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 10).map((ot) => (
                    <tr key={ot.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-900">{ot.employee_name}</td>
                      <td className="py-4 px-4 text-sm text-slate-500">{ot.date}</td>
                      <td className="py-4 px-4 text-sm font-bold">{ot.regular_hours}h</td>
                      <td className="py-4 px-4 text-sm font-black text-rose-500">{ot.overtime_hours}h</td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          ot.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {ot.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const AIOptimizationReport = () => {
  const [data, setData] = useState({ efficiency_score: 0, balance: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/reports/ai-metrics');
        setData(res.data);
        setLoading(false);
      } catch (err) { console.error(err); setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <DashboardLayout title="AI Performance" role="Admin">
      <div className="relative">
        {loading && <LoadingOverlay />}
        <ReportHeader title="AI Optimization" description="Scheduling efficiency Review" icon={ShieldCheck} onExport={() => {}} filters={{}} setFilters={() => {}} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-black/[0.02]">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <TrendingUp className="text-emerald-500" /> Workload Balancing
            </h3>
            <div className="h-[300px]">
              <SafeResponsiveContainer width="100%" height="100%">
                <BarChart data={data.workload_balance}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} />
                  <YAxis hide />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="val" radius={[20, 20, 20, 20]} barSize={60}>
                    {data.workload_balance?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 2 ? '#6366f1' : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </SafeResponsiveContainer>
            </div>
          </div>
          <div className="bg-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl shadow-indigo-900/40 relative overflow-hidden">
            <h3 className="text-2xl font-black mb-6">AI Efficiency Score</h3>
            <div className="text-7xl font-black mb-8">{data.efficiency_score}<span className="text-2xl text-indigo-200">%</span></div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl">
                <span className="text-xs font-black uppercase tracking-widest">Overtime Reduction</span>
                <span className="text-lg font-black text-emerald-400">+{data.overtime_reduction}%</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl">
                <span className="text-xs font-black uppercase tracking-widest">Staff Optimization</span>
                <span className="text-lg font-black text-emerald-400">+{data.staff_optimization}%</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl">
                <span className="text-xs font-black uppercase tracking-widest">Preference Match</span>
                <span className="text-lg font-black text-emerald-400">{data.preference_match}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const DepartmentCoverageReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/reports/department-coverage');
        setData(res.data);
        setLoading(false);
      } catch (err) { console.error(err); setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <DashboardLayout title="Dept Coverage" role="Admin">
      <div className="relative">
        {loading && <LoadingOverlay />}
        <ReportHeader title="Department Coverage" description="Live strength matrix" icon={BarChart3} onExport={() => exportToCSV(data, 'dept_coverage')} filters={{}} setFilters={() => {}} />
        <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-2xl shadow-black/[0.03]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-x divide-y divide-slate-50">
            {data.map((dept, i) => (
              <div key={i} className="p-8 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-6">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    dept.status === 'Critical' ? 'bg-rose-50 text-rose-600' : 
                    dept.status === 'Optimal' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {dept.status}
                  </span>
                  <h4 className="text-lg font-black text-slate-900">{dept.strength}%</h4>
                </div>
                <h5 className="text-sm font-black text-slate-600 uppercase tracking-widest mb-4">{dept.name}</h5>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${dept.strength}%` }}
                    className={`h-full rounded-full ${
                      dept.strength < 50 ? 'bg-rose-500' : 
                      dept.strength < 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const ReplacementHistoryReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/reports/replacement-history');
        setData(res.data);
        setLoading(false);
      } catch (err) { console.error(err); setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <DashboardLayout title="Replacement Logs" role="Admin">
      <div className="relative">
        {loading && <LoadingOverlay />}
        <ReportHeader title="Replacement History" description="Substitution tracking" icon={History} onExport={() => exportToCSV(data, 'replacement_history')} filters={{}} setFilters={() => {}} />
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-black/[0.02] overflow-hidden">
          <div className="p-8 lg:p-10 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] border-b border-slate-100">
                  <th className="pb-6 px-4">Date</th>
                  <th className="pb-6 px-4">Original Employee</th>
                  <th className="pb-6 px-4">Replacement</th>
                  <th className="pb-6 px-4">Shift</th>
                  <th className="pb-6 px-4 text-right">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((r, i) => (
                  <tr key={i} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-6 px-4 font-bold text-slate-500 text-sm italic">{r.date}</td>
                    <td className="py-6 px-4 text-sm font-black text-slate-900">{r.original_employee}</td>
                    <td className="py-6 px-4 text-sm font-black text-indigo-600">{r.replacement_employee}</td>
                    <td className="py-6 px-4 text-sm font-black text-slate-900">{r.shift}</td>
                    <td className="py-6 px-4 text-right">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${r.method === 'AI Auto' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-600'}`}>
                        {r.method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const WeeklyAnalytics = () => (
  <DashboardLayout title="Weekly Insights" role="Admin">
    <ReportHeader title="Weekly Analytics" description="Operational efficiency Review" icon={TrendingUp} onExport={() => {}} filters={{}} setFilters={() => {}} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-black/[0.02]">
        <h3 className="text-xl font-black text-slate-900 mb-8">Workforce Utilization %</h3>
        <div className="h-[300px]">
          <SafeResponsiveContainer width="100%" height="100%">
            <AreaChart data={[
              { name: 'Mon', val: 85 }, { name: 'Tue', val: 88 }, { name: 'Wed', val: 84 }, { name: 'Thu', val: 92 },
              { name: 'Fri', val: 95 }, { name: 'Sat', val: 78 }, { name: 'Sun', val: 75 },
            ]}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <Tooltip />
              <Area type="monotone" dataKey="val" stroke="#4f46e5" strokeWidth={3} fill="#818cf8" fillOpacity={0.1} />
            </AreaChart>
          </SafeResponsiveContainer>
        </div>
      </div>
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-black/[0.02]">
        <h3 className="text-xl font-black text-slate-900 mb-8">Incident Response (min)</h3>
        <div className="h-[300px]">
          <SafeResponsiveContainer width="100%" height="100%">
            <LineChart data={[
              { name: 'Mon', val: 12 }, { name: 'Tue', val: 14 }, { name: 'Wed', val: 10 }, { name: 'Thu', val: 8 },
              { name: 'Fri', val: 15 }, { name: 'Sat', val: 20 }, { name: 'Sun', val: 18 },
            ]}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <Tooltip />
              <Line type="stepAfter" dataKey="val" stroke="#f59e0b" strokeWidth={4} dot={true} />
            </LineChart>
          </SafeResponsiveContainer>
        </div>
      </div>
    </div>
  </DashboardLayout>
);

export const MonthlyAnalytics = () => (
  <DashboardLayout title="Monthly Review" role="Admin">
    <ReportHeader title="Monthly Analytics" description="30-day comprehensive review" icon={BarChart3} onExport={() => {}} filters={{}} setFilters={() => {}} />
    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-black/[0.02]">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          <div className="text-center">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Service Level</p>
             <h4 className="text-5xl font-black text-indigo-600 tracking-tighter">99.2<span className="text-xl">%</span></h4>
             <div className="mt-4 flex items-center justify-center gap-2 text-emerald-500 font-bold text-xs">
                <ArrowUpRight size={14} /> +2.4% vs Last Month
             </div>
          </div>
          <div className="text-center">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Retention Rate</p>
             <h4 className="text-5xl font-black text-slate-900 tracking-tighter">94.8<span className="text-xl">%</span></h4>
             <div className="mt-4 flex items-center justify-center gap-2 text-emerald-500 font-bold text-xs">
                <ArrowUpRight size={14} /> +0.5% vs Last Month
             </div>
          </div>
          <div className="text-center">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">AI Adoption</p>
             <h4 className="text-5xl font-black text-emerald-600 tracking-tighter">88.5<span className="text-xl">%</span></h4>
             <div className="mt-4 flex items-center justify-center gap-2 text-indigo-500 font-bold text-xs">
                <ArrowUpRight size={14} /> +12.0% vs Last Month
             </div>
          </div>
       </div>
    </div>
  </DashboardLayout>
);
