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
  RefreshCw
} from 'lucide-react';

export const SearchContext = createContext({
  searchQuery: '',
  setSearchQuery: () => {},
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

const DashboardLayout = ({ title, children, role = "Employee" }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const searchContext = useContext(SearchContext);
  const searchQuery = searchContext?.searchQuery ?? '';
  const setSearchQuery = searchContext?.setSearchQuery ?? (() => {});
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

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: `/${roleSlug}/dashboard`, roles: ['admin', 'manager', 'supervisor'] },
    { icon: <Users size={20} />, label: 'Employees', path: `/${roleSlug}/employees`, roles: ['admin', 'manager'] },
    { icon: <Calendar size={20} />, label: 'Shifts', path: `/${roleSlug}/shifts`, roles: ['admin', 'manager', 'supervisor'] },
    { icon: <ClipboardList size={20} />, label: 'Leaves', path: `/${roleSlug}/leaves`, roles: ['admin', 'manager', 'supervisor'] },
    { icon: <RefreshCw size={20} />, label: 'Weekly Off Swap', path: `/${roleSlug}/weekly-off-swap`, roles: ['admin', 'manager', 'supervisor'] },
    { icon: <Upload size={20} />, label: 'Upload', path: `/${roleSlug}/upload`, roles: ['admin', 'manager'] },
    { icon: <Shield size={20} />, label: 'Access Control', path: `/${roleSlug}/users`, roles: ['admin'] },
    { icon: <Settings size={20} />, label: 'Settings', path: `/${roleSlug}/settings`, roles: ['admin', 'manager', 'supervisor'] },
  ].filter(item => item.roles.includes(userRole));

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar Desktop */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 88 }}
        className="hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-[#0f172a] text-white z-50 border-r border-white/5 overflow-hidden shadow-2xl"
      >
        <div className="p-6 mb-4 flex items-center justify-between">
          <AnimatePresence mode='wait'>
            {sidebarOpen ? (
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
            const isActive = location.pathname.includes(item.path);
            return (
              <motion.div
                key={item.path}
                whileHover={{ x: sidebarOpen ? 4 : 0 }}
                whileTap={{ scale: 0.98 }}
              >
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `w-full flex items-center gap-4 p-3.5 rounded-xl transition-all duration-300 relative group ${
                    isActive 
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
          className={`sticky top-0 z-40 transition-all duration-300 px-6 lg:px-10 h-20 flex items-center justify-between ${
            isScrolled ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm' : 'bg-transparent'
          }`}
        >
          <div className="flex items-center gap-6">
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
                        {[1,2,3].map(n => (
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
  const shiftNames = schedule && typeof schedule === 'object' && schedule.shifts ? Object.keys(schedule.shifts) : [];
  const [activeShift, setActiveShift] = useState('Morning');

  useEffect(() => {
    if (shiftNames.length > 0 && !shiftNames.includes(activeShift)) {
      setActiveShift(shiftNames[0]);
    } else if (shiftNames.length > 0 && activeShift === 'Morning' && !shiftNames.includes('Morning')) {
      setActiveShift(shiftNames[0]);
    }
  }, [schedule, shiftNames, activeShift]);

  if (!schedule || typeof schedule !== 'object') return (
    <div className="w-full py-32 rounded-[3rem] bg-white border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-6">
      <div className="w-20 h-20 rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-300 animate-pulse">
        <Zap size={40} />
      </div>
      <p className="text-slate-400 font-black tracking-[0.2em] uppercase text-sm animate-pulse">Initializing AI Core...</p>
    </div>
  );

  const currentShiftData = (schedule.shifts && typeof schedule.shifts === 'object') ? (schedule.shifts[activeShift] || {}) : {};
  const weeklyOffs = Array.isArray(schedule.weekly_off) ? schedule.weekly_off : [];
  const assigned = Array.isArray(currentShiftData.employees) ? currentShiftData.employees : [];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex bg-white/80 p-2 rounded-[2rem] backdrop-blur-xl border border-slate-200/60 shadow-xl shadow-black/5">
          {shiftNames.map((s) => (
            <button
              key={s}
              onClick={() => setActiveShift(s)}
              className={`px-8 py-4 rounded-[1.5rem] text-sm font-black transition-all duration-500 ${
                activeShift === s 
                  ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/30 scale-[1.05]' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="px-6 py-4 rounded-[2rem] bg-white border border-slate-200 shadow-sm flex items-center gap-3">
             <Calendar className="text-indigo-500" size={18} />
             <span className="text-sm font-black text-slate-900">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          
          <button 
            onClick={async () => {
              if(!window.confirm("Regenerate entire AI schedule for today? This will clear manual overrides.")) return;
              const token = localStorage.getItem('token');
              try {
                await axios.post('http://127.0.0.1:8000/generate-schedule', { date: new Date().toISOString().split('T')[0] }, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                onUpdate && onUpdate();
              } catch(e) { alert("Error regenerating schedule"); }
            }}
            className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-100 group"
          >
            <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
            Regenerate AI
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10">
        {/* Weekly Off Card */}
        <motion.div 
          layout
          className="relative overflow-hidden group"
        >
          <div className="bg-white border border-slate-100 rounded-[3rem] p-10 lg:p-14 shadow-2xl shadow-orange-900/5 relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white shadow-2xl shadow-orange-200 ring-8 ring-orange-50">
                  <Clock size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">System Rest Days</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-widest border border-orange-200">
                      Rotating Weekly Off
                    </span>
                    <span className="text-sm font-bold text-slate-500">{weeklyOffs.length} Personnel resting today</span>
                  </div>
                </div>
              </div>
              
              <button className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 group/btn">
                Broadcast Schedule <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="flex overflow-x-auto gap-5 pb-6 px-1 custom-scrollbar snap-x snap-mandatory">
              {weeklyOffs.length > 0 ? (
                weeklyOffs.map((emp, i) => (
                  <motion.div 
                    key={emp?.id || i}
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex-shrink-0 flex items-center gap-4 px-6 py-4 bg-slate-50 border-2 border-transparent hover:border-orange-200 hover:bg-white rounded-[1.5rem] transition-all group/chip cursor-default shadow-sm hover:shadow-xl hover:shadow-orange-900/5 snap-start"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white text-orange-500 flex items-center justify-center font-black text-sm border border-slate-100 group-hover/chip:bg-orange-500 group-hover/chip:text-white transition-all shadow-sm">
                      {(emp?.name || '?').charAt(0)}
                    </div>
                    <div>
                      <p className="text-[15px] font-black text-slate-900 leading-none group-hover/chip:text-orange-600 transition-colors">{emp?.name || 'Unknown'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-1.5">{emp?.emp_id || 'N/A'}</p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="w-full py-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-[2rem] italic tracking-widest bg-slate-50/50">
                  CRITICAL: NO PERSONNEL RESTING IN CURRENT SHIFT
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Assigned Personnel Grid */}
        <div>
          <div className="flex items-center justify-between mb-8 px-4">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                   <Users size={18} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Deployed Force</h3>
             </div>
             <button className="text-sm font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                View Allocation Report <ChevronRight size={16} />
             </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
            {assigned.map((item, idx) => {
              if (!item || typeof item !== 'object') return null;
              return (
                <motion.div
                  key={item?.emp_id || idx}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-black/[0.02] hover:shadow-[0_32px_64px_-12px_rgba(15,23,42,0.12)] hover:-translate-y-3 transition-all duration-700"
                >
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-700 relative overflow-hidden ring-4 ring-slate-50/50">
                        <User size={32} className="text-slate-300 group-hover:text-indigo-500 transition-colors duration-500" />
                        <div className="absolute inset-0 bg-indigo-500 opacity-0 group-hover:opacity-5 transition-opacity"></div>
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="text-xl font-black text-slate-900 leading-tight tracking-tight group-hover:text-indigo-600 transition-colors duration-500">{item?.name || 'Unknown'}</h4>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest">{item?.emp_id || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                             {Array.isArray(item?.skills) ? item.skills.join(', ') : (typeof item?.skills === 'string' ? item.skills : (item?.role || 'Personnel'))}
                           </p>
                        </div>
                      </div>
                    </div>
                    <button className="text-slate-300 hover:text-slate-900 transition-colors p-1">
                       <MoreVertical size={20} />
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem] group-hover:bg-indigo-50 group-hover:border-indigo-100 border border-transparent transition-all duration-500">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-white shadow-sm text-indigo-500 group-hover:scale-110 transition-transform">
                          <Clock size={18} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Deployment Time</span>
                          <span className="text-sm font-black text-slate-900">{item?.start_time || '--'} - {item?.end_time || '--'}</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={async () => {
                        if(!window.confirm(`Mark ${item?.name || 'employee'} as on leave for today and assign an AI replacement?`)) return;
                        const token = localStorage.getItem('token');
                        try {
                          await axios.post('http://127.0.0.1:8000/apply-leave', { 
                            employee_name: item?.name, 
                            date: new Date().toISOString().split('T')[0] 
                          }, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          onUpdate && onUpdate();
                        } catch(e) { 
                          alert(e?.response?.data?.detail || "Error assigning replacement"); 
                        }
                      }}
                      className="w-full py-4 rounded-[1.5rem] text-white bg-indigo-600 border-2 border-indigo-600 text-sm font-black hover:bg-indigo-700 hover:border-indigo-700 transition-all duration-500 shadow-xl shadow-indigo-100 hover:shadow-indigo-900/20"
                    >
                      Assign Replacement
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
