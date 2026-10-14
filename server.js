const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname)));

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'ccts_user',
  password: process.env.DB_PASSWORD || 'ccts_password',
  database: process.env.DB_NAME || 'corruption_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Database Initialization (Schema + Default Seed Data)
async function initializeDatabase() {
  try {
    console.log('[MySQL] Initializing database tables...');

    // 1. Campus Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campus_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(191) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('STUDENT', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
        name VARCHAR(191) NOT NULL,
        prn VARCHAR(100) NULL,
        department VARCHAR(100) NULL,
        year VARCHAR(50) NULL,
        division VARCHAR(50) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Campus Complaints Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campus_complaints (
        id VARCHAR(50) PRIMARY KEY,
        pin VARCHAR(20) NOT NULL,
        user_id INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        incident_date VARCHAR(50) NOT NULL,
        category VARCHAR(100) NOT NULL,
        priority VARCHAR(50) NOT NULL,
        privacy_option ENUM('identified', 'anonymous') NOT NULL DEFAULT 'identified',
        whistleblower BOOLEAN DEFAULT FALSE,
        student_name VARCHAR(191) NOT NULL,
        student_erp VARCHAR(100) NOT NULL,
        student_email VARCHAR(191) NOT NULL,
        department VARCHAR(100) NOT NULL,
        year VARCHAR(50) NOT NULL,
        division VARCHAR(50) NOT NULL,
        building VARCHAR(150) NOT NULL,
        spot VARCHAR(255) NOT NULL,
        gps VARCHAR(150) NULL,
        witnesses TEXT NULL,
        description TEXT NOT NULL,
        files JSON NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        remarks TEXT NULL,
        remarks_date DATETIME NULL,
        FOREIGN KEY (user_id) REFERENCES campus_users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Campus 2-Way Chat Messages Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campus_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id VARCHAR(50) NOT NULL,
        sender ENUM('student', 'admin') NOT NULL,
        sender_name VARCHAR(191) NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES campus_complaints(id) ON DELETE CASCADE,
        INDEX idx_msg_complaint (complaint_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default users if table is empty
    const [userRows] = await pool.query('SELECT COUNT(*) as count FROM campus_users');
    if (userRows[0].count === 0) {
      console.log('[MySQL] Seeding default admin and student accounts...');
      await pool.query(`
        INSERT INTO campus_users (email, password, role, name, prn, department, year, division) VALUES
        ('admin@campus.edu.in', 'admin123', 'ADMIN', 'Dr. S. K. Kulkarni (Chief Proctor)', 'ADMIN-001', 'Proctorial Board', 'Faculty', 'Administration'),
        ('student@campus.edu.in', 'student123', 'STUDENT', 'Rohan V. Sharma', 'PRN-2023-88412', 'Computer Engineering', 'FE (First Year)', 'Division A'),
        ('ananya@campus.edu.in', 'student123', 'STUDENT', 'Ananya Deshmukh', 'PRN-2024-55102', 'Information Technology', 'SE (Second Year)', 'Division B');
      `);
    }

    // Seed sample complaints if empty
    const [complaintRows] = await pool.query('SELECT COUNT(*) as count FROM campus_complaints');
    if (complaintRows[0].count === 0) {
      console.log('[MySQL] Seeding initial sample complaints and 2-way messages...');

      // Sample 1: Anti-Ragging (Critical)
      await pool.query(`
        INSERT INTO campus_complaints 
        (id, pin, user_id, created_at, incident_date, category, priority, privacy_option, whistleblower, student_name, student_erp, student_email, department, year, division, building, spot, gps, witnesses, description, files, status, remarks, remarks_date)
        VALUES 
        ('CMP-2026-8F3A2K', '749201', 2, '2026-09-28 21:15:00', '2026-09-28 20:30', 'Anti-Ragging / Harassment', 'CRITICAL', 'anonymous', 1, 'Anonymous Student', 'PRN-XXXX-MASKED', 'protected-whistleblower@campus.edu.in', 'Computer Engineering', 'FE (First Year)', 'Division A', 'Hostel Block B (Boys)', '3rd Floor Common Washroom & Wing Corridor', '18.5204° N, 73.8567° E (±4m)', 'Senior students from 3rd Year Hostel Wing', 'During night hours after 10 PM, a group of 4 senior hostel residents coerced freshers into performing degrading tasks, physical exercises, and issued verbal abuse. When resisted, they threatened academic repercussions and room blockade.', JSON_ARRAY('hostel_corridor_audio_clip.mp3', 'threat_note_photo.jpg'), 'Under Investigation', 'Hostel Warden and Chief Proctor have been mobilized. CCTV records of 3rd floor corridor between 20:00 - 22:30 retrieved. Squad conducted surprise night inspection.', '2026-09-29 08:30:00');
      `);

      // Messages for Sample 1
      await pool.query(`
        INSERT INTO campus_messages (complaint_id, sender, sender_name, text, created_at) VALUES
        ('CMP-2026-8F3A2K', 'student', 'Student (Whistleblower)', 'Sir, they are threatening to corner us again tonight during dinner mess hours. Please ensure warden patrol is visible.', '2026-09-29 09:12:00'),
        ('CMP-2026-8F3A2K', 'admin', 'Chief Proctor & Anti-Ragging Cell', 'Strict security escort deployed at Hostel B mess. Two proctorial officers are stationed permanently on 3rd floor. Your identity remains 100% confidential. Stay safe.', '2026-09-29 09:45:00');
      `);

      // Sample 2: Academic Bias (High)
      await pool.query(`
        INSERT INTO campus_complaints 
        (id, pin, user_id, created_at, incident_date, category, priority, privacy_option, whistleblower, student_name, student_erp, student_email, department, year, division, building, spot, gps, witnesses, description, files, status, remarks, remarks_date)
        VALUES 
        ('CMP-2026-3B9X7Q', '418290', 3, '2026-09-26 14:20:00', '2026-09-26 11:00', 'Academic Bias / Faculty Targeting', 'HIGH', 'identified', 0, 'Ananya Deshmukh', 'PRN-2024-55102', 'ananya.d@campus.edu.in', 'Information Technology', 'SE (Second Year)', 'Division B', 'Computer Lab 304 / IT Block', 'Software Engineering Lab - Termwork Evaluation Room', '18.5210° N, 73.8572° E (±3m)', 'Class Representative and Lab batchmates', 'Faculty deliberately failed multiple submissions of our project group despite fully working Git repositories and complete documentation, citing personal disagreements during departmental council elections.', JSON_ARRAY('lab_report_evaluation_sheet.pdf', 'git_commit_log.png'), 'Resolved', 'Head of Department reviewed project evaluation rubrics in presence of an external subject matter expert. Marks reinstated as per actual technical deliverables. Faculty counseled.', '2026-09-28 16:00:00');
      `);

      // Messages for Sample 2
      await pool.query(`
        INSERT INTO campus_messages (complaint_id, sender, sender_name, text, created_at) VALUES
        ('CMP-2026-3B9X7Q', 'student', 'Ananya Deshmukh', 'Submitted original commit logs and timestamped Google Classroom records for cross-verification.', '2026-09-26 15:00:00'),
        ('CMP-2026-3B9X7Q', 'admin', 'Academic Grievance Redressal Board', 'External moderation complete. Revised rubric scores updated on the college ERP portal.', '2026-09-28 16:05:00');
      `);

      // Sample 3: Irregular Lectures (Medium)
      await pool.query(`
        INSERT INTO campus_complaints 
        (id, pin, user_id, created_at, incident_date, category, priority, privacy_option, whistleblower, student_name, student_erp, student_email, department, year, division, building, spot, gps, witnesses, description, files, status, remarks, remarks_date)
        VALUES 
        ('CMP-2026-5N2V9R', '630142', NULL, '2026-09-27 10:10:00', '2026-09-27 09:15', 'Irregular Lectures / Teaching Quality', 'MEDIUM', 'anonymous', 0, 'Anonymous Student', 'PRN-XXXX-MASKED', 'protected-student@campus.edu.in', 'Mechanical Engineering', 'TE (Third Year)', 'Division A', 'Mechanical Workshop', 'CNC Lab Room 102', '18.5218° N, 73.8560° E (±6m)', 'Whole TE Mechanical Batch', 'Robotics and Mechatronics practicals have been skipped for 4 consecutive weeks. Replacement faculty does not conduct lab experiments, leaving students unprepared for University practical exams.', JSON_ARRAY('attendance_and_lab_timetable.pdf'), 'Action Taken', 'Dean Academics arranged remedial practical sessions commencing this Saturday. Contract instructor assigned for CNC machine hands-on modules.', '2026-09-29 11:00:00');
      `);

      // Sample 4: Infrastructure (Standard)
      await pool.query(`
        INSERT INTO campus_complaints 
        (id, pin, user_id, created_at, incident_date, category, priority, privacy_option, whistleblower, student_name, student_erp, student_email, department, year, division, building, spot, gps, witnesses, description, files, status, remarks, remarks_date)
        VALUES 
        ('CMP-2026-9P4W1T', '552189', NULL, '2026-09-29 18:40:00', '2026-09-29 17:30', 'Infrastructure / Hostel Issue', 'STANDARD', 'identified', 0, 'Kavita Nair', 'PRN-2025-11029', 'kavita.n@campus.edu.in', 'Electronics & Telecom', 'FE (First Year)', 'Hostel Resident Wing', 'Hostel Block A (Girls)', 'Ground Floor Water Purifier & Mess Exit Gate', '18.5198° N, 73.8580° E (±5m)', 'Block A residents', 'Water filtration plant has been leaking contaminated water near the hostel entrance. Security light near the rear garden has been non-functional for 5 days.', JSON_ARRAY('water_purifier_leak.jpg'), 'Pending', 'Work order forwarded to Estate Office & Campus Engineering Maintenance crew.', '2026-09-29 19:00:00');
      `);
    }

    console.log('[MySQL] Database tables and initial seed data are ready!');
  } catch (err) {
    console.error('[MySQL Error] Database initialization failed:', err);
  }
}

// ==========================================
// REST API ROUTES
// ==========================================

// Health / Status
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as connected');
    res.json({ status: 'ok', mysql: 'connected', timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ status: 'error', mysql: err.message });
  }
});

