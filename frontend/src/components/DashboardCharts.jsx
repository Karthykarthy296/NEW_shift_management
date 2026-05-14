import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import { 
  Users, 
  RotateCcw, 
  UserMinus, 
  Coffee, 
  TrendingUp, 
  Calendar, 
  Zap, 
  Activity,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  BrainCircuit,
  PieChart as PieIcon,
  BarChart3,
  Sparkles,
  MoreVertical
} from 'lucide-react';

const DashboardCharts = ({ summary, role = "Admin" }) => {
  // Fallback stats
  const stats = summary || {
    total_employees: 1000,
    active_shifts: 4,
    today_leaves: 12,
    today_weekly_off: 143,
    shift_assignments: { Morning: 250, Afternoon: 230, Evening: 245, Night: 132 }
  };

  const statCards = [
    { 
      label: 'Total Personnel', 
      value: stats.total_employees, 
      trend: '+12.5%', 
      trendType: 'up',
      icon: <Users size={24} />, 
      gradient: 'from-indigo-600 to-indigo-400',
      shadow: 'shadow-indigo-500/30'
    },
    { 
      label: 'Active Rotations', 
      value: stats.active_shifts, 
      trend: 'Optimized', 
      trendType: 'neutral',
      icon: <RotateCcw size={24} />, 
      gradient: 'from-purple-600 to-purple-400',
      shadow: 'shadow-purple-500/30'
    },
    { 
      label: 'Absence Today', 
      value: stats.today_leaves, 
      trend: '-2.4%', 
      trendType: 'down',
      icon: <UserMinus size={24} />, 
      gradient: 'from-rose-500 to-rose-400',
      shadow: 'shadow-rose-500/30'
    },
    { 
      label: 'Resting Today', 
      value: stats.today_weekly_off, 
      trend: 'Balanced', 
      trendType: 'neutral',
      icon: <Coffee size={24} />, 
      gradient: 'from-amber-500 to-amber-400',
      shadow: 'shadow-amber-500/30'
    }
  ];

  const shiftData = Object.entries(stats.shift_assignments || {}).map(([name, val]) => ({
    name,
    value: val,
    full: 300
  }));

  const workforceTrends = [
    { day: 'Mon', active: 850, leave: 45, rest: 105 },
    { day: 'Tue', active: 840, leave: 52, rest: 108 },
    { day: 'Wed', active: 865, leave: 38, rest: 97 },
    { day: 'Thu', active: 820, leave: 65, rest: 115 },
    { day: 'Fri', active: 880, leave: 30, rest: 90 },
    { day: 'Sat', active: 750, leave: 85, rest: 165 },
    { day: 'Sun', active: 720, leave: 92, rest: 188 },
  ];

  const COLORS = ['#6366f1', '#f59e0b', '#8b5cf6', '#3b82f6'];

  return (
    <div className="space-y-10">
      {/* Top Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {statCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: -5, scale: 1.02 }}
            className={`relative overflow-hidden p-8 rounded-[2.5rem] bg-gradient-to-br ${card.gradient} text-white shadow-2xl ${card.shadow} group cursor-default`}
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-500">
               {card.icon}
            </div>
            <div className="relative z-10">
               <div className="flex items-center justify-between mb-6">
                  <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner border border-white/30">
                    {card.icon}
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-white/20 ${
                    card.trendType === 'up' ? 'bg-emerald-500/20 text-emerald-100' : 
                    card.trendType === 'down' ? 'bg-rose-500/20 text-rose-100' : 'bg-white/20 text-white'
                  }`}>
                    {card.trendType === 'up' && <ArrowUpRight size={12} />}
                    {card.trendType === 'down' && <ArrowDownRight size={12} />}
                    {card.trend}
                  </div>
               </div>
               <div className="space-y-1">
                  <h3 className="text-4xl font-black tracking-tight">{card.value}</h3>
                  <p className="text-xs font-bold text-white/70 uppercase tracking-[0.2em]">{card.label}</p>
               </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 overflow-hidden">
               <motion.div 
                 initial={{ x: '-100%' }}
                 animate={{ x: '0%' }}
                 transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                 className="h-full bg-white/40"
               />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Workforce Activity Trends */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-2 bg-white rounded-[3rem] p-10 lg:p-14 border border-slate-100 shadow-xl shadow-black/[0.02]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                <Activity size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Operational Intelligence</h3>
                <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest">Force readiness & availability trends</p>
              </div>
            </div>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
               <button className="px-5 py-2.5 rounded-xl text-xs font-black bg-white text-indigo-600 shadow-md uppercase tracking-wider">7 Days</button>
               <button className="px-5 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:text-slate-900 uppercase tracking-wider">30 Days</button>
            </div>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={400} minHeight={400}>
              <AreaChart data={workforceTrends}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                    padding: '20px'
                  }} 
                />
                <Area type="monotone" dataKey="active" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorActive)" />
                <Area type="monotone" dataKey="rest" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorRest)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12 pt-10 border-t border-slate-50">
             <div className="flex items-center gap-4 group cursor-default">
                <div className="w-2 h-8 rounded-full bg-indigo-500 shadow-lg shadow-indigo-200 transition-all group-hover:scale-y-125"></div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Average On-Shift</p>
                   <p className="text-xl font-black text-slate-900 tracking-tight">825 Personnel</p>
                </div>
             </div>
             <div className="flex items-center gap-4 group cursor-default">
                <div className="w-2 h-8 rounded-full bg-amber-500 shadow-lg shadow-amber-200 transition-all group-hover:scale-y-125"></div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Weekly Rest Avg</p>
                   <p className="text-xl font-black text-slate-900 tracking-tight">124 Personnel</p>
                </div>
             </div>
             <div className="flex items-center gap-4 group cursor-default">
                <div className="w-2 h-8 rounded-full bg-rose-500 shadow-lg shadow-rose-200 transition-all group-hover:scale-y-125"></div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Critical Absences</p>
                   <p className="text-xl font-black text-slate-900 tracking-tight">Low (4.2%)</p>
                </div>
             </div>
          </div>
        </motion.div>

        {/* AI Insights & Distribution */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-10"
        >
          {/* Shift Distribution Card */}
          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-black/[0.02] flex-1">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-black text-slate-900 tracking-tight">Force Distribution</h3>
               <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                 <PieIcon size={20} />
               </div>
            </div>
            
            <div className="h-[300px] w-full relative min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={300}>
                <PieChart>
                  <Pie
                    data={shiftData}
                    innerRadius={75}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {shiftData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <p className="text-3xl font-black text-slate-900 leading-none tracking-tight">{stats.total_employees}</p>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Personnel</p>
              </div>
            </div>

            <div className="space-y-4 mt-8">
              {shiftData.map((entry, idx) => (
                <div key={entry.name} className="flex items-center justify-between group">
                   <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full group-hover:scale-125 transition-transform" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <span className="text-sm font-bold text-slate-600 tracking-tight group-hover:text-slate-900 transition-colors">{entry.name} Shift</span>
                   </div>
                   <span className="text-sm font-black text-slate-900">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Recommendations Card */}
          <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-[80px]"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/20 rounded-full blur-[80px]"></div>
            
            <div className="relative z-10">
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                    <BrainCircuit size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight leading-none">AI Assistant</h3>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1.5">Optimization Engine Active</p>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group/item">
                     <div className="flex items-center gap-3 mb-2">
                        <Zap size={14} className="text-amber-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-indigo-200">Alert Detected</span>
                     </div>
                     <p className="text-sm font-bold text-slate-300 leading-relaxed group-hover/item:text-white transition-colors">Night shift capacity is at 45%. Recommend re-balancing from Morning rotation for optimal coverage.</p>
                  </div>
                  
                  <button className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-slate-900 text-sm font-black hover:bg-indigo-500 hover:text-white transition-all duration-500 shadow-xl shadow-black/20 group/btn">
                     Run Auto-Rebalance <Sparkles size={18} className="group-hover/btn:rotate-12 transition-transform" />
                  </button>
               </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Weekly Off Distribution Heatmap Placeholder Style */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[3rem] p-10 lg:p-14 border border-slate-100 shadow-xl shadow-black/[0.02]"
        >
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-inner">
                <Calendar size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Personnel Availablity</h3>
                <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest">Global weekly off spread</p>
              </div>
            </div>
            <button className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-colors"><MoreVertical size={20} /></button>
          </div>

          <div className="grid grid-cols-7 gap-4">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                 <span className="text-xs font-black text-slate-300 uppercase tracking-widest mb-2">{day}</span>
                 {[...Array(4)].map((_, j) => {
                   const intensity = Math.random();
                   return (
                     <motion.div 
                       key={j}
                       initial={{ opacity: 0, scale: 0.8 }}
                       animate={{ opacity: 1, scale: 1 }}
                       transition={{ delay: (i + j) * 0.02 }}
                       whileHover={{ scale: 1.1 }}
                       className="w-full aspect-square rounded-xl cursor-help shadow-sm transition-all"
                       style={{ 
                         backgroundColor: intensity > 0.7 ? '#6366f1' : intensity > 0.4 ? '#818cf8' : intensity > 0.2 ? '#c7d2fe' : '#f1f5f9',
                         opacity: 0.4 + (intensity * 0.6)
                       }}
                       title={`Resting: ${Math.floor(intensity * 150)} Personnel`}
                     />
                   );
                 })}
              </div>
            ))}
          </div>
          
          <div className="mt-10 flex items-center gap-6 justify-center sm:justify-start">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-100"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Low</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">High Load</span>
             </div>
          </div>
        </motion.div>

        {/* Recruitment/Employee Activity Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[3rem] p-10 lg:p-14 border border-slate-100 shadow-xl shadow-black/[0.02]"
        >
           <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                <TrendingUp size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Recent Intelligence</h3>
                <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest">Live system activity feed</p>
              </div>
            </div>
            <button className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-colors shadow-lg shadow-slate-100">Live Feed</button>
          </div>

          <div className="space-y-6">
            {[
              { type: 'Update', msg: 'Shift rotation optimized for Next Week', time: '12 mins ago', icon: <Zap size={14} />, color: 'text-indigo-500 bg-indigo-50' },
              { type: 'Alert', msg: 'Personnel EMP045 requested Emergency Leave', time: '1 hour ago', icon: <AlertCircle size={14} />, color: 'text-rose-500 bg-rose-50' },
              { type: 'Check', msg: 'Manual override: Morning shift assigned to Support Lead', time: '3 hours ago', icon: <Coffee size={14} />, color: 'text-amber-500 bg-amber-50' },
              { type: 'Data', msg: 'Imported 125 new employee records from HRMS', time: '5 hours ago', icon: <RotateCcw size={14} />, color: 'text-emerald-500 bg-emerald-50' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-5 p-5 rounded-3xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                <div className={`w-10 h-10 rounded-2xl ${item.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.type}</span>
                    <span className="text-[10px] font-bold text-slate-300">{item.time}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed group-hover:text-slate-900 transition-colors">{item.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardCharts;
