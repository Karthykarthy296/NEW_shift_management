/**
 * FIXED DASHBOARD COMPONENT
 * Handles auto-refresh and proper data display after Excel upload
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FixedDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleData, setScheduleData] = useState(null);
  const [weeklyStatus, setWeeklyStatus] = useState(null);

  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000',
    timeout: 30000,
  });

  const showMessage = (msg, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${msg}`);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboard-summary');
      setDashboardData(response.data);
      showMessage('Dashboard data loaded successfully', 'success');
      console.log('Dashboard Data:', response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error loading dashboard data';
      showMessage(errorMsg, 'error');
      console.error('Dashboard Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduleData = async () => {
    try {
      const response = await api.get(`/get-schedule?date=${selectedDate}`);
      setScheduleData(response.data);
      showMessage('Schedule data loaded successfully', 'success');
      console.log('Schedule Data:', response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error loading schedule data';
      showMessage(errorMsg, 'error');
      console.error('Schedule Error:', error);
    }
  };

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
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/upload-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadStatus(response.data);
      showMessage(response.data.message, 'success');
      console.log('Upload Response:', response.data);

      // Auto-refresh dashboard after successful upload
      if (response.data.status === 'success') {
        setTimeout(() => {
          fetchDashboardData();
          fetchScheduleData();
        }, 1000);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error uploading Excel file';
      showMessage(errorMsg, 'error');
      console.error('Upload Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSchedule = async () => {
    setLoading(true);
    showMessage('Generating schedule...', 'info');

    try {
      const response = await api.post('/generate-weekly-schedule', {
        start_date: selectedDate
      });

      showMessage(response.data.message, 'success');
      console.log('Generate Schedule Response:', response.data);

      // Refresh schedule data
      await fetchScheduleData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error generating schedule';
      showMessage(errorMsg, 'error');
      console.error('Generate Schedule Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyStatus = async () => {
    try {
      const response = await api.get('/get-all-employees-weekly-status', {
        params: { date: selectedDate }
      });
      setWeeklyStatus(response.data.weekly_summary);
      showMessage('Weekly status loaded successfully', 'success');
      console.log('Weekly Status:', response.data.weekly_summary);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error loading weekly status';
      showMessage(errorMsg, 'error');
      console.error('Weekly Status Error:', error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchScheduleData();
    fetchWeeklyStatus();
  }, [selectedDate]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchScheduleData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatCardColor = (value, label) => {
    if (value === 0) return 'bg-gray-50 text-gray-600';
    if (label === 'employees' || label === 'active_shift') return 'bg-blue-50 text-blue-600';
    if (label === 'weekly_off') return 'bg-yellow-50 text-yellow-600';
    if (label === 'leaves') return 'bg-red-50 text-red-600';
    return 'bg-green-50 text-green-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Shift Scheduler - Fixed Dashboard
          </h1>
          <p className="text-gray-600">
            Enterprise-grade workforce management with real-time data
          </p>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span className="mr-4">API: {api.defaults.baseURL}</span>
            <span className="mr-4">Status: {loading ? '🔄 Loading' : '✅ Online'}</span>
            <span>Last Updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>

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
              <p className="mt-2 text-sm text-blue-600">
                Processing upload...
              </p>
            )}
          </div>
        </div>

        {/* Dashboard Stats */}
        {dashboardData && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Dashboard Statistics - {dashboardData.day_name}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className={`${getStatCardColor(dashboardData.employees, 'employees')} p-4 rounded-lg`}>
                <h3 className="text-sm font-medium">Total Employees</h3>
                <p className="text-2xl font-bold">{dashboardData.employees || 0}</p>
                <p className="text-xs mt-1">Active workforce</p>
              </div>
              
              <div className={`${getStatCardColor(dashboardData.weekly_off, 'weekly_off')} p-4 rounded-lg`}>
                <h3 className="text-sm font-medium">Weekly Off</h3>
                <p className="text-2xl font-bold">{dashboardData.weekly_off || 0}</p>
                <p className="text-xs mt-1">Resting today</p>
              </div>
              
              <div className={`${getStatCardColor(dashboardData.active_shift, 'active_shift')} p-4 rounded-lg`}>
                <h3 className="text-sm font-medium">Active Rotations</h3>
                <p className="text-2xl font-bold">{dashboardData.active_shift || 0}</p>
                <p className="text-xs mt-1">Working today</p>
              </div>
              
              <div className={`${getStatCardColor(dashboardData.leaves, 'leaves')} p-4 rounded-lg`}>
                <h3 className="text-sm font-medium">On Leave</h3>
                <p className="text-2xl font-bold">{dashboardData.leaves || 0}</p>
                <p className="text-xs mt-1">Leave today</p>
              </div>
            </div>

            {/* Shift Distribution */}
            {dashboardData.shift_assignments && Object.keys(dashboardData.shift_assignments).length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Shift Distribution</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(dashboardData.shift_assignments).map(([shiftName, count]) => (
                    <div key={shiftName} className="bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="font-medium text-gray-900">{shiftName}</div>
                      <div className="text-2xl font-bold text-blue-600">{count}</div>
                      <div className="text-xs text-gray-500">employees</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weekly Status */}
        {weeklyStatus && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Weekly Change Status - Week of {weeklyStatus.week_start_date}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800">Total Employees</h3>
                <p className="text-2xl font-bold text-blue-900">{weeklyStatus.total_employees}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-green-800">Can Change</h3>
                <p className="text-2xl font-bold text-green-900">{weeklyStatus.employees_can_change}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-red-800">Already Changed</h3>
                <p className="text-2xl font-bold text-red-900">{weeklyStatus.employees_already_changed}</p>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Controls */}
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
              {loading ? 'Generating...' : '🔄 Generate Schedule'}
            </button>
            
            <button
              onClick={fetchScheduleData}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              📊 Refresh Schedule
            </button>
          </div>
        </div>

        {/* Schedule Display */}
        {scheduleData && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Schedule for {scheduleData.date} ({scheduleData.day_name})
            </h2>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                <strong>Total Assignments:</strong> {scheduleData.total_assignments || 0} |
                <strong>Status:</strong> <span className="text-green-600">{scheduleData.status}</span>
              </p>
            </div>
            
            {scheduleData.shifts && Object.keys(scheduleData.shifts).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(scheduleData.shifts).map(([shiftName, shiftData]) => (
                  <div key={shiftName} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{shiftName}</h3>
                      <div className="text-sm text-gray-500">
                        {shiftData.shift_details?.start} - {shiftData.shift_details?.end}
                      </div>
                    </div>
                    
                    {shiftData.employees && shiftData.employees.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {shiftData.employees.map((employee, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded border border-gray-200">
                            <div className="font-medium text-gray-900">{employee.name}</div>
                            <div className="text-sm text-gray-600">ID: {employee.emp_id}</div>
                            <div className="text-sm text-gray-600">Role: {employee.role || 'Not Assigned'}</div>
                            {employee.is_override && (
                              <span className="inline-block mt-1 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                                Override
                              </span>
                            )}
                            {employee.replaced_name && (
                              <div className="text-xs text-gray-500 mt-1">
                                Replaced: {employee.replaced_name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No employees assigned to this shift
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-lg mb-2">📅</div>
                <div>No schedules found for this date</div>
                <div className="text-sm mt-1">Try generating a schedule for this date</div>
              </div>
            )}
            
            {/* Weekly Off Section */}
            {scheduleData.weekly_off && scheduleData.weekly_off.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Weekly Off Today</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {scheduleData.weekly_off.map((employee, index) => (
                    <div key={index} className="bg-green-50 p-3 rounded border border-green-200">
                      <div className="font-medium text-gray-900">{employee.name}</div>
                      <div className="text-sm text-gray-600">ID: {employee.emp_id}</div>
                      <div className="text-sm text-green-600">🏖️ Weekly Off</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Debug Console */}
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg mt-6">
          <h3 className="font-bold mb-2">Debug Console</h3>
          <div className="text-xs font-mono">
            <div>Dashboard Data: {dashboardData ? '✅ Loaded' : '❌ Not Loaded'}</div>
            <div>Schedule Data: {scheduleData ? '✅ Loaded' : '❌ Not Loaded'}</div>
            <div>Weekly Status: {weeklyStatus ? '✅ Loaded' : '❌ Not Loaded'}</div>
            <div>Upload Status: {uploadStatus ? '✅ Available' : '❌ No Upload'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FixedDashboard;
