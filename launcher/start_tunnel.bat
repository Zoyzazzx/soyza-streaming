@echo off
title Cloudflare Tunnel - MediaMTX HLS Remote Access
cls
echo ==============================================================
echo   SOYZA STREAMING - CLOUDFLARE HLS TUNNEL STARTER
echo ==============================================================
echo.
echo Starting secure HTTPS tunnel for MediaMTX HLS port 8888...
echo.
echo 1. Keep this window OPEN while streaming to remote Netlify viewers.
echo 2. Copy the generated 'https://....trycloudflare.com' URL below.
echo 3. Open Settings in the Dashboard and paste it under 'Cloudflare Tunnel Base URL'.
echo.
echo ==============================================================
echo.

set "CF_PATH=C:\Program Files (x86)\cloudflared\cloudflared.exe"

if exist "%CF_PATH%" (
    "%CF_PATH%" tunnel --url http://localhost:8888
) else (
    where cloudflared >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        cloudflared tunnel --url http://localhost:8888
    ) else (
        echo [ERROR] cloudflared.exe was not found!
        echo Please make sure cloudflared is installed.
        pause
        exit /b 1
    )
)

pause
