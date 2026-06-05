"""
Integration test for leave replacement API endpoints.
"""
import urllib.request
import json
import sys

def run_api_tests():
    print("\n" + "="*60)
    print("RUNNING API INTEGRATION TESTS FOR LEAVE REPLACEMENT")
    print("="*60)
    
    # 1. Login to get Access Token
    print("\n[Step 1] Logging in as admin...")
    login_url = "http://127.0.0.1:8000/login"
    login_data = json.dumps({"username": "admin", "password": "admin123"}).encode("utf-8")
    req = urllib.request.Request(
        login_url,
        data=login_data,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as res:
            resp_data = json.loads(res.read().decode("utf-8"))
            token = resp_data.get("access_token")
            print("✓ Login successful. Token retrieved.")
    except Exception as e:
        print(f"✗ Login failed: {e}")
        sys.exit(1)
        
    auth_header = {"Authorization": f"Bearer {token}"}
    
    # 2. Test Fetching Replacement Candidates
    print("\n[Step 2] Fetching replacement candidates for 'Dev Lead 1'...")
    # Dev Lead 1 is employee ID 1, but we can query by name to be sure
    candidates_url = "http://127.0.0.1:8000/leaves/replacement-candidates?employee_name=Dev%20Lead%201&date=2026-06-01"
    req = urllib.request.Request(
        candidates_url,
        headers=auth_header
    )
    
    try:
        with urllib.request.urlopen(req) as res:
            candidates = json.loads(res.read().decode("utf-8"))
            print(f"✓ Successfully fetched {len(candidates)} replacement candidates.")
            for i, c in enumerate(candidates[:3]):
                print(f"  {i+1}. {c['name']} ({c['role']}) - Dept: {c['department']} | Workload: {c['weekly_hours']} hrs | Weekly Off: {c['is_weekly_off']}")
            
            if len(candidates) == 0:
                print("⚠ No candidates returned, but endpoint returned 200.")
            else:
                target_candidate_id = candidates[0]["id"]
    except Exception as e:
        print(f"✗ Fetching candidates failed: {e}")
        sys.exit(1)

    # 3. Test Manual Assignment of Replacement
    print("\n[Step 3] Assigning replacement candidate...")
    assign_url = "http://127.0.0.1:8000/leaves/assign-replacement"
    # We assign replacement for Dev Lead 1 (who has leave today)
    # Since we don't have Dev Lead 1's ID directly, we fetch it or hardcode.
    # Let's get Dev Lead 1's employee details first
    emp_url = "http://127.0.0.1:8000/employees"
    req = urllib.request.Request(emp_url, headers=auth_header)
    dev_lead_id = None
    try:
        with urllib.request.urlopen(req) as res:
            employees = json.loads(res.read().decode("utf-8"))
            for emp in employees:
                if emp["name"] == "Dev Lead 1":
                    dev_lead_id = emp["id"]
                    break
    except Exception as e:
        print(f"✗ Fetching employees failed: {e}")
        sys.exit(1)
        
    if not dev_lead_id:
        print("✗ Dev Lead 1 not found in employee list")
        sys.exit(1)
        
    assign_data = json.dumps({
        "employee_id": dev_lead_id,
        "replacement_id": target_candidate_id,
        "date": "2026-06-01"
    }).encode("utf-8")
    
    req = urllib.request.Request(
        assign_url,
        data=assign_data,
        headers={"Content-Type": "application/json", **auth_header}
    )
    
    try:
        with urllib.request.urlopen(req) as res:
            result = json.loads(res.read().decode("utf-8"))
            print(f"✓ Assignment response: {result['message']}")
            print("✓ API tests completed successfully.")
    except Exception as e:
        # If it failed because of double-shift or other constraints, print detailed message
        if hasattr(e, "read"):
            err_msg = e.read().decode("utf-8")
            print(f"✗ Assignment failed: {err_msg}")
        else:
            print(f"✗ Assignment failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_api_tests()
