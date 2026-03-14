# Verolla  
Continuous Monitoring and Alert Automation System

Verolla is a Software Engineering group project that implements a Continuous Monitoring and Alert Automation System.  
The system monitors performance metrics, detects threshold violations, and generates alerts in real time.

---

## 📌 Project Overview

Verolla is designed to:

- Monitor system metrics (CPU, memory, disk usage, etc.)
- Detect abnormal conditions
- Trigger automated alerts
- Provide user authentication (login/signup module)
- Maintain complete software engineering documentation

The project follows a **Hybrid Architecture**:

- Monolithic Modular Architecture  
- Event-Driven Architecture  

---

## 📂 Repository Structure

```
Verolla/
│
├── Modules/     # Node.js authentication module
│ ├── server.js
│ ├── package.json
│ ├── package-lock.json
│ ├── users.json
│ ├── login.html
│ ├── signup.html
│ └── a3b1cc1f-33d2-4abc-9efb-0f22498584f5.mp4
│
├── docs/      # Software Requirements Specification
│ └── SRS.md
│
├── SoftwareArchitecture/        # Architecture documentation
│ └── SoftwareArchitectureStyle.md
│
├── DFD/       # Data Flow Diagrams
│ ├── L0_DFD.png
│ └── L1_DFD.png
│
├── UML/       # UML Diagrams
│ ├── UMLClassDiagram.png
│ └── UseCaseDiagrams/
│   ├── Admin.png
│   ├── External_Systems.png
│   ├── Notification_Services.png
│   ├── Registered_Users.png
│   ├── Unregistered_Users.png
│   └── UseCases.png
│
├── LICENSE       # MIT License
├── CONTRIBUTING.md        # Contribution Guidelines
│
└── README.md
```


---

## 🛠️ Tech Stack

- Node.js  
- Express.js  
- HTML/CSS  
- JSON (Local storage for demo purposes)

---

## ⚙️ Prerequisites

- Node.js (v18 or above)  
- npm (v9 or above)  

Check versions:

```bash
node -v
npm -v
```

## 🚀 Running the Authentication Module

```bash
cd Modules
npm install
npm start
```

The server will run at:

```
http://localhost:3000
```

## 🔑 API Endpoints

| Method | Endpoint               | Description                          |
|--------|------------------------|--------------------------------------|
| POST   | `/api/signup`          | Register a new user                  |
| POST   | `/api/login`           | Authenticate user                    |
| POST   | `/api/forgot-password` | Password recovery                    |
| GET    | `/api/users`           | Retrieve users (without passwords)   |

---


## 📊 Current Implementation Status

Verolla is currently under active development.

The following components are implemented at this stage:

### ✅ Implemented Features

#### 1. User Authentication Module
- User Registration (multi-step form)
- Login using username or email
- Forgot Password endpoint (basic flow)
- Server-side validation (email, phone, password strength, DOB, username rules)
- Credential storage using JSON-based persistence
- User data management via API

#### 2. Backend API (Express Server)
- REST API endpoints:
  - `POST /api/signup`
  - `POST /api/login`
  - `POST /api/forgot-password`
  - `GET /api/users`
- Express-based server architecture
- CORS enabled
- Static file serving for frontend pages
- Persistent local storage (`users.json`)

#### 3. Frontend Interface
- Modern Login interface
- Multi-step Signup interface
- Client-side validation
- Dynamic user feedback (toast notifications)
- Basic session handling using local storage

#### 4. Software Engineering Artifacts
- Software Requirements Specification (SRS)
- UML Class Diagram
- Use Case Diagrams
- Level 0 and Level 1 DFD
- Architecture Style Documentation
- Hybrid Architecture Justification (Modular Monolith + Event-Driven)

---

## 🚧 Modules in Development

The following major system modules are designed and architected, and will be implemented in upcoming phases:

- Real-Time Metric Collection
- Threshold Management
- Alert Generation Engine
- Alert Lifecycle Management
- Notification Integration (Email/SMS)
- Dashboard for Monitoring and Visualization
- Logging and Audit Module
- Role-Based Access Control
- Database Integration
- Secure Authentication Mechanisms

---

## 📌 Project Status

Verolla currently includes a functional Authentication subsystem along with complete system design documentation.

The Monitoring, Alert Automation, and Notification subsystems are actively being developed as part of the next implementation phase.

---

## 👥 Project Team

This is a group project maintained by:

- [Lasya Eadara](https://github.com/07Lasya)
- [Tejeshwar](https://github.com/tejeshwar20)
- [Rohan](https://github.com/ROHANBOPPANI)

---

## 📄 License

This project is licensed under the MIT License.  
See the `LICENSE` file for details.
