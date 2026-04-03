# 🏙️ CivicResource Ai: AI-Powered Urban Resource Optimization

CivicResource Ai is a high-fidelity, full-stack "Digital Twin" platform designed to optimize city resource allocation through predictive intelligence and interactive real-time management.

## 🚀 Key Features

*   **⚡ Predictive Command Center**: Real-time map-based visualization of incidents and resource locations.
*   **📊 Intelligence Hub**: Advanced analytics and forecasting driven by a custom Node.js/MongoDB AI engine.
*   **📡 Citizen Reporting**: Seamless incident submission flow with automatic priority triage.
*   **🚛 Driver HUD**: Dedicated unit-task assignment interface for field operations.
*   **🔐 HUD Security**: Enterprise-grade JWT authentication and protected route architecture.

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Framer Motion, Recharts, Lucide Icons |
| **Backend** | Node.js, Express, MongoDB (Mongoose), JSON Web Token (JWT), Bcrypt |
| **State/API** | React Query (TanStack), Axios with HTTP Interceptors |

---

## 🏁 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or via Atlas)

### 2. Installation
Clone the repository and install dependencies for both the client and server:

```bash
# Root directory
npm install

# Client
cd client && npm install

# Server
cd server && npm install
```

### 3. Environment Configuration
Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/CivicResource Ai
JWT_SECRET=your_super_secret_key_here
```

### 4. Database Seeding
Populate the database with initial operational data (Resources, Incidents, Analytics):
```bash
cd server
npm run seed
```

### 5. Running the Application
Open two terminal windows:

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## 🏗️ Architecture Overview

CivicResource Ai uses a **Decoupled Private Backend** architecture:
- The frontend resides in `/client`.
- The backend resides in `/server`.
- All dashboard routes (`/app/*`) are guarded by a `ProtectedRoute` component that validates sessions against the server.
