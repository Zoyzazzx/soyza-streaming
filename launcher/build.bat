@echo off
echo ============================================
echo   SOYZA Streaming Launcher - Build Script
echo ============================================
echo.

:: Check Python is available
where py >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python (py) not found on PATH.
    pause
    exit /b 1
)

:: Install PyInstaller if needed
echo [1/3] Checking PyInstaller...
py -m pip install pyinstaller --quiet
if %errorlevel% neq 0 (
    echo ERROR: Failed to install PyInstaller.
    pause
    exit /b 1
)
echo       OK

:: Build the exe
echo [2/3] Building launcher.exe with PyInstaller...
py -m PyInstaller ^
    --onefile ^
    --windowed ^
    --name "SOYZA Launcher" ^
    --distpath "%~dp0dist" ^
    --workpath "%~dp0build" ^
    --specpath "%~dp0build" ^
    "%~dp0launcher.py"

if %errorlevel% neq 0 (
    echo ERROR: PyInstaller build failed. See output above.
    pause
    exit /b 1
)
echo       OK

echo [3/3] Done!
echo.
echo ============================================
echo   Output: %~dp0dist\SOYZA Launcher.exe
echo ============================================
echo.
echo You can move "SOYZA Launcher.exe" anywhere inside
echo the soyza-streaming folder and it will work.
echo.
pause
