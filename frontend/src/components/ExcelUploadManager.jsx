/**
 * EXCEL UPLOAD MANAGER COMPONENT
 * Handles Excel file uploads and weekly schedule generation
 */

import React, { useState } from 'react';
import axios from 'axios';

const ExcelUploadManager = () => {
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // success, error, info
  const [uploadedFile, setUploadedFile] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklySchedule, setWeeklySchedule] = useState(null);
  const [shiftUpdate, setShiftUpdate] = useState({
    date: '',
    empId: '',
    newShift: '',
    reason: ''
  });

  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000',
    timeout: 30000,
  });

  const showMessage = (msg, type = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showMessage('Please upload an Excel file (.xlsx or .xls)', 'error');
      return;
    }

    setUploading(true);
    setUploadedFile(file);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/upload-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      showMessage(response.data.message, 'success');
      console.log('Upload response:', response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error uploading file';
      showMessage(errorMsg, 'error');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const generateWeeklySchedule = async () => {
    setGenerating(true);
    
    try {
      const response = await api.post('/generate-weekly-schedule', {
        start_date: startDate
      });

      showMessage(response.data.message, 'success');
      console.log('Schedule generation response:', response.data);
      
      // Fetch the generated schedule
      await fetchWeeklySchedule();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error generating schedule';
      showMessage(errorMsg, 'error');
      console.error('Schedule generation error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const fetchWeeklySchedule = async () => {
    try {
      const response = await api.get('/get-weekly-schedule', {
        params: { start_date: startDate }
      });

      if (response.data.status === 'success') {
        setWeeklySchedule(response.data.weekly_schedule);
        showMessage('Weekly schedule loaded successfully', 'success');
      } else {
        showMessage(response.data.message, 'info');
        setWeeklySchedule(null);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error fetching weekly schedule';
      showMessage(errorMsg, 'error');
      console.error('Fetch schedule error:', error);
    }
  };

  const updateShiftAssignment = async () => {
    if (!shiftUpdate.date || !shiftUpdate.empId || !shiftUpdate.newShift) {
      showMessage('Please fill in all required fields', 'error');
      return;
    }

    try {
      const response = await api.post('/update-shift-assignment', {
        date: shiftUpdate.date,
        emp_id: shiftUpdate.empId,
        new_shift: shiftUpdate.newShift,
        reason: shiftUpdate.reason
      });

      showMessage(response.data.message, 'success');
      
      // Clear form
      setShiftUpdate({
        date: '',
        empId: '',
        newShift: '',
        reason: ''
      });

      // Refresh schedule
      await fetchWeeklySchedule();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error updating shift assignment';
      showMessage(errorMsg, 'error');
      console.error('Shift update error:', error);
    }
  };

  const downloadTemplate = () => {
    // Create a sample CSV template
    const csvContent = `emp_id,name,department,preferred_shift,max_hours,skills,weekly_off
EMP001,John Doe,IT,Morning,40,"Python,SQL,React",Sunday
EMP002,Jane Smith,HR,Afternoon,40,"Communication,Leadership",Saturday
EMP003,Mike Johnson,Operations,Evening,45,"Logistics,Management",Friday
EMP004,Sarah Wilson,IT,Night,40,"Python,AI,ML",Monday
EMP005,Tom Brown,HR,Morning,40,"HR,Policies,Recruitment",Tuesday`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showMessage('Template downloaded successfully', 'success');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Excel Upload & Schedule Manager
          </h1>
          <p className="text-gray-600">
            Upload employee Excel files and generate weekly schedules
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

        {/* Excel Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">1. Upload Employee Excel File</h2>
          
          <div className="mb-4">
            <button
              onClick={downloadTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              📥 Download Template
            </button>
            <p className="text-sm text-gray-600 mt-2">
              Download the Excel template with required columns: emp_id, name, department, preferred_shift, max_hours, skills, weekly_off
            </p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="excel-upload"
            />
            <label
              htmlFor="excel-upload"
              className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              📁 Choose Excel File
            </label>
            
            {uploadedFile && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {uploadedFile.name}
              </p>
            )}
            
            {uploading && (
              <p className="mt-2 text-sm text-blue-600">
                Uploading and processing...
              </p>
            )}
          </div>
        </div>

        {/* Weekly Schedule Generation */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">2. Generate Weekly Schedule</h2>
          
          <div className="flex items-center space-x-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={generateWeeklySchedule}
              disabled={generating}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              {generating ? 'Generating...' : '🔄 Generate Weekly Schedule'}
            </button>
            
            <button
              onClick={fetchWeeklySchedule}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              📊 View Current Schedule
            </button>
          </div>
        </div>

        {/* Shift Assignment Update */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">3. Update Shift Assignment</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                placeholder="e.g., EMP001"
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          
          <button
            onClick={updateShiftAssignment}
            className="mt-4 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            ✏️ Update Shift Assignment
          </button>
        </div>

        {/* Weekly Schedule Display */}
        {weeklySchedule && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Weekly Schedule: {weeklySchedule.start_date} to {weeklySchedule.end_date}
            </h2>
            
            <div className="space-y-4">
              {Object.entries(weeklySchedule.daily_schedules).map(([dayName, dayData]) => (
                <div key={dayName} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {dayName} ({dayData.date})
                  </h3>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    Total Assignments: {dayData.total_assignments}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {Object.entries(dayData.shifts).map(([shiftName, shiftData]) => (
                      <div key={shiftName} className="bg-gray-50 p-3 rounded border border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-1">{shiftName}</h4>
                        <div className="space-y-1">
                          {shiftData.map((employee, index) => (
                            <div key={index} className="text-sm">
                              <div className="font-medium">{employee.name}</div>
                              <div className="text-gray-600">{employee.emp_id}</div>
                              <div className="text-gray-500">{employee.department}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelUploadManager;
