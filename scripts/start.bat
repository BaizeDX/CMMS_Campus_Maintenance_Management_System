@echo off
cd /d "%~dp0\.."

echo Starting CMMS System...

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

python --version >nul 2>&1
if errorlevel 1 (
    python3 --version >nul 2>&1
    if errorlevel 1 (
        echo Python not found. Please install Python 3.8+
        pause
        exit /b 1
    )
    set PYTHON_CMD=python3
    set PIP_CMD=pip3
) else (
    set PYTHON_CMD=python
    set PIP_CMD=pip
)

%PYTHON_CMD% -c "import flask, flask_cors" >nul 2>&1
if errorlevel 1 (
    echo Installing backend dependencies...
    %PIP_CMD% install -r backend\requirements.txt
)

if not exist "cmms_database.db" (
    echo Initializing database...
    %PYTHON_CMD% scripts\init_db.py --seed
)

if not exist "logs" mkdir logs

echo Starting backend server...
start "CMMS Backend" cmd /k "cd backend && %PYTHON_CMD% api.py"

timeout /t 2 /nobreak >nul

echo Starting frontend server...
start "CMMS Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ==========================================
echo CMMS System is running!
echo Backend: http://localhost:5001
echo Frontend: http://localhost:8080
echo.
echo Close the command windows to stop servers
echo ==========================================
pause
