/**
 * CanYouHackIT - State Management
 * Centralized state for current session and user data
 */

class AppState {
  constructor() {
    this.currentStudent = this.loadStudent();
    this.trips = [];
    this.bookings = [];
    this.selectedBus = null;
  }

  // Load student from localStorage
  loadStudent() {
    const stored = localStorage.getItem('currentStudent');
    return stored ? JSON.parse(stored) : null;
  }

  // Save student to state and localStorage
  setCurrentStudent(student) {
    this.currentStudent = student;
    if (student) {
      localStorage.setItem('currentStudent', JSON.stringify(student));
    } else {
      localStorage.removeItem('currentStudent');
    }
  }

  // Check if user is logged in
  isLoggedIn() {
    return this.currentStudent !== null;
  }

  // Get current student data
  getStudent() {
    return this.currentStudent;
  }

  // Clear all state (logout)
  clear() {
    this.currentStudent = null;
    this.trips = [];
    this.bookings = [];
    this.selectedBus = null;
    localStorage.removeItem('currentStudent');
  }

  // Update trips
  setTrips(trips) {
    this.trips = trips;
  }

  getTrips() {
    return this.trips;
  }

  // Update bookings
  setBookings(bookings) {
    this.bookings = bookings;
  }

  getBookings() {
    return this.bookings;
  }

  // Set selected bus
  setSelectedBus(bus) {
    this.selectedBus = bus;
  }

  getSelectedBus() {
    return this.selectedBus;
  }
}

// Global state instance
const appState = new AppState();

// Enhanced API fetch wrapper with better error handling
async function apiFetch(endpoint, options = {}) {
  const API_BASE_URL = 'http://localhost:5000/api';
  
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    ...options
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, defaultOptions);
    
    if (!response.ok) {
      if (response.status === 401) {
        // Unauthorized - redirect to login
        appState.clear();
        window.location.href = 'login.html';
        throw new Error('Session expired. Please login again.');
      }
      
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

// Utility: Format currency
function formatCurrency(amount) {
  return `₹${parseFloat(amount).toFixed(2)}`;
}

// Utility: Format time (HH:MM)
function formatTime(timeString) {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// Utility: Check if user is logged in, redirect if not
function requireLogin() {
  if (!appState.isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Utility: Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded-lg text-sm font-semibold shadow-lg z-50 ${
    type === 'success' ? 'bg-status-mint-glow text-tertiary' :
    type === 'error' ? 'bg-error text-on-error' :
    'bg-secondary text-on-secondary'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Initialize page - run on page load
function initializePage() {
  // Update user info in header if logged in
  if (appState.isLoggedIn()) {
    const student = appState.getStudent();
    const nameEl = document.querySelector('.user-name-display');
    const rollEl = document.querySelector('.user-roll-display');
    
    if (nameEl) nameEl.textContent = student.name;
    if (rollEl) rollEl.textContent = `Roll ${student.roll_number}`;
  }
  
  // Check API health
  apiFetch('/health')
    .then(() => console.log('✓ Backend API is online'))
    .catch(() => {
      console.warn('⚠ Backend API is offline');
      showToast('⚠ Cannot connect to backend. Check if server is running.', 'error');
    });
}

// Run on DOM load
document.addEventListener('DOMContentLoaded', initializePage);

// Namespace for API calls
window.apiFetch = apiFetch;
