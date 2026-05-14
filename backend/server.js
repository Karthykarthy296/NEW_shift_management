const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 8000;
const SECRET_KEY = "supersecretkey_shift_system";
const DB_PATH = path.join(__dirname, 'shift_db.db');

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

app.use(bodyParser.json());
app.use(express.static('uploads'));

const db = new sqlite3.Database(DB_PATH);

// Create uploads directory if not exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Middleware for JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token || token === 'null' || token === 'undefined') {
        console.warn(`[Auth] 401 Unauthorized: Missing or invalid token for ${req.method} ${req.url}`);
        return res.sendStatus(401);
    }

    jwt.verify(token, SECRET_KEY, (err, payload) => {
        if (err) {
            console.error(`[Auth] 403 Forbidden: JWT Verification Failed for ${req.method} ${req.url}`, err.message);
            return res.sendStatus(403);
        }
        req.user = payload;
        req.user.username = payload.sub; // Align for internal use
        next();
    });
};

// Login Route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user) return res.status(400).json({ detail: "User not found" });
        
        // Passlib bcrypt hashes are compatible with bcryptjs verify
        if (bcrypt.compareSync(password, user.password_hash)) {
            const token = jwt.sign({ sub: user.username, role: user.role }, SECRET_KEY);
            res.json({ access_token: token, token_type: "bearer", role: user.role });
        } else {
            res.status(400).json({ detail: "Invalid password" });
        }
    });
});

// User Management (Admin only)
app.get('/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    db.all("SELECT id, username, role FROM users", [], (err, rows) => {
        res.json(rows || []);
    });
});

app.delete('/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    db.run("DELETE FROM users WHERE id = ?", [req.params.id], function(err) {
        res.json({ msg: "User deleted" });
    });
});


// ─── Predefined Shifts (4 fixed shifts, timings editable by Admin/Manager) ────
const PREDEFINED_SHIFTS = [
    { name: 'Morning',   start_time: '06:00', end_time: '12:00', required_employees: 2 },
    { name: 'Afternoon', start_time: '12:00', end_time: '18:00', required_employees: 2 },
    { name: 'Evening',   start_time: '18:00', end_time: '00:00', required_employees: 2 },
    { name: 'Night',     start_time: '00:00', end_time: '06:00', required_employees: 2 },
];

const seedPredefinedShifts = () => {
    PREDEFINED_SHIFTS.forEach(shift => {
        db.run(
            `INSERT OR IGNORE INTO shifts (name, start_time, end_time, required_employees) VALUES (?, ?, ?, ?)`,
            [shift.name, shift.start_time, shift.end_time, shift.required_employees],
            (err) => { if (err) console.error('Shift seed error:', err); }
        );
    });
    console.log('[Startup] 4 predefined shifts seeded: Morning, Afternoon, Evening, Night');
};

const seedAdminUser = () => {
    const username = 'admin';
    const password = 'admin123';
    const role = 'admin';
    
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (!row) {
            const hash = bcrypt.hashSync(password, 10);
            db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [username, hash, role], (err) => {
                if (err) console.error('[Startup] Admin creation failed:', err);
                else console.log('[Startup] Default admin created (admin/admin123)');
            });
        } else {
            // Re-hash password to ensure compatibility with bcryptjs
            const hash = bcrypt.hashSync(password, 10);
            db.run("UPDATE users SET password_hash = ? WHERE username = ?", [hash, username], (err) => {
                if (err) console.error('[Startup] Admin re-hash failed:', err);
                else console.log('[Startup] Default admin password re-hashed for compatibility');
            });
        }
    });

    // Also ensure manager and supervisor exist
    const users = [
        { u: 'manager', p: 'manager123', r: 'manager' },
        { u: 'supervisor', p: 'supervisor123', r: 'supervisor' }
    ];

    users.forEach(user => {
        db.get("SELECT * FROM users WHERE username = ?", [user.u], (err, row) => {
            if (!row) {
                const hash = bcrypt.hashSync(user.p, 10);
                db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [user.u, hash, user.r]);
            } else {
                const hash = bcrypt.hashSync(user.p, 10);
                db.run("UPDATE users SET password_hash = ? WHERE username = ?", [hash, user.u]);
            }
        });
    });
};

// ─── Dashboard Summary ──────────────────────────────────────────────────────
app.get('/dashboard-summary', authenticateToken, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Use a single promise for all counts
    Promise.all([
        new Promise((resolve) => db.get("SELECT COUNT(*) as count FROM employees", (err, row) => resolve(row?.count || 0))),
        new Promise((resolve) => db.get("SELECT COUNT(*) as count FROM shifts", (err, row) => resolve(row?.count || 0))),
        new Promise((resolve) => db.get("SELECT COUNT(*) as count FROM leaves WHERE date = ?", [today], (err, row) => resolve(row?.count || 0))),
        new Promise((resolve) => {
            const query = `
                SELECT s.name, COUNT(sch.id) as count
                FROM shifts s
                LEFT JOIN schedules sch ON s.id = sch.shift_id AND sch.date = ?
                GROUP BY s.name`;
            db.all(query, [today], (err, rows) => {
                const shiftData = {};
                rows?.forEach(r => shiftData[r.name] = r.count);
                resolve(shiftData);
            });
        })
    ]).then(([empCount, shiftCount, leaveCount, shiftAssignments]) => {
        res.json({
            total_employees: empCount,
            active_shifts: shiftCount,
            today_leaves: leaveCount,
            shift_assignments: shiftAssignments
        });
    }).catch(err => {
        console.error('Dashboard summary error:', err);
        res.status(500).json({ error: err.message });
    });
});

