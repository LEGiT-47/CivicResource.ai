# 🏙️ CivicResource Ai: AI-Powered Urban Resource Optimization

CivicResource Ai is a high-fidelity, full-stack "Digital Twin" platform designed to optimize city resource allocation through predictive intelligence and interactive real-time management.

## 🚀 Key Features

*   **⚡ Predictive Command Center**: Real-time map-based visualization of incidents and resource locations.
*   **📊 Intelligence Hub**: Advanced analytics and forecasting driven by a custom Node.js/MongoDB AI engine.
*   **📡 Citizen Reporting**: Seamless incident submission flow with automatic priority triage.
*   **🚛 Driver HUD**: Dedicated unit-task assignment interface for field operations.
*   **🔐 HUD Security**: Enterprise-grade JWT authentication and protected route architecture.
*   **🧠 Demand Prediction Engine**: Zone demand is predicted using a blended ensemble model (Random Forest + Gradient Boosting) with weather, complaint history, event factor, and population density inputs.
*   **🎯 Smart Allocation Suggestions**: AI now generates resource-to-zone recommendations using urgency-ranked demand and travel-distance-aware assignment.
*   **🔄 Real-Time Optimization Loop**: Intelligence Matrix runs live AI pulse analysis and continuously refreshes demand/allocation insights.

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Framer Motion, Recharts, Lucide Icons |
| **Backend** | Node.js, Express, MongoDB (Mongoose), JSON Web Token (JWT), Bcrypt |
| **State/API** | React Query (TanStack), Axios with HTTP Interceptors |
| **AI Engine** | FastAPI, scikit-learn (DBSCAN, RandomForestRegressor, GradientBoostingRegressor), NumPy, spaCy |

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

### AI Optimization Flow
- Data Input System: incidents are aggregated into geo-zones with derived features (complaints, weather proxy, event factor, population density).
- Demand Prediction Engine: ensemble forecasting ranks zones by urgency and predicts recommended units.
- Smart Allocation: available resources are matched to urgent zones using a distance-aware greedy optimizer.
- Interactive Dashboard Output: Intelligence Matrix and Strategic views consume these outputs (`demandForecast`, `allocationPlan`, `allocationSummary`, `strategicAdvice`) for actionable UI.

### New AI/Backend Endpoints Used
- `POST /analyze/demand-forecast` (AI engine): urgency-ranked demand forecast.
- `POST /analyze/resource-allocation` (AI engine): resource-to-zone optimized recommendations.
- `POST /api/dispatch/ai-analyze` (backend): combined clusters, heatmap, demand, and allocation payload for frontend.
