#!/bin/bash

cd "$(dirname "$0")/.."

echo "Starting CMMS System..."

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

if ! python3 -c "import flask, flask_cors" 2>/dev/null; then
    echo "Installing backend dependencies..."
    pip3 install -r backend/requirements.txt
fi

if [ ! -f "cmms_database.db" ]; then
    echo "Initializing database..."
    python3 scripts/init_db.py --seed
fi

mkdir -p logs

echo "Starting backend server..."
cd backend
python3 api.py > ../logs/api.log 2>&1 &
BACKEND_PID=$!
cd ..

sleep 2

echo "Starting frontend server..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "=========================================="
echo "CMMS System is running!"
echo "Backend: http://localhost:5001"
echo "Frontend: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "=========================================="

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
