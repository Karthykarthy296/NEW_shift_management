import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import NewDashboard from './NewDashboard';

export default function MainDashboard() {
  return <NewDashboard />;
}
