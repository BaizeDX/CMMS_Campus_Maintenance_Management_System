# Project Structure

This file provides a quick reference to the cleaned repository layout used for public publication.

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
│   │   ├── CleaningSearch.tsx
│   │   ├── Dashboard.tsx
│   │   ├── DataConsole.tsx
│   │   ├── ReportsPanel.tsx
│   │   ├── Sidebar.tsx
│   │   ├── SqlTerminal.tsx
│   │   └── TableQuery.tsx
│   ├── src/api_utils.ts
│   ├── src/roles.ts
│   ├── src/types.ts
│   ├── .env.example
│   ├── App.tsx
│   ├── index.html
│   ├── index.tsx
│   ├── package-lock.json
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── scripts/
│   ├── init_db.py
│   ├── seed_realistic_data.py
│   ├── start.bat
│   ├── start.js
│   └── start.sh
├── tests/
│   └── test_smoke.py
├── .env.example
├── .gitignore
├── package.json
├── PROJECT_STRUCTURE.md
└── README.md
```

## Notes

- `database/schema.sql` is the single source of truth for schema creation.
- `scripts/init_db.py` is the recommended way to create or recreate the local SQLite database.
- `scripts/seed_realistic_data.py` loads demo data for reviewers.
- `tests/test_smoke.py` provides lightweight clone-and-run confidence checks.
- `docs/REVIEWER_GUIDE.md` gives a task-based walkthrough for coursework reviewers and portfolio visitors.
- Generated files such as `cmms_database.db`, `logs/`, `frontend/dist/`, and `frontend/node_modules/` are intentionally excluded from version control.
- The frontend file layout is preserved close to the original coursework submission to keep the project recognizable.
