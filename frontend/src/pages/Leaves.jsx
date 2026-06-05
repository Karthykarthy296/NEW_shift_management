import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Calendar, ClipboardList, CalendarDays, CalendarRange, RefreshCw, UserCheck, Plus, X, Building2, ChevronDown } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const weekDays = [
  { abbrev: 'Mon', full: 'Monday' },
  { abbrev: 'Tue', full: 'Tuesday' },
  { abbrev: 'Wed', full: 'Wednesday' },
  { abbrev: 'Thu', full: 'Thursday' },
  { abbrev: 'Fri', full: 'Friday' },
  { abbrev: 'Sat', full: 'Saturday' },
  { abbrev: 'Sun', full: 'Sunday' }
];

export default function Leaves() {
  const [activeTab, setActiveTab] = useState('manage'); // 'manage' or 'history'
  const [selectedWeek, setSelectedWeek] = useState(1); // 1, 2, 3, 4
  const [selectedDay, setSelectedDay] = useState(0); // 0 (Mon) to 6 (Sun)
  
  const [schedule, setSchedule] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [msg, setMsg] = useState('');
  const [replacements, setReplacements] = useState([]);

  // Add Leave Modal States
  const [showAddLeaveModal, setShowAddLeaveModal] = useState(false);
  const [employeesOptions, setEmployeesOptions] = useState([]);
  const [modalEmpName, setModalEmpName] = useState('');
  const [modalDate, setModalDate] = useState('');

  // Department states
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [deptLoading, setDeptLoading] = useState(false);
  const [empLoading, setEmpLoading] = useState(false);

  // Search & Autocomplete States
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);

  // Replacement Panel States
  const [replacementModalOpen, setReplacementModalOpen] = useState(false);
  const [replacementLeaveEmp, setReplacementLeaveEmp] = useState(null); // { name, emp_id, date }
  const [replacementCandidates, setReplacementCandidates] = useState([]);
  const [selectedReplacementId, setSelectedReplacementId] = useState(null);
  const [replacementLoading, setReplacementLoading] = useState(false);

  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'User';

  // Role authorization logic
  const isAuthorized = useMemo(() => {
    return ['admin', 'manager', 'supervisor'].includes(role.toLowerCase());
  }, [role]);

  const getMondayOfCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  };

  const targetDate = useMemo(() => {
    const monday = getMondayOfCurrentWeek();
    const daysToAdd = (selectedWeek - 1) * 7 + selectedDay;
    monday.setDate(monday.getDate() + daysToAdd);
    return monday.toISOString().split('T')[0];
  }, [selectedWeek, selectedDay]);

  const targetDayName = useMemo(() => {
    return weekDays[selectedDay].full;
  }, [selectedDay]);

  // Sync modal date when targetDate changes
  useEffect(() => {
    setModalDate(targetDate);
  }, [targetDate]);

  const fetchScheduleAndLeaves = async () => {
    if (!isAuthorized) return;

    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    setLoading(true);
    try {
      // 1. Fetch Schedule for target date
      const schedRes = await axios.get(`${API_URL}/get-schedule?date=${targetDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSchedule(schedRes.data);

      // 2. Fetch Leaves for target date
      const leavesRes = await axios.get(`${API_URL}/leaves?date=${targetDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeaves(leavesRes.data);
    } catch (e) {
      console.error(e);
      if (e.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = useCallback(async () => {
    if (!isAuthorized) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setDeptLoading(true);
    try {
      const res = await axios.get(`${API_URL}/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(res.data || []);
    } catch (e) {
      console.error('Error fetching departments:', e);
    } finally {
      setDeptLoading(false);
    }
  }, [isAuthorized]);

  const fetchEmployeesOptions = useCallback(async (dept = '') => {
    if (!isAuthorized) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setEmpLoading(true);
    try {
      const params = dept ? `?department=${encodeURIComponent(dept)}` : '';
      const res = await axios.get(`${API_URL}/employees${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployeesOptions(res.data || []);
    } catch (e) {
      console.error('Error fetching employees list:', e);
    } finally {
      setEmpLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    fetchScheduleAndLeaves();
  }, [targetDate, isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      fetchDepartments();
      fetchEmployeesOptions();
    }
  }, [isAuthorized]);

  // Detailed information for employees currently on leave
  const leavesDetailed = useMemo(() => {
    return leaves.map(leave => {
      const empDetails = employeesOptions.find(e => e.name === leave.employee_name || e.emp_id === leave.employee_id);
      const shiftName = empDetails?.preferred_shift || 'Morning';
      const roleName = empDetails?.role || 'Staff';
      
      let shiftStartEnd = 'N/A';
      if (shiftName === 'Morning') shiftStartEnd = '06:00 – 12:00';
      else if (shiftName === 'Afternoon') shiftStartEnd = '12:00 – 18:00';
      else if (shiftName === 'Evening') shiftStartEnd = '18:00 – 00:00';
      else if (shiftName === 'Night') shiftStartEnd = '00:00 – 06:00';

      return {
        id: leave.id,
        name: leave.employee_name,
        emp_id: leave.employee_id,
        role: roleName,
        shiftName: shiftName,
        shiftStartEnd: shiftStartEnd
      };
    });
  }, [leaves, employeesOptions]);

  // When department selection changes, reload employee list and clear current selection
  const handleDeptChange = (deptName) => {
    setSelectedDept(deptName);
    setModalEmpName('');
    setEmpSearchQuery('');
    setIsEmpDropdownOpen(false);
    fetchEmployeesOptions(deptName);
  };

  // Autocomplete filter logic (within the already-dept-filtered list)
  const filteredEmployees = useMemo(() => {
    if (!empSearchQuery) return employeesOptions;
    const matched = employeesOptions.find(e => e.name === modalEmpName);
    if (matched && `${matched.name} (${matched.emp_id})` === empSearchQuery) {
      return employeesOptions;
    }
    const q = empSearchQuery.toLowerCase();
    return employeesOptions.filter(emp =>
      emp.name.toLowerCase().includes(q) || emp.emp_id.toLowerCase().includes(q)
    );
  }, [empSearchQuery, employeesOptions, modalEmpName]);

  const handleSelectEmployee = (emp) => {
    setModalEmpName(emp.name);
    setEmpSearchQuery(`${emp.name} (${emp.emp_id})`);
    setIsEmpDropdownOpen(false);
  };

  const handleGenerateSchedule = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await axios.post(`${API_URL}/generate-schedule`, { date: targetDate }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg(res.data.message || 'AI Schedule successfully generated.');
      fetchScheduleAndLeaves();
    } catch (e) {
      console.error(e);
      setMsg('Error: Schedule generation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelLeave = async (empName) => {
    if (!window.confirm(`Cancel leave for ${empName} on ${targetDate}?`)) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setActionLoading(true);
    setMsg('');
    try {
      const res = await axios.delete(`${API_URL}/cancel-leave?employee_name=${encodeURIComponent(empName)}&date=${targetDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg(res.data.msg);
      fetchScheduleAndLeaves();
    } catch (e) {
      console.error(e);
      setMsg(e.response?.data?.detail || 'Error cancelling leave');
    } finally {
      setActionLoading(false);
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!modalEmpName) { alert('Please select an employee'); return; }
    if (!modalDate) { alert('Please select a date'); return; }
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    setActionLoading(true);
    setMsg('');
    setReplacements([]);
    try {
      const res = await axios.post(`${API_URL}/apply-leave`, {
        employee_name: modalEmpName,
        date: modalDate
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMsg(res.data.msg);
      
      if (Array.isArray(res.data.candidates)) {
        setReplacementLeaveEmp({ name: modalEmpName, emp_id: '', date: modalDate });
        setReplacementCandidates(res.data.candidates);
        if (res.data.candidates.length > 0) {
          setSelectedReplacementId(res.data.candidates[0].id);
        } else {
          setSelectedReplacementId(null);
        }
        setReplacementModalOpen(true);
      }
      
      setShowAddLeaveModal(false);
      setModalEmpName('');
      setEmpSearchQuery('');
      fetchScheduleAndLeaves();
    } catch (e) {
      console.error(e);
      setMsg(e.response?.data?.detail || 'Error applying leave');
      setShowAddLeaveModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReplacementModal = async (empName, empId, date) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setReplacementLeaveEmp({ name: empName, emp_id: empId, date });
    setReplacementLoading(true);
    setReplacementCandidates([]);
    setSelectedReplacementId(null);
    setReplacementModalOpen(true);
    try {
      const res = await axios.get(`${API_URL}/leaves/replacement-candidates?employee_name=${encodeURIComponent(empName)}&date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReplacementCandidates(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedReplacementId(res.data[0].id);
      }
    } catch (e) {
      console.error(e);
      setMsg('Error fetching replacement candidates.');
    } finally {
      setReplacementLoading(false);
    }
  };

  const handleAssignReplacement = async () => {
    if (!selectedReplacementId || !replacementLeaveEmp) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setActionLoading(true);
    setMsg('');
    try {
      const res = await axios.post(`${API_URL}/leaves/assign-replacement`, {
        date: replacementLeaveEmp.date,
        employee_name: replacementLeaveEmp.name,
        replacement_id: selectedReplacementId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMsg(res.data.message || 'Replacement assigned successfully.');
      setReplacementModalOpen(false);
      setReplacementLeaveEmp(null);
      setReplacementCandidates([]);
      fetchScheduleAndLeaves();
    } catch (e) {
      console.error(e);
      setMsg(e.response?.data?.detail || 'Error assigning replacement.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardLayout title="Leave Management" role={role.charAt(0).toUpperCase() + role.slice(1)}>
      <div style={lightStyles.container}>
        
        {/* Title Block */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={lightStyles.headerTitle}>Leave Management</h1>
          <p style={lightStyles.headerSub}>Apply leave, find replacements, and track leave history</p>
        </div>

        {/* Tab Selection & Add Leave Button */}
        <div style={lightStyles.tabContainer}>
          <button
            onClick={() => setActiveTab('manage')}
            style={activeTab === 'manage' ? lightStyles.activeTabBtn : lightStyles.inactiveTabBtn}
          >
            <Calendar size={18} /> Manage Leaves
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={activeTab === 'history' ? lightStyles.activeTabBtn : lightStyles.inactiveTabBtn}
          >
            <ClipboardList size={18} /> Leave History
          </button>
          
          {isAuthorized && (
            <button
              onClick={() => setShowAddLeaveModal(true)}
              style={lightStyles.addLeaveBtn}
            >
              <Plus size={18} /> Add Leave
            </button>
          )}
        </div>

        {/* AI Action Alerts */}
        {msg && (
          <div style={{
            background: msg.includes('Error') ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            border: msg.includes('Error') ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '1rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            color: msg.includes('Error') ? '#ef4444' : '#065f46',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: 700,
            fontSize: '0.9rem'
          }}>
            <div>{msg}</div>
            <button onClick={() => setMsg('')} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 900 }}>✕</button>
          </div>
        )}

        {replacements.length > 0 && (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '1.25rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            color: '#065f46'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#064e3b', marginBottom: '0.5rem' }}>AI Shift Reassignment</h3>
            <p style={{ fontSize: '0.85rem', margin: '0 0 1rem 0', color: '#047857' }}>AI has auto-reassigned shifts to ensure optimal force deployment.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {replacements.map((r, i) => (
                <div key={i} style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid #d1fae5', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)' }}>
                  <div style={{ fontWeight: 800, color: '#064e3b', fontSize: '0.85rem' }}>{r.employee_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#047857', opacity: 0.8 }}>{r.shift} ({r.shift_time})</div>
                </div>
              ))}
            </div>
            <button onClick={() => setReplacements([])} style={{ marginTop: '1rem', background: '#10b981', color: '#ffffff', border: 'none', padding: '0.4rem 1rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.2)' }}>Dismiss</button>
          </div>
        )}

        {/* Card 1: Select Date */}
        <div style={lightStyles.card}>
          <div style={lightStyles.cardTitleRow}>
            <CalendarDays size={20} color="#7c3aed" />
            <span>Select Date</span>
          </div>

          {/* Weeks Selector */}
          <div style={lightStyles.weekRow}>
            {[1, 2, 3, 4].map(w => (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                style={selectedWeek === w ? lightStyles.activeWeekBtn : lightStyles.inactiveWeekBtn}
              >
                Week {w}
              </button>
            ))}
          </div>

          {/* Days Selector */}
          <div style={lightStyles.dayRow}>
            {weekDays.map((d, index) => (
              <button
                key={index}
                onClick={() => setSelectedDay(index)}
                style={selectedDay === index ? lightStyles.activeDayBtn : lightStyles.inactiveDayBtn}
              >
                <span style={lightStyles.dayLabelAbbrev}>{d.abbrev}</span>
                <span style={lightStyles.dayLabelFull}>{d.full}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Card 2: List Details */}
        <div style={lightStyles.card}>
          <div style={lightStyles.cardTitleRow}>
            <UserCheck size={20} color="#7c3aed" />
            <span>
              {activeTab === 'manage' ? 'Employees on Leave' : 'Leaves'} — {targetDayName}, WEEK {selectedWeek}
            </span>
          </div>

          {/* Action Overlay */}
          {actionLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7c3aed', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing AI Reassignments...
            </div>
          )}

          {activeTab === 'manage' ? (
            // Employees on Leave view
            !isAuthorized ? (
              <div style={lightStyles.emptyState}>
                <UserCheck size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
                <div style={lightStyles.emptyStateText}>Access Restricted</div>
                <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem', textAlign: 'center', maxWidth: '380px', lineHeight: '1.4' }}>
                  Only Admin, Supervisor, and Manager accounts are authorized to view active employee details and manage leaves.
                </div>
              </div>
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#7c3aed' }} />
              </div>
            ) : leavesDetailed.length === 0 ? (
              <div style={lightStyles.emptyState}>
                <CalendarRange size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
                <div style={lightStyles.emptyStateText}>No employees on leave for this date.</div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center' }}>
                  Click "Add Leave" to apply leave for an employee.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {leavesDetailed.map((emp, idx) => (
                  <div key={emp.id || idx} style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '0.55rem',
                          background: 'rgba(239, 68, 68, 0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem', fontWeight: 900, color: '#ef4444',
                          flexShrink: 0,
                          border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}>
                          {(emp.name || '?').charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {emp.name}
                          </div>
                          <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 700 }}>
                            {emp.emp_id || 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          background: '#ffffff',
                          color: '#475569',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          border: '1px solid #e2e8f0'
                        }}>
                          {emp.shiftName}
                        </span>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          background: '#ffffff',
                          color: '#475569',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          border: '1px solid #e2e8f0'
                        }}>
                          {emp.role || 'Staff'}
                        </span>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          border: '1px solid rgba(239, 68, 68, 0.15)'
                        }}>
                          On Leave
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                          {emp.shiftStartEnd}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <button
                          onClick={() => handleOpenReplacementModal(emp.name, emp.emp_id, targetDate)}
                          disabled={actionLoading}
                          style={{
                            background: 'rgba(124, 58, 237, 0.08)',
                            color: '#7c3aed',
                            border: '1px solid rgba(124, 58, 237, 0.2)',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            flex: 1,
                            textAlign: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#7c3aed';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                            e.currentTarget.style.color = '#7c3aed';
                          }}
                        >
                          Replacement
                        </button>

                        <button
                          onClick={() => handleCancelLeave(emp.name)}
                          disabled={actionLoading}
                          style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            flex: 1,
                            textAlign: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                            e.currentTarget.style.color = '#ef4444';
                          }}
                        >
                          Cancel Leave
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Leave History view
            !isAuthorized ? (
              <div style={lightStyles.emptyState}>
                <UserCheck size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
                <div style={lightStyles.emptyStateText}>Access Restricted</div>
                <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem', textAlign: 'center', maxWidth: '380px', lineHeight: '1.4' }}>
                  Only Admin, Supervisor, and Manager accounts are authorized to view leave history.
                </div>
              </div>
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#7c3aed' }} />
              </div>
            ) : leaves.length === 0 ? (
              <div style={lightStyles.emptyState}>
                <CalendarRange size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
                <div style={lightStyles.emptyStateText}>No employees on leave for this date.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {leaves.map((leave, idx) => (
                  <div key={leave.id || idx} style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '0.55rem',
                        background: 'rgba(239, 68, 68, 0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', fontWeight: 900, color: '#ef4444',
                        flexShrink: 0,
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                      }}>
                        {(leave.employee_name || '?').charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {leave.employee_name}
                        </div>
                        <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 700 }}>
                          ID: {leave.employee_id || 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        color: '#ef4444',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                      }}>
                        On Leave
                      </span>

                      <button
                        onClick={() => handleCancelLeave(leave.employee_name)}
                        disabled={actionLoading}
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#ef4444';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                          e.currentTarget.style.color = '#ef4444';
                        }}
                      >
                        Cancel Leave
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

      </div>

      {/* Add Leave Modal Popup */}
      {showAddLeaveModal && (
        <div style={lightStyles.modalOverlay}>
          <div style={lightStyles.modalContent}>
            <button
              onClick={() => {
                setShowAddLeaveModal(false);
                setModalEmpName('');
                setEmpSearchQuery('');
                setIsEmpDropdownOpen(false);
                setSelectedDept('');
                fetchEmployeesOptions(); // reset to all employees
              }}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} color="#7c3aed" /> Apply New Leave
            </h3>

            <form onSubmit={handleModalSubmit}>

              {/* ── Step 1: Department ───────────────────────── */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ ...lightStyles.formLabel, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={13} color="#7c3aed" />
                  Department
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedDept}
                    onChange={e => handleDeptChange(e.target.value)}
                    style={{
                      ...lightStyles.formInput,
                      appearance: 'none',
                      paddingRight: '2.5rem',
                      cursor: 'pointer',
                      color: selectedDept ? '#0f172a' : '#94a3b8',
                    }}
                  >
                    <option value="">All Departments</option>
                    {deptLoading ? (
                      <option disabled>Loading…</option>
                    ) : (
                      departments.map(d => (
                        <option key={d.id || d.name} value={d.name}>{d.name}</option>
                      ))
                    )}
                  </select>
                  <ChevronDown
                    size={15}
                    color="#94a3b8"
                    style={{
                      position: 'absolute', right: '0.9rem', top: '50%',
                      transform: 'translateY(-50%)', pointerEvents: 'none'
                    }}
                  />
                </div>
                {selectedDept && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '3px 10px', borderRadius: '999px',
                      background: '#f5f3ff', color: '#7c3aed',
                      fontSize: '0.72rem', fontWeight: 700,
                      border: '1px solid #ddd6fe'
                    }}>
                      <Building2 size={10} /> {selectedDept}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeptChange('')}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* ── Step 2: Employee Search ──────────────────── */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={lightStyles.formLabel}>
                  Select Employee
                  {selectedDept && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#7c3aed', marginLeft: '6px' }}>
                      ({employeesOptions.length} in {selectedDept})
                    </span>
                  )}
                </label>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder={empLoading ? 'Loading employees…' : 'Type name or ID to search…'}
                    value={empSearchQuery}
                    disabled={empLoading}
                    onChange={e => {
                      setEmpSearchQuery(e.target.value);
                      setModalEmpName('');
                      setIsEmpDropdownOpen(true);
                    }}
                    onFocus={() => setIsEmpDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsEmpDropdownOpen(false), 250)}
                    style={{
                      ...lightStyles.formInput,
                      opacity: empLoading ? 0.6 : 1,
                      cursor: empLoading ? 'not-allowed' : 'text',
                    }}
                    required
                  />

                  {empSearchQuery && !empLoading && (
                    <button
                      type="button"
                      onClick={() => { setEmpSearchQuery(''); setModalEmpName(''); }}
                      style={{
                        position: 'absolute', right: '1rem', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#94a3b8',
                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  )}

                  {/* Employee Dropdown */}
                  {isEmpDropdownOpen && !empLoading && (
                    <div style={lightStyles.dropdownList}>
                      {filteredEmployees.length === 0 ? (
                        <div style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.9rem' }}>
                          No employees found{selectedDept ? ` in ${selectedDept}` : ''}
                        </div>
                      ) : (
                        filteredEmployees.slice(0, 60).map(emp => (
                          <div
                            key={emp.emp_id}
                            onClick={() => handleSelectEmployee(emp)}
                            style={lightStyles.dropdownItem}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = '#f5f3ff';
                              e.currentTarget.style.color = '#7c3aed';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#0f172a';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <div>
                                <span style={{ fontWeight: 800 }}>{emp.name}</span>
                                <span style={{ fontSize: '0.75rem', color: '#7c3aed', marginLeft: '0.5rem', fontWeight: 600 }}>({emp.emp_id})</span>
                              </div>
                              {emp.department && (
                                <span style={{
                                  fontSize: '0.65rem', color: '#64748b', fontWeight: 600,
                                  background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px'
                                }}>
                                  {emp.department}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Step 3: Date ─────────────────────────────── */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={lightStyles.formLabel}>Select Date</label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={e => setModalDate(e.target.value)}
                  style={lightStyles.formInput}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddLeaveModal(false);
                    setModalEmpName('');
                    setEmpSearchQuery('');
                    setIsEmpDropdownOpen(false);
                    setSelectedDept('');
                    fetchEmployeesOptions();
                  }}
                  style={lightStyles.modalCancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !modalEmpName}
                  style={{
                    ...lightStyles.modalSubmitBtn,
                    opacity: (actionLoading || !modalEmpName) ? 0.6 : 1,
                    cursor: (actionLoading || !modalEmpName) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading ? 'Applying…' : 'Apply Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replacement Candidates Modal Popup */}
      {replacementModalOpen && (
        <div style={lightStyles.modalOverlay}>
          <div style={{ ...lightStyles.modalContent, maxWidth: '540px' }}>
            <button
              onClick={() => {
                setReplacementModalOpen(false);
                setReplacementLeaveEmp(null);
                setReplacementCandidates([]);
              }}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={20} color="#7c3aed" style={{ animation: replacementLoading ? 'spin 1s linear infinite' : 'none' }} /> Replacement Candidates
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Select a replacement candidate for <strong>{replacementLeaveEmp?.name}</strong> on <strong>{replacementLeaveEmp?.date}</strong>.
            </p>

            {replacementLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#7c3aed' }} />
                <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>Finding eligible candidates...</div>
              </div>
            ) : replacementCandidates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                No eligible replacement candidates found within constraints (e.g. limit hours, leave, or shifts).
              </div>
            ) : (
              <div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.5rem' }}>
                  {replacementCandidates.map((cand) => (
                    <div
                      key={cand.id}
                      onClick={() => setSelectedReplacementId(cand.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        background: selectedReplacementId === cand.id ? '#f5f3ff' : 'transparent',
                        border: selectedReplacementId === cand.id ? '1px solid #ddd6fe' : '1px solid transparent',
                        transition: 'all 0.15s',
                        marginBottom: '0.25rem'
                      }}
                    >
                      <input
                        type="radio"
                        name="replacementCandidate"
                        checked={selectedReplacementId === cand.id}
                        onChange={() => setSelectedReplacementId(cand.id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{cand.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({cand.role})</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                          Dept: {cand.department} | Weekly Workload: {cand.weekly_hours} hrs
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '4px', flexWrap: 'wrap' }}>
                          {cand.is_weekly_off && (
                            <span style={{ padding: '1px 5px', borderRadius: '4px', background: '#ecfdf5', color: '#10b981', fontSize: '0.65rem', fontWeight: 700 }}>
                              Weekly Off Today
                            </span>
                          )}
                          {cand.has_no_shift && (
                            <span style={{ padding: '1px 5px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', fontSize: '0.65rem', fontWeight: 700 }}>
                              No Shift Assigned
                            </span>
                          )}
                          {cand.same_dept && (
                            <span style={{ padding: '1px 5px', borderRadius: '4px', background: '#f5f3ff', color: '#7c3aed', fontSize: '0.65rem', fontWeight: 700 }}>
                              Same Dept
                            </span>
                          )}
                          {cand.same_role && (
                            <span style={{ padding: '1px 5px', borderRadius: '4px', background: '#fffbeb', color: '#d97706', fontSize: '0.65rem', fontWeight: 700 }}>
                              Same Role
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    onClick={() => {
                      setReplacementModalOpen(false);
                      setReplacementLeaveEmp(null);
                      setReplacementCandidates([]);
                    }}
                    style={lightStyles.modalCancelBtn}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignReplacement}
                    disabled={actionLoading || !selectedReplacementId}
                    style={{
                      ...lightStyles.modalSubmitBtn,
                      opacity: (actionLoading || !selectedReplacementId) ? 0.6 : 1,
                      cursor: (actionLoading || !selectedReplacementId) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {actionLoading ? 'Assigning...' : 'Assign Replacement'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </DashboardLayout>
  );
}

const lightStyles = {
  container: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    borderRadius: '1.5rem',
    padding: 0,
    minHeight: '100%',
    fontFamily: "'Plus Jakarta Sans', sans-serif"
  },
  headerTitle: {
    fontSize: '2.25rem',
    fontWeight: 950,
    color: '#0f172a',
    letterSpacing: '-0.03em',
    marginBottom: '0.5rem',
    marginTop: 0
  },
  headerSub: {
    color: '#64748b',
    fontSize: '1rem',
    fontWeight: 500,
    margin: 0
  },
  tabContainer: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '0.75rem'
  },
  activeTabBtn: {
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.85rem',
    fontSize: '0.9rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(124, 58, 237, 0.25)',
    transition: 'all 0.2s'
  },
  inactiveTabBtn: {
    backgroundColor: '#ffffff',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.85rem',
    fontSize: '0.9rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  addLeaveBtn: {
    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
    color: '#ffffff',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.85rem',
    fontSize: '0.9rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(124, 58, 237, 0.2)',
    transition: 'all 0.2s'
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '1.25rem',
    padding: '1.75rem',
    marginBottom: '1.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#0f172a',
    fontWeight: 800,
    fontSize: '1.1rem',
    marginBottom: '1.5rem'
  },
  weekRow: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  activeWeekBtn: {
    flex: 1,
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    border: 'none',
    padding: '1rem',
    borderRadius: '0.85rem',
    fontWeight: 800,
    fontSize: '0.95rem',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
    boxShadow: '0 4px 15px rgba(124, 58, 237, 0.25)'
  },
  inactiveWeekBtn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    padding: '1rem',
    borderRadius: '0.85rem',
    fontWeight: 800,
    fontSize: '0.95rem',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s'
  },
  dayRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '0.5rem'
  },
  activeDayBtn: {
    backgroundColor: '#f5f3ff',
    color: '#7c3aed',
    border: '2px solid #7c3aed',
    padding: '0.75rem 0.5rem',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  inactiveDayBtn: {
    backgroundColor: '#f8fafc',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    padding: '0.75rem 0.5rem',
    borderRadius: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  dayLabelAbbrev: {
    fontSize: '1rem',
    fontWeight: 800,
    marginBottom: '2px'
  },
  dayLabelFull: {
    fontSize: '0.7rem',
    fontWeight: 500,
    opacity: 0.8
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1.5rem',
    color: '#94a3b8'
  },
  emptyStateText: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#64748b',
    marginTop: '1rem'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  modalContent: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '1.5rem',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    position: 'relative'
  },
  formLabel: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 750,
    color: '#334155',
    marginBottom: '0.5rem',
    marginTop: '1.25rem'
  },
  formInput: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '0.75rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.95rem',
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  },
  modalCancelBtn: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.75rem',
    fontSize: '0.9rem',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  modalSubmitBtn: {
    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
    color: '#ffffff',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.75rem',
    fontSize: '0.9rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
    transition: 'all 0.2s'
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '0.75rem',
    marginTop: '0.35rem',
    maxHeight: '220px',
    overflowY: 'auto',
    zIndex: 99999,
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
  },
  dropdownItem: {
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    color: '#0f172a',
    fontSize: '0.9rem',
    transition: 'all 0.15s',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
};
