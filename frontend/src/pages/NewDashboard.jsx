import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
  Zap,
  ChevronRight,
  Download
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API_URL = 'http://127.0.0.1:8000';

export default function NewDashboard() {
  const [summary, setSummary] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [schedulesGenerated, setSchedulesGenerated] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'User';
  const username = localStorage.getItem('username') || 'User';
  const today = new Date().toISOString().split('T')[0];


  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch summary
        const summaryRes = await axios.get(`${API_URL}/dashboard-summary`, { headers });
        setSummary(summaryRes.data);

        // Fetch schedule
        const scheduleRes = await axios.get(`${API_URL}/get-schedule?date=${today}`, { headers });
        setSchedule(scheduleRes.data);

        // Fetch leaves
        const leavesRes = await axios.get(`${API_URL}/leaves`, { headers });
        setLeaves(leavesRes.data || []);

        // Fetch schedules generated count this month
        try {
          const countRes = await axios.get(`${API_URL}/schedules-generated-count`, { headers });
          setSchedulesGenerated(countRes.data?.count ?? 1);
        } catch {
          setSchedulesGenerated(1);
        }

        // One-time check of AI generation status (no polling loop)
        try {
          const statusRes = await axios.get(`${API_URL}/schedule-generation-status`);
          setIsGenerating(statusRes.data?.is_generating ?? false);
        } catch {
          setIsGenerating(false);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        if (error.response?.status === 401) {
          navigate('/login');
        }
      }
    };

    fetchData();
    // Empty dependency array: runs ONCE on mount only. No polling, no re-fetch loops.
  }, []);

  // Calculate stats from actual backend data
  const totalEmployees = summary?.total_employees || 0;
  const presentToday = summary?.active_shifts || 0;
  const onLeaveToday = summary?.today_leaves || 0;
  const weeklyOffToday = summary?.today_weekly_off || 0;
  const absentToday = Math.max(0, totalEmployees - presentToday - onLeaveToday - weeklyOffToday);
  
  const totalShiftsCount = Object.keys(summary?.shift_assignments || {}).length || 3;
  const departmentsCount = Object.keys(summary?.department_distribution || {}).length || 0;

  // Dynamic Shift distribution data
  const shiftData = Object.entries(summary?.shift_assignments || {}).map(([name, count], idx) => {
    const colors = ['#3B82F6', '#F59E0B', '#1F2937', '#10B981'];
    const total = Object.values(summary?.shift_assignments || {}).reduce((a, b) => a + b, 0);
    return {
      name,
      value: count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(2) : 0,
      color: colors[idx % colors.length],
      time: name === 'Morning' ? '6:00 AM - 2:00 PM' : name === 'Afternoon' ? '2:00 PM - 10:00 PM' : '10:00 PM - 6:00 AM'
    };
  });

  // Dynamic Department wise employee count
  const departmentData = Object.entries(summary?.department_distribution || {}).map(([name, count]) => ({
    name,
    count
  }));

  // Dynamic Attendance overview
  const attendanceData = [
    { name: 'Present', value: presentToday, color: '#10B981' },
    { name: 'On Leave', value: onLeaveToday, color: '#F59E0B' },
    { name: 'Weekly Off', value: weeklyOffToday, color: '#3B82F6' },
    { name: 'Absent', value: absentToday, color: '#9CA3AF' }
  ].filter(d => d.value > 0);

  const attendancePercentage = totalEmployees > 0 ? ((presentToday / totalEmployees) * 100).toFixed(2) : '0.00';

  // Dynamic Recent leave requests
  const recentLeaves = leaves.slice(0, 5).map(l => ({
    name: l.employee_name,
    department: l.department || 'General',
    type: 'General Leave',
    date: l.date,
    status: 'Approved'
  }));

  // Dynamic Today's shift schedule
  const todaySchedule = Object.entries(summary?.shift_assignments || {}).map(([name, count], idx) => ({
    shift: `${name} Shift`,
    time: name === 'Morning' ? '6:00 AM - 2:00 PM' : name === 'Afternoon' ? '2:00 PM - 10:00 PM' : '10:00 PM - 6:00 AM',
    employees: count,
    status: 'Active'
  }));

  // Bottom metrics
  const metrics = [
    { label: 'Schedules Generated', value: String(schedulesGenerated), subtitle: 'This Month', icon: Calendar, color: 'bg-pink-50 text-pink-600' },
    { label: 'Attendance Rate', value: `${attendancePercentage}%`, subtitle: 'Currently Present', icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
    { label: 'Overtime Hours', value: '45.30', subtitle: 'This Month', icon: Clock, color: 'bg-blue-50 text-blue-600' },
    { label: 'Productivity Rate', value: '88.10%', subtitle: 'This Month', icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Employee Satisfaction', value: '4.2 / 5', subtitle: 'This Month', icon: Users, color: 'bg-purple-50 text-purple-600' }
  ];

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-8">
        {/* Pulsing AI Generator Banner */}
        {isGenerating && (
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff, #faf5ff)',
            border: '1px solid #c7d2fe',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.08)',
            animation: 'pulse-slow 2s infinite alternate',
            marginBottom: '10px'
          }}>
            <style>{`
              @keyframes pulse-slow {
                0% { box-shadow: 0 4px 15px rgba(99, 102, 241, 0.08); border-color: #c7d2fe; }
                100% { box-shadow: 0 4px 25px rgba(99, 102, 241, 0.2); border-color: #818cf8; }
              }
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
              }
            `}</style>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>
              🤖
            </div>
            <div style={{ flexGrow: 1 }}>
              <h4 style={{ fontWeight: 600, color: '#1e3a8a', fontSize: '14px', margin: 0 }}>
                AI Shift Scheduling & Balancing in Progress...
              </h4>
              <p style={{ color: '#4b5563', fontSize: '12px', margin: '2px 0 0 0' }}>
                The Enterprise AI Auto-Scheduler is processing records, distributing weekly offs fairly, and balancing morning/evening/night shifts. The stats will refresh automatically.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#3b82f6',
                  animation: 'bounce 1.2s infinite ease-in-out both',
                  animationDelay: `${i * 0.15}s`
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Welcome back, {role.charAt(0).toUpperCase() + role.slice(1)} User! 👋
            </h2>
            <p className="text-gray-600">Here's what's happening with your organization today.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => window.openExportSidebar && window.openExportSidebar()}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-sm"
            >
              <Download size={18} />
              Export Report
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
              <Calendar size={18} />
              Generate Schedule
            </button>
          </div>
        </div>

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Employees</p>
                <p className="text-3xl font-bold text-gray-900">{totalEmployees}</p>
                <p className="text-xs text-green-600 font-semibold mt-1">All employees</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                <UserCheck className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Present Today</p>
                <p className="text-3xl font-bold text-gray-900">{presentToday}</p>
                <p className="text-xs text-gray-600 font-semibold mt-1">{attendancePercentage}% of total</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
                <UserX className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">On Leave Today</p>
                <p className="text-3xl font-bold text-gray-900">{onLeaveToday}</p>
                <p className="text-xs text-gray-600 font-semibold mt-1">{(totalEmployees > 0 ? (onLeaveToday / totalEmployees * 100).toFixed(2) : 0)}% of total</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Clock className="text-indigo-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Shifts</p>
                <p className="text-3xl font-bold text-gray-900">{totalShiftsCount}</p>
                <p className="text-xs text-gray-600 font-semibold mt-1">{Object.keys(summary?.shift_assignments || {}).join(', ')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-pink-50 flex items-center justify-center">
                <Building2 className="text-pink-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Departments</p>
                <p className="text-3xl font-bold text-gray-900">{departmentsCount}</p>
                <p className="text-xs text-gray-600 font-semibold mt-1">{Object.keys(summary?.department_distribution || {}).join(', ')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shift Distribution */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Shift Distribution (Today)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shiftData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {shiftData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {shiftData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-700">{item.name} ({item.time})</span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.value} ({item.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Department Wise Employee Count */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Department Wise Employee Count</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Today's Attendance Overview */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Today's Attendance Overview</h3>
            <div className="h-64 flex items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={attendanceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {attendanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold text-gray-900">{attendancePercentage}%</p>
                  <p className="text-sm text-gray-600">Present</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {attendanceData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.value} ({item.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Shift Schedule */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Today's Shift Schedule</h3>
              <button onClick={() => navigate(`/${role}/shifts`)} className="text-sm text-blue-600 font-semibold hover:text-blue-700">View Full Schedule</button>
            </div>
            <div className="space-y-4">
              {todaySchedule.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    idx === 0 ? 'bg-blue-100' : idx === 1 ? 'bg-orange-100' : 'bg-gray-800'
                  }`}>
                    <Clock className={idx === 0 ? 'text-blue-600' : idx === 1 ? 'text-orange-600' : 'text-white'} size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{item.shift}</p>
                    <p className="text-sm text-gray-600">{item.time}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-gray-700">
                      <Users size={16} />
                      <span className="font-semibold">{item.employees}</span>
                    </div>
                    <span className="text-xs text-green-600 font-semibold">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Leave Requests */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Recent Leave Requests</h3>
              <button onClick={() => navigate(`/${role}/leaves`)} className="text-sm text-blue-600 font-semibold hover:text-blue-700">View All</button>
            </div>
            <div className="space-y-3">
              {recentLeaves.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 pb-3 border-b border-gray-100 last:border-0">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-700">
                    {item.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-600">{item.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">{item.type}</p>
                    <p className="text-xs text-gray-500">{item.date}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    item.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="text-blue-600" size={20} />
              <h3 className="text-lg font-bold text-gray-900">AI Insights</h3>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">All shifts are perfectly balanced today.</p>
                  <p className="text-xs text-gray-600">Morning: 333, Afternoon: 334, Night: 333 employees.</p>
                </div>
              </div>
              <div className="flex gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">50% of employees are currently on leave.</p>
                  <p className="text-xs text-gray-600">500 employees present, 500 on leave. Monitor attendance patterns.</p>
                </div>
              </div>
              <div className="flex gap-3 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <AlertCircle className="text-indigo-600 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">All 5 departments have equal distribution.</p>
                  <p className="text-xs text-gray-600">Each department has exactly 200 employees for optimal balance.</p>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-blue-600 hover:text-blue-700">
                View More Insights
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {metrics.map((metric, idx) => (
            <div key={idx} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg ${metric.color} flex items-center justify-center`}>
                  <metric.icon size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                  <p className="text-xs text-gray-600 font-semibold mt-1">{metric.label}</p>
                  <p className="text-xs text-gray-500">{metric.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
