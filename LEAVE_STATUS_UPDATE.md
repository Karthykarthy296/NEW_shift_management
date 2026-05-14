# Leave Status Update

## Changes Made

Updated the Leave Status column to use "Present" and "On Leave" instead of "Active".

### **Status Values:**
- ✅ **Present** - Employee is present/working (Green badge)
- ❌ **On Leave** - Employee is on leave/absent (Red badge)

## Implementation

### 1. **Database Updated** ✅
Changed all existing "Active" values to "Present":
- Updated 1000 employees
- All employees now show "Present" status

### 2. **Excel Parser Updated** ✅
Now intelligently handles various input formats:

**Recognized as "Present":**
- "Present"
- "Active"
- "present"
- "PRESENT"
- Any variation with "present" or "active"

**Recognized as "On Leave":**
- "On Leave"
- "Leave"
- "Absent"
- "on leave"
- "ON LEAVE"
- Any variation with "leave" or "absent"

### 3. **Frontend Updated** ✅
- Changed default from "Active" to "Present"
- Added dropdown for editing with options: Present, On Leave, Active
- Updated color coding:
  - 🟢 Present/Active → Green badge
  - 🔴 On Leave → Red badge

## Excel Format

Your Excel file should have a `Leave Status` column with these values:

```
Employee ID | Name       | Department | Role    | Shift Preference | Leave Status
EMP0001     | John Doe   | IT         | Manager | Morning          | Present
EMP0002     | Jane Smith | Sales      | Staff   | Evening          | On Leave
EMP0003     | Bob Wilson | Support    | Staff   | Morning          | Present
```

**Accepted Values:**
- `Present` or `present` or `PRESENT`
- `On Leave` or `on leave` or `ON LEAVE`
- `Active` (will be converted to "Present")
- `Leave` or `Absent` (will be converted to "On Leave")

## Visual Display

| Status | Badge Color | Text Color | Border |
|--------|-------------|------------|--------|
| Present | Green (`bg-emerald-50`) | Dark Green (`text-emerald-600`) | Light Green |
| On Leave | Red (`bg-rose-50`) | Dark Red (`text-rose-600`) | Light Red |

## What You Need to Do

**RESTART YOUR BACKEND SERVER:**
```bash
cd backend
# Stop current server (Ctrl+C)
python main.py
```

Then:
1. **Refresh the Employees page** in your browser
2. **Verify all employees** show "Present" status
3. **Upload new Excel** with "Present" and "On Leave" values
4. **Check the display** - Present should be green, On Leave should be red

## Expected Result

The table will now show:
```
Personnel ID | Force Member | Department | Role  | Shift    | Leave Status
EMP0001      | Employee_1   | IT         | Staff | Morning  | Present ✓
EMP0002      | Employee_2   | Sales      | Staff | Morning  | Present ✓
EMP0003      | Employee_3   | Support    | Staff | Evening  | On Leave ✗
```

## Testing

### 1. **Verify Database Update**
```bash
cd backend
python update_leave_status_to_present.py
```
Should show: "✓ Updated 1000 employees"

### 2. **Check Sample Data**
```bash
cd backend
python -c "from database import SessionLocal, Employee; db = SessionLocal(); emp = db.query(Employee).first(); print(f'Leave Status: {emp.leave_status}'); db.close()"
```
Should output: "Leave Status: Present"

### 3. **Test Excel Upload**
Create an Excel file with:
```
Employee ID | Name       | Leave Status
EMP9001     | John Doe   | Present
EMP9002     | Jane Smith | On Leave
```

Upload and verify:
- John Doe shows green "PRESENT" badge
- Jane Smith shows red "ON LEAVE" badge

## Files Modified

1. `frontend/src/pages/Employees.jsx` - Updated display logic and dropdown
2. `backend/excel_upload_manager.py` - Added intelligent status parsing
3. `backend/migrate_add_role_leave_status.py` - Changed default to 'Present'

## Files Created

1. `backend/update_leave_status_to_present.py` - Update script
2. `LEAVE_STATUS_UPDATE.md` - This document

## Migration Summary

✅ **Before:**
- Status: "Active" (1000 employees)

✅ **After:**
- Status: "Present" (1000 employees)

## Notes

- The system is case-insensitive for Excel input
- "Active" is still supported for backward compatibility
- Default for new employees is "Present"
- Editing in the UI provides a dropdown with clear options
- The parser intelligently handles variations in spelling/casing