// Authentication: Login for Student & Admin Panels
app.post('/api/auth/login', async (req, res) => {
  const { email, password, requiredRole } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email, password, role, name, prn, department, year, division FROM campus_users WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const user = rows[0];

    // Simple password check (for demo simplicity)
    if (user.password !== password.trim()) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    // Role check if login screen demanded specific role
    if (requiredRole && user.role.toUpperCase() !== requiredRole.toUpperCase()) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This portal requires ${requiredRole.toUpperCase()} credentials.`
      });
    }

    // Strip password from response
    delete user.password;
    res.json({ success: true, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during authentication' });
  }
});

// Authentication: Register New Student
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, prn, department, year, division } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM campus_users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const [result] = await pool.query(
      'INSERT INTO campus_users (name, email, password, role, prn, department, year, division) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name.trim(), email.trim(), password.trim(), 'STUDENT', prn || null, department || null, year || null, division || null]
    );

    const user = {
      id: result.insertId,
      name: name.trim(),
      email: email.trim(),
      role: 'STUDENT',
      prn,
      department,
      year,
      division
    };

    res.status(201).json({ success: true, user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Registration failed due to a database error' });
  }
});

// Complaints: Get All (or filter by userId for logged-in student)
app.get('/api/complaints', async (req, res) => {
  const { userId, category, status } = req.query;

  try {
    let sql = 'SELECT * FROM campus_complaints WHERE 1=1';
    const params = [];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    if (category && category !== 'ALL') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (status && status !== 'ALL') {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const [complaints] = await pool.query(sql, params);

    // Fetch messages for each complaint
    for (const c of complaints) {
      const [messages] = await pool.query(
        'SELECT id, complaint_id, sender, sender_name as senderName, text, created_at as timestamp FROM campus_messages WHERE complaint_id = ? ORDER BY created_at ASC',
        [c.id]
      );
      c.messages = messages;
      c.whistleblower = Boolean(c.whistleblower);
      c.createdAt = c.created_at;
      c.incidentDate = c.incident_date;
      c.privacyOption = c.privacy_option;
      c.studentName = c.student_name;
      c.studentErp = c.student_erp;
      c.studentEmail = c.student_email;
      c.remarksDate = c.remarks_date;
      if (typeof c.files === 'string') {
        try { c.files = JSON.parse(c.files); } catch (_) { c.files = []; }
      }
    }

    res.json({ success: true, complaints });
  } catch (err) {
    console.error('Fetch complaints error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve complaints from MySQL' });
  }
});

// Complaints: Create New Complaint
app.post('/api/complaints', async (req, res) => {
  const data = req.body;

  // Generate Tracking ID and Secret PIN
  const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
  const id = `CMP-2026-${randomChars}`;
  const pin = Math.floor(100000 + Math.random() * 900000).toString();

  // Priority mapping
  let priority = data.priority || 'MEDIUM';
  if (data.category === 'Anti-Ragging / Harassment') priority = 'CRITICAL';
  else if (data.category === 'Academic Bias / Faculty Targeting') priority = 'HIGH';
  else if (data.category === 'Infrastructure / Hostel Issue') priority = 'STANDARD';

  const isAnonymous = data.privacyOption === 'anonymous';
  const studentName = isAnonymous ? 'Anonymous Student' : (data.studentName || 'Student');
  const studentErp = isAnonymous ? 'PRN-XXXX-MASKED' : (data.studentErp || 'PRN-XXXX');
  const studentEmail = isAnonymous ? 'protected-whistleblower@campus.edu.in' : (data.studentEmail || 'student@campus.edu');

  const filesJson = JSON.stringify(data.files || []);

  try {
    await pool.query(`
      INSERT INTO campus_complaints 
      (id, pin, user_id, created_at, incident_date, category, priority, privacy_option, whistleblower, student_name, student_erp, student_email, department, year, division, building, spot, gps, witnesses, description, files, status, remarks, remarks_date)
      VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Complaint registered into Central Anti-Ragging Register. Under Proctorial intake review.', NOW())
    `, [
      id,
      pin,
      data.userId || null,
      data.incidentDate || new Date().toISOString().slice(0, 16),
      data.category,
      priority,
      data.privacyOption || 'identified',
      data.whistleblower ? 1 : 0,
      studentName,
      studentErp,
      studentEmail,
      data.department || 'General',
      data.year || 'FE (First Year)',
      data.division || 'Division A',
      data.building || 'Campus Central',
      data.spot || 'Unspecified Spot',
      data.gps || '18.5204° N, 73.8567° E (Campus Zone)',
      data.witnesses || '',
      data.description,
      filesJson
    ]);

    const newRecord = {
      id,
      pin,
      category: data.category,
      priority,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    res.status(201).json({ success: true, id, pin, complaint: newRecord });
  } catch (err) {
    console.error('Create complaint error:', err);
    res.status(500).json({ success: false, message: 'Database error saving complaint to MySQL' });
  }
});

// Complaints: Track by ID & PIN
app.post('/api/complaints/track', async (req, res) => {
  const { id, pin } = req.body;

  if (!id || !pin) {
    return res.status(400).json({ success: false, message: 'Both Tracking ID and 6-Digit PIN are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM campus_complaints WHERE UPPER(id) = UPPER(?) AND pin = ?',
      [id.trim(), pin.trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid Tracking ID or Secret PIN' });
    }

    const c = rows[0];
    const [messages] = await pool.query(
      'SELECT id, complaint_id, sender, sender_name as senderName, text, created_at as timestamp FROM campus_messages WHERE complaint_id = ? ORDER BY created_at ASC',
      [c.id]
    );

    c.messages = messages;
    c.whistleblower = Boolean(c.whistleblower);
    c.createdAt = c.created_at;
    c.incidentDate = c.incident_date;
    c.privacyOption = c.privacy_option;
    c.studentName = c.student_name;
    c.studentErp = c.student_erp;
    c.studentEmail = c.student_email;
    c.remarksDate = c.remarks_date;
    if (typeof c.files === 'string') {
      try { c.files = JSON.parse(c.files); } catch (_) { c.files = []; }
    }

    res.json({ success: true, complaint: c });
  } catch (err) {
    console.error('Track complaint error:', err);
    res.status(500).json({ success: false, message: 'Error checking complaint in MySQL' });
  }
});

// Complaints: Update Status & Remarks (Admin only)
// Complaints: Update Status & Remarks (Admin only)
app.put('/api/complaints/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, priority, remarks } = req.body;

  try {
    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (remarks !== undefined) {
      updates.push('remarks = ?');
      params.push(remarks);
    }
    updates.push('remarks_date = NOW()');

    if (updates.length === 1) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(id);
    const sql = `UPDATE campus_complaints SET ${updates.join(', ')} WHERE id = ?`;
    await pool.query(sql, params);

    res.json({ success: true, message: `Complaint ${id} updated successfully` });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update complaint in MySQL' });
  }
});

// 2-Way Chat: Post Message
app.post('/api/complaints/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { sender, senderName, text } = req.body;

  if (!text || !sender) {
    return res.status(400).json({ success: false, message: 'Message text and sender are required' });
  }

  try {
    await pool.query(
      'INSERT INTO campus_messages (complaint_id, sender, sender_name, text, created_at) VALUES (?, ?, ?, ?, NOW())',
      [id, sender, senderName || (sender === 'admin' ? 'Ombudsman' : 'Student'), text.trim()]
    );

    const [messages] = await pool.query(
      'SELECT id, complaint_id, sender, sender_name as senderName, text, created_at as timestamp FROM campus_messages WHERE complaint_id = ? ORDER BY created_at ASC',
      [id]
    );

    res.status(201).json({ success: true, messages });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, message: 'Failed to store chat message in MySQL' });
  }
});

// Analytics: Metric Cards, Hotspots & Distribution
app.get('/api/analytics', async (req, res) => {
  try {
    const [totalRows] = await pool.query('SELECT COUNT(*) as total FROM campus_complaints');
    const [pendingRows] = await pool.query("SELECT COUNT(*) as pending FROM campus_complaints WHERE status != 'Resolved'");
    const [criticalRows] = await pool.query("SELECT COUNT(*) as critical FROM campus_complaints WHERE priority = 'CRITICAL' AND status != 'Resolved'");
    const [resolvedRows] = await pool.query("SELECT COUNT(*) as resolved FROM campus_complaints WHERE status = 'Resolved'");
    const [whistleRows] = await pool.query('SELECT COUNT(*) as whistleblower FROM campus_complaints WHERE whistleblower = 1');

    const [hotspots] = await pool.query(`
      SELECT building as location, COUNT(*) as count 
      FROM campus_complaints 
      GROUP BY building 
      ORDER BY count DESC
    `);

    const [categories] = await pool.query(`
      SELECT category as name, COUNT(*) as count 
      FROM campus_complaints 
      GROUP BY category 
      ORDER BY count DESC
    `);

    const total = totalRows[0].total || 0;
    const resolved = resolvedRows[0].resolved || 0;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    res.json({
      success: true,
      metrics: {
        total,
        pending: pendingRows[0].pending || 0,
        critical: criticalRows[0].critical || 0,
        resolved,
        resolutionRate,
        whistleblower: whistleRows[0].whistleblower || 0
      },
      hotspots,
      categories
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute MySQL analytics' });
  }
});

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Express Server
app.listen(PORT, async () => {
  console.log(`[Express] Campus Integrity Server running on http://localhost:${PORT}`);
  await initializeDatabase();
});
