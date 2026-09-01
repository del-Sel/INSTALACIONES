@echo off
chcp 65001 >nul
cd /d C:\FULMAR\fulmar-wiki

echo FUL-MAR · Preparacion de Wrangler
echo.
echo Se abrira el navegador para autorizar Cloudflare.
call npx.cmd wrangler login
if errorlevel 1 (
  echo No se pudo completar el login.
  pause
  exit /b 1
)

echo.
echo Proyectos de Cloudflare Pages disponibles:
call npx.cmd wrangler pages project list

echo.
echo Anota el nombre exacto de tu proyecto y, si no es "fulmar-instalaciones",
echo edita la variable PAGES_PROJECT dentro de publicar-fulmar.cmd.
pause
