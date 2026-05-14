"""
Fixed upload-excel endpoint with better logging and error handling
Replace the existing @app.post("/upload-excel") endpoint in main.py with this code
"""

@app.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload Excel file with employee data and generate weekly schedule
    """
    try:
        print(f"\n{'='*60}")
        print(f"EXCEL UPLOAD STARTED: {file.filename}")
        print(f"{'='*60}")
        
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx or .xls)")
        
        # Save uploaded file
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = f"{upload_dir}/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"✓ File saved to: {file_path}")
        
        # Ensure shifts exist before importing
        shifts = db.query(Shift).all()
        if not shifts:
            print("⚠ No shifts found. Creating default shifts...")
            default_shifts = [
                Shift(name="Morning", start_time="06:00", end_time="12:00", required_employees=3),
                Shift(name="Afternoon", start_time="12:00", end_time="18:00", required_employees=3),
                Shift(name="Evening", start_time="18:00", end_time="00:00", required_employees=2),
                Shift(name="Night", start_time="00:00", end_time="06:00", required_employees=2)
            ]
            for shift in default_shifts:
                db.add(shift)
            db.commit()
            print("✓ Default shifts created successfully")
        else:
            print(f"✓ Found {len(shifts)} existing shifts")
        
        # Import employees from Excel
        from excel_upload_manager import ExcelUploadManager
        manager = ExcelUploadManager(db)
        
        print(f"\n📊 Starting Excel import...")
        success, message, imported_count = manager.import_employees_from_excel(file_path)
        
        if not success:
            print(f"✗ Import failed: {message}")
            raise HTTPException(status_code=400, detail=message)
        
        print(f"✓ Successfully imported {imported_count} employees")
        
        # Auto-generate weekly off allocation and shift generation
        try:
            print(f"\n🤖 Auto-generating schedule for {imported_count} employees...")
            
            # Get today's date
            today = datetime.date.today().isoformat()
            print(f"   Schedule start date: {today}")
            
            # Generate weekly schedule
            schedule_success, schedule_message, schedule_summary = manager.generate_weekly_schedule(today)
            
            if schedule_success:
                total_assignments = schedule_summary.get('total_assignments', 0)
                print(f"✓ Schedule generated successfully: {total_assignments} assignments")
                print(f"   Daily breakdown:")
                for day, info in schedule_summary.get('daily_schedules', {}).items():
                    print(f"     - {day}: {info.get('assignments', 0)} assignments")
                message += f" | {schedule_message}"
            else:
                print(f"✗ Schedule generation failed: {schedule_message}")
                message += f" | Warning: {schedule_message}"
                
        except Exception as e:
            print(f"✗ Error in auto-generation: {str(e)}")
            import traceback
            traceback.print_exc()
            message += f" | Auto-generation warning: {str(e)}"
        
        response_data = {
            "status": "success",
            "msg": message,
            "message": message,  # Both for compatibility
            "employees_imported": imported_count,
            "file_name": file.filename,
            "auto_generated": True
        }
        
        print(f"\n{'='*60}")
        print(f"UPLOAD COMPLETE: {imported_count} employees imported")
        print(f"{'='*60}\n")
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n✗ ERROR uploading Excel: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error uploading Excel file: {str(e)}")
