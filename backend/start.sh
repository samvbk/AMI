#!/bin/bash
echo "Starting Family Healthcare Assistant..."
echo ""

echo "Step 1: Starting MySQL..."
sudo systemctl start mysql 2>/dev/null || brew services start mysql 2>/dev/null || echo "MySQL already running"
echo ""

echo "Step 2: Checking database..."
mysql -u "${DB_USER:-root}" -p"${DB_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS healthcare; USE healthcare; SHOW TABLES;" 2>/dev/null
echo ""

echo "Step 3: Starting Backend Server..."
cd backend
python app.py &
BACKEND_PID=$!
echo "Backend starting on http://localhost:8000 (PID: $BACKEND_PID)"
cd ..
echo ""

echo "Step 4: Starting Frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
echo "Frontend starting on http://localhost:5173 (PID: $FRONTEND_PID)"
cd ..
echo ""

echo "All services started!"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for user to press Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Services stopped'; exit" INT
wait
