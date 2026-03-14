# Software Architecture Style

Software architecture styles define the overall structure of a software system by providing a blueprint for how components interact.

---

# I. Chosen Software Architecture Style

The system follows a **Hybrid Architecture combining:**

- Modular Monolithic Architecture  
- Event-Driven Architecture  

Software architecture defines the overall structure of a system and how its components interact.

---

## A. Justification Based on Granularity of Software Components

### PART 1: Modular Monolithic Architecture

#### Definition

- The system is deployed as a single application.  
- All modules share the same runtime and codebase.  
- Modules are logically separated based on responsibilities.  
- Communication occurs through internal method calls.  

---

### Granularity of Software Components

Granularity refers to the size and responsibility scope of components.

In this system:

- Medium-grained component granularity is used.  
- Each module encapsulates a complete business capability.  
- Modules are logically independent but not independently deployable.  
- All modules operate within a single deployment unit.  

---

### Application Modules

#### 1. Use Management Module
   - User registration
   - Login and logout
   - Authentication and authorization
   - Role management

**Granularity**: Medium-grained (handles complete user lifecycle functionality)

#### 2. Monitoring Module
   - Collection of CPU, memory, and disk metrics
   - Storage of performance data

**Granularity**: Medium-grained (handles full monitoring responsibility)

#### 3. Alert Management Module
   - Definition of threshold values
   - Evaluation of metrics
   - Generation of alerts

**Granularity**: Medium-grained (handles abnormal condition detection and alert lifecycle)

#### 4. Notification Module
   - Sending email/SMS notifications
   - Integration with messaging services
   - Maintenance of notification history

**Granularity**: Medium-grained (handles communication workflow)

#### 5.Dashboard Module
   - Display of real-time metrics
   - Graphical visualization
   - System health monitoring

**Granularity**: Presentation-level module responsible for user interaction

#### 6. Logging Module
   - Storage of system logs
   - Maintenance of audit records
   - Recording alert history

**Granularity** : Cross-cutting module supporting traceability and monitoring

---

### Justification for Modular Monolith

The system satisfies Modular Monolithic Architecture because:

- The system is deployed as a single unit.  
- Modules share the same runtime environment.  
- Logical separation ensures maintainability.  
- Internal communication occurs via direct method calls.  
- Independent deployment of modules is not required for project scope.  

---

## PART 2: Event-Driven Architecture

### Definition

- Components communicate by generating and responding to events.  
- An event represents a significant state change.  
- Producers and consumers are loosely coupled.  
- Processing can be asynchronous.  

---

### Event Mechanism in the System

Events used in the system include:

- Metric Collected Event  
- Threshold Exceeded Event  
- Alert Generated Event  
- Notification Sent Event  

---

### Typical Event Flow

Monitoring Module  
→ Generates Metric Event  

Threshold Evaluation  
→ Generates Alert Event  

Alert Module  
→ Processes Event  

Notification Module  
→ Sends Notification  

---

### Justification for Event-Driven Architecture

The system satisfies Event-Driven Architecture because:

- Modules communicate through events.  
- Direct dependency between modules is reduced.  
- Components respond asynchronously.  
- Loose coupling improves flexibility and reliability.  

---

## B. Justification for Architecture Choice

### 1. Scalability
- Suitable for small to medium-scale systems.  
- Event-based processing supports workload separation.  
- Modular design allows future architectural evolution.  

### 2. Maintainability
- Clear separation of responsibilities.  
- Reduced inter-module dependency.  
- Easier debugging and testing.  

### 3. Performance
- Internal communication avoids network latency.  
- Event-driven processing enables non-blocking operations.  
- Efficient monitoring and alert handling.  

### 4. Fault Isolation
- Loose coupling reduces cascading failures.  
- Logging ensures traceability and recovery support.  

### 5. Implementation Feasibility
- Single deployment reduces infrastructure complexity.  
- Easier configuration and management.  
- Suitable for controlled academic development environments.  

---

## Conclusion

The system integrates:

- Modular Monolithic Architecture for structured internal organization.  
- Event-Driven Architecture for asynchronous communication and loose coupling.  

This hybrid approach ensures scalability, maintainability, performance efficiency, and practical feasibility for the project requirements.

---

# II. Application Components Present in the Project

## 1. Authentication Component

Responsible for securing system access.

### Key Functions:
- User login and logout  
- Credential validation (username/password verification)  
- Secure access control to protected resources  

This component ensures that only authorized users can access the system.

---

## 2. User Management Component

Responsible for managing user accounts and profiles.

### Key Functions:
- User registration  
- Profile creation and updates  
- Role management (Admin/User)  
- Storage of user-related information  

This component supports structured user administration and access control.

---

## 3. Dashboard Component

Provides the visual interface for system interaction.

### Key Functions:
- Displaying real-time system metrics and system health  
- Showing active and historical alerts  
- Visualizing monitoring data  

This component acts as the presentation layer of the system.

---

## 4. Metric Collection Component

Responsible for continuous system monitoring.

### Key Functions:
- Collecting CPU, memory, and disk usage metrics  
- Recording timestamped metric values  
- Storing performance data in the database  
- Ensuring continuous monitoring  

This component forms the foundation of system performance analysis.

---

## 5. Threshold Management Component

Responsible for evaluating system performance limits.

### Key Functions:
- Defining upper and lower threshold values  
- Comparing metrics against thresholds  
- Detecting threshold violations  
- Triggering alert events  

This component determines whether the system operates within acceptable limits.

---

## 6. Alert Management Component

Responsible for managing alert lifecycle.

### Key Functions:
- Creating alerts when thresholds are exceeded  
- Storing alert details  
- Maintaining alert status (active/resolved)  
- Tracking alert history  

This component records and manages abnormal system conditions.

---

## 7. Notification Component

Responsible for informing users about alerts.

### Key Functions:
- Sending email or system notifications  
- Delivering notifications in real-time  
- Maintaining notification history  

This component ensures timely communication of system issues.

---
