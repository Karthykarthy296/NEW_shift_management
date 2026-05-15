TargetFile: "c:\\Users\\gess2\\Downloads\\NEW_shift_management\\artifacts\\system_workflow.md"
Overwrite: true
IsArtifact: true
ArtifactMetadata:
  ArtifactType: "walkthrough"
  Summary: "Detailed architectural and operational workflow of the Antigravity Shift Management AI, covering Excel parsing, database mapping, AI scheduling, and frontend rendering."
CodeContent: |
  # Antigravity Shift Management AI: System Workflow

  This document outlines the end-to-end data flow and operational logic of the Shift Management system.

  ## 1. Data Intake & Intelligent Parsing
  The workflow begins when an administrator uploads an Excel sheet containing employee data.

  *   **File Handling**: The file is received by the FastAPI backend (`/upload-excel`).
  *   **Intelligent Mapping**: The `ExcelUploadManager` uses `pandas` to read the sheet and applies **case-insensitive matching** to identify key columns:
      *   **Identity**: `Employee Name`, `Name`, `Employee ID`, `Emp ID`.
      *   **Roles**: `Role in Department`, `Designation`, `Job Title`.
      *   **Preferences**: `Preferred Shift`, `Weekly Off`.
  *   **Normalization**: Missing data is handled gracefully (e.g., auto-generating IDs or using placeholder names) to prevent import failures.

  ## 2. Persistence Layer (Database)
  Once parsed, data is synchronized with the SQLite database using **SQLAlchemy ORM**.

  *   **Upsert Logic**: If an `Employee ID` already exists, the system updates their profile; otherwise, a new record is created.
  *   **Relational Mapping**: Employees are linked to their respective **Departments** and assigned default **Shift Timings** if none are specified in the file.

  ## 3. AI Scheduling Engine
  After the import is successful, the AI Engine (`ai_scheduler.py`) is triggered to generate the operational schedule.

  *   **Rest Day Allocation**: The AI distributes "Weekly Offs" across the workforce to ensure staffing levels remain consistent (aiming for roughly 1/7th of the force resting each day).
  *   **Shift Assignment**: The AI assigns employees to shifts based on:
      1.  **Staffing Requirements**: Ensuring every shift has the minimum required personnel.
      2.  **Employee Preferences**: Prioritizing the "Preferred Shift" mapped from the Excel sheet.
      3.  **Workload Balance**: Monitoring weekly hours to prevent burnout.
  *   **Auto-Rotation**: The system can rotate shift patterns weekly to ensure fairness.

  ## 4. Frontend Rendering & UI
  The React frontend provides a real-time view of the generated schedule.

  *   **Data Retrieval**: The `Shifts.jsx` page fetches the live schedule via the `/get-schedule` API.
  *   **Dynamic UI Components**:
      *   **Shift Tiles**: Each employee is rendered as a "tile" showing their **Name**, **ID**, and **Assigned Shift** prominently.
      *   **Filters**: A comprehensive filter bar allows supervisors to sort by **Role in Department**, **Specific Shifts**, or **Overtime Status**.
  *   **Live Updates**: Any changes made (like manual overrides or leave applications) trigger immediate re-renders.

  ## 5. Exception Handling & Manual Overrides
  The system allows human supervisors to fine-tune the AI's decisions.

  *   **Leave Management**: When a leave is applied, the AI automatically identifies a "Replacement" from the pool of employees on their rest day or with the lowest workload.
  *   **Manual Overrides**: Supervisors can manually swap shifts or update employee details directly through the UI.

  ---
  *Document Version: 1.2*  
  *Last Updated: 2026-05-15*
Description: "Created a detailed markdown artifact explaining the system workflow."
