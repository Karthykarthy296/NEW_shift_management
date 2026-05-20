# Employee Weekoff Management System

## Overview
A comprehensive Weekoff Management System built with Python, Flask, and MySQL.

## Features
- **Employee CRUD:** Add, View, Delete employees.
- **AI Weekoff Assignment:** Automatically assigns one weekoff day per employee every week, balancing the workforce and fairly rotating the weekoff day (e.g. Monday -> Tuesday).
- **Weekoff Swap:** Employees can request swaps. Targets can accept/reject. Admins give final approval.
- **Dashboard:** Shows current weekoffs, calendar logic, and swap requests.

## Setup Instructions

### Using Docker (Recommended)
1. Ensure you have Docker and Docker Compose installed.
2. Navigate to this directory in your terminal.
3. Run the following command:
   ```bash
   docker-compose up --build
   ```
4. The application will be available at `http://localhost:5000`.

### Local Setup (Without Docker)
1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set up MySQL database and update `app.py` or `.env` with your credentials:
   ```
   DB_USER=root
   DB_PASSWORD=yourpassword
   DB_HOST=localhost
   DB_NAME=weekoff_db
   ```
4. Run the application:
   ```bash
   python app.py
   ```
5. Note: The app will fallback to SQLite automatically if MySQL is not provided for local testing.

## Default Credentials
When the app starts, it creates a default admin user:
- **Role:** Admin
- **Username:** admin
- **Password:** admin123

## Usage
1. Login as Admin.
2. Go to `Employees` tab to add users.
3. Go to Dashboard and click `Generate AI Weekoffs for this week`.
4. Login as an Employee (Role: Employee, Username: <Emp_ID>) to view weekoff and request swaps.
