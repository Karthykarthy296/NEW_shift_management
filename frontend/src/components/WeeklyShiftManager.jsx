/**
 * WEEKLY SHIFT CHANGE MANAGER
 * Manages one shift change per week limitation
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const WeeklyShiftManager = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklyStatus, setWeeklyStatus] = useState(null);
  const [employeeStatus, setEmployeeStatus] = useState(null);
  const [shiftUpdate, setShiftUpdate] = useState({
    date: '',
    empId: '',
    newShift: '',
    reason: ''
  });
  const [pendingRequests, setPendingRequests] = useState([]);

  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000',
    timeout: 30000,
  });

  const showMessage = (msg, type = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const fetchWeeklyStatus = async () => {
    setLoading(true);
    try {
      const response = await api.get('/get-all-employees-weekly-status', {
        params: { date: selectedDate }
      });

      if (response.data.status === 'success') {
        setWeeklyStatus(response.data.weekly_summary);
        showMessage('Weekly status loaded successfully', 'success');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error fetching weekly status';
      showMessage(errorMsg, 'error');
      console.error('Fetch weekly status error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeStatus = async (empId) => {
    try {
      const response = await api.get('/get-employee-weekly-status', {
        params: { emp_id: empId, date: selectedDate }
      });

      if (response.data.status === 'success') {
        setEmployeeStatus(response.data);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error fetching employee status';
      showMessage(errorMsg, 'error');
      console.error('Fetch employee status error:', error);
    }
  };

  const updateShiftAssignment = async () => {
    if (!shiftUpdate.date || !shiftUpdate.empId || !shiftUpdate.newShift) {
      showMessage('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/update-shift-assignment', {
        date: shiftUpdate.date,
        emp_id: shiftUpdate.empId,
        new_shift: shiftUpdate.newShift,
        reason: shiftUpdate.reason,
        user_id: 1 // Replace with actual user ID
      });

      showMessage(response.data.message, 'success');
      
      // Clear form
      setShiftUpdate({
        date: '',
        empId: '',
        newShift: '',
        reason: ''
      });

      // Refresh status
      await fetchWeeklyStatus();
      if (shiftUpdate.empId) {
        await fetchEmployeeStatus(shiftUpdate.empId);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error updating shift assignment';
      showMessage(errorMsg, 'error');
      console.error('Shift update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestShiftChange = async () => {
    if (!shiftUpdate.date || !shiftUpdate.empId || !shiftUpdate.newShift) {
      showMessage('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/request-shift-change', {
        date: shiftUpdate.date,
        emp_id: shiftUpdate.empId,
        new_shift: shiftUpdate.newShift,
        reason: shiftUpdate.reason,
        user_id: 1 // Replace with actual user ID
      });

      showMessage(response.data.message, 'success');
      
      // Clear form
      setShiftUpdate({
        date: '',
        empId: '',
        newShift: '',
        reason: ''
      });

      // Refresh status
      await fetchWeeklyStatus();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error requesting shift change';
      showMessage(errorMsg, 'error');
      console.error('Shift request error:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveShiftChange = async (changeId) => {
    try {
      const response = await api.post('/approve-shift-change', {
        change_id: changeId,
        user_id: 1 // Replace with actual user ID
      });

      showMessage(response.data.message, 'success');
      
      // Refresh status
      await fetchWeeklyStatus();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error approving shift change';
      showMessage(errorMsg, 'error');
      console.error('Approve error:', error);
    }
  };

  const rejectShiftChange = async (changeId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await api.post('/reject-shift-change', {
        change_id: changeId,
        user_id: 1, // Replace with actual user ID
        rejection_reason: reason
      });

      showMessage(response.data.message, 'success');
      
      // Refresh status
      await fetchWeeklyStatus();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error rejecting shift change';
      showMessage(errorMsg, 'error');
      console.error('Reject error:', error);
    }
  };

  useEffect(() => {
    fetchWeeklyStatus();
  }, [selectedDate]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'rejected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getChangeStatusIcon = (canChange, hasChanged) => {
    if (hasChanged) return '🔒';
    if (canChange) return '✅';
    return '⏳';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Weekly Shift Change Manager
          </h1>
          <p className="text-gray-600">
            Manage one shift change per week limitation for employees
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            messageType === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            <p className="font-medium">{message}</p>
          </div>
        )}

        {/* Weekly Summary */}
        {weeklyStatus && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Weekly Summary - Week of {weeklyStatus.week_start_date}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800">Total Employees</h3>
                <p className="text-2xl font-bold text-blue-900">{weeklyStatus.total_employees}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-green-800">Can Change</h3>
                <p className="text-2xl font-bold text-green-900">{weeklyStatus.employees_can_change}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-yellow-800">Already Changed</h3>
                <p className="text-2xl font-bold text-yellow-900">{weeklyStatus.employees_already_changed}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-red-800">Used Changes</h3>
                <p className="text-2xl font-bold text-red-900">{weeklyStatus.employees_already_changed}/{weeklyStatus.total_employees}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Week
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={fetchWeeklyStatus}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {loading ? 'Loading...' : '🔄 Refresh'}
              </button>
            </div>
          </div>
        )}

        {/* Employee Status List */}
        {weeklyStatus && weeklyStatus.employees_status && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Employee Weekly Status</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preferred Shift
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Changes This Week
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(weeklyStatus.employees_status).map(([empId, empData]) => (
                    <tr key={empId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{empData.name}</div>
                        <div className="text-sm text-gray-500">{empId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {empData.department}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {empData.preferred_shift}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          empData.can_change ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {getChangeStatusIcon(empData.can_change, empData.has_changed_this_week)}
                          {empData.can_change ? 'Can Change' : 'Change Used'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {empData.approved_changes} approved, {empData.pending_changes} pending
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => fetchEmployeeStatus(empId)}
                          className="text-blue-600 hover:text-blue-900 mr-2"
                        >
                          View Details
                        </button>
                        {empData.can_change && (
                          <button
                            onClick={() => setShiftUpdate({...shiftUpdate, empId: empId})}
                            className="text-green-600 hover:text-green-900"
                          >
                            Change Shift
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Shift Update Form */}
        {shiftUpdate.empId && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Update Shift Assignment - {shiftUpdate.empId}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={shiftUpdate.date}
                  onChange={(e) => setShiftUpdate({...shiftUpdate, date: e.target.value})}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID *
                </label>
                <input
                  type="text"
                  value={shiftUpdate.empId}
                  onChange={(e) => setShiftUpdate({...shiftUpdate, empId: e.target.value})}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Shift *
                </label>
                <select
                  value={shiftUpdate.newShift}
                  onChange={(e) => setShiftUpdate({...shiftUpdate, newShift: e.target.value})}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Shift</option>
                  <option value="Morning">Morning</option>
                  <option value="Afternoon">Afternoon</option>
                  <option value="Evening">Evening</option>
                  <option value="Night">Night</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={shiftUpdate.reason}
                  onChange={(e) => setShiftUpdate({...shiftUpdate, reason: e.target.value})}
                  placeholder="Optional reason"
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={updateShiftAssignment}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {loading ? 'Processing...' : '✏️ Update Shift (Uses Weekly Change)'}
              </button>
              
              <button
                onClick={requestShiftChange}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                {loading ? 'Requesting...' : '📋 Request Change (Approval Required)'}
              </button>
              
              <button
                onClick={() => setShiftUpdate({date: '', empId: '', newShift: '', reason: ''})}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Employee Detailed Status */}
        {employeeStatus && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Detailed Status - {employeeStatus.employee_name}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Weekly Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Week Start Date:</span>
                    <span className="text-sm font-medium">{employeeStatus.weekly_status.week_start_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Has Changed This Week:</span>
                    <span className={`text-sm font-medium ${employeeStatus.weekly_status.has_changed_this_week ? 'text-red-600' : 'text-green-600'}`}>
                      {employeeStatus.weekly_status.has_changed_this_week ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Remaining Changes:</span>
                    <span className="text-sm font-medium">{employeeStatus.weekly_status.remaining_changes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Can Change:</span>
                    <span className={`text-sm font-medium ${employeeStatus.weekly_status.can_change ? 'text-green-600' : 'text-red-600'}`}>
                      {employeeStatus.weekly_status.can_change ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Change History</h3>
                <div className="space-y-2">
                  {employeeStatus.weekly_status.change_history.length > 0 ? (
                    employeeStatus.weekly_status.change_history.map((change, index) => (
                      <div key={index} className="border border-gray-200 rounded p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm font-medium">{change.change_date}</span>
                            <span className={`ml-2 text-sm ${getStatusColor(change.status)}`}>
                              {change.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {change.original_shift} → {change.new_shift}
                        </div>
                        {change.reason && (
                          <div className="text-sm text-gray-500 mt-1">
                            Reason: {change.reason}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No changes this week</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyShiftManager;
