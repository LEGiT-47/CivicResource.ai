# CivicResource.ai

CivicResource.ai is an AI-assisted civic operations platform that connects complaint intake, dispatch intelligence, and field execution in one operational flow.

It combines:

1. A web command system for admins and dispatch teams.
2. A worker operational HUD for route execution and status updates.
3. A mobile app for citizen reporting and field use cases.
4. A Python AI engine for triage, demand forecasting, and allocation support.

## Problem It Solves

City response teams often work with delayed updates, fragmented tools, and no shared real-time field context. This platform unifies the lifecycle:

1. Complaint is reported.
2. Incident is triaged and validated.
3. Dispatch allocates the right responder.
4. Worker route and progress are tracked live.
5. Resolution and learning feedback update future decisions.

## Major Capabilities

### Complaint Intake and Trust

1. Multilingual complaint intake with normalization support.
2. AI-assisted complaint triage and civic relevance checks.
3. Trust score and verification mode assignment.
4. Duplicate/fusion clustering for repeated reports.
5. Public tracking via phone or tracking ID.

### AI and Optimization

1. Demand forecasting and zone urgency scoring.
2. Crisis mode templates (normal, flood, festival, strike, heatwave).
3. Explainable allocation suggestions with scoring factors.
4. Freshness-aware demand weighting so new incidents are prioritized.
5. Open-data training pipeline using civic datasets.

### Dispatch and Operations

1. Live dispatch panel with dynamic apply-plan flow.
2. Smart fallback recommendations when AI plan is temporarily empty.
3. Assignment history preserved after resolution.
4. Worker-specific assignment feeds.
5. Operator copilot command endpoint for quick decision support.

### Live Worker Journey Simulation

1. Scripted route lifecycle: accept, en-route, on-site, resolving, return.
2. Shared tracking telemetry (path, events, current location) stored on incidents.
3. Same tracking path rendered on worker and admin strategic maps.
4. Countdown ETA in mm:ss format with seconds-level updates.
5. Outbound ETA starts with a planned value between 11 and 20 minutes by default.
6. If worker marks resolved early, simulation fast-forwards to completion and releases unit.

## Tech Stack

### Client (Web)

1. React 18
2. TypeScript
3. Vite
4. Tailwind CSS
5. Framer Motion
6. React Leaflet

### Server

1. Node.js
2. Express
3. MongoDB + Mongoose
4. JWT authentication

### AI Engine

1. FastAPI
2. scikit-learn-based triage and demand services

### Mobile App

1. Expo
2. React Native
3. TypeScript

## Repository Layout

1. client: web UI and operational dashboards
2. server: API routes, business logic, simulation scripts, seeders
3. ai-engine: AI services, training scripts, and model assets
4. mobile-app: mobile workflows for citizen and field usage
5. prd.md: product requirements and system goals

## Local Setup

### Prerequisites

1. Node.js 18+
2. Python 3.10+
3. MongoDB

### Install Dependencies

1. In server: npm install
2. In client: npm install
3. In mobile-app: npm install
4. In ai-engine: pip install -r requirements.txt

### Run Services

Use separate terminals:

1. server: npm run dev
2. client: npm run dev
3. ai-engine: uvicorn main:app --reload --port 8000
4. mobile-app (optional): npm run start

### Seed Demo Data

1. In server: npm run seed
2. Seed includes admin/operator/worker accounts, personnel, incidents, and resources.

## Demo Flow (Judge Friendly)

1. Log in as admin and create a fresh complaint.
2. Assign responder from dispatch.
3. Confirm incident is assigned but not yet moving.
4. Log in as worker and click Initialize Route.
5. Show mm:ss ETA countdown and moving unit on worker HUD.
6. Show the same unit path and phase on admin strategic map.
7. Mark incident resolved from worker view to trigger fast completion.
8. Confirm dispatch status completed and responder returned to available.

## API Highlights

1. POST /api/incidents: create incident
2. PUT /api/incidents/:id/status: status transitions and resolution handling
3. POST /api/dispatch/assign: manual responder assignment
4. POST /api/dispatch/apply-plan-live: dynamic live dispatch application
5. POST /api/dispatch/start-journey-simulation: worker route simulation start
6. GET /api/dispatch/my-assignments: worker live assignments
7. GET /api/dispatch/personnel?all=true: admin personnel view with live incident tracking

## Notes

1. For demo consistency, reseed before major presentations.
2. Use two browser sessions: one admin, one worker.
3. The worker and admin maps now consume shared tracking telemetry for route sync.

## License

Internal project and competition usage unless specified otherwise.
