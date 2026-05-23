# Campus Maintenance and Management System (CMMS)

Cleaned portfolio version of a COMP2411 Database Systems coursework project focused on campus maintenance, cleaning operations, maintenance requests, equipment tracking, and reporting.

This repository keeps the original project logic and demo-oriented structure largely intact while improving the parts that matter for public publication:

* reproducible setup
* safer GitHub publishing
* cleaner repository layout
* clearer database initialization flow
* better documentation for reviewers

## Project Overview

The Campus Maintenance and Management System (CMMS) is a full-stack coursework project that demonstrates how a campus operations database can support:

* staff and facility record management
* maintenance request tracking
* activity scheduling across buildings and campus areas
* equipment maintenance logs
* chemical usage tracking for cleaning activities
* reporting and dashboard summaries
* CRUD, search, and query workflows through a web interface

The system uses a Flask backend, a React + Vite frontend, and SQLite for the database.

## Features

* Dashboard for high-level operational metrics
* Table Manager for browsing and editing core database tables
* SQL Runner for direct query execution
* Cleaning and activity search for location/date-based operational lookup
* Reporting panel with workforce and facility summaries
* Session-based login with role-aware UI and lightweight backend authorization
* Sample data seeding for demo and review
* Lightweight demo accounts for reviewer testing

## Tech Stack

* Frontend: React 19, TypeScript, Vite
* Backend: Python, Flask, Flask-CORS
* Database: SQLite
* Tooling: npm, Python scripts

## Repository Structure

```text
Campus-Maintenance-Management-System-CMMS/
├── backend/
│   ├── api.py
│   └── requirements.txt
├── database/
│   └── schema.sql
├── docs/
│   └── REVIEWER_GUIDE.md
├── frontend/
│   ├── src/components/
│   ├── src/api_utils.ts
│   ├── src/roles.ts
│   ├── src/types.ts
│   ├── App.tsx
│   ├── index.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   ├── init_db.py
│   ├── seed_realistic_data.py
│   ├── start.js
│   ├── start.sh
│   └── start.bat
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── PROJECT_STRUCTURE.md
└── README.md
```

## Prerequisites

* Node.js 18+ with npm
* Python 3.9+
* SQLite 3.x

## Quick Start

### Option 1: One-command start

From the project root:

```bash
npm start
```

On Windows, use:

```bash
npm run start:win
```

What this does:

1. installs frontend dependencies if missing
2. installs backend Python dependencies if missing
3. creates `cmms_database.db` from `database/schema.sql` if missing
4. seeds demo data into the database
5. seeds demo login accounts for each role
6. starts the Flask API on `http://localhost:5001`
7. starts the Vite frontend on `http://localhost:8080`

### Option 2: Manual setup

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

Install backend dependencies:

```bash
python3 -m pip install -r backend/requirements.txt
```

Initialize the database with sample data:

```bash
python3 scripts/init_db.py --seed
```

Start the backend from the project root:

```bash
python3 backend/api.py
```

In a second terminal, start the frontend:

```bash
cd frontend
npm run dev
```

If you pull schema or authentication changes, or encounter missing-table errors, reset the local database and reseed it with:

```bash
python3 scripts/init_db.py --force --seed
```

## Database Setup

The initialization flow is:

1. `database/schema.sql`
2. `scripts/init_db.py`
3. `scripts/seed_realistic_data.py` for sample/demo data
4. run backend and frontend

### Create a fresh database

```bash
python3 scripts/init_db.py --seed
```

### Reset and recreate the database

```bash
python3 scripts/init_db.py --force --seed
```

This reset is recommended after pulling schema changes.

### Seed an existing database manually

```bash
python3 scripts/seed_realistic_data.py --db ./cmms_database.db
```

## Authentication

The public GitHub version uses a lightweight Flask session-based login flow instead of relying on frontend role switching alone.

* Passwords are stored as hashes using Werkzeug helpers
* Session cookies are configured with `HttpOnly` and `SameSite=Lax`
* Session cookies are intentionally non-permanent
* This is still a demo-oriented auth system, not a production identity platform
* Backend authorization is derived from the authenticated session user

Role model in this public version:

* The `admin` account is a system administrator / DBA-style login and is not automatically part of the operational `Staff` hierarchy
* Executive officers are business-facing report consumers, not system administrators
* Mid-level managers and base-level workers remain the operational staff roles used throughout campus workflows

Session behavior note:

* Login state is stored in the browser session cookie
* Stopping the backend does not automatically log the user out if the browser still has the same session cookie and the backend restarts with the same `SECRET_KEY`
* Use the Logout action to end the session explicitly

Seeded demo accounts:

* `admin / admin123`
* `manager / manager123`
* `executive / executive123`
* `worker / worker123`

## Reviewer Guide

For a task-based walkthrough of the main requirements and UI flows, see:

* `docs/REVIEWER_GUIDE.md`

## Environment Configuration

