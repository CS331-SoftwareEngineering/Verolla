# Business Logic Layer

## I. Core Functional Modules in Business Logic Layer

Based on the implementation in `server.js`, the following are the core Business Logic Layer (BLL) modules of the system:

### 1. Authentication & Identity Management Module
- Validates user credentials during signup and login
- Enforces rules like password strength, username format, and age restriction
- Prevents duplicate usernames and emails
- Handles profile updates

Interaction with UI:
- UI forms send user data -> API endpoints -> BLL validates -> response returned to UI

### 2. Continuous System Monitoring Module
- Collects system metrics (CPU, memory) at regular intervals (every 3 seconds)
- Calculates actual usage percentages

Interaction with UI:
- Dashboard requests metrics -> BLL processes data -> UI displays charts and stats

### 3. Threshold Evaluation & Alerting Module
- Evaluates metrics against thresholds (CPU, memory)
- Detects sustained anomalies (not just temporary spikes)
- Generates incidents with severity, timestamps, and IDs
- Triggers alert actions (e.g., email notifications)

Interaction with UI:
- Alerts fetched via API -> BLL filters & formats -> UI displays alerts

### 4. Notification & State Management Module
- Maintains active incidents and historical logs
- Tracks unread notifications
- Manages notification states

Interaction with UI:
- UI notification panel -> API -> BLL -> returns processed notifications

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

Business rules define how the system behaves under different conditions.

### 1. Authentication Rules
- User must be at least 13 years old
- Password must contain:
  - Minimum 6 characters
  - At least 1 uppercase, 1 lowercase, 1 number
- Username must be 3-20 characters (alphanumeric + underscore)

### 2. Uniqueness Rules
- Email and username must be unique
- Duplicate entries are rejected

### 3. Monitoring Threshold Rules
- Memory usage > 90% -> Alert
- CPU usage > 85% for 60 seconds -> Incident

### 4. Alert Control Rules
- Alerts are triggered only for sustained conditions
- Duplicate alerts are suppressed using flags

### 5. Data Privacy Rules
- Sensitive data (like passwords) is never sent to UI
- Data is filtered before exposure

---

## II-B. Validation Logic

Validation ensures data correctness before processing.

### 1. Format Validation (Regex)
- Email -> valid email format
- Phone -> valid numeric format
- Username -> restricted characters

### 2. Business Rule Validation
- Password strength enforced
- Age verified using date of birth

### 3. Data Integrity Validation
- Required fields must be present
- Password and confirm password must match
- Duplicate users are prevented

### 4. Data Sanitization
- Trimming whitespace
- Converting email/username to lowercase

---

## II-C. Data Transformation

Data is transformed to make it suitable for the UI.

### 1. JSON Parsing & Serialization
- Data read using `JSON.parse()`
- Data stored using `JSON.stringify()`

### 2. Aggregation for Dashboard
- Combines CPU, memory, and alerts into a single response
- Calculates active alerts count

### 3. Data Filtering
- Only recent alerts are sent to UI
- Large datasets are trimmed

### 4. Data Enrichment
- Converts timestamps into human-readable values (e.g., hours ago)

### 5. Security Transformation
- Removes sensitive fields (like passwords) before sending data

---

## Conclusion

The Business Logic Layer in this project:
- Enforces business rules
- Validates incoming data
- Processes and monitors system metrics
- Transforms and secures data before sending it to the UI

It acts as the core layer connecting the UI and data layer, ensuring correct and secure system behavior.
