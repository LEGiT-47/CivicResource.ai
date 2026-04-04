# CivicResource.ai

AI-assisted civic operations platform for complaint intake, dispatch orchestration, and field execution.

It combines three connected surfaces:

1. Web control system for admin and operations teams.
2. Mobile app for citizens and field workers.
3. AI engine for demand analysis and optimization suggestions.

## What This Project Solves

City operations teams usually work with fragmented tools and delayed communication loops. CivicResource.ai creates one operational flow:

1. Citizen raises issue.
2. Admin triages and dispatches the right worker type.
3. Worker executes in field with a tactical HUD.
4. System tracks lifecycle from unassigned to resolved.

## Core Features

### Citizen Experience

1. Complaint filing with multilingual input support.
2. Tracking by phone or tracking ID.
3. Offline queue and auto-sync when network is back.

### Admin Experience (Web)

1. Live command center with map and feeds.
2. Dispatch system with type-safe worker assignment.
3. Incident archive and operational analytics.

### Worker Experience (Web + Mobile)

1. Assignment-focused operational HUD.
2. Workflow actions: initialize route, resolve incident.
3. Tactical map with coordinates, route polyline, and nearby risk markers (web HUD).
4. Mobile assignment loading from logged-in account, with optional Unit ID fallback.

## Tech Stack

### Web Client

1. React 18 + Vite + TypeScript
2. Tailwind CSS + Framer Motion
3. React Leaflet for maps

### Backend

1. Node.js + Express
2. MongoDB + Mongoose
3. JWT auth + bcrypt password hashing

### Mobile App

1. Expo + React Native + TypeScript
2. AsyncStorage, NetInfo, local notifications

### AI Engine

1. FastAPI (Python)
2. Forecasting and allocation endpoints consumed by web dashboard

## Repository Structure

1. client: Web application
2. server: REST API, auth, incident/dispatch logic, seeding
3. mobile-app: Citizen + worker mobile app
4. ai-engine: Python AI services
5. prd.md: Product requirements and vision

## Quick Start

### Prerequisites

1. Node.js 18+
2. Python 3.10+
3. MongoDB (Atlas or local)
4. Android Studio (for mobile emulator)

### Install

1. Install web dependencies in client.
2. Install backend dependencies in server.
3. Install mobile dependencies in mobile-app.
4. Install Python dependencies in ai-engine.

### Configure

1. Set server environment values in server/.env.
2. Set mobile environment values in mobile-app/.env.
3. Ensure API and AI URLs are reachable from emulator/device.

### Seed Data

Run seeding from server to create users, personnel, incidents, resources, and analytics.

Important seeded users include:

1. admin@civicflow.ai
2. operator@civicflow.ai
3. worker1@civicflow.ai through worker10@civicflow.ai

## Run Locally

Run these services in parallel:

1. server: backend API
2. ai-engine: Python AI service
3. client: web app
4. mobile-app: Expo app (optional if demoing mobile)

## End-to-End Flow

1. Citizen submits complaint.
2. Complaint appears in admin dispatch queue.
3. Admin assigns compatible worker type.
4. Worker sees assignment and starts execution.
5. Worker resolves incident.
6. Admin views updated status and history.

## Security and Access

1. Protected web routes require valid token.
2. Role-based behavior for admin/operator/responder.
3. Worker assignment endpoint is scoped to logged-in worker account.

## Demo Notes (Hackathon Friendly)

1. Keep seeded data fresh by running server seed before demo.
2. Use one browser session for admin and another for worker.
3. Demonstrate full lifecycle with one incident from creation to closure.
4. Show tactical map during worker step for field situational awareness.

## Documentation for Team

For deeper onboarding and architecture details, read TEAMMATE_GUIDE.md at project root.

## License

Internal project / competition submission usage unless otherwise specified.