// ─── Employee Excel Upload (only) ─────────────────────────────────────────────
app.post('/upload-excel', authenticateToken, upload.single('file'), (req, res) => {
    if (req.user.role !== 'manager' && req.user.role !== 'admin') return res.sendStatus(403);

    const type = req.query.type;

    // Only employees upload is allowed; shifts are predefined internally
    if (type !== 'employees') {
        return res.status(400).json({ detail: "Only 'employees' upload is supported. Shifts are predefined by the system." });
    }

    if (!req.file) return res.status(400).json({ detail: "No file uploaded" });
    const filePath = req.file.path;
    const today    = new Date().toISOString().split('T')[0];

    // Delegate ALL parsing and scheduling to Python (single source of truth)
    // Python reads the Excel, upserts employees, reads current shift timings
    // from DB (including any Admin/Manager edits), then runs the AI engine.
    const pythonExe = path.join(__dirname, 'venv', 'Scripts', 'python');
    const pyScript  = `
import ai_scheduler, sys
from database import SessionLocal
db = SessionLocal()
try:
    result = ai_scheduler.parse_combined_excel(r'${filePath}', db)
    ai_scheduler.generate_ai_schedule(db, '${today}')
    print(f'OK:{result}')
except Exception as e:
    print(f'ERR:{e}', file=sys.stderr)
    sys.exit(1)
finally:
    db.close()
`.trim();

    const runPython = (exe, cb) => {
        exec(`"${exe}" -c "${pyScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
            { cwd: __dirname }, cb);
    };

    console.log(`[Upload] Handing off to Python AI pipeline: ${filePath}`);
    runPython(pythonExe, (err, stdout, stderr) => {
        if (err) {
            // Fallback to global python
            exec(`python -c "${pyScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
                { cwd: __dirname }, (err2, stdout2, stderr2) => {
                    if (err2) {
                        console.error('[Upload] Python AI failed:', stderr2 || err2.message);
                        return res.status(500).json({ detail: `AI processing failed: ${stderr2 || err2.message}` });
                    }
                    const line = stdout2.trim();
                    const count = line.startsWith('OK:') ? line.slice(3) : '?';
                    res.json({ msg: `✅ ${count} employees stored. AI has read current shift timings from database and generated an optimized schedule.` });
                });
            return;
        }
        const line  = stdout.trim();
        const count = line.startsWith('OK:') ? line.slice(3) : '?';
        console.log(`[Upload] Python AI complete. ${count} employees processed.`);
        res.json({ msg: `✅ ${count} employees stored. AI analyzed current shift timings from database and generated an optimized schedule.` });
    });
});



// Helper function to trigger AI
const triggerAIScheduler = (date) => {
    const today = date || new Date().toISOString().split('T')[0];
    const pythonExe = path.join(__dirname, 'venv', 'Scripts', 'python');
    const pythonCmd = `"${pythonExe}" -c "import ai_scheduler; from database import SessionLocal; db=SessionLocal(); ai_scheduler.generate_ai_schedule(db, '${today}')"`;
    
    return new Promise((resolve, reject) => {
        exec(pythonCmd, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                console.error(`AI Error: ${error}`);
                // Fallback
                exec(`python -c "import ai_scheduler; from database import SessionLocal; db=SessionLocal(); ai_scheduler.generate_ai_schedule(db, '${today}')"`, { cwd: __dirname }, (err2) => {
                    if (err2) reject(err2);
                    else resolve();
                });
            } else {
                resolve();
            }
        });
    });
};

// --- Employee Management ---
app.get('/employees', authenticateToken, (req, res) => {
    db.all("SELECT * FROM employees", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({ ...r, skills: JSON.parse(r.skills || '[]') })));
    });
});

app.post('/employees', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.sendStatus(403);
    const { emp_id, name, skills, preferred_shift, max_hours } = req.body;
    const skillsJson = JSON.stringify(skills || []);
    db.run("INSERT INTO employees (emp_id, name, skills, preferred_shift, max_hours) VALUES (?, ?, ?, ?, ?)",
        [emp_id, name, skillsJson, preferred_shift, max_hours], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            triggerAIScheduler().then(() => res.json({ id: this.lastID, msg: "Employee added and schedule reprocessed" }))
                .catch(e => res.json({ id: this.lastID, msg: "Employee added but AI failed" }));
        });
});

