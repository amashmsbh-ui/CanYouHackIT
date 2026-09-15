# CanYouHackIT Backend API

Python Flask-based REST API for the college bus management system.

## Quick Start

### 1. Install Dependencies

```bash
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install packages
pip install -r requirements.txt
```

### 2. Run the Server

```bash
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

## API Endpoints

### Health Check
- **GET** `/api/health` - Check if API is running

### Buses
- **GET** `/api/buses` - Get all buses with seat availability
- **GET** `/api/buses/<bus_id>` - Get specific bus details

### Bookings
- **POST** `/api/book` - Book a seat on a bus
  ```json
  {
    "bus_id": "1",
    "student_id": "2022CS104"
  }
  ```
- **GET** `/api/bookings/<student_id>` - Get student's bookings
- **DELETE** `/api/bookings/<ticket_id>` - Cancel a booking

### Students
- **GET** `/api/students/<student_id>` - Get student profile
- **GET** `/api/students/<student_id>/balance` - Get wallet balance
- **POST** `/api/students/<student_id>/recharge` - Recharge wallet
  ```json
  {
    "amount": 500
  }
  ```

### Authentication
- **POST** `/api/auth/login` - Login
  ```json
  {
    "roll_number": "2022CS104",
    "password": "password"
  }
  ```
- **POST** `/api/auth/register` - Register new student
  ```json
  {
    "roll_number": "2022CS105",
    "name": "John Doe",
    "email": "john@iiitdmj.ac.in",
    "phone": "9876543210"
  }
  ```

### Conductor
- **POST** `/api/conductor/verify` - Verify ticket validity
  ```json
  {
    "ticket_id": "ticket_0001"
  }
  ```

## Demo Data

The API comes with demo data:
- **3 Buses** (active with schedules)
- **1 Student** (Roll: 2022CS104, Name: Aryan Sharma)

## Testing with Curl

```bash
# Check API health
curl http://localhost:5000/api/health

# Get all buses
curl http://localhost:5000/api/buses

# Get specific bus
curl http://localhost:5000/api/buses/1

# Get student profile
curl http://localhost:5000/api/students/2022CS104

# Book a seat
curl -X POST http://localhost:5000/api/book \
  -H "Content-Type: application/json" \
  -d '{"bus_id": "1", "student_id": "2022CS104"}'
```

## Testing with Postman

1. Download [Postman](https://www.postman.com/downloads/)
2. Import the endpoints listed above
3. Test each endpoint with the provided JSON bodies

## Next Steps

1. **Connect Frontend**: Update HTML pages to call these endpoints
2. **Add Database**: Replace in-memory storage with SQLite/PostgreSQL
3. **Authentication**: Implement proper JWT tokens
4. **Error Handling**: Add validation and error messages

## Troubleshooting

**Port 5000 already in use?**
```bash
# Use a different port
python app.py --port 5001
```

**CORS errors?**
- The API already has CORS enabled for all origins
- Check browser console for specific error messages

**Database not loading?**
- The API uses demo data if Excel file is not found
- Ensure `DATABASE 25.xlsx` is in the `database/` folder

## Architecture

```
backend/
├── app.py              # Main Flask app & all endpoints
├── requirements.txt    # Python dependencies
└── README.md          # This file

Data is currently stored in-memory. For production:
- Use SQLAlchemy ORM
- Add proper database (PostgreSQL recommended)
- Implement user authentication with JWT tokens
```

## Contributing

1. Test endpoints before committing
2. Add new features in separate functions
3. Keep error messages clear and helpful
4. Document new endpoints in this README

---

**Created for CanYouHackIT - College Bus Management System**
