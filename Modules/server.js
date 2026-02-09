const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Login page: http://localhost:${PORT}/login.html`);
    console.log(`Signup page: http://localhost:${PORT}/signup.html`);
});
