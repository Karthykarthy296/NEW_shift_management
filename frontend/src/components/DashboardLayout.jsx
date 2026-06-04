import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  User,
  Calendar,
  LayoutDashboard,
  Users,
  Clock,
  LogOut,
  Bell,
  Search,
  Settings,
  ChevronRight,
  AlertCircle,
  Shield,
  Upload,
  ClipboardList,
  ChevronLeft,
  X,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Zap,
  ArrowRight,
  Filter,
  MoreVertical,
  RefreshCw,
  BarChart3,
  PieChart,
  FileText,
  TrendingUp,
  History,
  CalendarRange,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileJson,
  Printer,
  ChevronUp,
  Loader2
} from 'lucide-react';

export const SearchContext = createContext({
  searchQuery: '',
  setSearchQuery: () => { },
  _isMock: true
});

export const SearchProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery, _isMock: false }}>
      {children}
    </SearchContext.Provider>
  );
};

// --- Export Sidebar Component ---
const ExportSidebar = ({ isOpen, onClose }) => {
  const [selectedReport, setSelectedReport] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState(null);

  const reports = [
    { id: 'employees', label: 'Employee Report', icon: <Users size={20} />, description: 'Full workforce directory and skills matrix' },
    { id: 'shifts', label: 'Shift Schedule Report', icon: <Clock size={20} />, description: 'Daily/Weekly personnel assignments' },
    { id: 'attendance', label: 'Attendance Report', icon: <CheckCircle2 size={20} />, description: 'Presence and absence tracking' },
    { id: 'leaves', label: 'Leave Report', icon: <CalendarRange size={20} />, description: 'Leave history and pending requests' },
    { id: 'performance', label: 'Performance Report', icon: <TrendingUp size={20} />, description: 'AI efficiency and workload balance' },
    { id: 'payroll', label: 'Payroll Report', icon: <Zap size={20} />, description: 'Overtime and estimated workforce costs' },
  ];

  const formats = [
    { id: 'xlsx', label: 'Excel (.xlsx)', icon: <FileSpreadsheet size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'pdf', label: 'PDF Document (.pdf)', icon: <FileText size={18} />, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'csv', label: 'CSV File (.csv)', icon: <FileJson size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExport = async (format) => {
    if (!selectedReport) return;
    setIsGenerating(true);

    try {
      const reportName = reports.find(r => r.id === selectedReport).label;
      const date = new Date().toISOString().split('T')[0];
      const filename = `${reportName.replace(/\s+/g, '_')}_${date}.${format}`;

      const token = localStorage.getItem('token');
      const response = await axios.get(`http://127.0.0.1:8000/export/${selectedReport}`, {
        params: { format },
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast(`${reportName} exported successfully!`);
      setSelectedReport(null);
      onClose();
    } catch (err) {
      console.error('Export error:', err);
      const errorMsg = err.response?.data?.detail || 'Export failed. Check backend connectivity.';
      showToast(errorMsg, 'danger');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-2xl z-[101] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Export Center</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Select report type and format</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                  <X size={24} className="text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {!selectedReport ? (
                  <div className="space-y-4">
                    {reports.map((report) => (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        key={report.id}
                        onClick={() => setSelectedReport(report.id)}
                        className="w-full text-left p-6 rounded-[2rem] border border-slate-100 bg-white hover:bg-indigo-50 hover:border-indigo-100 transition-all group flex items-start gap-5 shadow-sm hover:shadow-xl hover:shadow-indigo-900/5"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-white group-hover:text-indigo-500 transition-all shadow-sm">
                          {report.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{report.label}</h4>
                          <p className="text-xs font-bold text-slate-400 mt-1">{report.description}</p>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-400 mt-1" />
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                    <button
                      onClick={() => setSelectedReport(null)}
                      className="flex items-center gap-2 text-indigo-500 font-black text-xs uppercase tracking-widest hover:text-indigo-600 transition-colors"
                    >
                      <ChevronLeft size={16} /> Back to Reports
                    </button>

                    <div className="p-8 rounded-[2.5rem] bg-indigo-600 text-white shadow-2xl shadow-indigo-200 flex items-center gap-6">
                      <div className="w-16 h-16 rounded-[1.5rem] bg-white/10 flex items-center justify-center">
                        {reports.find(r => r.id === selectedReport).icon}
                      </div>
                      <div>
                        <h4 className="text-xl font-black">{reports.find(r => r.id === selectedReport).label}</h4>
                        <p className="text-xs font-bold text-indigo-100 mt-1">Ready for generation</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Output Format</p>
                      {formats.map((format) => (
                        <button
                          key={format.id}
                          disabled={isGenerating}
                          onClick={() => handleExport(format.id)}
                          className="w-full flex items-center justify-between p-6 rounded-[2rem] border border-slate-100 hover:border-slate-300 transition-all group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-4 relative z-10">
                            <div className={`w-10 h-10 rounded-xl ${format.bg} ${format.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                              {format.icon}
                            </div>
                            <span className="font-black text-slate-900">{format.label}</span>
                          </div>
                          <Download size={18} className="text-slate-300 group-hover:text-slate-900 relative z-10" />
                          <div className="absolute inset-0 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              <AnimatePresence>
                {isGenerating && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/80 backdrop-blur-sm z-[110] flex flex-col items-center justify-center gap-4"
                  >
                    <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] animate-pulse">Generating Report...</p>
                    <p className="text-xs font-bold text-slate-400 italic">Please do not close this window</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl shadow-2xl z-[200] flex items-center gap-3 font-black text-sm ${toast.type === 'success' ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white'
              }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-400" /> : <AlertCircle size={18} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const DashboardLayout = ({ title, children, role = "Employee" }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const searchContext = useContext(SearchContext);
  const searchQuery = searchContext?.searchQuery ?? '';
  const setSearchQuery = searchContext?.setSearchQuery ?? (() => { });
  const navigate = useNavigate();
  const location = useLocation();

  const username = localStorage.getItem('username') || 'User';
  const userRole = localStorage.getItem('role') || role.toLowerCase();
  const roleSlug = userRole.toLowerCase();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync state with global window for easy access from other components
  useEffect(() => {
    window.openExportSidebar = () => setIsExportOpen(true);
    return () => delete window.openExportSidebar;
  }, []);

  const reportItems = [
    { label: 'Attendance Report', path: `/${roleSlug}/reports/attendance`, icon: <Clock size={18} />, roles: ['admin', 'manager', 'supervisor'] },
    { label: 'Shift Distribution', path: `/${roleSlug}/reports/shift-distribution`, icon: <PieChart size={18} />, roles: ['admin', 'manager', 'supervisor'] },
    { label: 'Leave Report', path: `/${roleSlug}/reports/leave`, icon: <CalendarRange size={18} />, roles: ['admin', 'manager'] },
    { label: 'Overtime Report', path: `/${roleSlug}/reports/overtime`, icon: <TrendingUp size={18} />, roles: ['admin', 'manager'] },
    { label: 'AI Optimization', path: `/${roleSlug}/reports/ai-optimization`, icon: <Zap size={18} />, roles: ['admin', 'manager'] },
    { label: 'Department Coverage', path: `/${roleSlug}/reports/department-coverage`, icon: <BarChart3 size={18} />, roles: ['admin', 'manager'] },
    { label: 'Replacement History', path: `/${roleSlug}/reports/replacement-history`, icon: <History size={18} />, roles: ['admin', 'manager'] },
    { label: 'Weekly Analytics', path: `/${roleSlug}/reports/weekly-analytics`, icon: <TrendingUp size={18} />, roles: ['admin', 'manager', 'supervisor'] },
    { label: 'Monthly Analytics', path: `/${roleSlug}/reports/monthly-analytics`, icon: <BarChart3 size={18} />, roles: ['admin', 'manager'] },
  ].filter(item => item.roles.includes(userRole));

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: `/${roleSlug}/dashboard`, roles: ['admin', 'manager', 'supervisor'] },
    { icon: <Users size={20} />, label: 'Employees', path: `/${roleSlug}/employees`, roles: ['admin', 'manager'] },
    { icon: <Calendar size={20} />, label: 'Shifts', path: `/${roleSlug}/shifts`, roles: ['admin', 'manager', 'supervisor'] },
    { icon: <ClipboardList size={20} />, label: 'Leaves', path: `/${roleSlug}/leaves`, roles: ['admin', 'manager', 'supervisor'] },
    { icon: <Clock size={20} />, label: 'Overtime', path: `/${roleSlug}/overtime`, roles: ['admin', 'manager', 'supervisor'] },
    { icon: <RefreshCw size={20} />, label: 'Weekly Off Swap', path: `/${roleSlug}/weekly-off-swap`, roles: ['admin', 'manager', 'supervisor'] },
    { icon: <CalendarRange size={20} />, label: 'Weekly Off', path: `/${roleSlug}/weekly-off`, roles: ['admin', 'manager', 'supervisor'] },
    { icon: <Upload size={20} />, label: 'Upload', path: `/${roleSlug}/upload`, roles: ['admin', 'manager'] },
    {
      icon: <BarChart3 size={20} />,
      label: 'Reports',
      isSubmenu: true,
      roles: ['admin', 'manager', 'supervisor']
    },
    { icon: <History size={20} />, label: 'Activity Logs', path: `/${roleSlug}/activity-logs`, roles: ['admin', 'manager'] },
    { icon: <Shield size={20} />, label: 'Access Control', path: `/${roleSlug}/users`, roles: ['admin'] },
    { icon: <Settings size={20} />, label: 'Settings', path: `/${roleSlug}/settings`, roles: ['admin', 'manager', 'supervisor'] },
  ].filter(item => item.roles.includes(userRole));


  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Export Sidebar Integration */}
      <ExportSidebar isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Desktop & Mobile */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarOpen ? 280 : 88,
          x: mobileMenuOpen ? 0 : (window.innerWidth < 1024 ? -280 : 0)
        }}
        className={`fixed lg:flex flex-col left-0 top-0 h-screen bg-[#0f172a] text-white z-50 border-r border-white/5 overflow-hidden shadow-2xl transition-all duration-300 ${mobileMenuOpen ? 'flex w-[280px]' : 'hidden lg:flex'}`}
      >
        <div className="p-6 mb-4 flex items-center justify-between">
          <AnimatePresence mode='wait'>
            {(sidebarOpen || mobileMenuOpen) ? (
              <motion.div
                key="logo-full"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 font-bold text-xl tracking-tight"
              >
                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Zap size={22} className="text-white" fill="white" />
                </div>
                <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">ShiftAI</span>
              </motion.div>
            ) : (
              <motion.div
                key="logo-short"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-11 h-11 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mx-auto"
              >
                <Zap size={24} className="text-white" fill="white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            if (item.isSubmenu) {
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    onClick={() => setReportsOpen(!reportsOpen)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all duration-300 group ${reportsOpen ? 'bg-white/5 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`transition-colors ${reportsOpen ? 'text-indigo-400' : 'group-hover:text-white'}`}>
                        {item.icon}
                      </span>
                      {sidebarOpen && (
                        <motion.span
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="font-bold text-[15px]"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </div>
                    {sidebarOpen && (
                      <motion.div
                        animate={{ rotate: reportsOpen ? 180 : 0 }}
                        className="text-slate-500"
                      >
                        <ChevronDown size={16} />
                      </motion.div>
                    )}
                  </button>

                  <AnimatePresence>
                    {reportsOpen && sidebarOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden pl-4 space-y-1"
                      >
                        {reportItems.map((subItem) => {
                          const isSubActive = location.pathname === subItem.path;
                          return (
                            <NavLink
                              key={subItem.path}
                              to={subItem.path}
                              className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-300 group ${isSubActive
                                  ? 'bg-indigo-500/10 text-indigo-400'
                                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                            >
                              <span className={isSubActive ? 'text-indigo-400' : 'group-hover:text-white'}>
                                {subItem.icon}
                              </span>
                              <span className="text-[13px] font-bold">{subItem.label}</span>
                              {isSubActive && (
                                <motion.div
                                  layoutId="active-sub-indicator"
                                  className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                                />
                              )}
                            </NavLink>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            const isActive = location.pathname.includes(item.path);
            return (
              <motion.div
                key={item.path}
                whileHover={{ x: sidebarOpen ? 4 : 0 }}
                whileTap={{ scale: 0.98 }}
              >
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `w-full flex items-center gap-4 p-3.5 rounded-xl transition-all duration-300 relative group ${isActive
                      ? 'bg-indigo-500/15 text-indigo-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <span className={`transition-colors ${isActive ? 'text-indigo-400' : 'group-hover:text-white'}`}>
                    {item.icon}
                  </span>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="font-bold text-[15px]"
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                    />
                  )}
                </NavLink>
              </motion.div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 bg-slate-900/50">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center gap-4 p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all mb-2"
          >
            {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} className="mx-auto" />}
            {sidebarOpen && <span className="font-bold text-xs uppercase tracking-widest opacity-60">Collapse</span>}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-3.5 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={20} className={!sidebarOpen ? "mx-auto" : ""} />
            {sidebarOpen && <span className="font-bold text-[15px]">Sign Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main
        className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-[280px]' : 'lg:ml-[88px]'} min-h-screen flex flex-col`}
      >
        {/* Navbar */}
        <header
          className={`sticky top-0 z-40 transition-all duration-300 px-6 lg:px-10 h-20 flex items-center justify-between ${isScrolled ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm' : 'bg-transparent'
            }`}
        >
          <div className="flex items-center gap-4 lg:gap-6">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight leading-none">{title}</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active System: {userRole}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-8">
            {/* Search */}
            <div className="hidden md:flex relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Universal Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border-2 border-slate-100 rounded-2xl py-2.5 pl-12 pr-6 w-64 lg:w-96 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              {/* Export Trigger */}
              <button
                onClick={() => setIsExportOpen(true)}
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100 group"
              >
                <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
                Export
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-3 text-slate-500 hover:bg-white hover:text-slate-900 rounded-2xl transition-all shadow-sm border border-slate-100 bg-white"
                >
                  <Bell size={20} />
                  <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full right-0 mt-4 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-[60]"
                    >
                      <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                        <span className="font-black text-slate-900">Notifications</span>
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-widest">3 New</span>
                      </div>
                      <div className="py-2">
                        {[1, 2, 3].map(n => (
                          <div key={n} className="p-4 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer group">
                            <div className="flex gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                <Zap size={18} />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-slate-900">Shift Pattern Optimized</p>
                                <p className="text-xs text-slate-500 font-medium">AI completed weekly rotation.</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="h-8 w-[2px] bg-slate-200/60 mx-1 hidden sm:block"></div>

              <div className="relative">
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="flex items-center gap-3 pl-1 pr-1 sm:pr-4 py-1 hover:bg-white rounded-2xl transition-all group border border-transparent hover:border-slate-100 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-sm font-black text-slate-900 tracking-tight">{username}</span>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{userRole}</span>
                  </div>
                </button>

                <AnimatePresence>
                  {showProfile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full right-0 mt-4 w-56 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-[60]"
                    >
                      <div className="p-4 border-b border-slate-50 mb-1">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account Status</p>
                        <p className="text-sm font-black text-emerald-500">Verified System Account</p>
                      </div>
                      <button className="w-full flex items-center gap-3 p-3.5 hover:bg-slate-50 rounded-2xl transition-colors text-slate-700 font-bold text-sm">
                        <Settings size={18} /> Settings
                      </button>
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3.5 hover:bg-rose-50 rounded-2xl transition-colors text-rose-500 font-bold text-sm">
                        <LogOut size={18} /> Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-6 lg:p-10 max-w-[1920px] w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export const AlertPanel = ({ title, message, type = 'info' }) => {
  const styles = {
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 rounded-[2rem] border-2 ${styles[type]} mb-10 flex items-start gap-5 shadow-xl shadow-black/5`}
    >
      <div className="p-3 rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm">
        <Sparkles size={24} className="text-indigo-600" />
      </div>
      <div>
        <h4 className="font-black text-lg mb-1 tracking-tight">{title}</h4>
        <p className="text-sm font-bold opacity-80 leading-relaxed">{message}</p>
      </div>
    </motion.div>
  );
};

export const ShiftDisplay = ({ schedule, onUpdate }) => {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState("1");
  const [selectedDay, setSelectedDay] = useState("All");
  const [searchFilter, setSearchFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [deptFilter, setDeptFilter] = useState("All Depts");
  const itemsPerPage = 20;

  const fetch4WeekSchedule = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://127.0.0.1:8000/get-4-week-schedule', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScheduleData(res.data);
    } catch (e) {
      console.error("Error fetching 4-week schedule", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch4WeekSchedule();
  }, [schedule]);

  const handleGenerateNew = async () => {
    if (!window.confirm('Regenerate entire AI 4-week schedule? This will balance Morning / Evening / Night shifts and rotate weekly offs fairly day-by-day across all 4 weeks.')) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://127.0.0.1:8000/generate-4-week-schedule', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('AI successfully generated 4-week schedule!');
      fetch4WeekSchedule();
      onUpdate && onUpdate();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Error generating 4-week schedule');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '1rem' }}>
        <Loader2 className="animate-spin" size={48} style={{ color: '#7c3aed' }} />
        <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>Loading Enterprise Calendar Schedule...</p>
      </div>
    );
  }

  const weeks = scheduleData?.weeks || {};
  const currentWeekData = weeks[selectedWeek] || { employees: [] };
  const allEmployees = currentWeekData.employees || [];

  // Get distinct roles and departments for filter
  const distinctRoles = [...new Set(allEmployees.map(e => e.role).filter(Boolean))].sort();
  const distinctDepts = [...new Set(allEmployees.map(e => e.department).filter(Boolean))].sort();

  // Filter employees based on search, role, and dept
  const filteredEmployees = allEmployees.filter(emp => {
    if (searchFilter && !emp.name?.toLowerCase().includes(searchFilter.toLowerCase()) && !emp.emp_id?.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    if (roleFilter !== "All Roles" && emp.role !== roleFilter) return false;
    if (deptFilter !== "All Depts" && emp.department !== deptFilter) return false;
    return true;
  });

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Count metrics for the selected week & day
  const getDayCounts = (day) => {
    let working = 0;
    let resting = 0;
    allEmployees.forEach(emp => {
      if (emp.schedules && emp.schedules[day] === "WEEK OFF") {
        resting++;
      } else {
        working++;
      }
    });
    return { working, resting };
  };

  // Shift styles
  const getShiftBadgeStyle = (shiftName) => {
    const base = {
      padding: '0.35rem 0.75rem',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '95px',
      border: '1px solid'
    };
    
    switch (shiftName) {
      case 'Morning':
        return { ...base, background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' };
      case 'Afternoon':
        return { ...base, background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' };
      case 'Evening':
        return { ...base, background: '#faf5ff', color: '#6b21a8', borderColor: '#e9d5ff' };
      case 'Night':
        return { ...base, background: '#f1f5f9', color: '#334155', borderColor: '#cbd5e1' };
      case 'WEEK OFF':
        return { ...base, background: '#fef3c7', color: '#d97706', borderColor: '#fde68a' };
      default:
        return { ...base, background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' };
    }
  };

  // Pagination bounds
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100%', borderRadius: '1.5rem', padding: '2.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Sparkles size={24} style={{ color: '#7c3aed' }} />
            <h1 style={{ color: '#0f172a', fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              AI Calendar Scheduler
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
            Enterprise 4-Week Rotational Shift and Weekly Off Management System
          </p>
        </div>
        <button
          onClick={handleGenerateNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.9rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(124, 58, 237, 0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)'; }}
        >
          <Sparkles size={16} />
          Regenerate 4-Week AI Schedule
        </button>
      </div>

      {/* Week Selector Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {["1", "2", "3", "4"].map(w => {
          const isActive = selectedWeek === w;
          const weekStartDate = weeks[w]?.start_date ? new Date(weeks[w].start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          return (
            <motion.button
              key={w}
              onClick={() => { setSelectedWeek(w); setCurrentPage(1); }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '1.25rem',
                borderRadius: '1rem',
                border: isActive ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                background: isActive ? 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' : '#ffffff',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: isActive ? '0 8px 20px rgba(124, 58, 237, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)',
                transition: 'all 0.25s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isActive ? '#7c3aed' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  WEEK {w}
                </span>
                <CalendarRange size={16} style={{ color: isActive ? '#7c3aed' : '#94a3b8' }} />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                {weekStartDate ? `Starts ${weekStartDate}` : `Schedule Week ${w}`}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', fontWeight: 600 }}>
                7 Days AI Rotated Plan
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Day Selector Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#f8fafc',
        borderRadius: '1rem',
        padding: '0.5rem',
        gap: '0.35rem',
        marginBottom: '2rem',
        border: '1px solid #e2e8f0',
        overflowX: 'auto',
      }}>
        <button
          onClick={() => { setSelectedDay("All"); setCurrentPage(1); }}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '0.75rem',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            border: 'none',
            background: selectedDay === 'All' ? '#7c3aed' : 'transparent',
            color: selectedDay === 'All' ? '#ffffff' : '#64748b',
            transition: 'all 0.2s',
          }}
        >
          📅 Weekly Overview
        </button>

        {daysOfWeek.map(d => {
          const counts = getDayCounts(d);
          const isSelected = selectedDay === d;
          return (
            <button
              key={d}
              onClick={() => { setSelectedDay(d); setCurrentPage(1); }}
              style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '0.75rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                border: 'none',
                background: isSelected ? '#7c3aed' : 'transparent',
                color: isSelected ? '#ffffff' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{d.substring(0, 3)}</span>
              <span style={{
                fontSize: '0.7rem',
                padding: '0.1rem 0.4rem',
                borderRadius: '6px',
                background: isSelected ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                color: isSelected ? '#ffffff' : '#475569',
                fontWeight: 800,
              }}>
                {counts.working}
              </span>
            </button>
          );
        })}
      </div>

      {/* Advanced Filters Roster */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '1rem',
        padding: '1.25rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by Employee Name, ID or Role..."
            value={searchFilter}
            onChange={e => { setSearchFilter(e.target.value); setCurrentPage(1); }}
            style={{
              width: '100%',
              padding: '0.7rem 1rem 0.7rem 2.5rem',
              borderRadius: '0.75rem',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontSize: '0.875rem',
              fontWeight: 600,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
        </div>

        {/* Filters Select boxes */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={e => { setDeptFilter(e.target.value); setCurrentPage(1); }}
            style={selectStyle}
          >
            <option value="All Depts">All Departments</option>
            {distinctDepts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setCurrentPage(1); }}
            style={selectStyle}
          >
            <option value="All Roles">All Roles</option>
            {distinctRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Main Roster Schedule View */}
      {filteredEmployees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed #e2e8f0', borderRadius: '1.25rem', color: '#64748b' }}>
          <Calendar size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>No Employees Scheduled</h3>
          <p style={{ fontSize: '0.875rem' }}>No records match your active search and filter options.</p>
        </div>
      ) : selectedDay === "All" ? (
        /* WEEKLY CALENDAR TABLE LAYOUT */
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '1.25rem', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '1.25rem 1.5rem', color: '#475569', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', width: '220px' }}>Employee</th>
                <th style={{ padding: '1.25rem 1rem', color: '#475569', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', width: '160px' }}>Role / Dept</th>
                {daysOfWeek.map(day => (
                  <th key={day} style={{ padding: '1.25rem 1rem', color: '#475569', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                    {day.substring(0,3)}
                  </th>
                ))}
                <th style={{ padding: '1.25rem 1.5rem', color: '#475569', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: '120px' }}>Off Day</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((emp, index) => (
                <tr
                  key={emp.id || index}
                  style={{
                    borderBottom: index === paginatedEmployees.length - 1 ? 'none' : '1px solid #f1f5f9',
                    background: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f3ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = index % 2 === 0 ? '#ffffff' : '#f8fafc'; }}
                >
                  {/* Name & ID */}
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '0.5rem',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #c4b5fd 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.9rem', fontWeight: 900, color: '#ffffff'
                      }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{emp.name}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed' }}>{emp.emp_id}</div>
                      </div>
                    </div>
                  </td>
                  {/* Role & Dept */}
                  <td style={{ padding: '1.25rem 1rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 750, color: '#334155' }}>{emp.role}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{emp.department}</div>
                  </td>
                  {/* Monday to Sunday shifts */}
                  {daysOfWeek.map(day => {
                    const shiftName = emp.schedules ? emp.schedules[day] : 'Morning';
                    return (
                      <td key={day} style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                        <span style={getShiftBadgeStyle(shiftName)}>
                          {shiftName}
                        </span>
                      </td>
                    );
                  })}
                  {/* Rotated Off Day */}
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#d97706', background: '#fef3c7', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid #fde68a' }}>
                      {emp.weekly_off}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* DAILY SHIFT GROUP CARDS LAYOUT */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {["Morning", "Afternoon", "Evening", "Night", "WEEK OFF"].map(shift => {
            const shiftEmployees = paginatedEmployees.filter(emp => emp.schedules && emp.schedules[selectedDay] === shift);
            if (shiftEmployees.length === 0) return null;

            const isOff = shift === "WEEK OFF";
            
            return (
              <div key={shift}>
                {/* Shift Sub-Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <span style={getShiftBadgeStyle(shift)}>{shift}</span>
                  <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>
                    {shiftEmployees.length} {shiftEmployees.length === 1 ? 'employee' : 'employees'} assigned
                  </span>
                </div>

                {/* Grid layout for employee cards in this shift */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {shiftEmployees.map((emp, index) => (
                    <motion.div
                      key={emp.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01, borderColor: isOff ? '#fde68a' : '#c4b5fd', background: isOff ? '#fffbeb' : '#f5f3ff' }}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1rem',
                        padding: '1.25rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                      onClick={async () => {
                        if (isOff) {
                          alert(`${emp.name} is on WEEK OFF. Let them rest!`);
                          return;
                        }
                        if (!window.confirm(`Mark ${emp.name} as on leave for ${selectedDay} in Week ${selectedWeek}? AI will find an ideal replacement.`)) return;
                        const token = localStorage.getItem('token');
                        try {
                          await axios.post('http://127.0.0.1:8000/apply-leave', {
                            employee_name: emp.name,
                            date: weeks[selectedWeek]?.start_date // Use start date as target
                          }, { headers: { Authorization: `Bearer ${token}` } });
                          alert('Leave marked and replacement assigned!');
                          fetch4WeekSchedule();
                          onUpdate && onUpdate();
                        } catch (e) {
                          alert(e?.response?.data?.detail || 'Error applying leave');
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '0.55rem',
                          background: isOff ? '#fffbeb' : '#f5f3ff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem', fontWeight: 900, color: isOff ? '#d97706' : '#7c3aed',
                          flexShrink: 0,
                          border: isOff ? '1px solid #fde68a' : '1px solid #ddd6fe',
                        }}>
                          {emp.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {emp.name}
                          </div>
                          <div style={{ color: isOff ? '#d97706' : '#7c3aed', fontSize: '0.75rem', fontWeight: 700 }}>
                            {emp.emp_id}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: isOff ? '#f59e0b' : '#10b981',
                            display: 'inline-block'
                          }} />
                          <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {emp.role}
                          </span>
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>
                          {emp.department}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modern High-Performance Pagination Bar */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: currentPage === 1 ? '#94a3b8' : '#0f172a',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 750 }}>
            Page {currentPage} of {totalPages} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({filteredEmployees.length} employees)</span>
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: currentPage === totalPages ? '#94a3b8' : '#0f172a',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

const selectStyle = {
  padding: '0.55rem 2rem 0.55rem 0.85rem',
  borderRadius: '0.6rem',
  fontSize: '0.875rem',
  fontWeight: 700,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  color: '#0f172a',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='4 6 8 10 12 6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.5rem center',
  backgroundSize: '16px 16px',
};

export default DashboardLayout;


