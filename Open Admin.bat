@echo off
cd /d "%~dp0"
echo Starting Lane Legends admin server at http://localhost:8080/admin/
echo Press Ctrl+C to stop.
start "" "http://localhost:8080/admin/"
python -m http.server 8080
