# 🚀 Full Deployment Guide for CanYouHackIT

This guide provides step-by-step instructions on how to deploy your **IIITDMJ Smart Transit & Ticket System** so that it is **100% fully functioning** (Frontend, Express Backend, Prisma Database, Authentication, and Real-Time WebSockets).

---

## 📌 Architecture Overview

Your application consists of:
1. **Frontend**: Static HTML, Tailwind CSS, & JavaScript in `/frontend`
2. **Backend**: Node.js & Express API in `server.js`
3. **Realtime Engine**: Socket.io for live notifications and ticket updates
4. **Database**: Prisma ORM with SQLite (`prisma/dev.db`)
5. **Scheduler**: Background cron jobs (`node-cron`) for automated trip management

---

## 🌟 Option 1: 1-Click Deployment on Render via GitHub (Recommended)

Since your project uses **WebSockets (`socket.io`)**, **background cron jobs (`node-cron`)**, and **Prisma SQLite**, hosting it as a continuous Node.js Web Service on **Render** (free tier) directly from your **GitHub** repo is the easiest and most reliable solution.

### Step 1: Push latest code to GitHub
Make sure all your latest files are on your GitHub repo:
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Create a New Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and sign in with your **GitHub** account.
2. Click **New +** > **Web Service**.
3. Select your GitHub repository: `amashmsbh-ui/CanYouHackIT`.
4. Configure the service settings:
   - **Name**: `canyouhackit` (or your preferred name)
   - **Region**: `Singapore` or nearest to your location
   - **Branch**: `main`
   - **Root Directory**: *(Leave empty)*
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npx prisma db push
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Instance Type**: `Free`

### Step 3: Add Environment Variables
In the **Environment Variables** section on Render, add:
| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production mode |
| `PORT` | `3000` | Port for Express server |
| `DATABASE_URL` | `file:./dev.db` | SQLite database connection |
| `JWT_SECRET` | `KKA84mSaHDfwNQacuafUDcH9AtnRYm8OwJpilVwmSKi` | Secret key for JWT auth |
| `RAZORPAY_KEY_ID` | `rzp_test_Tc0Lf8lICpJbkN` | *(Optional) Razorpay Key* |
| `RAZORPAY_KEY_SECRET` | `ZtzSM2TD9qpVH5DzhpPWBh75` | *(Optional) Razorpay Secret* |

### Step 4: Deploy & Seed Data
1. Click **Create Web Service**. Render will clone your GitHub repo, run the build command, and start the app.
2. Once deployed, open the **Shell** tab in Render's dashboard and run the seed script to import students and create trips:
   ```bash
   node scripts/import_students.js
   node scripts/seed_trips.js
   ```
3. Your app is now live at: `https://canyouhackit.onrender.com`!

---

## ⚡ Option 2: Deploy Frontend on Vercel + Backend on Render / Railway

If you specifically want your frontend hosted on **Vercel**:

### Step 1: Deploy Backend to Render (as described in Option 1)
Follow Option 1 to get your backend URL, for example: `https://canyouhackit.onrender.com`.

### Step 2: Point Frontend to your Backend
In `frontend/state.js`, set your live backend URL at the top:
```javascript
window.API_BASE_URL = 'https://canyouhackit.onrender.com';
```
Commit and push this change to GitHub:
```bash
git add frontend/state.js
git commit -m "Configure production backend URL for Vercel"
git push origin main
```

### Step 3: Deploy Frontend on Vercel
1. Log in to [Vercel](https://vercel.com/) with GitHub.
2. Click **Add New...** > **Project**.
3. Import your GitHub repository: `amashmsbh-ui/CanYouHackIT`.
4. In the configuration screen:
   - **Framework Preset**: `Other`
   - **Root Directory**: Click `Edit` and select `frontend`
   - **Build Command**: *(Leave empty)*
   - **Output Directory**: `.` *(or Leave empty)*
5. Click **Deploy**.
6. Vercel will deploy your frontend to a URL like `https://canyouhackit.vercel.app`!

---

## 🚀 Option 3: Deploy Directly to Vercel using `vercel.json` (Serverless API)

If you want to host both frontend and backend APIs completely within Vercel:

> [!WARNING]
> Vercel runs backend code as **Serverless Functions**. Serverless functions are stateless, meaning:
> - Local SQLite (`dev.db`) resets on each cold start. For persistent data on Vercel, use a cloud database (PostgreSQL via Supabase, Neon, or PlanetScale).
> - WebSockets (`socket.io`) require a persistent server; on serverless, standard REST API polling is used.

### `vercel.json` Configuration:
A `vercel.json` file is configured at the root of your project:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    },
    {
      "src": "frontend/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server.js"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/$1"
    }
  ]
}
```

---

## 🔑 Default Login Credentials

Once your deployment is live, you can log in with:

- **Student Account**:
  - **Email**: `25bcs084@iiitdmj.ac.in` (or any student email from `DATABASE 25 (3).xlsx`)
  - **Password**: `25bcs084` *(Roll number in lowercase)*

- **Conductor Account**:
  - **Email**: `conductor@iiitdmj.ac.in`
  - **Password**: `124421`

---

## 🛠️ Verification Checklist

- [x] All HTML files located inside `frontend/`
- [x] Express static routing serves `frontend/`
- [x] Prisma Client generated (`npx prisma generate`)
- [x] CORS configured to accept incoming web requests
- [x] Dynamic API base URL resolver implemented in `frontend/state.js`
- [x] Git repository up to date with remote `main` branch
