@echo off
echo ========================================================
echo Starting Sonia Platform Services...
echo ========================================================
echo.
echo Cleaning up ports from previous sessions...
call npx --yes kill-port 8000 8081 5174 5175
echo.

echo Starting Django Backend...
start "Sonia - Backend" cmd /k "cd backend && python manage.py runserver 0.0.0.0:8000"

echo Starting Expo App (Frontend)...
start "Sonia - Expo App" cmd /k "cd sonia && npm start"

echo Starting Vapi Webview (Voice UI)...
start "Sonia - Vapi Web" cmd /k "cd sonia\vapi-web && npm run dev"

:: echo Starting Admin Panel...
:: start "Sonia - Admin Panel" cmd /k "cd admin && npm run dev"

echo.
echo All services have been launched in separate windows!
echo Keep those windows open while developing.
pause