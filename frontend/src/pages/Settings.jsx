import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Settings as SettingsIcon, Bell, Lock, Globe } from 'lucide-react';

export default function Settings() {
  const role = localStorage.getItem('role') || 'User';
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);

  const settingSections = [
    { icon: <Bell size={18} />, title: "Notifications", desc: "Configure how you receive alerts." },
    { icon: <Lock size={18} />, title: "Security", desc: "Update your password and security settings." },
    { icon: <Globe size={18} />, title: "Preferences", desc: "Set your language and timezone." },
  ];

  return (
    <DashboardLayout title="System Settings" role={roleTitle}>
      <div style={{ display: 'grid', gap: '20px' }}>
        {settingSections.map((s, i) => (
          <div key={i} className="card" style={{ marginBottom: 0, cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '12px', borderRadius: '10px' }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{s.title}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-sub)' }}>{s.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
