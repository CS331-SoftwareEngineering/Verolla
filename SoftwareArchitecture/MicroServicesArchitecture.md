# I. Chosen Software Architecture Style  
## Microservices Architecture

---

## A. Justification – Why it Falls Under Microservices Architecture (Granularity)

### Definition of Microservices Architecture

Microservices Architecture means:

- The system is divided into small, independent services.
- Each service performs one specific business function.
- Services communicate via APIs (HTTP/REST).

---

### In Our Project

The Continuous Monitoring and Alert Automation System is divided into the following independent services:

#### 1. User Management Service
- Handles user registration
- Manages login and authentication
- Implements authorization and role management

#### 2. Monitoring Service
- Collects system metrics such as:
  - CPU usage
  - Memory usage
  - Disk usage
  - Application status

#### 3. Alert Service
- Checks defined threshold values
- Evaluates incoming metrics
- Triggers alerts when thresholds are exceeded

#### 4. Notification Service
- Sends alerts through:
  - Email
  - SMS
  - Push notifications
- Integrates with external notification providers

#### 5. Dashboard Service
- Displays real-time metrics
- Shows graphical reports and statistics
- Provides system health overview

#### 6. Logging Service
- Stores system logs
- Maintains alert history
- Provides audit tracking

---

### Granularity Explanation

Each service in the system:

- Has its own clearly defined responsibility
- Can maintain its own database (if required)
- Can be developed and deployed independently
- Communicates with other services using REST APIs

Therefore, the system clearly follows the Microservices Architecture style.
