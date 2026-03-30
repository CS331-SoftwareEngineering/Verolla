# Business Logic Layer

## I. Core Functional Modules in Business Logic Layer

Based on the implementation in `server.js`, the following are the core functional modules in the Business Logic Layer (BLL):

---

### 1. Authentication & Identity Management Module

**Validation Logic**
- Enforces business rules for account creation
- `validatePassword()` ensures password complexity
- `validateDOB()` ensures user is at least 13 years old

**Session & Access Control**
- Verifies credentials during login
- Prevents duplicate usernames and emails

**Profile Management**
- Handles updating user data via `/api/update-profile`

**Interaction with UI**
- UI forms send input -> API endpoints -> BLL validates -> response returned

---

### 2. Continuous System Monitoring Module

**Data Aggregation**
- Background engine runs every 3 seconds
- Collects system data using:
  - `os.cpus()`
  - `os.totalmem()`

**Metrics Calculation**
- Computes CPU usage using tick differences over time
- Calculates memory utilization percentage

**Interaction with UI**
- Dashboard fetches metrics -> BLL processes -> UI displays charts

---

### 3. Threshold Evaluation & Alerting Module

**Rule Engine**
- Evaluates metrics against thresholds:
  - Memory > 90%
  - CPU > 85%

**Sustained State Tracking**
- Tracks if CPU remains above threshold continuously
- Requires condition to persist for 60 seconds

**Incident Generation**
- Creates incident objects with:
  - Severity
  - Timestamp
  - Unique ID

**Action Triggering**
- Executes actions like `triggerRegisteredMailAlert()`

**Interaction with UI**
- Alerts fetched -> BLL processes -> UI displays alerts

---

### 4. Notification & State Management Module

**Centralized State**
- Maintains:
  - `activeIncidents`
  - `notificationLog`

**User Awareness Tracking**
- Tracks unread notifications (`unreadNotifications`)
- Supports marking notifications as read

**Interaction with UI**
- Notification panel -> API -> BLL -> structured response

---

### Overall Interaction Flow
```
UI (Frontend)
     |
API Requests
     |
Business Logic Layer
     |
Data Layer (JSON / DB)
     |
Processed Response -> UI
```

---

## II-A. Business Rules Implementation

### 1. User Authentication & Identity Management Rules

**Age Restriction Rule**
- Implemented using `validateDOB()`
- Calculates age from date of birth
- Rule: User must be >= 13 years and <= 120 years

**Password Complexity Rule**
- Implemented using `validatePassword()`
- Rules:
  - Minimum 6 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number

**Username Constraint Rule**
- Implemented using `validateUsername()`
- Regex: `/^[a-zA-Z0-9_]{3,20}$/`
- Rule:
  - 3-20 characters
  - Only alphanumeric + underscore

**Uniqueness Rule**
- Implemented using `users.find()`
- Rule:
  - Email and username must be unique
  - Duplicate entries rejected with HTTP 400

**Login Resolution Rule**
- User can login using email or username
- Input normalized to lowercase before matching

---

### 2. Continuous Monitoring Module Rules

**Memory Threshold Rule**
- If memory usage > 90%
- Active alert count is incremented

**CPU Sustained Threshold Rule**
- CPU must exceed 85%
- Must remain above threshold for 60 seconds continuously
- If it drops below, tracking resets

**Suppression & Throttling Rule**
- Uses `alertSent` flag
- Prevents duplicate alerts
- Resets when system returns to normal

---

### 3. Data Privacy Rule

**Safe Data Exposure**
- Implemented in `/api/users` endpoint
- Uses:
```javascript
const safeUsers = users.map(({ password, ...user }) => user);
```

- Rule: Passwords are never exposed to UI

---

## II-B. Validation Logic

### 1. Format & Syntax Validation (Regex)

**Email Validation**
- Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Ensures proper email structure

**Phone Validation**
- Regex: `/^[\d\s\-+()]{10,15}$/`
- Allows valid phone characters and length

**Username Validation**
- Regex: `/^[a-zA-Z0-9_]{3,20}$/`
- Restricts invalid characters

---

### 2. Complex Business Rule Validation

**Password Strength**
- Checks:
  - Uppercase
  - Lowercase
  - Number
  - Minimum length
- Returns specific error messages

**Age Verification**
- Parses DOB using `Date()`
- Ensures valid age range

---

### 3. Data Integrity & Consistency Validation

- Required fields checked in API endpoints
- Rejects incomplete requests (HTTP 400)
- Password must match confirm password
- Prevents duplicate users using `.find()`

---

### 4. Data Sanitization (Normalization)

Trims whitespace:
```javascript
fullName.trim()
org.trim()
```

Converts to lowercase:
```javascript
email.toLowerCase()
username.toLowerCase()
```

---

## II-C. Data Transformation

### 1. JSON Parsing & Serialization

Transformation In - reads data using:
```javascript
JSON.parse(data)
```

Transformation Out - writes data using:
```javascript
JSON.stringify(users, null, 2)
```

---

### 2. Aggregation & Composition (`/api/metrics`)

Combines:
- CPU usage
- Memory usage
- Active incidents

Computes:
```javascript
activeIncidents.filter(a => a.status === 'Active').length
```

Limits dataset:
```javascript
recentAlerts: activeIncidents.slice(0, 4)
```

---

### 3. Data Enrichment (`/api/notifications`)

Converts timestamps into readable values:
```javascript
hoursAgo = (now - n.timestamp) / (1000 * 60 * 60)
```

---

### 4. Security Redaction (`/api/users`)

Removes sensitive fields:
```javascript
const safeUsers = users.map(({ password, ...user }) => user);
```

---

## Conclusion

The Business Logic Layer:

- Implements strict business rules
- Performs comprehensive validation
- Processes monitoring data and alerts
- Transforms and secures data before sending to UI

It acts as the core mediator between the presentation layer and data layer, ensuring correct, secure, and efficient system behavior.
