import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MainDashboard from './pages/MainDashboard';
import Shifts from './pages/Shifts';
import Employees from './pages/Employees';
import Leaves from './pages/Leaves';
import Settings from './pages/Settings';
import Upload from './pages/Upload';
import Users from './pages/Users';
import ActivityLogs from './pages/ActivityLogs';
import WeeklyOffSwap from './pages/WeeklyOffSwap';
import WeeklyOff from './pages/WeeklyOff';
import Overtime from './pages/Overtime';
import { 
  AttendanceReport, 
  ShiftDistributionReport, 
  LeaveReport, 
  OvertimeReport, 
  AIOptimizationReport, 
  DepartmentCoverageReport, 
  ReplacementHistoryReport, 
  WeeklyAnalytics, 
  MonthlyAnalytics 
} from './pages/Reports/Reports';
import { SearchProvider, SearchContext } from './components/DashboardLayout';

const ErrorFallback = ({ error, resetError }) => (
  <div style={{ 
    minHeight: '100vh', 
    display: 'flex', 
    flexDirection: 'column',
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: '20px',
    background: '#f8fafc',
    fontFamily: 'system-ui, sans-serif'
  }}>
    <div style={{
      background: 'white',
      padding: '40px',
      borderRadius: '20px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
      maxWidth: '500px',
      textAlign: 'center'
    }}>
      <div style={{ 
        fontSize: '48px', 
        marginBottom: '20px',
        color: '#ef4444'
      }}>⚠️</div>
      <h2 style={{ 
        color: '#1e293b', 
        marginBottom: '10px',
        fontSize: '24px',
        fontWeight: '800'
      }}>Something went wrong</h2>
      <p style={{ 
        color: '#64748b', 
        marginBottom: '24px',
        fontSize: '14px'
      }}>
        {error?.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button 
        onClick={resetError}
        style={{
          background: '#4f46e5',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '10px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        Return to Dashboard
      </button>
    </div>
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
    const role = localStorage.getItem('role');
    if (role) {
      window.location.href = `/${role}/dashboard`;
    } else {
      window.location.href = '/login';
    }
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} resetError={this.resetError} />;
    }
    return this.props.children;
  }
}

const PrivateRoute = ({ children, roleRequired }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    return <Navigate to={`/login`} />;
  }

  if (roleRequired && role !== roleRequired) {
    const dashboardPath = `/${role}/dashboard`;
    return <Navigate to={dashboardPath} />;
  }

  return children;
};

