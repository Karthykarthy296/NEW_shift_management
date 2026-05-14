/**
 * PRODUCTION READY MAIN DASHBOARD
 * Enterprise-grade React component with comprehensive error handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

const MainDashboardProduction = () => {
  const [loading, setLoading] = useState({
    schedule: false,
    summary: false,
    employees: false
  });
  
  const [errors, setErrors] = useState({
    schedule: null,
    summary: null,
    employees: null
  });
  
  const [data, setData] = useState({
    schedule: null,
    summary: null,
    employees: null
  });
  
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Error boundary for component
  const handleError = useCallback((section, error) => {
    console.error(`Dashboard ${section} error:`, error);
    setErrors(prev => ({
      ...prev,
      [section]: error
    }));
  }, []);

  // Clear error for section
  const clearError = useCallback((section) => {
    setErrors(prev => ({
      ...prev,
      [section]: null
    }));
  }, []);

  // Fetch dashboard summary
  const fetchSummary = useCallback(async () => {
    setLoading(prev => ({ ...prev, summary: true }));
    clearError('summary');
    
    try {
      const result = await apiService.getDashboardSummary();
      
      if (result.success) {
        setData(prev => ({ ...prev, summary: result.data }));
      } else {
        handleError('summary', result.error);
      }
    } catch (error) {
      handleError('summary', {
        message: 'Failed to fetch dashboard summary',
        details: error
      });
    } finally {
      setLoading(prev => ({ ...prev, summary: false }));
    }
  }, [handleError, clearError]);

  // Fetch schedule
  const fetchSchedule = useCallback(async (date) => {
    setLoading(prev => ({ ...prev, schedule: true }));
    clearError('schedule');
    
    try {
      const result = await apiService.getSchedule(date);
      
      if (result.success) {
        setData(prev => ({ ...prev, schedule: result.data }));
      } else {
        handleError('schedule', result.error);
      }
    } catch (error) {
      handleError('schedule', {
        message: 'Failed to fetch schedule',
        details: error
      });
    } finally {
      setLoading(prev => ({ ...prev, schedule: false }));
    }
  }, [handleError, clearError]);

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    setLoading(prev => ({ ...prev, employees: true }));
    clearError('employees');
    
    try {
      const result = await apiService.getEmployees();
      
      if (result.success) {
        setData(prev => ({ ...prev, employees: result.data }));
      } else {
        handleError('employees', result.error);
      }
    } catch (error) {
      handleError('employees', {
        message: 'Failed to fetch employees',
        details: error
      });
    } finally {
      setLoading(prev => ({ ...prev, employees: false }));
    }
  }, [handleError, clearError]);

  // Generate schedule
  const generateSchedule = useCallback(async () => {
    setLoading(prev => ({ ...prev, schedule: true }));
    clearError('schedule');
    
    try {
      const result = await apiService.generateSchedule(selectedDate);
      
      if (result.success) {
        // Refresh schedule after generation
        await fetchSchedule(selectedDate);
      } else {
        handleError('schedule', result.error);
      }
    } catch (error) {
      handleError('schedule', {
        message: 'Failed to generate schedule',
        details: error
      });
    } finally {
      setLoading(prev => ({ ...prev, schedule: false }));
    }
  }, [selectedDate, fetchSchedule, handleError, clearError]);

  // Retry failed request
  const retryRequest = useCallback((section) => {
    switch (section) {
      case 'summary':
        fetchSummary();
        break;
      case 'schedule':
        fetchSchedule(selectedDate);
        break;
      case 'employees':
        fetchEmployees();
        break;
      default:
        break;
    }
  }, [fetchSummary, fetchSchedule, fetchEmployees, selectedDate]);

  // Initial data fetch
  useEffect(() => {
    fetchSummary();
    fetchSchedule(selectedDate);
    fetchEmployees();
  }, [fetchSummary, fetchSchedule, fetchEmployees, selectedDate]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSummary();
      fetchSchedule(selectedDate);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchSummary, fetchSchedule, selectedDate]);

  // Error display component
  const ErrorDisplay = ({ section, error, onRetry }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-red-800 font-medium">
            {section.charAt(0).toUpperCase() + section.slice(1)} Error
          </h3>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
          {error.details && (
            <details className="mt-2">
              <summary className="text-red-500 text-xs cursor-pointer">
                Technical Details
              </summary>
              <pre className="text-red-400 text-xs mt-1 overflow-auto">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
        <button
          onClick={onRetry}
          className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
        >
          Retry
        </button>
      </div>
    </div>
  );

  // Loading spinner component
  const LoadingSpinner = ({ message }) => (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-2 text-gray-600">{message}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Enterprise HRMS Dashboard
          </h1>
          <p className="text-gray-600">
            AI-Powered Workforce Management System
          </p>
        </div>

        {/* Error Displays */}
        {errors.summary && (
          <ErrorDisplay
            section="summary"
            error={errors.summary}
            onRetry={() => retryRequest('summary')}
          />
        )}
        {errors.schedule && (
          <ErrorDisplay
            section="schedule"
            error={errors.schedule}
            onRetry={() => retryRequest('schedule')}
          />
        )}
        {errors.employees && (
          <ErrorDisplay
            section="employees"
            error={errors.employees}
            onRetry={() => retryRequest('employees')}
          />
        )}

        {/* Dashboard Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {loading.summary ? (
            <div className="col-span-full">
              <LoadingSpinner message="Loading dashboard summary..." />
            </div>
          ) : data.summary ? (
            <>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Employees</h3>
                <p className="text-2xl font-bold text-gray-900">{data.summary.employees || 0}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Shifts</h3>
                <p className="text-2xl font-bold text-gray-900">{data.summary.shifts || 0}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-500">On Leave</h3>
                <p className="text-2xl font-bold text-gray-900">{data.summary.on_leave || 0}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-500">Weekly Off</h3>
                <p className="text-2xl font-bold text-gray-900">{data.summary.weekly_off || 0}</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Schedule Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Schedule Management</h2>
            <div className="flex items-center space-x-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <button
                onClick={generateSchedule}
                disabled={loading.schedule}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded text-sm"
              >
                {loading.schedule ? 'Generating...' : 'Generate Schedule'}
              </button>
            </div>
          </div>

          {loading.schedule ? (
            <LoadingSpinner message="Loading schedule..." />
          ) : data.schedule ? (
            <div>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Date: {data.schedule.date} | 
                  Total Assignments: {data.schedule.count || 0}
                </p>
              </div>
              
              {data.schedule.schedules && data.schedule.schedules.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Shift
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.schedule.schedules.map((schedule, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {schedule.employee?.name || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {schedule.shift?.name || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {schedule.shift?.start_time && schedule.shift?.end_time 
                              ? `${schedule.shift.start_time} - ${schedule.shift.end_time}`
                              : 'Unknown'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {schedule.employee?.department || 'Unassigned'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No schedules found for this date
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Employees Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Employees</h2>
          
          {loading.employees ? (
            <LoadingSpinner message="Loading employees..." />
          ) : data.employees ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preferred Shift
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Weekly Off
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.employees.employees && data.employees.employees.map((employee, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.emp_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.department || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.preferred_shift || 'Not set'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.weekly_off || 'Not set'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MainDashboardProduction;
