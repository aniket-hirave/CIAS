# Campus Integrity & Anti-Ragging System
### UGC & AICTE Statutory Compliance Web Application with MySQL Database & Role-Based Access

A full-stack, responsive collegiate grievance redressal, anti-ragging deterrence, and whistleblower protection system. Powered by **Node.js + Express** with **MySQL Database persistence**, **Tailwind CSS**, and **Lucide Icons**.

---

## 🌟 What's New: MySQL Database & Role-Based Panels

### 1. MySQL Database Integration (`server.js`)
All complaints, 2-way chat messages, proctorial remarks, and user accounts are now permanently stored in MySQL:
- **`campus_users`**: Manages authenticated student accounts and administrative proctorial profiles.
- **`campus_complaints`**: Permanently records complaints with Tracking IDs, Secret PINs, categories, priority levels, GPS coords, and proctorial directives.
- **`campus_messages`**: Real-time anonymous 2-way chat messages linked directly to complaint records with timestamps.
- **Connection Configuration:** Configured in [`.env`](file:///d:/CEP%20FINAL/.env) with local MySQL host `127.0.0.1:3306`, user `ccts_user`, and database `corruption_db`.

---

### 2. Separate Student Panel & Admin Panel

#### 🎓 Student Panel (Authenticated & Anonymous)
- **Separate Student Login & Registration Modal:**
  - Enrolled students can log in using their college email and password, or register a new student account.
  - **1-Click Auto-Fill:** Test quickly with pre-configured student accounts.
- **Student Dashboard Sub-Navigation:**
  - **Lodge New Grievance:** Automatically pre-fills the credentials bar (Name, PRN, Department, Year, Division) while preserving the option to lodge anonymously under the Whistleblower protocol.
  - **My Lodged Grievances (History):** Displays all complaints filed by the authenticated student directly from MySQL, complete with live status badges, proctorial findings, and a 1-click button to jump directly into the tracking & 2-way chat terminal.
- **Anonymous Whistleblower Option:** Students in active distress or who wish to avoid logging in can still lodge completely anonymous complaints with zero identity retention.

#### 🛡️ Admin Panel (Proctorial Board Gateway)
- **Gated Security Access:**
  - The "Admin Panel" tab is protected behind a **Proctorial Board Authentication Gateway**.
  - Non-administrators and unauthenticated guests are greeted with an official access challenge.
- **Admin Dashboard Unlocked Upon Authentication:**
  - Real-time metric cards (Total Grievances, Active Investigations, Resolution Rate %, Whistleblower flags).
  - Geospatial Campus Incident Hotspots (Hostel B, Canteen, Labs) computed directly via SQL aggregation queries.
  - Live Incident Registry with priority badges (`CRITICAL`, `HIGH`, `MEDIUM`, `STANDARD`).
  - **Dossier & Chat Drawer:** Update complaint status (*Pending*, *Under Investigation*, *Action Taken*, *Resolved*), modify priority, write official findings, and chat with students.
  - **Statutory UGC Exports:** Download compliance CSV or generate an official printable UGC report with proctorial signatory blocks.

---

## 🔑 Pre-Configured Test Credentials

### 🛡️ Admin Panel Login
* **Email:** `admin@campus.edu.in`
* **Password:** `admin123`
* **Role:** `ADMIN` (Dr. S. K. Kulkarni - Chief Proctor & Ombudsman)

### 🎓 Student Panel Login
* **Student 1:**
  * **Email:** `student@campus.edu.in`
  * **Password:** `student123`
  * **Profile:** Rohan V. Sharma | PRN: `PRN-2023-88412` | Computer Engg (FE)
* **Student 2:**
  * **Email:** `ananya@campus.edu.in`
  * **Password:** `student123`
  * **Profile:** Ananya Deshmukh | PRN: `PRN-2024-55102` | IT (SE)

### 🔍 Quick Tracking Test Badges (Tab 2)
* **`CMP-2026-8F3A2K`** | PIN: `749201` (Anti-Ragging Critical - Hostel Block B - Has 2-way chat)
* **`CMP-2026-3B9X7Q`** | PIN: `418290` (Academic Bias - Resolved)
* **`CMP-2026-5N2V9R`** | PIN: `630142` (Irregular Lectures - Action Taken)
* **`CMP-2026-9P4W1T`** | PIN: `552189` (Hostel Infrastructure - Pending)

---

## 🚀 Running the System

The backend server is running live:
* **URL:** [**http://localhost:5000**](http://localhost:5000)

To start or restart the server manually:
```powershell
node server.js
```
The server will automatically:
1. Connect to MySQL (`127.0.0.1:3306`).
2. Verify and create all required tables (`campus_users`, `campus_complaints`, `campus_messages`).
3. Seed default admin, student accounts, and sample records.
4. Serve the responsive frontend and REST APIs on port 5000.