function App() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <ErrorBoundary>
      <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />
            
            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<PrivateRoute roleRequired="admin"><MainDashboard /></PrivateRoute>} />
            <Route path="/admin/shifts" element={<PrivateRoute roleRequired="admin"><Shifts /></PrivateRoute>} />
            <Route path="/admin/employees" element={<PrivateRoute roleRequired="admin"><Employees /></PrivateRoute>} />
            <Route path="/admin/leaves" element={<PrivateRoute roleRequired="admin"><Leaves /></PrivateRoute>} />
            <Route path="/admin/overtime" element={<PrivateRoute roleRequired="admin"><Overtime /></PrivateRoute>} />
            <Route path="/admin/weekly-off-swap" element={<PrivateRoute roleRequired="admin"><WeeklyOffSwap /></PrivateRoute>} />
            <Route path="/admin/weekly-off" element={<PrivateRoute roleRequired="admin"><WeeklyOff /></PrivateRoute>} />
            <Route path="/admin/upload" element={<PrivateRoute roleRequired="admin"><Upload /></PrivateRoute>} />
            <Route path="/admin/users" element={<PrivateRoute roleRequired="admin"><Users /></PrivateRoute>} />
            <Route path="/admin/activity-logs" element={<PrivateRoute roleRequired="admin"><ActivityLogs /></PrivateRoute>} />
            <Route path="/admin/settings" element={<PrivateRoute roleRequired="admin"><Settings /></PrivateRoute>} />
            
            {/* Admin Reports */}
            <Route path="/admin/reports/attendance" element={<PrivateRoute roleRequired="admin"><AttendanceReport /></PrivateRoute>} />
            <Route path="/admin/reports/shift-distribution" element={<PrivateRoute roleRequired="admin"><ShiftDistributionReport /></PrivateRoute>} />
            <Route path="/admin/reports/leave" element={<PrivateRoute roleRequired="admin"><LeaveReport /></PrivateRoute>} />
            <Route path="/admin/reports/overtime" element={<PrivateRoute roleRequired="admin"><OvertimeReport /></PrivateRoute>} />
            <Route path="/admin/reports/ai-optimization" element={<PrivateRoute roleRequired="admin"><AIOptimizationReport /></PrivateRoute>} />
            <Route path="/admin/reports/department-coverage" element={<PrivateRoute roleRequired="admin"><DepartmentCoverageReport /></PrivateRoute>} />
            <Route path="/admin/reports/replacement-history" element={<PrivateRoute roleRequired="admin"><ReplacementHistoryReport /></PrivateRoute>} />
            <Route path="/admin/reports/weekly-analytics" element={<PrivateRoute roleRequired="admin"><WeeklyAnalytics /></PrivateRoute>} />
            <Route path="/admin/reports/monthly-analytics" element={<PrivateRoute roleRequired="admin"><MonthlyAnalytics /></PrivateRoute>} />
            
            {/* Manager Routes */}
            <Route path="/manager/dashboard" element={<PrivateRoute roleRequired="manager"><MainDashboard /></PrivateRoute>} />
            <Route path="/manager/shifts" element={<PrivateRoute roleRequired="manager"><Shifts /></PrivateRoute>} />
            <Route path="/manager/employees" element={<PrivateRoute roleRequired="manager"><Employees /></PrivateRoute>} />
            <Route path="/manager/leaves" element={<PrivateRoute roleRequired="manager"><Leaves /></PrivateRoute>} />
            <Route path="/manager/overtime" element={<PrivateRoute roleRequired="manager"><Overtime /></PrivateRoute>} />
            <Route path="/manager/weekly-off-swap" element={<PrivateRoute roleRequired="manager"><WeeklyOffSwap /></PrivateRoute>} />
            <Route path="/manager/weekly-off" element={<PrivateRoute roleRequired="manager"><WeeklyOff /></PrivateRoute>} />
            <Route path="/manager/upload" element={<PrivateRoute roleRequired="manager"><Upload /></PrivateRoute>} />
            <Route path="/manager/activity-logs" element={<PrivateRoute roleRequired="manager"><ActivityLogs /></PrivateRoute>} />
            <Route path="/manager/settings" element={<PrivateRoute roleRequired="manager"><Settings /></PrivateRoute>} />

            {/* Manager Reports */}
            <Route path="/manager/reports/attendance" element={<PrivateRoute roleRequired="manager"><AttendanceReport /></PrivateRoute>} />
            <Route path="/manager/reports/shift-distribution" element={<PrivateRoute roleRequired="manager"><ShiftDistributionReport /></PrivateRoute>} />
            <Route path="/manager/reports/leave" element={<PrivateRoute roleRequired="manager"><LeaveReport /></PrivateRoute>} />
            <Route path="/manager/reports/overtime" element={<PrivateRoute roleRequired="manager"><OvertimeReport /></PrivateRoute>} />
            <Route path="/manager/reports/ai-optimization" element={<PrivateRoute roleRequired="manager"><AIOptimizationReport /></PrivateRoute>} />
            <Route path="/manager/reports/department-coverage" element={<PrivateRoute roleRequired="manager"><DepartmentCoverageReport /></PrivateRoute>} />
            <Route path="/manager/reports/replacement-history" element={<PrivateRoute roleRequired="manager"><ReplacementHistoryReport /></PrivateRoute>} />
            <Route path="/manager/reports/weekly-analytics" element={<PrivateRoute roleRequired="manager"><WeeklyAnalytics /></PrivateRoute>} />
            <Route path="/manager/reports/monthly-analytics" element={<PrivateRoute roleRequired="manager"><MonthlyAnalytics /></PrivateRoute>} />

            {/* Supervisor Routes */}
            <Route path="/supervisor/dashboard" element={<PrivateRoute roleRequired="supervisor"><MainDashboard /></PrivateRoute>} />
            <Route path="/supervisor/shifts" element={<PrivateRoute roleRequired="supervisor"><Shifts /></PrivateRoute>} />
            <Route path="/supervisor/leaves" element={<PrivateRoute roleRequired="supervisor"><Leaves /></PrivateRoute>} />
            <Route path="/supervisor/overtime" element={<PrivateRoute roleRequired="supervisor"><Overtime /></PrivateRoute>} />
            <Route path="/supervisor/weekly-off-swap" element={<PrivateRoute roleRequired="supervisor"><WeeklyOffSwap /></PrivateRoute>} />
            <Route path="/supervisor/weekly-off" element={<PrivateRoute roleRequired="supervisor"><WeeklyOff /></PrivateRoute>} />
            <Route path="/supervisor/settings" element={<PrivateRoute roleRequired="supervisor"><Settings /></PrivateRoute>} />

            {/* Supervisor Reports (Limited) */}
            <Route path="/supervisor/reports/attendance" element={<PrivateRoute roleRequired="supervisor"><AttendanceReport /></PrivateRoute>} />
            <Route path="/supervisor/reports/shift-distribution" element={<PrivateRoute roleRequired="supervisor"><ShiftDistributionReport /></PrivateRoute>} />
            <Route path="/supervisor/reports/weekly-analytics" element={<PrivateRoute roleRequired="supervisor"><WeeklyAnalytics /></PrivateRoute>} />

            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </SearchContext.Provider>
    </ErrorBoundary>
  );
}

export default App;

