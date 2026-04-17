@echo off
echo ========================================================
echo Stopping Sonia Platform Services...
echo ========================================================
echo.

echo 1. Closing service windows...
taskkill /F /FI "WINDOWTITLE eq Sonia - *" /T >nul 2>&1
echo.

echo 2. Ensuring all development ports are freed...
call npx --yes kill-port 8000 8081 5174 5175
echo.

echo ========================================================
echo All background services and windows have been stopped!
echo ========================================================
pause
