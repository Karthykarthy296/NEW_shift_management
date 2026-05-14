import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Clock } from 'lucide-react';

export default function Attendance() {
  const role = localStorage.getItem('role') || 'User';
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <DashboardLayout title="Attendance Logs" role={roleTitle}>
      <div className="card">
        <div className="card-title">
          <span>Daily Attendance</span>
          <Clock size={18} color="var(--primary)" />
        </div>
        <p style={{ color: 'var(--text-sub)' }}>
          Track check-in/check-out times and monitor punctuality.
        </p>
        <div style={{ marginTop: '24px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Employee #{i*123}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Checked in at 09:0{i} AM</div>
              </div>
              <span className="badge badge-assigned">Verified</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
