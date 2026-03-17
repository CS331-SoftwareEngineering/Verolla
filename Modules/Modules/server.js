const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static HTML files

// Default route - serve login page
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Initialize users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

// Helper functions
function readUsers() {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePhone(phone) {
    const phoneRegex = /^[\d\s\-+()]{10,15}$/;
    return phoneRegex.test(phone);
}

function validatePassword(password) {
    // At least 6 characters, 1 uppercase, 1 lowercase, 1 number
    const minLength = password.length >= 6;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    return {
        valid: minLength && hasUppercase && hasLowercase && hasNumber,
        errors: {
            minLength: !minLength ? 'Password must be at least 6 characters' : null,
            hasUppercase: !hasUppercase ? 'Password must contain at least one uppercase letter' : null,
            hasLowercase: !hasLowercase ? 'Password must contain at least one lowercase letter' : null,
            hasNumber: !hasNumber ? 'Password must contain at least one number' : null
        }
    };
}

function validateUsername(username) {
    // 3-20 characters, alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
}

function validateDOB(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    return age >= 13 && age <= 120; // Must be at least 13 years old
}

// SIGNUP endpoint
app.post('/api/signup', (req, res) => {
    const { fullName, username, org, email, phone, dob, password, confirmPassword } = req.body;

    // Required field validation
    if (!fullName || !username || !org || !email || !phone || !dob || !password || !confirmPassword) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Full name validation
    if (fullName.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Full name must be at least 2 characters' });
    }

    // Username validation
    if (!validateUsername(username)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' 
        });
    }

    // Email validation
    if (!validateEmail(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    // Phone validation
    if (!validatePhone(phone)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid phone number' });
    }

    // DOB validation
    if (!validateDOB(dob)) {
        return res.status(400).json({ success: false, message: 'You must be at least 13 years old to sign up' });
    }

    // Password validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        const errorMessages = Object.values(passwordValidation.errors).filter(e => e !== null);
        return res.status(400).json({ success: false, message: errorMessages[0] });
    }

    // Password match validation
    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    // Check if user already exists
    const users = readUsers();
    const existingUser = users.find(u => u.email === email || u.username === username);
    if (existingUser) {
        if (existingUser.email === email) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }
        return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    // Create new user
    const newUser = {
        id: Date.now(),
        fullName: fullName.trim(),
        username: username.toLowerCase(),
        org: org.trim(),
        email: email.toLowerCase(),
        phone,
        dob,
        password, // In production, hash this with bcrypt
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeUsers(users);

    res.status(201).json({ 
        success: true, 
        message: 'Account created successfully!',
        user: { id: newUser.id, username: newUser.username, email: newUser.email }
    });
});

// LOGIN endpoint
app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;

    // Required field validation
    if (!identifier || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Password length check
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Find user by username OR email
    const users = readUsers();
    const identifierLower = identifier.toLowerCase();
    const user = users.find(u => 
        u.username.toLowerCase() === identifierLower || 
        u.email.toLowerCase() === identifierLower
    );

    if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Check password
    if (user.password !== password) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    res.json({ 
        success: true, 
        message: 'Login successful!',
        user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName }
    });
});

// FORGOT PASSWORD endpoint
app.post('/api/forgot-password', (req, res) => {
    const { identifier } = req.body;

    if (!identifier) {
        return res.status(400).json({ success: false, message: 'Please enter username or email' });
    }

    const users = readUsers();
    const identifierLower = identifier.toLowerCase();
    const user = users.find(u => 
        u.username.toLowerCase() === identifierLower || 
        u.email.toLowerCase() === identifierLower
    );

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // In production, send actual email here
    res.json({ 
        success: true, 
        message: 'Email sent'
    });
});

// Get all users (for testing/admin purposes)
app.get('/api/users', (req, res) => {
    const users = readUsers();
    // Return users without passwords
    const safeUsers = users.map(({ password, ...user }) => user);
    res.json({ success: true, users: safeUsers });
});

// UPDATE PROFILE endpoint
app.post('/api/update-profile', (req, res) => {
    const { userId, username, email, password } = req.body;

    if (!userId || !username || !email) {
        return res.status(400).json({ success: false, message: 'Username and email are required' });
    }

    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check for duplicate username/email (excluding current user)
    const duplicate = users.find(u => u.id !== userId && (u.username === username.toLowerCase() || u.email === email.toLowerCase()));
    if (duplicate) {
        return res.status(400).json({ success: false, message: 'Username or email already taken' });
    }

    users[userIndex].username = username.toLowerCase();
    users[userIndex].email = email.toLowerCase();
    if (password && password.length >= 6) {
        users[userIndex].password = password;
    }
    writeUsers(users);

    res.json({ success: true, message: 'Profile updated successfully' });
});

// ============================================
// CONTINUOUS MONITORING ENGINE (Background Task)
// ============================================
let previousCpus = os.cpus();
let currentCPU = 0;
let currentMem = 0;
let activeAlerts = 0;

// Centralized State for Alerts and Notifications
let activeIncidents = []; // Stores real incidents when thresholds breach
let notificationLog = []; // Stores real triggered notifications
let unreadNotifications = 0; // Tracks unread notifications for the bell icon

// Tracking for sustained 1-minute threshold
let cpuHighSince = null; // Timestamp of when CPU first crossed 85%
let alertSent = false;

