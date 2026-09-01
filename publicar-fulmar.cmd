@echo off
setlocal
chcp 65001 >nul

REM ========================================================
REM FUL-MAR · Publicación en Cloudflare Pages
REM Cambiá esta línea SOLO si tu proyecto Pages tiene otro nombre.
set "PAGES_PROJECT=fulmar-instalaciones"
REM ========================================================

cd /d C:\FULMAR\fulmar-wiki
if errorlevel 1 (
  echo.
  echo ERROR: No se encontro C:\FULMAR\fulmar-wiki
  pause
  exit /b 1
)

echo.
echo [1/2] Generando version de produccion...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo ERROR: El build fallo. No se publico nada.
  pause
  exit /b 1
)

echo.
echo [2/2] Publicando en Cloudflare Pages: %PAGES_PROJECT%...
call npx.cmd wrangler pages deploy dist --project-name=%PAGES_PROJECT%
if errorlevel 1 (
  echo.
  echo No se pudo publicar. Si es la primera vez, ejecuta primero:
  echo   npx.cmd wrangler login
  echo.
  echo Tambien verifica que PAGES_PROJECT coincida con el nombre real de tu proyecto.
  pause
  exit /b 1
)

echo.
echo ========================================
echo FUL-MAR publicado correctamente.
echo ========================================
pause
