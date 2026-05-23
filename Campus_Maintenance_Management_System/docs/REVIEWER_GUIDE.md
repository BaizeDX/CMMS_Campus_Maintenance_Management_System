# Reviewer Guide

This guide is a quick walkthrough for lecturers, teammates, or recruiters who want to validate the main project flows without exploring the codebase first.

## 1. Start the system

From the project root:

```bash
npm start
```

Or initialize/reset manually first:

```bash
python3 scripts/init_db.py --force --seed
cd backend && python3 api.py
cd frontend && npm run dev
```

## 2. Sign in with a seeded demo account

Use one of the built-in demo users:

- `admin / admin123`
- `manager / manager123`
- `executive / executive123`
- `worker / worker123`

The `admin` account is a system administrator login for platform-level access. It is intentionally separate from the operational `Staff` hierarchy used by managers, executives, and workers.

## 3. Review the major requirement-facing flows

### Dashboard

- Confirms the system can read staff, requests, equipment, and maintenance logs
- Recent Logs should appear newest-first
- Overdue equipment should count each equipment item only once

### Cleaning Search

- Open Data Console -> Activity Search
- Search a date range that includes `2024-11-22`
- This view is intentionally focused on scheduled cleaning activities rather than all activities
- Review:
  - affected building/area
  - whether the area is still usable
  - impact level / notes
  - harmful chemical usage

### Table Manager

- Sign in as `admin` or `manager`
- Open Data Console -> Table Manager
- Browse core tables such as Staff, Building, Activity, Equipment, and Maintenance Request
- CRUD operations should be blocked for lower-privilege users

### SQL Runner

- Sign in as `admin`
- Open Data Console -> SQL Runner
- Read-only queries are allowed by default
- Unsafe SQL requires both:
  - administrator role
  - backend opt-in via `CMMS_ALLOW_UNSAFE_SQL=1`

### Reports

- Sign in as `executive` or `admin`
- Open Data Console -> Reports
- Review backend-driven summaries such as:
  - staff summary
  - building utilization
  - request priority distribution
  - overdue equipment by type
  - workforce allocation

## 4. Expected demo/auth behavior

- Unauthenticated requests should fail cleanly
- Executive and worker users are read-only
- Manager and administrator users can perform write operations
- The backend is the source of truth for authorization, not the frontend UI alone

## 5. Useful validation commands

Run smoke tests:

```bash
npm test
```

Rebuild the frontend:

```bash
cd frontend && npm run build
```
