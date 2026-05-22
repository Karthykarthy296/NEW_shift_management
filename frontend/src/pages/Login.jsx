import React, { useState } from 'react';
import api from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, User, Lock, Zap, Sparkles, ArrowRight } from 'lucide-react';


export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post(`/login`, { username, password });
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('role', response.data.role);
      localStorage.setItem('username', username);
      
      const role = response.data.role;
      if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'manager') navigate('/manager/dashboard');
      else if (role === 'supervisor') navigate('/supervisor/dashboard');
    } catch (err) {
      setError('System rejected authentication. Verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Abstract Background Effects */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl relative z-10"
      >
        <div className="bg-white/95 backdrop-blur-2xl rounded-[3rem] p-10 lg:p-16 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-white/20">
          <div className="text-center mb-12">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] text-white shadow-2xl shadow-indigo-500/30 mb-8 ring-8 ring-indigo-50/50"
            >
              <Zap size={36} fill="white" />
            </motion.div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">Welcome to ShiftAI</h1>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-[0.2em]">Enterprise Workforce Intelligence</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-rose-50 border-2 border-rose-100 text-rose-600 p-4 rounded-2xl text-xs font-black uppercase tracking-widest mb-8 text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Identity</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <User size={20} />
                </div>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                  placeholder="Username"
                  autoComplete="username"
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Token</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={20} />
                </div>
                <input 
                  type="password" 
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-slate-900 text-white rounded-[2rem] py-5 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-600 hover:shadow-2xl hover:shadow-indigo-500/30 transition-all duration-500 group relative overflow-hidden"
            >
              <span className="relative z-10">{loading ? 'Processing...' : 'Authorize Access'}</span>
              {!loading && <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-slate-100 text-center">
             <div className="flex items-center justify-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-[0.3em]">
                <Sparkles size={14} />
                Powered by ShiftAI Core Engine
             </div>
          </div>
        </div>
        
        <div className="text-center mt-8 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] opacity-40">
           Enterprise Grade Security • AES-256 Encrypted
        </div>
      </motion.div>
    </div>
  );
}
