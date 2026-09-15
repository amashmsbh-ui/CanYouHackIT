# 🚌 CanYouHackIT - Campus Bus Ticketing & Transit System

CanYouHackIT is a real-time online campus transit and bus ticketing platform designed to streamline campus bus bookings, real-time ticket scanning, driver assignment, and live notifications.

---

## 📋 Table of Contents
- [Prerequisites](#-prerequisites)
- [Recommended VS Code Extensions](#-recommended-vs-code-extensions)
- [Step-by-Step Localhost Setup in VS Code](#-step-by-step-localhost-setup-in-vs-code)
  - [1. Open Project in VS Code](#1-open-project-in-vs-code)
  - [2. Open Integrated Terminal](#2-open-integrated-terminal)
  - [3. Configure Environment Variables (.env)](#3-configure-environment-variables-env)
  - [4. Install Dependencies](#4-install-dependencies)
  - [5. Setup & Seed Database](#5-setup--seed-database)
  - [6. Start Localhost Server](#6-start-localhost-server)
  - [7. Open in Browser](#7-open-in-browser)
- [Available Web Pages & Port Details](#-available-web-pages--port-details)
- [Useful Terminal Commands](#-useful-terminal-commands)
- [Troubleshooting](#-troubleshooting)

---

## 🛠️ Prerequisites

Before starting, ensure you have installed:
1. **[Node.js](https://nodejs.org/)** (v18 or higher recommended)
2. **[Visual Studio Code (VS Code)](https://code.visualstudio.com/)**
3. **[Git](https://git-scm.com/)**

Verify Node.js and NPM installation by running these commands in your command prompt or terminal:
```bash
node -v
npm -v
```

---

## 🔌 Recommended VS Code Extensions

For the best development experience in VS Code, install the following extensions:
* **Prisma** (`Prisma.prisma`) – Syntax highlighting and formatting for Prisma ORM schema files.
* **Prettier** (`esbenp.prettier-vscode`) – Code formatter.
* **DotENV** (`mikestead.dotenv`) – Syntax highlighting for `.env` files.

---

## 🚀 Step-by-Step Localhost Setup in VS Code

### 1. Open Project in VS Code
1. Launch **VS Code**.
2. Go to **File** ➔ **Open Folder...** (or press `Ctrl + K, Ctrl + O`).
3. Select the `CanYouHackIT` folder. 
   *(Note: If you opened the outer `CanYouHack-IT` repository folder, navigate into `CanYouHackIT` in your terminal).*

---

### 2. Open Integrated Terminal & Navigate to Project Directory
Inside VS Code, open the built-in terminal:
- Press **`Ctrl + ~`** (backtick) OR menu **Terminal ➔ New Terminal**.

If your terminal prompt shows the root repository (`CanYouHack-IT`), change directory into `CanYouHackIT`:
```bash
cd CanYouHackIT
```

---

### 3. Configure Environment Variables (`.env`)
Check if a `.env` file exists in the root directory. If not, create one from `.env.example`:

**On PowerShell / Command Prompt in VS Code:**
```powershell
copy .env.example .env
```

Ensure your `.env` contains the following settings for local SQLite execution:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="super_secret_jwt_key_here"
PORT=3000
RAZORPAY_KEY_ID="rzp_test_key"
RAZORPAY_KEY_SECRET="rzp_test_secret"
```

---

### 4. Install Dependencies
In the VS Code terminal, execute:
```bash
npm install
```
*This installs all required npm packages (Express, Prisma, Socket.io, JWT, bcrypt, etc.).*

---

### 5. Setup & Seed Database
Initialize Prisma ORM and SQLite database (`dev.db`):

1. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

2. **Sync Database Schema:**
   ```bash
   npx prisma db push
   ```

3. **(Optional) Seed Trips & Test Data:**
   ```bash
   node scripts/seed_trips.js
   ```

---

### 6. Start Localhost Server
Run the application server:
```bash
npm start
```
*Alternatively, you can run:*
```bash
node server.js
```

You should see output similar to:
```text
Server running on port 3000
New client connected: <socket_id>
```

---

### 7. Open in Browser
Open your web browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🌐 Available Web Pages & Port Details

| Page / Route | URL Path | Description |
| :--- | :--- | :--- |
| **Main Portal / Login** | `http://localhost:3000/index.html` or `http://localhost:3000/1st.html` | Student portal, login & ticket booking |
| **Conductor Mode** | `http://localhost:3000/conductor.html` | Real-time ticket QR scanner for conductors |
| **Admin Dashboard** | `http://localhost:3000/admin.html` | Bus fleet management & user control |
| **API Endpoints** | `http://localhost:3000/api/...` | Express REST API backend endpoints |

---

## 📜 Useful Terminal Commands

| Command | Action |
| :--- | :--- |
| `npm start` | Runs the server on `http://localhost:3000` |
| `npx prisma studio` | Opens an interactive UI in browser to inspect/edit database tables (`dev.db`) |
| `node scripts/list_users.js` | Lists registered database users |
| `node scripts/seed_trips.js` | Seeds test trips into the database |
| `node scripts/reset_conductor.js` | Resets conductor credentials for testing |

---

## ❓ Troubleshooting

### 1. `npm.ps1 cannot be loaded because running scripts is disabled` (PowerShell Error)
This is caused by Windows PowerShell execution security policy.
* **Quickest Fix (Run in VS Code terminal):**
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```
  *(Select `A` for Yes to All if prompted).*
* **Alternative Quick Workaround:** Use `npm.cmd` instead of `npm`:
  ```cmd
  npm.cmd install
  npm.cmd start
  ```
* **Or switch terminal to Command Prompt (cmd):** Click the `+` dropdown in VS Code terminal and select **Command Prompt**.

### 2. `EADDRINUSE: port 3000 is already in use`
If port 3000 is occupied by another process:
* **Option A**: Change `PORT=3001` in your `.env` file and restart.
* **Option B**: Stop the running process using port 3000:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
  ```

### 2. `Prisma Client unable to connect`
* Make sure `DATABASE_URL="file:./dev.db"` is set correctly in `.env`.
* Re-run `npx prisma db push` to generate/update `prisma/dev.db`.

### 3. Changes not reflecting
* Refresh your browser page with `Ctrl + F5` (Hard Refresh).
* If backend routes changed, restart the server in VS Code by pressing `Ctrl + C` in the terminal and running `npm start`.

---

✨ **Happy Coding!** If you encounter any issues, check the VS Code terminal logs for detailed output.