# 🚀 CanYouHackIT - Quick Start Guide

Your backend API and frontend client are now ready! Follow these steps to get your app running.

## ✅ What's Already Created

- ✅ **Backend API** (`backend/app.py`) - Python Flask server with all endpoints
- ✅ **Frontend Client** (`frontend/js/api.js`) - JavaScript to connect frontend to backend
- ✅ **Dependencies** (`backend/requirements.txt`) - All Python packages needed

---

## 🏃 Quick Start (5 minutes)

### Step 1: Install Python Dependencies

```bash
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install packages
pip install -r requirements.txt
```

### Step 2: Start the Backend Server

```bash
# Make sure you're still in the backend folder
# and venv is activated

python app.py
```

You should see:
```
============================================================
🚀 CanYouHackIT Backend API Starting...
============================================================
📊 Buses loaded: 3
👥 Students loaded: 1
🎫 Bookings: 0

📍 API running at: http://localhost:5000
📖 Health check: http://localhost:5000/api/health
============================================================
```

### Step 3: Open Frontend in Browser

**Option A: Simple HTML (Easiest)**
```bash
# In a new terminal, go to frontend folder
cd frontend

# Serve it locally
python -m http.server 8000
# or on Windows:
python -m http.server 8000 --bind 127.0.0.1
```

Then open: **http://localhost:8000/1st.html**

**Option B: Direct Open**
- Just double-click `frontend/1st.html` to open in browser
- ⚠️ Note: This might have CORS issues. Use Option A for best results.

---

## 🧪 Test the API

### Using Browser Console

Open your browser's developer tools (F12) and paste:

```javascript
// Check if API is running
api.checkHealth()
  .then(res => console.log('✓ API Online:', res))
  .catch(err => console.log('✗ API Offline:', err));

// Get all buses
api.getAllBuses()
  .then(res => console.log('Buses:', res.data));

// Get student info
api.getStudent('2022CS104')
  .then(res => console.log('Student:', res.data));
```

### Using cURL (Command Line)

```bash
# Check health
curl http://localhost:5000/api/health

# Get all buses
curl http://localhost:5000/api/buses

# Get student profile
curl http://localhost:5000/api/students/2022CS104

# Book a bus
curl -X POST http://localhost:5000/api/book \
  -H "Content-Type: application/json" \
  -d '{"bus_id": "1", "student_id": "2022CS104"}'
```

---

## 📖 API Demo Data

### Student Account (Ready to Test)
- **Roll Number**: 2022CS104
- **Name**: Aryan Sharma
- **Email**: aryan.sharma@iiitdmj.ac.in
- **Balance**: ₹500.00

### Available Buses
1. **Bus 01** - Institute to Sadar (Seats: 26 available) - ₹20
2. **Bus 02** - Institute to Railway Station (Seats: 31 available) - ₹25
3. **Bus 03** - Sadar to Campus (Seats: 22 available) - ₹20

---

## 🔧 Integration Checklist

To use the API in your HTML pages, add this to your HTML files:

```html
<!-- At the end of your HTML, before </body> -->
<script src="js/api.js"></script>
```

Then use these functions in your page:

### Load Buses
```javascript
<div id="buses-container"></div>

<script>
  loadBuses('buses-container');
</script>
```

### Book a Bus
```html
<button onclick="bookBusSeat('1')">Book Bus 01</button>
```

### Show Student Bookings
```javascript
<div id="bookings-container"></div>

<script>
  loadStudentBookings('bookings-container');
</script>
```

### Show Student Profile
```javascript
<div id="profile-container"></div>

<script>
  displayProfile('profile-container');
</script>
```

---

## 🆘 Troubleshooting

### "API is not running" error
- Make sure you ran `python app.py` in the backend folder
- Check if port 5000 is available
- Activate the virtual environment: `source venv/bin/activate` (Mac/Linux) or `venv\Scripts\activate` (Windows)

### CORS errors
- The API already has CORS enabled
- Make sure you're accessing from `http://localhost:8000` (not `file://`)

### Port 5000 already in use
```bash
# Use a different port
python app.py --port 5001
# Then update API_BASE_URL in frontend/js/api.js to http://localhost:5001/api
```

### Virtual environment not working
```bash
# Delete old venv and create new one
rm -rf venv  # or: rmdir /s venv (Windows)
python -m venv venv
source venv/bin/activate  # or: venv\Scripts\activate (Windows)
pip install -r requirements.txt
```

---

## 📚 Full API Documentation

See **`backend/README.md`** for complete API endpoint reference.

---

## 🎯 Next Steps

1. **DONE** ✅ Backend API created and running
2. **DONE** ✅ Frontend client ready
3. **TODO** - Integrate API calls into more HTML pages
4. **TODO** - Add database (currently using in-memory demo data)
5. **TODO** - Deploy to cloud (Heroku, Railway, etc.)

---

## 💡 Quick Tips

- **Test first**: Use the browser console to test API calls
- **Keep terminal open**: Keep the backend running in a terminal
- **Save progress**: Commit your work to Git regularly
- **Check logs**: Look at the terminal where `python app.py` runs for errors

---

**Need help?** Check the `backend/README.md` file or the API client functions in `frontend/js/api.js` 🚀