// Run the engine every 3 seconds, even if no user has the dashboard open
setInterval(() => {
    // 1. Calculate CPU
    const currentCpus = os.cpus();
    let totalIdleDiff = 0, totalTickDiff = 0;
    currentCpus.forEach((core, i) => {
        let prev = previousCpus[i].times, curr = core.times;
        let pTotal = 0, cTotal = 0;
        for (let t in curr) { cTotal += curr[t]; pTotal += prev[t]; }
        totalIdleDiff += (curr.idle - prev.idle);
        totalTickDiff += (cTotal - pTotal);
    });
    previousCpus = currentCpus;
    currentCPU = totalTickDiff === 0 ? 0 : Math.round(100 - (100 * totalIdleDiff / totalTickDiff));

    // 2. Calculate Memory
    const totalMem = os.totalmem();
    currentMem = Math.round(((totalMem - os.freemem()) / totalMem) * 100);

    // 3. Threshold Evaluation Logic (Sustained 1-Minute Alert)
    activeAlerts = 0;
    if (currentMem > 90) activeAlerts++;
    
    if (currentCPU > 85) {
        if (cpuHighSince === null) {
            cpuHighSince = Date.now(); // Start the timer
            console.log(`[WARNING] CPU spiked to ${currentCPU}%. Starting 1-min timer...`);
        } else {
            const timeAboveThresholdMs = Date.now() - cpuHighSince;
            // Has it been running hot for more than 60 seconds (60000 ms)?
            if (timeAboveThresholdMs >= 60000) {
                if (!alertSent) {
                    // Create an actual incident
                    const incidentId = 'INC-' + Math.floor(1000 + Math.random() * 9000);
                    activeIncidents.unshift({
                        id: incidentId,
                        service: 'CPU',
                        threshold: '>85% for 60s',
                        severity: 'high',
                        status: 'Active',
                        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                    });
                    unreadNotifications++;

                    triggerRegisteredMailAlert(currentCPU, Math.round(timeAboveThresholdMs/1000));
                    alertSent = true;
                }
            }
        }
    } else {
        if (cpuHighSince !== null) {
            console.log(`[RECOVERY] CPU dropped back to normal level: ${currentCPU}%`);
            // Optionally, auto-resolve incidents here if you wanted to
        }
        cpuHighSince = null; // Reset the timer
        alertSent = false;   // Reset so we can email again if it spikes later
    }
}, 3000);

function triggerRegisteredMailAlert(cpuVal, durationSec) {
    const users = readUsers();
    console.log('\n======================================================');
    console.log(`🚨 CRITICAL SYSTEM ALERT TRIGGERED 🚨`);
    console.log(`CPU has been critically high (>85%) for ${durationSec} continuous seconds!!`);
    users.forEach(u => {
        // Here you would plug in 'nodemailer' or an SMTP library to actually send the email.
        console.log(`-> Sending WARNING EMAIL to registered user: ${u.email}...`);
    });
    console.log('======================================================\n');

    // Add to Notification Log to show on the presentation layer
    const now = new Date();
    notificationLog.unshift({
        time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        service: 'CPU',
        alert: `Sustained Critical Load (>85% for ${durationSec}s)`,
        severity: 'high',
        status: 'Sent',
        channel: 'Email',
        timestamp: now.getTime()
    });
    if (notificationLog.length > 50) notificationLog.pop(); // Keep array small
}

// ============================================
// METRICS ENDPOINT (For the Dashboard UI)
// ============================================
app.get('/api/metrics', (req, res) => {
    // Instead of calculating here, we just return the live data our Monitoring Engine already created
    res.json({
        success: true,
        cpuUsage: currentCPU,
        memUsage: currentMem,
        diskUsage: Math.floor(Math.random() * 10) + 40,
        activeServices: 5,
        activeAlerts: activeIncidents.filter(a => a.status === 'Active').length,
        netInbound: Math.floor(Math.random() * 200) + 300,
        netOutbound: Math.floor(Math.random() * 100) + 200,
        unreadCount: unreadNotifications,
        recentAlerts: activeIncidents.slice(0, 4) // Send the 4 most recent for the dashboard table
    });
});

// ============================================
// ALERTS & NOTIFICATIONS ENDPOINTS
// ============================================
app.get('/api/alerts', (req, res) => res.json({ success: true, alerts: activeIncidents }));

// No longer manually created, they are generated by the engine! But we keep POST if needed.
app.post('/api/alerts/:id/resolve', (req, res) => {
    const inc = activeIncidents.find(a => a.id === req.params.id);
    if(inc) inc.status = 'Resolved';
    res.json({ success: true });
});

app.delete('/api/alerts/:id', (req, res) => {
    activeIncidents = activeIncidents.filter(a => a.id !== req.params.id);
    res.json({ success: true });
});

app.get('/api/notifications', (req, res) => {
    const now = Date.now();
    const formatted = notificationLog.map(n => ({
        ...n,
        hoursAgo: (now - n.timestamp) / (1000 * 60 * 60)
    }));
    res.json({ success: true, notifications: formatted });
});

app.get('/api/notifications/read', (req, res) => {
    unreadNotifications = 0; // Clears the bell icon count
    res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Login page: http://localhost:${PORT}/login.html`);
    console.log(`Signup page: http://localhost:${PORT}/signup.html`);
});