app.put('/employees/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.sendStatus(403);
    const { emp_id, name, skills, preferred_shift, max_hours } = req.body;
    const skillsJson = JSON.stringify(skills || []);
    db.run("UPDATE employees SET emp_id=?, name=?, skills=?, preferred_shift=?, max_hours=? WHERE id=?",
        [emp_id, name, skillsJson, preferred_shift, max_hours, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            triggerAIScheduler().then(() => res.json({ msg: "Employee updated and schedule reprocessed" }))
                .catch(e => res.json({ msg: "Employee updated but AI failed" }));
        });
});

app.delete('/employees/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.sendStatus(403);
    db.run("DELETE FROM employees WHERE id=?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        triggerAIScheduler().then(() => res.json({ msg: "Employee deleted and schedule reprocessed" }))
            .catch(e => res.json({ msg: "Employee deleted but AI failed" }));
    });
});

// --- Shift Management ---
app.get('/shifts', authenticateToken, (req, res) => {
    db.all("SELECT * FROM shifts", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Shifts are predefined — creation and deletion are disabled.
// Admin/Manager MAY update shift timings and staff count.
app.post('/shifts', authenticateToken, (req, res) => {
    res.status(403).json({ detail: "Shifts are fixed by the system. You cannot create new shifts." });
});

// ✅ Allow Admin/Manager to edit shift timings
app.put('/shifts/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.sendStatus(403);
    const { start_time, end_time, required_employees } = req.body;
    if (!start_time || !end_time) return res.status(400).json({ error: 'start_time and end_time are required' });
    db.run(
        "UPDATE shifts SET start_time=?, end_time=?, required_employees=? WHERE id=?",
        [start_time, end_time, required_employees || 2, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Shift not found' });
            console.log(`[Shift] ID ${req.params.id} updated to ${start_time}-${end_time}. Triggering AI...`);
            triggerAIScheduler()
                .then(() => res.json({ msg: `Shift timing updated and AI schedule regenerated.` }))
                .catch(() => res.json({ msg: `Shift timing updated. AI scheduling failed — check server.` }));
        }
    );
});

app.delete('/shifts/:id', authenticateToken, (req, res) => {
    res.status(403).json({ detail: "Shifts are fixed by the system. You cannot delete predefined shifts." });
});

// --- Manual Schedule Override ---
app.put('/update-schedule', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.sendStatus(403);
    const { date, shift_id, old_employee_id, new_employee_id } = req.body;
    
    // Update a single assignment
    db.run("UPDATE schedules SET employee_id = ? WHERE date = ? AND shift_id = ? AND employee_id = ?",
        [new_employee_id, date, shift_id, old_employee_id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ msg: "Schedule manually updated" });
        });
});

// Get Schedule
app.get('/get-schedule', authenticateToken, (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    const query = `
        SELECT s.name as shift_name, s.start_time, s.end_time, e.emp_id, e.name as emp_name 
        FROM schedules sch
        JOIN shifts s ON sch.shift_id = s.id
        JOIN employees e ON sch.employee_id = e.id
        WHERE sch.date = ?`;


    db.all(query, [date], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const result = {};
        rows.forEach(row => {
            if (!result[row.shift_name]) {
                result[row.shift_name] = {
                    shift_details: { start: row.start_time, end: row.end_time },
                    employees: []
                };
            }
            result[row.shift_name].employees.push({ id: row.emp_id, name: row.emp_name });
        });
        res.json(result);
    });
});
// Apply Leave (Supervisor, Manager, Admin)
app.post('/apply-leave', authenticateToken, (req, res) => {
    if (req.user.role !== 'supervisor' && req.user.role !== 'manager' && req.user.role !== 'admin') return res.sendStatus(403);
    const { employee_name, date } = req.body;

    db.get("SELECT id FROM employees WHERE name = ?", [employee_name], (err, emp) => {
        if (err || !emp) return res.status(404).json({ detail: "Employee not found" });

        db.run("INSERT INTO leaves (employee_id, date) VALUES (?, ?)", [emp.id, date], function(err) {
            if (err) return res.status(500).json({ error: err.message });

            // Trigger AI reassignment
            const pythonExe = path.join(__dirname, 'venv', 'Scripts', 'python');
            const pythonCmd = `"${pythonExe}" -c "import ai_scheduler; from database import SessionLocal; db=SessionLocal(); ai_scheduler.reassign_shift(db, ${emp.id}, '${date}')"`;

            exec(pythonCmd, { cwd: __dirname }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`AI Reassign Error: ${error}`);
                    return res.status(500).json({ detail: "AI Reassignment Failed" });
                }
                res.json({ msg: `Leave applied and shifts reassigned for ${employee_name}` });
            });
        });
    });
});

app.listen(port, () => {
    console.log(`Node.js server running at http://localhost:${port}`);
    // Seed predefined shifts so AI always has them available
    seedPredefinedShifts();
    seedAdminUser();
});
