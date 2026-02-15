# I. Chosen Software Architecture Style  

The system follows a **Hybrid Architecture** that combines:

1. Monolithic Modular Architecture  
2. Event-Driven Architecture  

---

# Part 1: Monolithic Modular Architecture

## Definition

Monolithic Modular Architecture is a design style in which:

- The entire system is deployed as a single application.
- The system is internally divided into logically independent modules.
- Each module performs a specific business function.
- Modules share a common codebase and typically a shared database.
- Communication between modules happens through internal method calls.

---

## Granularity of Software Components

Granularity refers to the size and responsibility scope of software components.

In this system:

- The architecture uses **medium-grained modules**.
- Each module encapsulates a complete functional responsibility.
- Modules are logically separated but not independently deployable.
- All modules operate within a single deployment unit.

---

## Application Modules

### 1. Use Management Module
   - User registration
   - Login and logout
   - Authentication and authorization
   - Role management
   - **Granularity**: Medium-grained (handles complete user lifecycle functionality)

### 2. Monitoring Module
   - Collection of CPU, memory, and disk metrics
   - Storage of performance data
   -  **Granularity**: Medium-grained (handles full monitoring responsibility)

### 3. Alert Management Module
   - Definition of threshold values
   - Evaluation of metrics
   - Generation of alerts
   - **Granularity**: Medium-grained (handles abnormal condition detection and alert lifecycle)

### 4. Notification Module
   - Sending email/SMS notifications
   - Integration with messaging services
   - Maintenance of notification history
   -  **Granularity**: Medium-grained (handles communication workflow)

### 5.Dashboard Module
   - Display of real-time metrics
   - Graphical visualization
   - System health monitoring
   -  **Granularity**: Presentation-level module responsible for user interaction

### 6. Logging Module
   - Storage of system logs
   - Maintenance of audit records
   - Recording alert history
   - **Granularity** : Cross-cutting module supporting traceability and monitoring

---

## Justification

The system qualifies as Monolithic Modular Architecture because:

- It is deployed as a single unit.
- Modules share the same runtime environment.
- Modules are logically separated.
- Internal communication occurs through direct function calls.
- Independent deployment of modules is not required.


