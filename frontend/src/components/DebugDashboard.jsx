/**
 * DEBUG DASHBOARD COMPONENT
 * Comprehensive debugging and fixes for all dashboard and schedule generation issues
 * Proper React state management, useEffect hooks, and error handling
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const DebugDashboard = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Data states
  const [employees, setEmployees] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [weeklyOff, setWeeklyOff] = useState([]);
  
  // UI states
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [debugMode, setDebugMode] = useState(true);

  // API configuration with fallback URLs
  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8001', // Using debug port
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Refs for debugging
  const componentMounted = useRef(false);

  // Message handling with auto-hide
  const showMessage = useCallback((message, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    if (type === 'success') {
      setSuccess(message);
      setError(null);
    } else if (type === 'error') {
      setError(message);
      setSuccess(null);
    } else {
      setError(null);
      setSuccess(null);
    }
    
    // Auto-hide messages after 5 seconds
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
  }, []);

  // API calls with comprehensive error handling
  const fetchEmployees = useCallback(async () => {
    try {
      console.log('[DEBUG] Fetching employees...');
      const response = await api.get('/employees');
      console.log('[DEBUG] Employees response:', response.data);
      setEmployees(response.data.employees || []);
      console.log(`[DEBUG] Employees loaded: ${response.data.total_count || 0} employees`);
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error loading employees';
      showMessage(errorMsg, 'error');
      console.error('[DEBUG] Employees Error:', error);
      throw error;
    }
  }, [api, showMessage]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      console.log('[DEBUG] Fetching dashboard stats...');
      const response = await api.get('/dashboard/stats');
      console.log('[DEBUG] Dashboard stats response:', response.data);
      setDashboardStats(response.data);
      console.log(`[DEBUG] Dashboard stats loaded: ${response.data.total_employees || 0} employees`);
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error loading dashboard stats';
      showMessage(errorMsg, 'error');
      console.error('[DEBUG] Dashboard Stats Error:', error);
      throw error;
    }
  }, [api, showMessage]);

  const fetchSchedules = useCallback(async (date) => {
    try {
      console.log(`[DEBUG] Fetching schedules for date: ${date}`);
      const params = date ? `?date=${date}` : '';
      const response = await api.get(`/schedules${params}`);
      console.log('[DEBUG] Schedules response:', response.data);
      setSchedules(response.data.schedules || []);
      console.log(`[DEBUG] Schedules loaded: ${response.data.total_count || 0} schedules`);
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error loading schedules';
      showMessage(errorMsg, 'error');
      console.error('[DEBUG] Schedules Error:', error);
      throw error;
    }
  }, [api, showMessage]);

  const fetchWeeklyOff = useCallback(async (date) => {
    try {
      console.log(`[DEBUG] Fetching weekly off for date: ${date}`);
      const params = date ? `?date=${date}` : '';
      const response = await api.get(`/weekly-off${params}`);
      console.log('[DEBUG] Weekly off response:', response.data);
      setWeeklyOff(response.data.weekly_off_employees || []);
      console.log(`[DEBUG] Weekly off loaded: ${response.data.total_count || 0} employees`);
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error loading weekly off';
      showMessage(errorMsg, 'error');
      console.error('[DEBUG] Weekly Off Error:', error);
      throw error;
    }
  }, [api, showMessage]);

  // Comprehensive data refresh with parallel requests
  const refreshAllData = useCallback(async () => {
    if (!componentMounted.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('[DEBUG] Refreshing all dashboard data...');
      
      // Fetch all data in parallel for better performance
      const [employeesData, statsData, schedulesData, weeklyOffData] = await Promise.all([
        fetchEmployees().catch(err => {
          console.error('[DEBUG] Employees fetch failed:', err);
          return { employees: [], total_count: 0 };
        }),
        fetchDashboardStats().catch(err => {
          console.error('[DEBUG] Dashboard stats fetch failed:', err);
          return { total_employees: 0, weekly_off_employees: 0, active_shift_employees: 0, leave_employees: 0 };
        }),
        fetchSchedules(selectedDate).catch(err => {
          console.error('[DEBUG] Schedules fetch failed:', err);
          return { schedules: [], total_count: 0 };
        }),
        fetchWeeklyOff(selectedDate).catch(err => {
          console.error('[DEBUG] Weekly off fetch failed:', err);
          return { weekly_off_employees: [], total_count: 0 };
        })
      ]);
      
      console.log('[DEBUG] All data refreshed successfully');
      showMessage('Dashboard data refreshed successfully', 'success');
      
    } catch (error) {
      console.error('[DEBUG] Error refreshing data:', error);
      showMessage('Error refreshing dashboard data', 'error');
    } finally {
      if (componentMounted.current) {
        setLoading(false);
      }
    }
  }, [fetchEmployees, fetchDashboardStats, fetchSchedules, fetchWeeklyOff, selectedDate, showMessage]);

  // Excel upload handler with comprehensive debugging
  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showMessage('Please upload an Excel file (.xlsx or .xls)', 'error');
      return;
    }

    setLoading(true);
    showMessage('Uploading Excel file...', 'info');

    try {
      console.log('[DEBUG] Starting Excel upload...');
      console.log(`[DEBUG] File: ${file.name}, Size: ${file.size} bytes`);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/upload-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('[DEBUG] Upload response:', response.data);
      setUploadStatus(response.data);
      showMessage(response.data.message, 'success');

      // Debug information
      if (response.data.debug) {
        console.log('[DEBUG] Upload debug info:', response.data.debug);
      }

      // Auto-refresh all data after successful upload
      if (response.data.status === 'success') {
        setTimeout(() => {
          if (componentMounted.current) {
            refreshAllData();
          }
        }, 1000);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error uploading Excel file';
      showMessage(errorMsg, 'error');
      console.error('[DEBUG] Upload Error:', error);
    } finally {
      if (componentMounted.current) {
        setLoading(false);
      }
    }
  };

  // Schedule generation handler with comprehensive debugging
  const generateSchedule = async () => {
    setLoading(true);
    showMessage('Generating schedule...', 'info');

    try {
      console.log('[DEBUG] Starting schedule generation...');
      console.log(`[DEBUG] Date: ${selectedDate}`);

      const response = await api.post('/generate-schedule', {
        date: selectedDate
      });

      console.log('[DEBUG] Generate schedule response:', response.data);
      showMessage(response.data.message, 'success');

      // Debug information
      if (response.data.debug) {
        console.log('[DEBUG] Schedule generation debug info:', response.data.debug);
      }

      // Refresh schedules and dashboard stats after generation
      await Promise.all([
        fetchSchedules(selectedDate),
        fetchDashboardStats()
      ]);
      
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error generating schedule';
      showMessage(errorMsg, 'error');
      console.error('[DEBUG] Generate Schedule Error:', error);
    } finally {
      if (componentMounted.current) {
        setLoading(false);
      }
    }
  };

  // STEP 5: FIX REACT useEffect HOOKS
  useEffect(() => {
    console.log('[DEBUG] Dashboard component mounted');
    componentMounted.current = true;
    
    // Initial data load
    refreshAllData();
    
    return () => {
      console.log('[DEBUG] Dashboard component unmounting');
      componentMounted.current = false;
    };
  }, []);

  // Auto-refresh when date changes
  useEffect(() => {
    if (selectedDate && componentMounted.current) {
      console.log(`[DEBUG] Date changed to: ${selectedDate} - refreshing schedule data...`);
      fetchSchedules(selectedDate);
      fetchWeeklyOff(selectedDate);
    }
  }, [selectedDate, fetchSchedules, fetchWeeklyOff]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (componentMounted.current) {
        console.log('[DEBUG] Auto-refreshing dashboard...');
        refreshAllData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshAllData]);

  // Manual refresh handler
  const handleManualRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refreshAllData();
  };

  // STEP 6: FIX EMPTY DASHBOARD WITH FALLBACK DATA
  const totalEmployees = dashboardStats?.total_employees || employees.length || 0;
  const weeklyOffCount = dashboardStats?.weekly_off_employees || weeklyOff.length || 0;
  const activeEmployees = dashboardStats?.active_shift_employees || (totalEmployees - weeklyOffCount) || 0;
  const leaveCount = dashboardStats?.leave_employees || 0;
  const todayScheduleCount = dashboardStats?.today_schedule_count || schedules.length || 0;

  // STEP 9: FIX CHARTS TO USE REAL API DATA
  const shiftDistribution = dashboardStats?.shift_distribution || {};
  const departmentDistribution = dashboardStats?.department_distribution || {};

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                AI Shift Scheduler - Debug Dashboard
              </h1>
              <p className="text-gray-600">
                Enterprise workforce management with comprehensive debugging and real-time data synchronization
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setDebugMode(!debugMode)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {debugMode ? '🔧 Debug ON' : '🔧 Debug OFF'}
              </button>
              <button
                onClick={handleManualRefresh}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span className="mr-4">API: {api.defaults.baseURL}</span>
            <span className="mr-4">Status: {loading ? '🔄 Loading' : '✅ Online'}</span>
            <span>Last Updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
            <h3 className="font-medium mb-1">❌ Error</h3>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 text-green-800 border border-green-200">
            <h3 className="font-medium mb-1">✅ Success</h3>
            <p className="text-sm">{success}</p>
          </div>
        )}

        {/* Upload Status */}
        {uploadStatus && (
          <div className={`mb-6 p-4 rounded-lg ${
            uploadStatus.status === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <h3 className="font-medium mb-2">
              {uploadStatus.status === 'success' ? '✅ Upload Successful' : '❌ Upload Failed'}
            </h3>
            <p className="text-sm">{uploadStatus.message}</p>
            {uploadStatus.employees_imported && (
              <p className="text-sm mt-1">
                Employees Imported: {uploadStatus.employees_imported}
              </p>
            )}
            {uploadStatus.debug && debugMode && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                <strong>Debug Info:</strong>
                <pre className="mt-1">{JSON.stringify(uploadStatus.debug, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* Excel Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Excel Upload</h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="hidden"
              id="excel-upload"
              key={refreshKey}
            />
            <label
              htmlFor="excel-upload"
              className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              📁 Choose Excel File
            </label>
            
            <p className="mt-2 text-sm text-gray-600">
              Required columns: Employee ID, Name, Department, Role, Preferred Shift, Weekly Off, Skills
            </p>
            
            {loading && (
              <div className="mt-4">
                <div className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
                  Processing...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard Stats Cards */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Dashboard Statistics - {dashboardStats?.day_name || 'Loading...'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-sm font-medium text-blue-800">Total Employees</h3>
              <p className="text-2xl font-bold text-blue-900">{totalEmployees}</p>
              <p className="text-xs mt-1">Active workforce</p>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="text-sm font-medium text-yellow-800">Weekly Off</h3>
              <p className="text-2xl font-bold text-yellow-900">{weeklyOffCount}</p>
              <p className="text-xs mt-1">Resting today</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="text-sm font-medium text-green-800">Active Rotations</h3>
              <p className="text-2xl font-bold text-green-900">{activeEmployees}</p>
              <p className="text-xs mt-1">Working today</p>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h3 className="text-sm font-medium text-red-800">On Leave</h3>
              <p className="text-2xl font-bold text-red-900">{leaveCount}</p>
              <p className="text-xs mt-1">Leave today</p>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shift Distribution Chart */}
            {Object.keys(shiftDistribution).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Shift Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(shiftDistribution).map(([shiftName, count]) => (
                    <div key={shiftName} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{shiftName}</span>
                      <span className="text-sm font-bold text-blue-600">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Department Distribution Chart */}
            {Object.keys(departmentDistribution).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Department Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(departmentDistribution).map(([deptName, count]) => (
                    <div key={deptName} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{deptName}</span>
                      <span className="text-sm font-bold text-green-600">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Schedule Management */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Schedule Management</h2>
          
          <div className="flex items-center space-x-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={generateSchedule}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              {loading ? '🔄 Generating...' : '🔄 Generate Schedule'}
            </button>
            
            <button
              onClick={() => {
                fetchSchedules(selectedDate);
                fetchWeeklyOff(selectedDate);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              📊 Refresh Schedule
            </button>
          </div>
        </div>

        {/* Schedule Display */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Schedule for {selectedDate} ({todayScheduleCount} assignments)
          </h2>
          
          {schedules.length > 0 ? (
            <div className="space-y-4">
              {Object.values(
                schedules.reduce((acc, schedule) => {
                  if (!acc[schedule.shift_name]) {
                    acc[schedule.shift_name] = [];
                  }
                  acc[schedule.shift_name].push(schedule);
                  return acc;
                }, {})
              ).map((shiftSchedules, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">{shiftSchedules[0]?.shift_name}</h3>
                    <div className="text-sm text-gray-500">
                      {shiftSchedules[0]?.shift_start} - {shiftSchedules[0]?.shift_end}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {shiftSchedules.map((schedule, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="font-medium text-gray-900">{schedule.employee_name}</div>
                        <div className="text-sm text-gray-600">ID: {schedule.emp_id}</div>
                        <div className="text-sm text-gray-600">Dept: {schedule.department}</div>
                        {schedule.is_override && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                            Override
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">📅</div>
              <div>No schedules found for this date</div>
              <div className="text-sm mt-1">Click "Generate Schedule" to create assignments</div>
            </div>
          )}
        </div>

        {/* Weekly Off Display */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Weekly Off Employees - {selectedDate} ({weeklyOff.length})
          </h2>
          
          {weeklyOff.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {weeklyOff.map((employee, index) => (
                <div key={index} className="bg-green-50 p-3 rounded border border-green-200">
                  <div className="font-medium text-gray-900">{employee.name}</div>
                  <div className="text-sm text-gray-600">ID: {employee.emp_id}</div>
                  <div className="text-sm text-gray-600">Dept: {employee.department}</div>
                  <div className="text-sm text-green-600">🏖️ Weekly Off: {employee.weekly_off}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">🏖️</div>
              <div>No employees on weekly off for this date</div>
            </div>
          )}
        </div>

        {/* Debug Console */}
        {debugMode && (
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg mt-6">
            <h3 className="font-bold mb-2">Debug Console</h3>
            <div className="text-xs font-mono space-y-1">
              <div>Component Mounted: {componentMounted.current ? '✅' : '❌'}</div>
              <div>Employees: {employees.length} loaded</div>
              <div>Dashboard Stats: {dashboardStats ? '✅ Loaded' : '❌ Not Loaded'}</div>
              <div>Schedules: {schedules.length} loaded</div>
              <div>Weekly Off: {weeklyOff.length} loaded</div>
              <div>Upload Status: {uploadStatus ? '✅ Available' : '❌ No Upload'}</div>
              <div>Loading: {loading ? '✅ Active' : '❌ Idle'}</div>
              <div>Error: {error ? '❌ ' + error : '✅ None'}</div>
              <div>Selected Date: {selectedDate}</div>
              <div>API URL: {api.defaults.baseURL}</div>
              <div>Debug Mode: {debugMode ? '✅ ON' : '❌ OFF'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugDashboard;
