@echo off
rem Iceberg Control Tower launcher (Windows) - double-click me.
cd /d "%~dp0"
echo Starting Iceberg Control Tower... dashboard: http://localhost:9500
start "" http://localhost:9500
where py >nul 2>nul
if %errorlevel%==0 (
  py controller.py %*
) else (
  python controller.py %*
)
echo.
echo Controller exited. If there is an error above, fix apps.json or install Python 3.
pause