Runtime configuration is optional. Example files are included:

* `.env.example`
* `frontend/.env.example`

Backend variables:

* `CMMS_DB_PATH`: path to the SQLite database file
* `PORT`: backend port, default `5001`
* `FLASK_DEBUG`: set to `1` only for local debugging
* `CMMS_ALLOW_UNSAFE_SQL`: set to `1` only if you intentionally want admin-only destructive SQL mode
* `CMMS_MAX_MID_LEVEL_MANAGERS`: optional app-layer limit for staff maintenance, default `4`
* `CMMS_MAX_BASE_LEVEL_WORKERS`: optional app-layer limit for staff maintenance, default `20`

Frontend variable:

* `VITE_API_PROXY_TARGET`: override the Vite `/api` proxy target

## SQL Runner Safety

The SQL Runner remains in the project because it is a useful database-systems demo feature, but the public GitHub version is intentionally safer by default.

* Default mode allows read-only queries only
* Unsafe SQL is blocked unless the logged-in user is an administrator
* Unsafe SQL also requires explicit backend opt-in via `CMMS_ALLOW_UNSAFE_SQL=1`
* The frontend exposes an explicit unsafe-mode toggle rather than silently allowing destructive queries

## Demo Data

The sample data script generates a reviewer-friendly demo dataset including:

* campus buildings and rooms
* staff across multiple role levels
* equipment and maintenance logs
* activities with room, floor, building, common-area, and outdoor-area assignments
* maintenance requests
* chemicals, suppliers, and external companies

This makes the app easier to evaluate without having to manually insert records first.

The cleaned portfolio version also includes:

* seeded demo login users for each role
* a system administrator account that is intentionally not mapped to a `Staff` record
* building managers assigned to mid-level managers only
* cleaning schedules that explicitly describe affected area and whether the area remains usable

## Testing

Run the lightweight smoke tests with:

```bash
npm test
```

The current test layer covers:

* database initialization
* seeded users and triggers
* admin/staff separation in the auth seed data
* authentication-protected endpoints
* login success and failure
* explicit non-permanent session behavior and logout clearing
* safer SQL Runner behavior
* one basic role-based write restriction check
* report-role authorization consistency
* multi-row batch insert behavior
* database path regression behavior
* cleaning search semantics and impact fields

## Known Limitations

* This is a coursework/demo system, not a production-hardened campus platform.
* Authentication is intentionally lightweight and session-based; it is suitable for a demo repo, not a production deployment.
* SQLite is used for simplicity and reproducibility, so this project is not designed for concurrent multi-user deployment.
* The frontend styling still relies on Tailwind via CDN in `index.html`, which is acceptable for a portfolio demo but not ideal for offline or locked-down environments.
* Equipment location is derived from the latest known activity usage rather than a dedicated ownership/location table, so unassigned equipment still appears as `Unassigned`.
* Campus-part modeling is improved beyond pure room-level associations, but it is still lightweight. A fuller production model would likely separate campus parts into dedicated normalized entities rather than storing impact metadata directly on activity-location rows.
* Staff count limits are implemented as lightweight configurable application rules rather than comprehensive organization-policy enforcement.

## GitHub Publishing Notes

Files and folders that should not be committed:

* `.env`
* `cmms_database.db`
* `frontend/node_modules/`
* `frontend/dist/`
* `logs/`
* OS/editor artifacts such as `.DS_Store`

Files that should be committed:

* source code
* `database/schema.sql`
* startup and database scripts
* `README.md`
* `.gitignore`
* example environment files

## Design Reflections

* SQLite was chosen because it keeps the project easy to clone, initialize, and review without requiring external database infrastructure.
* The login/auth layer is intentionally lightweight because the project goal is still database workflow demonstration rather than production identity management. Sessions and password hashes provide a better trust model than frontend-only role switching without overwhelming the original coursework scope.
* The system administrator is modeled as an auth-layer actor rather than an operational staff member, which keeps DBA-style powers separate from the business personnel hierarchy.
* Role control originally started as a UI/demo concept because the coursework emphasized schema, CRUD, and query workflows first. The public version now adds lightweight backend enforcement without turning the project into a full auth stack.
* The SQL Runner exists because direct SQL interaction is an important part of the project’s database-systems value, but the portfolio version defaults to safer read-only behavior.
* The biggest current limitations are lightweight authentication, SQLite’s single-file deployment model, and a domain model that does not yet track permanent equipment ownership/location in a fully normalized way.
* In a future iteration, the next improvements would be stronger auth/session hardening, a clearer campus-part model, richer harmful-chemical reporting over time windows, and a more production-like styling/build pipeline.

## Acknowledgments

This repository is based on a group coursework project completed for COMP2411 Database Systems.

I am grateful to my teammates for their work and collaboration throughout the project, including design discussion, implementation, testing, and presentation preparation. The public version of this repository reflects a cleaned and documented portfolio release, while the original coursework project was a shared team effort.
