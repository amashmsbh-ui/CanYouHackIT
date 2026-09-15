// Initialize before page-specific DOMContentLoaded handlers run.
window.apiFetch = async (url, options = {}) => {
    const apiBase = window.location.protocol === 'file:' ? '' : '';
    const apiUrl = url.startsWith('http') ? url : `${apiBase}${url.startsWith('/') ? url : `/${url}`}`;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${localStorage.getItem('transit_token') || ''}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const res = await fetch(apiUrl, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('transit_token');
        localStorage.removeItem('transit_user');
        window.location.href = 'index.html';
    }
    return res;
};

document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
    const isPublicPage = currentPath === 'index.html' || currentPath === 'forgot-password.html';
    const token = localStorage.getItem('transit_token');
    const userStr = localStorage.getItem('transit_user');
    let user = userStr ? JSON.parse(userStr) : null;

    if (!token && !isPublicPage && currentPath !== 'reset-password.html') {
        window.location.href = 'index.html';
        return;
    }

    if (token && user) {
        if (user.mustChangePassword && currentPath !== 'reset-password.html' && currentPath !== 'index.html') {
            window.location.href = 'reset-password.html';
            return;
        }

        window.transitUser = user; // Export user globally for other scripts

        // Populate user info if elements exist
        const userNameElements = document.querySelectorAll('.user-name-display');
        const userEmailElements = document.querySelectorAll('.user-email-display');
        const userRoleElements = document.querySelectorAll('.user-role-display');
        const userRollElements = document.querySelectorAll('.user-roll-display');

        userNameElements.forEach(el => el.textContent = user.name);
        userEmailElements.forEach(el => el.textContent = user.email);
        userRoleElements.forEach(el => el.textContent = user.role.toUpperCase());
        userRollElements.forEach(el => {
            if(user.rollNumber) el.textContent = `Roll ${user.rollNumber}`;
        });

        // Setup Socket.io
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () => {
            window.socket = io();
            window.socket.on('connect', () => {
                window.socket.emit('authenticate', token);
            });

            // Handle New Notifications
            window.socket.on('notification.new', (data) => {
                console.log('New notification:', data);
                if (typeof loadNotifications === 'function') {
                    loadNotifications();
                } else {
                    // Update unread count indicator if we are not on the notifications page
                    const notifBadge = document.getElementById('notification-badge');
                    if (notifBadge) {
                        notifBadge.style.display = 'block';
                    }
                }
                
                // Also update trips/tickets since a new notification implies a booking change
                if (typeof loadDashboard === 'function') loadDashboard();
                if (typeof loadMyTickets === 'function') loadMyTickets();
            });

            // Handle Trip Capacity Updates
            window.socket.on('trip.capacity.updated', (data) => {
                if (typeof loadDashboard === 'function') loadDashboard();
            });

            // Handle Ticket Boarding (Conductor scanned ticket)
            window.socket.on('ticket.boarded', (data) => {
                if (typeof loadMyTickets === 'function') loadMyTickets();
                if (typeof loadDashboard === 'function') loadDashboard();
            });
            
            // Handle global updates
            window.socket.on('trip.passengers.updated', (data) => {
                // Handled in conductor pages, but good to have a generic hook
            });
        };
        document.head.appendChild(script);

        // Fetch active tickets count
        fetch('/api/bookings/my-tickets', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()).then(data => {
            const activeTickets = (data || []).filter(t => t.status === 'ACTIVE' || t.status === 'BOARDED');
            const activeTicketBadge = document.getElementById('active-ticket-badge');
            // If the element doesn't have an ID, we might need to select by class, but let's try to find it
            const headerBtn = document.querySelector('header button[onclick="window.location.href=\'tickets.html\'"]');
            if (headerBtn) {
                const textSpan = headerBtn.querySelector('span.text-status-mint-glow.font-semibold') || headerBtn.querySelector('span.text-label-mono');
                if (textSpan) {
                    textSpan.textContent = `Active Ticket (${activeTickets.length})`;
                }
                headerBtn.style.display = activeTickets.length > 0 ? 'flex' : 'none';
            }
        }).catch(err => console.error('Error fetching tickets:', err));
    }

    // Logout handling
    const logoutBtn = document.getElementById('logout-btn') || document.querySelector('[onclick*="logout"]');
    if (logoutBtn) {
        // If it's inline onclick, we might just let it be, but let's override
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('transit_token');
            localStorage.removeItem('transit_user');
            window.location.href = 'index.html';
        });
    }

});
